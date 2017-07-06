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
if (typeof process !== "undefined")
    require("amd-loader");

define(function(require, exports, module) {
"use strict";

var assert = require("assert");
var MsgStreamMock = require("./MsgStreamMock");
var V8DebuggerService = require("./V8DebuggerService");

module.exports = {

    name: "V8DebuggerService",
    
    setUp: function(next) {
        this.$msgStream = new MsgStreamMock();
        this.$service = new V8DebuggerService(this.$msgStream);
        next();
    },

    sendMessage: function(destination, content) {
        var headers = {
            Tool: "V8Debugger",
            Destination: destination
        };
        this.$msgStream.$send(headers, content);
    },

    "test: attach": function() {
        var called = false;
        this.$service.attach(2, function() {
            called = true;
        });
        this.sendMessage(2, '{"command":"attach","result":0}');

        assert.ok(called);
    },

    "test: detach": function() {
        var called = false;
        this.$service.detach(2, function() {
            called = true;
        });
        this.sendMessage(2, '{"command":"detach", "result":0}');

        assert.ok(called);
    },

    "test: debugger command": function() {
        var called = false;
        var data = '{"seq":1,"type":"request","command":"version"}';
        this.$service.debuggerCommand(2, data);
        this.sendMessage(2, '{"command":"debugger_command","result":0,"data":{"seq":1,"request_seq":1,"type":"response","command":"version","success":true,"body":{"V8Version":"2.1.10.5"},"refs":[],"running":true}}');
        assert.equal('{"command":"debugger_command","data":{"seq":1,"type":"request","command":"version"}}', this.$msgStream.requests[0].getContent());
    },

    "test: evaluate javascript": function() {
        this.$service.evaluateJavaScript(2, "javascript:void(0);");
        assert.equal('{"command":"evaluate_javascript","data":"javascript:void(0);"}', this.$msgStream.requests[0].getContent());
    }
};

if (typeof module !== "undefined" && !module.parent)
    require("asyncjs").test.testcase(module.exports).exec();

});