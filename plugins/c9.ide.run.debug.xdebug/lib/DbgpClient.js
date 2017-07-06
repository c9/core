define(function(require, exports, module) {
"use strict";

module.exports = DbgpClient;

var inherits = require("util").inherits;
var EventEmitter = require("events").EventEmitter;

var DbgpSession = require("./DbgpSession");
var DbgpStreamReader = require("./DbgpStreamReader");
var DbgpStreamWriter = require("./DbgpStreamWriter");
var XmlStreamReader = require("./XmlStreamReader");
var SocketStream = require("./SocketStream");

/**
 * @class debugger.xdebug.DbgpClient
 *
 * The `DbgpClient` controls interaction between IDE, netproxy socket, and
 * debugger processes.
 *
 * A client is bound to a {@link debugger.Socket netproxy socket}, on which it
 * listens for incoming connections. When a process connects, a new debugger
 * session is created and initialized. This session can then be used to
 * interact with the process.
 *
 * @constructor
 */
function DbgpClient() {
    EventEmitter.call(this);

    this.listening = false;
}

inherits(DbgpClient, EventEmitter);

/**
 * @event listening
 * Emitted when the client is bound to a netproxy socket and
 * listening for incoming connections.
 */

/**
 * @event session
 * Emitted when a debugger has connected and the session is
 * ready to use.
 *
 * @param {debugger.xdebug.DbgpSession} session
 */

/**
 * @property {boolean} listening
 * If the client is bound to a netproxy socket and listening for incoming
 * connections.
 *
 * @readonly
 */

/**
 * Connect with the given {@link debugger.Socket netproxy socket} and begin
 * listening for debugger connections.
 *
 * When a debugger connects, a new {@link debugger.xdebug.DbgpSession
 * DbgpSession} is initialized and the `session` event will be emitted.
 *
 * @param {debugger.Socket} socket The netproxy socket to bind to.
 */
DbgpClient.prototype.listen = function(socket) {
    var client = this;
    var socketStream = new SocketStream(socket);
    
    this.socketStream = socketStream;
    
    function onError(err) {
        client.emit("error", err);
    }
    socketStream.on("error", onError);

    function onConnect() {
        var dbgpWriter = new DbgpStreamWriter();
        var dbgpReader = new DbgpStreamReader();
        var xmlReader = new XmlStreamReader();
        var session = new DbgpSession(client.ideKey);

        // input stream
        socketStream.pipe(dbgpReader).pipe(xmlReader).pipe(session);

        // output stream
        session.pipe(dbgpWriter).pipe(socketStream);

        session.on("init", function() {
            client.emit("session", session);
        });

        client.listening = true;
        client.emit("listening");
    }
    socketStream.on("connect", onConnect);

    function onEnd() {
        socketStream.end();
    }
    client.removeAllListeners("end");
    client.on("end", onEnd);

    function onClose() {
        client.listening = false;
        client.emit("close");
    }
    socketStream.on("close", onClose);

    socketStream.connect();
};

/**
 * Stop listening for incoming connections and close the netproxy socket.
 */
DbgpClient.prototype.close = function() {
    this.emit("end");
};

});
