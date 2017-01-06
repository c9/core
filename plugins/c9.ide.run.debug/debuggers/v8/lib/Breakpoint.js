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

var Breakpoint = module.exports = function(source, line, column, dbg) {
    this.source = source;
    this.line = line;
    this.column = column || 0;

    this.enabled = true;
    this.condition = "";
    this.ignoreCount = 0;
    
    if (dbg) {
        this.$dbg = dbg;
        this.state = "connected";
        this.$listen();
    }
    else
        this.state = "initialized";
};

(function() {

    this.attach = function(dbg, callback) {
        var self = this;

        if (this.state !== "initialized")
            throw new Error("Already attached");

        this.$dbg = dbg;
        this.state = "connecting";

        this.$listen();
        dbg.setbreakpoint("script", self.source, self.line, self.column, self.enabled, self.condition, self.ignoreCount, function(body) {
            self.state = "connected";
            self.$id = body.breakpoint;
            self.line = body.line;
            callback(self);
        });
    };

    this.$listen = function() {
        var self = this;
        this.$onbreak = function(e) {
            if (self.state !== "connected")
                return;

            // TODO: how will this ever work??
            //if (e.data.breakpoints.indexOf(self.$id) !== -1)
            //    self.$dbg.emit("break");
        };
        this.$dbg.on("break", this.$onbreak);
    };

    this.clear = function(callback) {
        if (this.state !== "connected")
            throw new Error("Not connected!");

        var self = this;
        this.$dbg.clearbreakpoint(this.$id, function() {
            this.$id = null;
            this.$dbg = null;
            this.state = "initialized";
            callback && callback(self);
        });
    };

    this.setEnabled = function(enabled) {
      this.enabled = enabled;
    };

    this.setCondition = function(condition) {
        this.condition = condition;
    };

    this.setIgnoreCount = function(ignoreCount) {
        this.ignoreCount = ignoreCount;
    };

    this.flush = function(callback) {
        if (this.state !== "connected")
            throw new Error("Not connected");

        this.$dbg.changeBreakpoint(this.$id, this.enabled, this.condition, this.ignoreCount, callback);
    };

    this.destroy = function() {
        dbg.removeListener("break", this.$onbreak);
    };

}).call(Breakpoint.prototype);

Breakpoint.fromJson = function(breakpoint, dbg) {
    if (breakpoint.type != "scriptName")
        throw new Error("unsupported breakpoint type: " + breakpoint.type);

    var bp = new Breakpoint(breakpoint.script_name, breakpoint.line, breakpoint.column, dbg);
    bp.condition = breakpoint.condition || "";
    bp.ignoreCount = breakpoint.ignoreCount || 0;
    bp.enabled = breakpoint.active;
    bp.$id = breakpoint.number;
    return bp;
};

});