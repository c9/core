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
var V8Message = require("./V8Message");

module.exports = {

    name: "V8Message",
    
    "test: create message": function() {
        var msg = new V8Message("request");
        assert.equal("request", msg.type);
    },

    "test: two messages have different sequence numbers": function() {
        var msg1 = new V8Message("request");
        var msg2 = new V8Message("request");

        assert.ok(msg1.seq !== msg2.seq);
    }

};

if (typeof module !== "undefined" && !module.parent)
    require("asyncjs").test.testcase(module.exports).exec();

});