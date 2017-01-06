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

var net = require("net");
var EventEmitter = require("events").EventEmitter;

var NodeSocket = module.exports = function(ip, port) {
    EventEmitter.call(this);
    var _self = this;
    // connection status flag
    var connected = false;
    // the number of left connect retries
    // TODO: retrieve retry count from configuration
    var connectRetryCount = 30;
    // the amount of interval in msec between each retry
    // TODO: retrieve retry count from configuration
    var connectRetryInterval = 50; // 50 msec
    // note: total time for retry: 50msc * 30 = 1.5 sec

    function initStream() {
        _self.$stream = new net.Stream();
        _self.$stream.setEncoding("utf8");

        _self.$stream.addListener("data", function(data) {
            _self.$onData(data);
        });

        _self.$stream.addListener("end", onEnd);
        _self.$stream.addListener("error", onError);

        _self.$stream.addListener("connect", function () {
            // set connection flag to true (connected)
            connected = true;
            _self.emit("connect");
        });
    }

    // create the initial connection object
    initStream();

    function onEnd(errorInfo) {
        // set connection flag to false (not connected)
        connected = false;
        _self.$stream.end();
        _self.state = "initialized";
        _self.emit("end", errorInfo);
    }

    function onError() {
        // if currently not connected and there re-tries left to perform
        if (!connected && connectRetryCount > 0) {
            // decrease number of re-tries
            connectRetryCount--;
            // since the connection has failed the entire connection object is dead.
            // close the existing connection object
            _self.$stream.end();
            // create a new connection object.
            initStream();
            // sleep and afterward try to connect again
            setTimeout(function() {
                //console.log("retrying. " + ( connectRetryCount + 1 ) + " attempts left");
                _self.connect();
            }, connectRetryInterval);
        }
        else {
            // TODO: replace error message with exception instance.
            onEnd("Could not connect to the debugger");
        }
    }

    this.$ip = ip;
    this.$port = port;
};

require("./util").inherits(NodeSocket, EventEmitter);

(function() {

    this.receivedText = "";

    this.close = function() {
        this.$stream.end();
    };

    this.clearBuffer = function() { };

    this.send = function(msg) {
        //console.log("> sent to socket:\n", msg)
        this.$stream.write(msg, "utf8");
    };

    this.setMinReceiveSize = function(minSize) { };

    this.$onData = function(data) {
        this.receivedText = data;
        //console.log("> received from socket:\n", this.receivedText, this.receivedText.length)
        this.emit("data", this.receivedText);
    };

    this.connect = function() {
        //console.log("Connecting to: " + this.$ip + ":" + this.$port);
        this.$stream.connect(this.$port, this.$ip);
    };

}).call(NodeSocket.prototype);

});