define(function(require, exports, module) {
"use strict";

var util = require("./util");
var EventEmitter = require("events").EventEmitter;

/**
 * Wraps an engine.io socket. 
 * 
 * The engine.io socket can be replaced onder the hood without affecting the
 * wrapper.
 * 
 * Emits 'away' if the wrapped socket is closed and 'back' if the wrapped socket
 * is set to a new engine.io socket.
 */
var ReconnectSocket = module.exports = function(socket) {
    EventEmitter.call(this);
    
    this.listeners = {
        "close": this.onClose.bind(this),
        "message": this.onMessage.bind(this),
        "drain": this.onDrain.bind(this)
    };
    
    if (socket)
        this.setSocket(socket);
};

util.inherits(ReconnectSocket, EventEmitter);

ReconnectSocket.prototype.setSocket = function(socket) {
    if (!this.socket && !socket || this.socket == socket)
        return;
    
    var that = this;
    
    // cleanup old socket
    if (this.socket) {
        for (var type in this.listeners) {
            this.socket.removeListener(type, this.listeners[type]);
        }
        this.socket.close();
    }
    
    // setup new socket
    if (socket) {
        for (var type in this.listeners) {
            socket.on(type, this.listeners[type]);
        }
    }
    
    this.socket = socket;
    
    if (!this.socket) {
        this.emit("away");
    } 
    else {
        if (socket.readyState == "open") {
            this.emit("back");
        }
        else {
            socket.on("open", function() {
                that.emit("back");
            });
        }
    }
};

ReconnectSocket.prototype.send = function(msg) {
    if (!this.socket || this.socket.readyState !== "open")
        return;

    try { this.socket.send(msg); }
    catch (e) { 
        this.setSocket(null);
        this.emit('error', e); 
    }
};

Object.defineProperty(ReconnectSocket.prototype, "readyState", {
    get : function() { 
        if (!this.socket)
            return "away";
        else if (this.socket.readyState == "open")
            return "open";
        else
            return "reconnecting";
    }
});

ReconnectSocket.prototype.close = function() {
    this.setSocket(null);
};

ReconnectSocket.prototype.onClose = function() {
    this.setSocket(null);
};

ReconnectSocket.prototype.onMessage = function(message) {
    this.emit("message", message);
};

ReconnectSocket.prototype.onDrain = function() {
    this.emit("drain");
};

});