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
var DevToolsService = require("./DevToolsService");

module.exports = {

    name: "DevToolsService",
    
    setUp: function() {
        this.$msgStream = new MsgStreamMock();
        this.$service = new DevToolsService(this.$msgStream);
    },

    sendMessage: function(content) {
        this.$msgStream.$send(null, content);
    },

    "test: ping": function() {
        var called = false;
        this.$service.ping(function() {
            called = true;
        });
        this.sendMessage('{"command":"ping", "result":0, "data":"ok"}');

        assert.ok(called);
    },

    "test: getVersion": function() {
        var called = false;
        this.$service.getVersion(function(version) {
            called = true;
            assert.equal("0.1", version);
        });
        this.sendMessage('{"command":"version","data":"0.1","result":0}');

        assert.ok(called);
    },

    "test: listTabs": function() {
        var called = false;
        this.$service.listTabs(function(tabs) {
            called = true;
            assert.equal(1, tabs.length);
            assert.equal(2, tabs[0].length);
            assert.equal(2, tabs[0][0]);
            assert.equal("file:///index.html", tabs[0][1]);
        });
        this.sendMessage('{"command":"list_tabs","data":[[2,"file:///index.html"]],"result":0}');

        assert.ok(called);
    }
};

if (typeof module !== "undefined" && !module.parent)
    require("asyncjs").test.testcase(module.exports).exec();

});