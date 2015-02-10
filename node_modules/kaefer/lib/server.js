"use strict";

/**
 * server:
 *  - keep pool of connections (by id)
 *  - disconnected connections expire after N seconds
 * 
 * client:
 *  - keeps one persistent connection
 * 
 * initial handshake:
 *  - client receives eio connect event
 *  - client generates connection id and sends it to the server
 *  - server creates a connection and stores it in the connection pool
 * 
 * reconnect handshake:
 *  - client receives eio connect event
 *  - server looks up connection by id
 *  - if server finds connection resume and fire 'back' event on the client
 *  - if server doesn't find connection, reset the connection and start a new one (fire 'connect' event)
 */
 
var util = require("./util");
var EventEmitter = require("events").EventEmitter;

var ReliableSocket = require("./reliable_socket");
var ReconnectSocket = require("./reconnect_socket");
var version = require("./version").protocol;

var Server = module.exports = function(engine, socketOptions) {
    EventEmitter.call(this);
    
    var that = this;
    this.sockets = {};
    this.socketOptions = socketOptions || {};
    this.socketOptions.seq = this.socketOptions.seq || 10000;
    
    engine.on("connection", function(socket) {
        socket.once("message", function handshake(msg) {
            try {
                msg = JSON.parse(msg);
            } catch (e) {}
            
            if (
                !msg ||
                msg.type !== "handshake" ||
                !msg.seq ||
                msg.version != version
            ) {
                socket.close();
                return;
            }
            
            var transport = that.getConnection(msg.session);
            socket.send(JSON.stringify({
                "type": "handshake reply",
                "session": transport.id,
                "seq": transport.seq
            }));
            
            if (transport.recId == -1)
                transport.recId = msg.seq;
            
            transport.socket.setSocket(socket);
        });
    });
};

util.inherits(Server, EventEmitter);

Server.prototype.getConnection = function(id) {
    var transport;
    
    if (id) {
        transport = this.sockets[id];
        if (transport) {
            return transport;
        }
    }
    
    id = util.uid();
    transport = this.sockets[id] = new ReliableSocket(new ReconnectSocket(), this.socketOptions);
    transport.on("disconnect", this.disconnect.bind(this, transport));
    transport.id = id;
    this.emit("connection", transport);
    return transport;
};

Server.prototype.disconnect = function(transport) {
    delete this.sockets[transport.id];
    if (transport) {
        transport.close();
        this.emit("disconnect", transport);
    }
};