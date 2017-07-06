define(function(require, exports, module) {
"use strict";

module.exports = SocketStream;

var inherits = require("util").inherits;
var Stream = require("stream").Stream;

var RECONNECT_PAYLOAD = "Content-Length:0\r\n\r\n";

/**
 * @class debugger.xdebug.SocketStream
 *
 * Provides a `Stream` interface for {@link debugger.Socket netproxy sockets},
 * which can be used with `stream.pipe()`.
 *
 * ```
 * var socketStream = new SocketStream(socket);
 *
 * var otherStream = createAnotherStream();
 * otherStream.on("data", function(chunk) {
 *     console.log("got %d bytes of data", chunk.length);
 * });
 *
 * // all the data from the socket goes to the other stream
 * socketStream.pipe(otherStream);
 *
 * // connect the original socket through the stream wrapper
 * socketStream.connect();
 * ```
 *
 * @constructor
 * @param {debugger.Socket} socket  The underlying netproxy socket.
 */
function SocketStream(socket) {
    Stream.call(this);

    var stream = this;

    function onData(data) {
        if (data === RECONNECT_PAYLOAD)
            return;

        stream.emit("data", data);
    }
    socket.on("data", onData);

    function onAway() {
        stream._away = true;
    }
    socket.on("away", onAway);

    function onBack() {
        stream._away = false;
        stream.write();
    }
    socket.on("back", onBack);

    function onEnd(err) {
        if (err)
            stream.emit("error", err);
        else
            stream.emit("end");

        stream.emit("close", (err != null));
    }
    socket.on("end", onEnd);

    function onError(err) {
        stream.emit("error", err);
    }
    socket.on("err", onError);
    socket.on("error", onError);

    this._socket = socket;
    this._buffer = "";
    this._away = false;

    this.writable = true;
}

inherits(SocketStream, Stream);

/**
 * @event connect
 * Emitted when the connection through the netproxy socket is established.
 */

/**
 * @event data
 * Emitted when data is received from the netproxy socket.
 *
 * @param {string} data  The received data.
 */

/**
 * @event end
 * Emitted when the connection is closed and no more data can be exchanged.
 */

/**
 * @event close
 * Emitted when the connection is closed and no more data can be exchanged.
 *
 * @param {boolean} hadError  If the socket closed because of an error.
 */

/**
 * @event error
 * Emitted when an unexpected error occurs.
 *
 * @param {Error} err
 */

/**
 * Send data to the netproxy socket. The data must be given as a UTF-8 encoded
 * string.
 *
 * @param {string} data  The data to send.
 */
SocketStream.prototype.write = function(data) {
    if (this._away || this._socket.connected !== this._socket.CONNECTED) {
        this._buffer += data;
        return false;
    }

    if (this._buffer) {
        this._socket.send(this._buffer);
        this._buffer = "";
        this.emit("drain");
    }

    if (data !== null)
        this._socket.send(data);

    return true;
};

/**
 * Connect the netproxy socket. When the connection is established, the
 * `connect` event is emitted.
 *
 * Calls debugger.Socket#connect().
 */
SocketStream.prototype.connect = function() {
    var _self = this;

    function onConnect() {
        _self.emit("connect");
    }

    if (this._socket.connected) {
        onConnect();
    } else {
        this._socket.once("connect", onConnect);
        this._socket.connect();
    }
};

/**
 * Close the netproxy socket connection.
 */
SocketStream.prototype.end = function(data) {
    if (data)
        this._socket.send(data);

    this._socket.close();
};

});
