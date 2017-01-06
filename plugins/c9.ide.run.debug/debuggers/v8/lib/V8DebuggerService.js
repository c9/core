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
var DevToolsMessage = require("./DevToolsMessage");

var V8DebuggerService = module.exports = function(msgStream) {
    this.$msgStream = msgStream;
    this.$pending = {};

    var self = this;
    this.$msgStream.addEventListener("message", function(e) {
        var response = e.data;
        if (response.getHeaders()["Tool"] !== "V8Debugger")
            return;

        var content = JSON.parse(response.getContent());
        var command = content.command;

        var queue = self.$pending[command];
        if (queue && queue.length)
            queue.shift()(content.data);

        var event = command;
        var tabId = response.getHeaders()["Destination"];
        if (tabId)
            event += "_" + tabId;

        self.emit(event, { data: content.data });
    });
};

(function() {

    Util.implement(this, EventEmitter);

    this.attach = function(tabId, callback) {
        this.$send(tabId, "attach", null, callback);
    };

    this.detach = function(tabId, callback) {
        this.$send(tabId, "detach", null, callback);
    };

    this.evaluateJavaScript = function(tabId, jsCode) {
        this.$send(tabId, "evaluate_javascript", '"' + jsCode + '"', null);
    };

    this.debuggerCommand = function(tabId, v8Command) {
        this.$send(tabId, "debugger_command", v8Command);
        var self = this;
        setTimeout(function() {
            self.$send(tabId, "evaluate_javascript", '"javascript:void(0);"', null);
        }, 100);
    };

    this.$send = function(destination, command, data, callback) {
        var headers = {
            "Tool": "V8Debugger",
            "Destination": destination
        };

        var commandJson = ['{"command":"', command, '"'];
        data && commandJson.push(',"data":', data);
        commandJson.push("}");

        var msg = new DevToolsMessage(headers, commandJson.join(""));
        this.$msgStream.sendRequest(msg);

        if (callback) {
            if (!this.$pending[command])
                this.$pending[command] = [];

            this.$pending[command].push(callback);
        }
    };


}).call(V8DebuggerService.prototype);

});