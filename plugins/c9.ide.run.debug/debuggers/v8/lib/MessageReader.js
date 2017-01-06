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
var readBytes = Util.readBytes;

var MessageReader = module.exports = function(socket, callback) {
    this.$socket = socket;
    this.$callback = callback;

    this.$received = "";
    this.$expectedBytes = 0;
    this.$offset = 0;
    this.$cbReceive = this.$onreceive.bind(this);
    socket.on("data", this.$cbReceive);
};

(function() {

    this.$onreceive = function(data) {
        // this.$socket.clearBuffer();
        this.$received += data;

        var fullResponse;
        while (fullResponse = this.$checkForWholeMessage())
            this.$callback(fullResponse);
    };

    this.$checkForWholeMessage = function() {
        var fullResponse = false;
        var received = this.$received;
        if (!this.$expectedBytes) { // header
            var i = received.indexOf("\r\n\r\n");
            if (i !== -1) {
                var c = received.lastIndexOf("Content-Length:", i);
                if (c != -1) {
                    var l = received.indexOf("\r\n", c);
                    var len = parseInt(received.substring(c + 15, l), 10);
                    this.$expectedBytes = len;
                }
                this.$offset = i + 4;
            }
        }
        if (this.$expectedBytes) { // body
            var result = readBytes(received, this.$offset, this.$expectedBytes);
            this.$expectedBytes -= result.bytes;
            this.$offset += result.length;
        }
        if (this.$offset && this.$expectedBytes <= 0) {
            fullResponse = received.substring(0, this.$offset);
            this.$received = received.substr(this.$offset);
            this.$offset = this.$expectedBytes = 0;
        }
        // console.log("RECEIVE>", fullResponse, this.$received.length);
        return fullResponse;
    };
    
    this.destroy = function() {
        this.$socket && this.$socket.removeListener("data", this.$cbReceive);
        delete this.$socket;
        delete this.$callback;
        this.$received = "";
    };

}).call(MessageReader.prototype);

});