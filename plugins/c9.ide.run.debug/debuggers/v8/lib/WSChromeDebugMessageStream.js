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

var WSChromeDebugMessageStream = module.exports = function(socket) {
    this.$socket = socket;
    this.$attached = false;
};

(function() {

    Util.implement(this, EventEmitter);

    this.$received = "";

    this.connect = function() {
        if (this.$attached)
            return;

        var self = this;

        this.$socket.on("message", function(e) {
            var message;
            try {
                message = JSON.parse(data);
            }
            catch (e) {
                return _self.$onerror();
            }

            if (message.type == "chrome-debug-ready") {
                self._dispatchEvent("connect");
            }
            else {
                var response = new DevToolsMessage.fromString(e.body);
                self._dispatchEvent("message", { data: response });
            }
        });
    };

    this.sendRequest = function(message) {
        //console.log("> Sent to Chrome:\n", message.stringify());
        var command = {
            command: "debugChrome",
            message: message.stringify()
        };
        this.$socket.send(JSON.stringify(message));
    };

    this.$onerror = function() {
        this.$dispatchEvent("error");
    };

}).call(WSChromeDebugMessageStream.prototype);

});