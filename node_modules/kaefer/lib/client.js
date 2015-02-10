define(function(require, exports, module) {

"use strict";

var ReliableSocket = require("./reliable_socket");
var ReconnectSocket = require("./reconnect_socket");
var version = require("./version").protocol;

/**
 * Creates a reliable socket with automatic reconnects
 */
var connectClient = module.exports = function(connectEio, options) {
    var reconnectSocket = new ReconnectSocket();
    options = options || {};
    options.seq = options.seq || 20000;
    
    var socket = new ReliableSocket(reconnectSocket, options);
    socket.on("disconnect", function() {
        socket.id = null;
    });
    
    var connectAttempts = 0;
    var isReconnecting = false;
    var preConnectCheck = options.preConnectCheck || function(cb) { cb(null, true); };

    function connect() {
        if (reconnectSocket.readyState !== "away") {
            // Lets double check that the socket isn't in the process of going away
            setTimeout(function() {
                if (connectAttempts === 0 && reconnectSocket.readyState === "away")
                    connect();
            }, 250);
            return;
        }

        preConnectCheck(function(err, shouldConnect) {
            if (err || !shouldConnect)
                return reconnect();

            reconnectSocket.setSocket(null);

            var eioSocket = connectEio();
            eioSocket.on("open", function() {
                eioSocket.send(JSON.stringify({
                    type: "handshake",
                    session: socket.id,
                    seq: socket.seq,
                    version: version
                }));
            });

            eioSocket.on("message", function handshakeReply(msg) {
                try {
                    msg = JSON.parse(msg);
                } catch (e) {}
                
                if (msg.type !== "handshake reply" || !msg.seq) {
                    socket.close();
                    return reconnect(); // Make sure we never end up in a disconnected state
                }

                // backend has changed!
                if (socket.id && socket.id !== msg.session)
                    socket.disconnect();

                socket.id = msg.session;

                eioSocket.off("message", handshakeReply);
                connectAttempts = 0;
                
                if (socket.recId == -1)
                    socket.recId = msg.seq;
                    
                reconnectSocket.setSocket(eioSocket);
            });

            eioSocket.on("error", function(e) {
                console.error("Socket error; reconnecting:", e);
                eioSocket.close();
                reconnect();
            });
            eioSocket.on("close", function(e) {
                console.error("Socket close; reconnecting:", e);
                reconnect();
            });
        });
    }

    var timer;
    function reconnect(delay) {
        if (isReconnecting && typeof delay !== "number")
            return;
        
        reconnectSocket.setSocket(null);
        connectAttempts += 1;

        if (typeof delay !== "number") {
            if (connectAttempts < 10) {
                delay = 250;
            }
            else {
                delay = Math.min(60000, 250 * Math.pow(2, connectAttempts - 10));
            }
        }

        isReconnecting = true;
        console.log("Schedule re-connect in: " + delay);
        socket.emit("reconnectDelay", { delay: delay });
        
        clearTimeout(timer);
        timer = setTimeout(function() {
            isReconnecting = false;
            connect();
        }, delay);
    }

    socket.connect = connect;
    socket.reconnect = reconnect;
    return socket;
};

});