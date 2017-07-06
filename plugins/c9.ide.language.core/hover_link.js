define(function(require, exports, module) {
"use strict";

var oop = require("ace/lib/oop");
var event = require("ace/lib/event");
var Range = require("ace/range").Range;
var EventEmitter = require("ace/lib/event_emitter").EventEmitter;

var HoverLink = function(editor) {
    if (editor.hoverLink)
        return;
    editor.hoverLink = this;
    this.editor = editor;

    this.update = this.update.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseOut = this.onMouseOut.bind(this);
    this.onClick = this.onClick.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
    event.addListener(editor.renderer.scroller, "mousemove", this.onMouseMove);
    event.addListener(editor.renderer.content, "mouseout", this.onMouseOut);
    event.addListener(editor.renderer.content, "click", this.onClick);
    editor.on("mousedown", this.onMouseDown);
    this.active = true;
};

(function() {
    oop.implement(this, EventEmitter);
    
    this.attach = function () {
        
    };
    
    this.detach = function () {
        
    };
    
    this.token = {};
    this.range = new Range(-1, -1, -1, -1);

    this.update = function() {
        this.$timer = null;
        var editor = this.editor;
        var renderer = editor.renderer;
        
        // renderer.pixelToScreenCoordinates()
        var canvasPos = renderer.scroller.getBoundingClientRect();
        var offset = (this.x + renderer.scrollLeft - canvasPos.left - renderer.$padding) / renderer.characterWidth;
        var row = Math.floor((this.y + renderer.scrollTop - canvasPos.top) / renderer.lineHeight);
        var col = Math.round(offset);

        var screenPos = { row: row, column: col, side: offset - col > 0 ? 1 : -1 };
        var session = editor.session;
        var docPos = session.screenToDocumentPosition(screenPos.row, screenPos.column);
        
        var selectionRange = editor.selection.getRange();
        if (!selectionRange.isEmpty()) {
            if (selectionRange.start.row <= row && selectionRange.end.row >= row)
                return this.clear();
        }
        
        // var screenPos = editor.renderer.pixelToScreenCoordinates(x, y)
        // var docPos = editor.session.screenToDocumentPosition(screenPos.row, screenPos.column)
        var line = editor.session.getLine(docPos.row);
        if (docPos.column == line.length) {
            var clippedPos = editor.session.documentToScreenPosition(docPos.row, docPos.column);
            if (clippedPos.column != screenPos.column) {
                return this.clear();
            }
        }
        
        if (this.isOpen && this.range.contains(docPos.row, docPos.column))
            return;
        
        var token = this.findLink(docPos.row, docPos.column);
        this.link = token;
        if (!token) {
            return this.clear();
        }
        if (!this.isOpen) {
            this.isOpen = true;
        }
        editor.renderer.setCursorStyle("pointer");
        
        session.removeMarker(this.marker);
        
        this.range = this.getRange(token);
        this._signal("addMarker", { range: this.range });
        this.addMarker();
    };
    
    this.addMarker = function() {
        this.marker = this.editor.session.addMarker(this.range, "ace_link_marker", "text", true);
    };
    
    this.removeMarker = function() {
        this.editor.session.removeMarker(this.marker);
    };
    
    this.clear = function() {
        if (this.isOpen) {
            this.removeMarker();
            this.editor.renderer.setCursorStyle("");
            this.isOpen = false;
        }
    };
    
    this.getMatchAround = function(regExp, string, col) {
        var match;
        regExp.lastIndex = 0;
        string.replace(regExp, function(str) {
            var offset = arguments[arguments.length - 2];
            var length = str.length;
            if (offset <= col && offset + length >= col)
                match = {
                    start: offset,
                    value: str
                };
        });
    
        return match;
    };
    
    this.onClick = function() {
        if (this.link && this.isOpen) {
            this._signal("open", this.link);
        }
    };
    
    this.getRange = function(token) {
        var startCol = token.start;
        var row = token.row;
        var startRow = row;
        var endCol = startCol + token.value.length;
        var endRow = row;
        return new Range(startRow, startCol, endRow, endCol);
    };
    
    this.findLink = function(row, column) {
        var editor = this.editor;
        var session = editor.session;
        var token = session.getTokenAt(row, column);
        
        if (!token) return;
        var value = token.value;
        var startIndex = token.start;
        
        if (/[\s()\[\]{};]/.test(value))
            return;
            
        if (/keyword|operator|comment|string|storage|language|numeric/.test(token.type))
            return;
        
        return {
            value: value,
            start: startIndex,
            row: row
        };
    };
    
    this.onMouseMove = function(e) {
        if (this.isOpen && this.editor.$mouseHandler.isMousePressed) {
            if (!this.editor.selection.isEmpty())
                this.clear();
            return;
        }
        
        if (event.getModifierString(e) != this.$keyModifier)
            return this.clear();
        if (this.x == e.clientX && this.y == e.clientY)
            return;
        this.x = e.clientX;
        this.y = e.clientY;
        
        this.update();
    };
    
    this.onMouseDown = function(e) {
        if (this.isOpen && event.getModifierString(e.domEvent) == this.$keyModifier)
            e.stop();
    };

    this.onMouseOut = this.clear;

    this.destroy = function() {
        this.onMouseOut();
        event.removeListener(this.editor.renderer.scroller, "mousemove", this.onMouseMove);
        event.removeListener(this.editor.renderer.content, "mouseout", this.onMouseOut);
        delete this.editor.hoverLink;
    };

}).call(HoverLink.prototype);

exports.HoverLink = HoverLink;

});