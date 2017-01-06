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

var DevToolsMessage = module.exports = function(headers, content) {
    this.$headers = {};
    this.$content = "";

    if (headers)
        this.$headers = headers;
    if (content)
        this.setContent(content);
};

(function() {

    this.setContent = function(content) {
        this.$content = content.toString();
    };

    this.getContent = function() {
        return this.$content;
    };

    this.setHeader = function(name, value) {
        this.$headers[name] = value;
    };

    this.parse = function(msgString) {
        var headers = this.$headers = {};
        var responseParts = msgString.split("\r\n\r\n");

        var headerText = responseParts[0];
        this.$content = responseParts[1];

        var re = /([\w\-\d]+)\s*:\s*([^\r\n]*)(\r|$)/g;
        headerText.replace(re, function(str, key, value) {
            headers[key] = value;
        });

        return this;
    };

    this.stringify = function() {
        var headers = this.getHeaders();

        var str = [];
        for (var name in headers)
            str.push(name, ":", headers[name], "\r\n");
        if (this.$content)
            str.push("\r\n", this.$content);
        return str.join("");
    };

    this.getHeaders = function() {
        this.$headers["Content-Length"] = this.$content.length;
        this.$headers["Tool"] = this.$headers["Tool"] || "DevToolsService";

        return this.$headers;
    };

}).call(DevToolsMessage.prototype);

DevToolsMessage.fromString = function(msgString) {
    return new DevToolsMessage().parse(msgString);
};

});