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

var WSV8DebuggerService = module.exports = function(socket) {
    this.$socket = socket;
    this.$state = "initialized";
    this.$onAttach = [];
};

(function() {

    Util.implement(this, EventEmitter);

    this.attach = function(tabId, callback) {
        if (this.$state == "connected")
            return callback(new Error("already attached!"));

        this.$onAttach.push(callback);
        if (this.$state == "initialized") {
            this.$socket.send(JSON.stringify({ command: "DebugAttachNode", runner: "node" }));
            this.$onMessageHandler = this.$onMessage.bind(this);
            this.$socket.on("message", this.$onMessageHandler);
            this.$state = "connecting";
        }
    };

    this.$onMessage = function(data) {
        var message;
        //console.log("INCOMING: ", data);
        try {
            message = JSON.parse(data);
        }
        catch (ex) {
            return;
        }
        if (message.type == "node-debug-ready") {
            this.pid = message.pid;
            this.$state = "connected";
            for (var i = 0, l = this.$onAttach.length; i < l; i++)
                this.$onAttach[i]();
            this.$onAttach = [];
        }
        else if (message.type == "node-debug") {
            this.emit("debugger_command_0", { data: message.body });
        }
    };

    this.detach = function(tabId, callback) {
        this.$state = "initialized";
        this.$socket.removeListener("message", this.$onMessageHandler);
        callback();
    };

    this.debuggerCommand = function(tabId, v8Command) {
        this.$socket.send(JSON.stringify({
            command: "debugNode",
            pid: this.pid,
            runner: "node",
            body: JSON.parse(v8Command)
        }));
    };

}).call(WSV8DebuggerService.prototype);

});