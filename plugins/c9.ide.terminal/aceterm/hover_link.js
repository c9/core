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
    this.onContextMenu = this.onContextMenu.bind(this);
    event.addListener(editor.renderer.scroller, "mousemove", this.onMouseMove);
    event.addListener(editor.renderer.content, "mouseout", this.onMouseOut);
    event.addListener(editor.renderer.content, "click", this.onClick);
    event.addListener(editor.renderer.container, "contextmenu", this.onContextMenu);
};

(function(){
    oop.implement(this, EventEmitter);
    
    this.token = {};
    this.range = new Range();

    this.update = function() {
        this.$timer = null;
        var editor = this.editor;
        var renderer = editor.renderer;
        
        var canvasPos = renderer.scroller.getBoundingClientRect();
        var offset = (this.x + renderer.scrollLeft - canvasPos.left - renderer.$padding) / renderer.characterWidth;
        var row = Math.floor((this.y + renderer.scrollTop - canvasPos.top) / renderer.lineHeight);
        var col = Math.round(offset);

        var screenPos = {row: row, column: col, side: offset - col > 0 ? 1 : -1};
        var session = editor.session;
        var docPos = session.screenToDocumentPosition(screenPos.row, screenPos.column);
        
        var selectionRange = editor.selection.getRange();
        if (!selectionRange.isEmpty()) {
            if (selectionRange.start.row <= row && selectionRange.end.row >= row)
                return this.clear();
        }
        
        var line = editor.session.getLine(docPos.row);
        if (docPos.column == line.length) {
            var clippedPos = editor.session.documentToScreenPosition(docPos.row, docPos.column);
            if (clippedPos.column != screenPos.column) {
                return this.clear();
            }
        }
        
        var token = this.findLink(docPos.row, docPos.column);
        // var isFocused = editor.isFocused();
        this.link = token;
        if (!token) {
            return this.clear();
        }
        if (!this.isOpen) {
            this.isOpen = true;
        }
        // token.isFocused = isFocused;
        editor.renderer.setCursorStyle("pointer");
        
        session.removeMarker(this.marker);
        
        this.range = this.getRange(token);
        this.marker = session.addMarker(this.range, "ace_link_marker", "text", true);
    };
    
    this.clear = function() {
        if (this.isOpen) {
            this.editor.session.removeMarker(this.marker);
            this.editor.renderer.setCursorStyle("");
            this.isOpen = false;
        }
    };
    
    this.getMatchAround = function(regExp, string, col) {
        var match;
        regExp.lastIndex = 0;
        string.replace(regExp, function(str) {
            var offset = arguments[arguments.length-2];
            var length = str.length;
            if (offset <= col && offset + length >= col)
                match = {
                    start: offset,
                    value: str
                };
        });
    
        return match;
    };
    
    this.onClick = function(e) {
        if (this.link && this.isOpen) { // && this.link.isFocused
            if (this.editor.selection.isEmpty()) {
                this.editor.selection.setSelectionRange(this.range);
                this.lastRange = this.range;
            }
            
            this.link.editor = this.editor;
            this.link.x = e.clientX;
            this.link.y = e.clientY;
            this.link.metaKey = e.metaKey;
            this.link.ctrlKey = e.ctrlKey;
            this._signal("open", this.link);
        }
    };
    
    this.onContextMenu = function(e) {
        var range = this.editor.selection.getRange();
        if (!range.isEmpty()) {
            if (this.lastRange && range.isEqual(this.lastRange)) {
                this.editor.selection.clearSelection();
                this.update();
            }
        }
        if (this.link && this.isOpen) {
            if (this.editor.selection.isEmpty()) {
                this.editor.selection.setSelectionRange(this.range);
                this.lastRange = this.range;
            }
        }
    };
    
    this.getRange = function(token) {
        var session = this.editor.session;
        var startCol = token.start;
        var row = token.row;
        var line = session.getLine(row);
        while (line && line.length < startCol) {
            startCol -= line.length;
            row++;
            line = session.getLine(row);
        }
        var startRow = row;
        var endCol = startCol + token.value.length;
        while (line && line.length < endCol) {
            endCol -= line.length;
            row++;
            line = session.getLine(row);
        }
        var endRow = row;
        return new Range(startRow, startCol, endRow, endCol);
    };
    
    this.findLink = function(row, column) {
        var editor = this.editor;
        var session = editor.session;
        var lineData = session.getLineData(row);
        var prevLineData = session.getLineData(row - 1);
        var line = session.getLine(row);
        for (var i = 1; lineData && lineData.wrapped; i++) {
            line += session.getLine(row + i);
            lineData = session.getLineData(row + i);
        }
        while (prevLineData && prevLineData.wrapped) {
            row --;
            var prevLine = session.getLine(row);
            column += prevLine.length;
            line = prevLine + line;
            prevLineData = session.getLineData(row - 1);
        }
        lineData = session.getLineData(row);
        
        var match = this.getMatchAround(/https?:\/\/[^\s"']+|[~\/\w.]([:.~/\w-_]|\\.)+/g, line, column);
        if (!match)
            return;
        
        match.row = row;
        var value = match.value;
        if (/^https?:|\bc9.io\b|(\d{1,3}\b.?){4}|localhost/.test(value)) {
            match.type = "link";
            var m =  /((https?:\/\/)?(\d{1,3}\b.?){4}(:\d+[^\d\/]|[^:\d\/]))/.exec(value);
            if (m)
                value = m[0].slice(0, -1);
            value = value.replace(/[>)}\].,;:]+$/, "");
            match.value = value;
            return match;
        }
        var prompt = this.findPrompt(row);
        if (!prompt) {
            if (/^(\/|~|\/?\w:[\\/])/.test(value)) { // windows or unix absolute path
                match.type = "path";
                match.value = value.replace(/["'>)}\].,;:]+$/, "");
                return match;
            }
            return;
        }
        
        if (lineData.prompt && match.start <= prompt.index) {
            match.value = value = value.substr(prompt.index - match.start);
            match.start = prompt.index;
            if (match.start > column || !value)
                return;
            return;
        }
        
        match.command = prompt.command;
        match.args = prompt.args;
        match.basePath = prompt.path;
        
        if (prompt.command === "ls") {
            match.type = "path";
            if (lineData.prompt)
                return;
            // update basepath for ls /dir/name    
            if (prompt.args)
                match.basePath = this.findBasePath(prompt.args, prompt.path);
            if (prompt.args && /( |^)(--help|-h)\b/.test(prompt.args))
                return;
            var longStyle = /(^|\s)[ld\-][\-rwx]+\s/.test(line);
            if (longStyle) {
                if (/[*@|=>]$/.test(line))
                    line = line.slice(0, -1);
                if (match.start + value.length < line.length) {
                    var isLink = line[0] == "l" && line.substr(match.start + value.length, 4) == " -> ";
                    if (!isLink)
                        return;
                }
            } else {
                var before = line.substring(0, match.start).match(/[^\s\\\/@"']+ $/);
                var after = line.substr(match.start + value.length).match(/^ [^\s\\\/@"']+/);
                if (before && !/\d+/.test(before[0])) {
                    value = before[0] + value;
                    match.start -= before[0].length;
                }
                if (after) {
                    value += after[0];
                }
                match.value = value;
                return match;
            }
        }
        else if (prompt.command === "find") {
            if (match.start !== 0 || match.length < line.length)
                return;
            if (prompt.args)
                match.basePath = this.findBasePath(prompt.args, prompt.path);
            match.type = "path";
        }
        else if (prompt.command === "grep") {
            if (match.start !== 0)
                return;
            match.type = "path";
            match.value = value.replace(/:[^\d][^:]*$/, "");
            // match.basePath = "";
        }
        else if (/^(~|\.\.?)?[\/\\]/.test(value) || /\w:[\\]/.test(value)) {
            match.type = "path";
            match.value = value.replace(/['">)}\].,;:]+$/, "");
        }
        else if (/^[ab]?\//.test(value) && /^([+\-]{3}|diff)/.test(line)) { // diff
                match.type = "path";
                match.basePath = "";
                match.start++;
                match.value = value.substr(2);
        }
        else if (prompt.command === "git") { // git status
            var prefix = line.substr(0, match.start);
            if (match.start + value.length == line.length
                && /^(#|[ MDR?A]{2})\s+([\w\s]+:\s+)?$/.test(prefix)
            ) {
                match.type = "path";
            } else {
                value = value.replace(/[.:]$/, "");
                if (value.match(/[/][^/]*\.\w+[.:]$/) || prefix.match(/( in |merging )$/)) {
                    match.type = "path";
                    match.value = value;
                } else {
                    return;
                }
            }
        } else {
            return;
        }
        
        return match;
    };
    
    this.findBasePath = function(args, basePath) {
        var argList = args.split(" ").filter(function(x) {
            return x[0] != "-";
        });
        var pathArg = argList[argList.length - 1];
        if (pathArg) {
            if (pathArg[0] === "~" || pathArg[0] === "/")
                return pathArg;
            return basePath + "/" + pathArg;
        }
        return basePath;
    };

    this.findPrompt = function(row) {
        var promptRe = /([~\/](?:[^\\\s'"\(<]|\\.)*)[^$]*?\$/;
        var editor = this.editor;
        var session = editor.session;
        var prompt, args, command, promptRow;
        do {
            var lineData = session.getLineData(row);
            
            if (lineData.prompt)
                return lineData.prompt;
            
            var line = session.getLine(row);
            var m = promptRe.exec(line);
            if (m) {
                line = line.substr(m.index + m[0].length);
                var m2 = /^\s*([\w\-]+)/.exec(line);
                if (m2) {
                    command = m2[1];
                    args = line.substr(m2[0].length);
                }
                if (!prompt || lineData.isUserInput) {
                    prompt = {
                        path: m[1],
                        command: command,
                        index: m.index,
                        args: args,
                        lineData: lineData
                    };
                }
                if (lineData.isUserInput)
                    break;
            }
        } while (row-- > 0);
        if (prompt && promptRow < session.term.ybase)
            prompt.lineData.prompt = prompt;
        return prompt;
    };

    this.onMouseMove = function(e) {
        if (this.editor.$mouseHandler.isMousePressed) {
            if (!this.editor.selection.isEmpty())
                this.clear();
            return;
        }
        if (this.x == e.clientX && this.y == e.clientY)
            return;
        this.x = e.clientX;
        this.y = e.clientY;
        if (this.isOpen) {
            this.lastT = e.timeStamp;
        }
        this.update();
    };

    this.onMouseOut = function(e) {
        this.clear();
        this.$timer = clearTimeout(this.$timer);
    };

    this.destroy = function() {
        this.onMouseOut();
        event.removeListener(this.editor.renderer.scroller, "mousemove", this.onMouseMove);
        event.removeListener(this.editor.renderer.content, "mouseout", this.onMouseOut);
        delete this.editor.hoverLink;
    };

}).call(HoverLink.prototype);

exports.HoverLink = HoverLink;

});