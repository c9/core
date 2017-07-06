/**
 * V8Debugger
 * 
 * Copyright (c) 2010 Ajax.org B.V.
 * 
 * The MIT License (MIT)
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */
define(function(require, exports, module) {
"use strict";

var Util = require("./util");
var EventEmitter = Util.EventEmitter;

var ChromeDebugMessageStream = module.exports = function(socket) {
    this.$socket = socket;
};

(function() {

    Util.implement(this, EventEmitter);

    this.$received = "";

    this.connect = function() {
        var socket = this.$socket;
        var self = this;
        socket.on("connect", function() {
            self.$onconnect();
        });
        socket.on("data", function(data) {
            self.$onhandshake(data);
        });
        socket.connect();
    };

    this.sendRequest = function(message) {
        //console.log("> Sent to Chrome:\n", message.stringify());
        this.$socket.send(message.stringify());
    };

    this.$onconnect = function() {
        this.$socket.send(this.MSG_HANDSHAKE);
    };

    this.$onhandshake = function(data) {
        this.$received += data;
        //this.$socket.clearBuffer();

        if (this.$received.length < this.MSG_HANDSHAKE.length)
            return;

        if (this.$received.indexOf(this.MSG_HANDSHAKE) !== 0) {
            this.$socket.removeAllListeners("data");
            return this.$onerror();
        }

        this.$received = this.$received.substring(this.MSG_HANDSHAKE.length);
        this.$socket.removeAllListeners("data");
        this.$reader = new MessageReader(this.$socket, this.$onMessage.bind(this));

        this.emit("connect");
    };

    this.$onMessage = function(messageText) {
        var self = this;
        setTimeout(function() {
            //console.log("> Received from Chrome:\n", messageText);
            var response = new DevToolsMessage.fromString(messageText);
            self.emit("message", { data: response });
        }, 0);
    };

    this.$onerror = function() {
        this.emit("error");
    };

    this.MSG_HANDSHAKE = "ChromeDevToolsHandshake\r\n";

}).call(ChromeDebugMessageStream.prototype);

});