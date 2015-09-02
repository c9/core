define(function(require, exports, module) {
"use strict";

var util = require("./util");
var EventEmitter = require("events").EventEmitter;

/**
 * Makes sure that each messages reaches the receiver. Uses sliding windows
 * and acknowledgements to guarantee that.
 * 
 * @param socket {ReconnectSocket} The transport layer for the reliable socket
 * @param options {Object} Options to specify
 *   object:
 *   seq            {Number} initial sequence number
 *   ackTimeout     {Number} time to wait in ms before auto ack received messages
 *   disconnectTimeout {Number} time to waint in away state before disconnecting
 *                           the connection
 */
var ReliableSocket = module.exports = function(socket, options) {
    EventEmitter.call(this);
    
    this.socket = socket;

    options = options || {};
    this.options = options;
    
    this.initialCongestionWindowSize = 5;
    this.congestionWindowSize = this.initialCongestionWindowSize;
    this.slowStartThreshold = options.slowStartThreshold || 300;
    this.ackTimeout = options.ackTimeout || 200;
    this.disconnectTimeout = options.disconnectTimeout || 10 * 1000;
    this.retransmissionTimeout = 3000;
    this.maxRtt = options.maxRtt || 10000;
    this.minRtt = options.minRtt || 2000;

    this.duplicateCount = 0;
    this.missCount = 0;
    this.connectTs = 0;

    this.debug = options.debug || false;
    this.seq = options.seq || 1;
    this.recId = -1;
    this.connected = false;
    
    // messages sent while not connected
    this.buffer = [];
    
    // sent but not yet acknowledged messages
    this.unacked = {};
    
    socket.on("message", this.onMessage.bind(this));
    socket.on("away", this.onAway.bind(this));
    socket.on("back", this.onBack.bind(this));
    this.on("stats", this.onStats.bind(this));
    this.on("stats_reply", this.onStatsReply.bind(this));
    socket.on("error", function(e){ console.error(e.message); });
    
    // var that = this;
    // setInterval(function() {
    //     console.log(that._getStats());
    // }, 3000);
};

util.inherits(ReliableSocket, EventEmitter);

Object.defineProperty(ReliableSocket.prototype, "readyState", {
    get : function() { 
        return this.socket.readyState;
    }
});

function utf8escape(str) {
    return str.replace(/[\ud799-\uDFFF]/g, function(x) {
        return "\ud799" + String.fromCharCode(x.charCodeAt(0) - 0xd700);
    });
}

function utf8unescape(str) {
    return str.replace(/\ud799./g, function(x) {
        return String.fromCharCode(x.charCodeAt(1) + 0xd700);
    });
}

ReliableSocket.prototype.onMessage = function(msg) {
    if (typeof msg == "string") {
        try {
            msg = JSON.parse(utf8unescape(msg));
        } catch(e) {}
    }
    this.debug && console.log("on message", msg, this.seq);
    
    if (!msg || !msg.ack)
        return;
        
    // remove acknowledged messages from our buffer
    var ack = msg.ack;
    for (var key in this.unacked) {
        var unacked = this.unacked[key];
        if (unacked.seq <= ack)
            unacked.acknowledge();
    }

    if (Object.keys(this.unacked).length < this.congestionWindowSize)
        this._flush();
        
    var recId = msg.seq;
    if (recId) {
        var expectedId = this.recId + 1;
        if (recId == expectedId || this.recId == -1) {
            this.recId = recId;
            this._delayedAck();
        } else if (recId < expectedId) {
            this.debug && console.log("dupe", recId, expectedId);
            // we already saw this packet. Make sure the other side knows it
            this.duplicateCount += 1;
            this._ack();
            return;
        } else {
            this.debug &&  console.log("miss", recId, expectedId);
            // we miss packets in between
            this.missCount += 1;
            this._ack();
            return;
        }
    }
    
    if (msg.t) {
        this.emit(msg.t, msg);
    }
    else if (msg.d) {
        try {
            this.emit("message", msg.d);
        } catch (e) {
            console.error(e.stack);
            // Don't let engine.io catch this, it'll consider it a parser error,
            // making us reconnect
            setTimeout(function() { throw e; });
        }
    }
};

ReliableSocket.prototype.onStats = function(msg) {
    var data = msg.d || {};
    data.remote = this._getStats();
    this.send(data, "stats_reply");
};

ReliableSocket.prototype.onStatsReply = function(msg) {
    var data = msg.d || {};
    data.localEnd = this._getStats();
    var id = data.id;

    if (this.statsCallbacks[id]) {
        this.statsCallbacks[id](null, data);
        delete this.statsCallbacks[id];
    }
};

ReliableSocket.prototype.stats = function(callback) {
    if (!this.statsCallbacks) this.statsCallbacks = {};
    var id = this.seq;
    
    this.statsCallbacks[id] = callback;
    var data = {
        id: id,
        localStart: this._getStats()
    };
    this.send(data, "stats");
};

ReliableSocket.prototype._getStats = function() {
    var wsBuffer = -1;
    try {
        if (this.socket.socket.transport.ws)
            wsBuffer = this.socket.socket.transport.ws.bufferedAmount;
        else if (this.socket.socket.transport.socket)
            wsBuffer = this.socket.socket.transport.socket._socket.bufferSize;
    } catch(e) {}
    
    return {
        livetime: Date.now() - this.connectTs,
        ts: Date.now(),
        retransmissionTimeout: this.retransmissionTimeout,
        congestionWindowSize: this.congestionWindowSize,
        srtt: this.srtt,
        rttVar: this.rttVar,
        duplicateCount: this.duplicateCount,
        missCount: this.missCount,
        buffered: this.buffer.length,
        unacked: Object.keys(this.unacked).length,
        eioBuffer: this.socket.socket.writeBuffer.length,
        wsBuffer: wsBuffer
    };
};

ReliableSocket.prototype.onAway = function() {
    this.debug && console.log("away");
    this._scheduleDisconnect("client connection went away");
    this.emit("away");
};

ReliableSocket.prototype.onBack = function() {
    this.debug && console.log("back");
    this._cancelDisconnect();
    
    this.connectTs = Date.now();
    if (!this.connected) {
        this.connected = true;
        this.emit("connect");
    }
    this.emit("back");
    
    if (this.buffer.length)
        this._flush();
    else
        this._ack();
};

ReliableSocket.prototype._scheduleDisconnect = function(reason) {
    var that = this;
    this._cancelDisconnect();
    this.debug && console.log("schedule disconnect");
    this._disconnectTimer = setTimeout(function() {
        that.disconnect(reason);
    }, this.disconnectTimeout);
};

ReliableSocket.prototype._cancelDisconnect = function() {
    this.debug && console.log("cancel disconnect");
    clearTimeout(this._disconnectTimer);
};

ReliableSocket.prototype._delayedAck = function() {
    var that = this;
    this._cancelDelayedAck();
    this._ackTimer = setTimeout(function() {
        that._ack();
    }, this.ackTimeout);
};

ReliableSocket.prototype._cancelDelayedAck = function() {
    clearTimeout(this._ackTimer);
};

ReliableSocket.prototype._ack = function() {
    if (this.socket.readyState == "open") {
        this.debug && console.log("send ack", this.recId);
        this.socket.send(utf8escape(JSON.stringify({
            ack: this.recId
        })));
    }
};

ReliableSocket.prototype._flush = function() {
    if (this.socket.readyState == "open" && this.buffer.length) {
        var toSend = Math.min(
            this.congestionWindowSize - Object.keys(this.unacked).length,
            this.buffer.length
        );
        
        this.debug && console.log("flush", toSend, "messages");
        for (var i=0; i<toSend; i++) {
            var msg = this.buffer.shift();
            this._sendMessage(msg[0], msg[1]);
        }
        if (!this.buffer.length)
            this.emit("drain");
    }
};

ReliableSocket.prototype.disconnect = function(reason) {
    this.debug && console.log("disconnect");
    this.connected = false;
    this.recId = -1;
    this.duplicateCount = 0;
    this.missCount = 0;

    this.buffer = [];
    for (var key in this.unacked) {
        this.unacked[key].abort();
    }
    this.unacked = {};
    
    this.close();
    this.emit("away");
    
    var err = new Error("EDISCONNECT: " + (reason || "Client disconnected?"));
    err.code = "EDISCONNECT";
    this.emit("disconnect", err);
};

ReliableSocket.prototype.close = function() {
    return this.socket.close();
};

ReliableSocket.prototype.send = function(msg, type) {
    this._cancelDelayedAck();
    if (this.socket.readyState == "open" && Object.keys(this.unacked).length < this.congestionWindowSize) {
        this._sendMessage(msg, type);
        return true;
    }
    else {
        this.debug && console.log("buffer");
        this.buffer.push([msg, type]);
        return false;
    }
};

ReliableSocket.prototype._sendMessage = function(data, type) {
    var that = this;
    
    var msg = {
        seq: ++this.seq,
        ts: Date.now(),
        tries: 0,
        send: function() {
            msg.abort();
            that.unacked[msg.seq] = msg;
            msg.retransmissionTimer = setTimeout(function() {
                msg.tries += 1;
                that.debug && console.log("timeout", msg.seq);
                that._updateRetransmissionTimeout(0);
                that._updateCongestionWindowSize(true);
                
                msg.send();
            }, that.retransmissionTimeout);
            //that.debug && console.log("send", msg.serialize(), that.retransmissionTimeout);
            that.socket.send(msg.serialize());
        },
        abort: function() {
            delete that.unacked[msg.seq];
            clearTimeout(msg.retransmissionTimer);
        },
        acknowledge: function() {
            msg.abort();
            if (msg.tries > 0)
                that.debug && console.log("retry", msg.seq, that.congestionWindowSize, that.retransmissionTimeout);
                
            that._updateCongestionWindowSize(false);
            if (!msg.tries)
                that._updateRetransmissionTimeout(Date.now() - msg.ts);
        },
        serialize: function() {
            return utf8escape(JSON.stringify({
                ack: that.recId,
                seq: msg.seq,
                d: data,
                t: type
            }));
        }  
    };
    
    msg.send();
};

ReliableSocket.prototype._updateCongestionWindowSize = function(timeout) {
    if (timeout) {
        this.slowStartThreshold = Math.max(Math.floor(this.congestionWindowSize / 2), 50);
        this.congestionWindowSize = this.initialCongestionWindowSize;
    }
    else {
        if (this.congestionWindowSize > this.slowStartThreshold)
            this.congestionWindowSize += 1;
        else 
            this.congestionWindowSize *= 2;
    }
};

// use TCP algorithm to compute the retransmission timeout
// http://de.wikipedia.org/wiki/Transmission_Control_Protocol#Retransmission_Timer
ReliableSocket.prototype._updateRetransmissionTimeout = function(rtt) {
    if (!rtt) {
        // there was a timeout
        this.retransmissionTimeout = Math.min(this.retransmissionTimeout * 2, this.maxRtt);
        this.srtt = null;
    }
    else if (!this.srtt) {
        this.srtt = rtt;
        this.rttVar = 0.5 * rtt;
        this.retransmissionTimeout = rtt * this.rttVar;
    }
    else {
        var alpha = 1/8;
        var beta = 1/4;
        this.srtt = (1-alpha) * this.srtt + alpha * rtt;
        this.rttVar = (1-beta) * this.rttVar + beta * (Math.abs(this.srtt - rtt));
        this.retransmissionTimeout = this.srtt + 4 * this.rttVar;
    }
    
    this.retransmissionTimeout = Math.min(Math.max(this.retransmissionTimeout, this.minRtt), this.maxRtt);
};

});