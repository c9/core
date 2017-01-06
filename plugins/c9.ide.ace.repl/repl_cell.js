/* ***** BEGIN LICENSE BLOCK *****
 * Distributed under the BSD license:
 *
 * Copyright (c) 2010, Ajax.org B.V.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *     * Redistributions of source code must retain the above copyright
 *       notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above copyright
 *       notice, this list of conditions and the following disclaimer in the
 *       documentation and/or other materials provided with the distribution.
 *     * Neither the name of Ajax.org B.V. nor the
 *       names of its contributors may be used to endorse or promote products
 *       derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL AJAX.ORG B.V. BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * ***** END LICENSE BLOCK ***** */


define(function(require, exports, module) {
"use strict";

var Anchor = require("ace/anchor").Anchor;
var Range = require("ace/range").Range;
var comparePoints = Range.comparePoints;
var lang = require("ace/lib/lang");

 
var ReplCell = function(options, session) {
    this.session = session;
    this.type = options.type;
};

(function() {
    this.insert = function(pos, text) {
        if (typeof pos == "string") {
            text = pos;
            pos = this.getRange().end;
        }
        this.session.insert(pos, text);
    };
    this.setPlaceholder = function(str) {
        this.placeholder = str;
        
    };
    this.setMode = function() {
        
    };
    this.setWaiting = function(val) {
        this.waiting = val;
        this.session.repl.$updateSession();
    };
    this.prompt = "";
    this.promptType = null;
    this.setPrompt = function(str, type) {
        if (this.prompt == str)
            return;
        this.promptType = type;
        this.prompt = (str || "") + "   ";
        this.session.maxPromptLength = Math.max(this.session.maxPromptLength || 0, this.prompt.length);
    };
    
    this.setValue = function(val, selection) {
        if (!this.session)
            return;
        if (val == null)
            return this.remove();
        if (this.lineWidget && val.trim())
            this.removeWidget();
        this.$updateRange();
        var pos = this.session.doc.replace(this.range, val);
        this.range.setEnd(pos);
        if (selection == 1)
            this.session.selection.setRange({ start: this.range.end, end: this.range.end });
        else if (selection == -1)
            this.session.selection.setRange({ start: this.range.start, end: this.range.start });
    };
    this.getValue = function() {
        if (!this.session)
            return "";
        return this.session.doc.getTextRange(this.range);
    };
    this.getRange = function() {
        this.$updateRange();
        return this.range;
    };
    this.$updateRange = function(row) {
        var cells = this.session.replCells;
        if (row == null)
            row = cells.indexOf(this);

        for (i = row; i > 0; i--) {
            if (cells[i])
                break;
        }
        var cell = cells[i];
        if (!cell)
            return;
        cell.row = i;
        for (var i = row + 1; i < this.session.getLength(); i++) {
            if (cells[i])
                break;
        }
        cell.endRow = i - 1;
        cell.range = new Range(cell.row, 0, cell.endRow, Number.MAX_VALUE);
        
        return this.range;
    };
    
    this.removeWidget = function() {
        if (this.lineWidget) {
            var w = this.lineWidget;
            this.lineWidget = null;
            this.session.repl.removeLineWidget(w);
        }
    };
    
    this.addWidget = function(options) {
        if (this.lineWidget)
            this.removeWidget();
        
        this.setValue("");
        options.row = this.range.end.row;
        this.lineWidget = options;
        this.session.repl.addLineWidget(this.lineWidget);
    };
    
    this.destroy = function() {
        this.removeWidget();
        this.session = null;
    };
    
    this.remove = function() {
        if (this.session)
            this.session.repl.removeCell(this);
    };
 
}).call(ReplCell.prototype);

exports.ReplCell = ReplCell;

});