define(function(require, exports, module) {
"use strict";

var LineWidgets = require("ace/line_widgets").LineWidgets;
var dom = require("ace/lib/dom");
var event = require("ace/lib/event");
var Range = require("ace/range").Range;


var css = require("text!./conflictmarker.css");
dom.importCssString(css, "x");



function ConflictMarker(editor) {
    var session = editor.session;
    if (!session.meta)
        session.meta = {};
    if (session.meta.conflictMarker)
        return session.meta.conflictMarker;
    if (!session.widgetManager) {
        session.widgetManager = new LineWidgets(session);
        session.widgetManager.attach(editor);
    }
    
    this.onChange = this.onChange.bind(this);
    this.onClick = this.onClick.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onChangeEditor = this.onChangeEditor.bind(this);
    this.onEndOperation = this.onEndOperation.bind(this);
    
    this.editor = editor;
    this.resolved = [];
    this.chunks = [];
    this.attachToSession(session);
}

(function() {
    this.attachToSession = function(session) {
        if (this.session == session)
            return;
        if (this.session)
            this.detachFromSession();
        this.session = session;
        
        this.chunks = this.parse();
        session.on("changeEditor", this.onChangeEditor);
        session.on("change", this.onChange);
        this.addWidgets(session, this.editor.renderer.lineHeight);
        session.addDynamicMarker(this);
        if (!session.meta)
            session.meta = {};
        session.meta.conflictMarker = this;
    };
    this.detachFromSession = function() {
        var session = this.session;
        if (session) {
            session.removeMarker(this.id);
            this.removeWidgets();
            this.session = null;
            session.off("changeEditor", this.onChangeEditor);
            session.off("change", this.onChange);
            session.meta.conflictMarker = null;
        }
    };
    this.onChangeEditor = function(e) {
        if (e.oldEditor && e.oldEditor == this.editor) {
            this.editor = null;
        }
        if (e.editor && e.editor != this.editor) {
            this.editor = e.editor;
        }
    };
    
    this.refresh = function() {
        var session = this.session;
        this.detachFromSession(session);
        this.attachToSession(session);
    };
    
    this.onEndOperation = function() {
        if (this.mustRefresh) {
            this.mustRefresh = false;
            this.refresh();
        }
    };
    
    this.onChange = function(delta) { 
        var isInsert = delta.action == "insert";
        var start = delta.start;
        var end = delta.end;
        var rowShift = (end.row - start.row) * (isInsert ? 1 : -1);
        if (isInsert) end = start;
          
        var chunks = this.chunks;
        if (rowShift) {
            for (var i = 0; i < chunks.length; i++) {
                var chunk = chunks[i];
                if (chunk.v1Range.start.row > start.row)
                    chunk.v1Range.start.row += rowShift;
                if (chunk.v1Range.end.row >= start.row)
                    chunk.v1Range.end.row += rowShift;
                if (chunk.v2Range.start.row > start.row)
                    chunk.v2Range.start.row += rowShift;
                if (chunk.v2Range.end.row >= start.row)
                    chunk.v2Range.end.row += rowShift;
            }
        }
        if (rowShift && !this.mustRefresh)
            this.mustRefresh = setTimeout(this.onEndOperation, 20);
    };
    
    this.parse = function() {
        var session = this.session;
        var chunks = [];
        var lines = session.doc.getAllLines();
        var last;
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            if (/^([<|=>])\1{6}( |$)/.test(line)) {
                var ch = line[0];
                if (ch == "<") {
                    last = {};
                    last.startRow = i;
                    last.branch1 = line.substr(8);
                } else if (!last) {
                    continue;
                } if (ch == "|") {
                    last.v1End = i; // shown if merge.conflictstyle="diff3"
                } else if (ch == "=") {
                    if (!last.v1End)
                        last.v1End = i;
                    if (!last.v2Start)
                        last.v2Start = i;
                } else if (ch == ">") {                 
                    last.endRow = i;
                    var v1Range = new Range(last.startRow + 1, 0, last.v1End - 1, Number.MAX_VALUE);
                    var v2Range = new Range(last.v2Start + 1, 0, last.endRow - 1, Number.MAX_VALUE);
                    var origRange = new Range(last.v1End + 1, 0, last.v2Start - 1, Number.MAX_VALUE);
                    if (origRange.start.row > origRange.end.row)
                        origRange = null;
                    chunks.push({
                        v1Range: v1Range,
                        v2Range: v2Range,
                        orig: origRange,
                        v1Text: session.getTextRange(v1Range),
                        v2Text: session.getTextRange(v2Range),
                        origText: origRange && session.getTextRange(origRange),
                        branch1: last.branch1,
                        branch2: line.substr(8),
                        changed1: false,
                        changed2: false
                    });
                    last = null;
                }
            }
        }
        return chunks;
    };
    
    this.removeWidgets = function() {
        var chunks = this.chunks;
        for (var i = 0; i < chunks.length; i++) {
            var chunk = chunks[i];
            this.removeChunk(chunk, false);
        }
        chunks.length = 0;
    };
    this.removeChunk = function(chunk, update) {
        var wm = this.session.widgetManager;
        wm.removeLineWidget(chunk.header);
        wm.removeLineWidget(chunk.splitter);
        wm.removeLineWidget(chunk.footer);
        chunk.resolved = true;
        this.resolved.push(chunk);
        if (update !== false) {
            var i = this.chunks.indexOf(chunk);
            this.chunks.splice(i, 1);
        }
    };
    this.createWidget = function(chunk, pos, count) {
        chunk.header = {
            row: chunk.v1Range.start.row - 1,
            el: document.createElement("div"),
            rowCount: 0,
            coverLine: 1,
            fixedWidth: true
        };
        chunk.splitter = {
            row: chunk.v2Range.start.row - 1,
            el: document.createElement("div"),
            rowCount: 0,
            coverLine: 1,
            fixedWidth: true
        };
        chunk.footer = {
            row: chunk.v2Range.end.row + 1,
            el: document.createElement("div"),
            rowCount: 0,
            coverLine: 1,
            fixedWidth: true
        };
        chunk.header.el.chunk =
        chunk.footer.el.chunk =
        chunk.splitter.el.chunk = chunk;

        chunk.header.el.className = "conflict-widget-1";
        chunk.footer.el.className = "conflict-widget-2";
        chunk.splitter.el.className = "conflict-widget-split";
        
        chunk.header.el.innerHTML = chunk.branch1 + "<span class='ace_comment'> // our changes</span>"
            + "<span class='conflict-button-bottom'>"
            + "<span class='ace_button' actionId='use-1'>Use Me</span>"
            + "<span class='ace_button' actionId='use-1-2'>Use Both</span>"
            + "</span>";
        chunk.footer.el.innerHTML = chunk.branch2 + "<span class='ace_comment'> // their changes</span>"
            + "<span class='conflict-button-top'>"
            + "<span class='ace_button' actionId='use-2'>Use Me</span>"
            + "<span class='ace_button' actionId='use-2-1'>Use Both</span>"
            + "</span>";
        chunk.splitter.el.innerHTML = "&nbsp;<span class='conflict-button-top'>"
            + "<span class='ace_button" + (pos ? "" : " disabled") + "' actionId='prev'>&lt;</span>"
            + "<span class='ace_button" + (pos < count - 1 ? "" : " disabled") + "' actionId='next'>&gt;</span>"
            + "</span>";
        chunk.header.el.onclick = 
        chunk.footer.el.onclick = 
        chunk.splitter.el.onclick = this.onClick;

        chunk.header.el.onmousedown = 
        chunk.footer.el.onmousedown = 
        chunk.splitter.el.onmousedown = this.onMouseDown;
    };
    this.addWidgets = function(session, lineHeight) {
        var wm = session.widgetManager;
        wm.session.lineWidgets && wm.session.lineWidgets.filter(Boolean).forEach(wm.removeLineWidget, wm);
        
        var chunks = this.chunks;
        for (var i = 0; i < chunks.length; i++) {
            var chunk = chunks[i];
            this.createWidget(chunk, i, chunks.length);
    
            wm.addLineWidget(chunk.header);
            wm.addLineWidget(chunk.footer);
            wm.addLineWidget(chunk.splitter); 
        }
    };
    this.onClick = function(e) {
        var el = e.target;
        var chunk = e.currentTarget.chunk;
        var session = this.session;
        var chunks = this.chunks;
        var actionId = el.getAttribute('actionId');
        if (actionId && /^use/.test(actionId)) {
            var text = actionId.split("-").slice(1).map(function(part) {
                return session.getTextRange(part == "1" ? chunk.v1Range : chunk.v2Range);
            }).join("\n");
            session.replace(new Range(chunk.v1Range.start.row - 1, 0, chunk.v2Range.end.row + 1, Number.MAX_VALUE), text);
            this.removeChunk(chunk);
        } else if (actionId == "next" || actionId == "prev") {
            var dir = actionId == "next" ? 1 : -1;
            var i = chunks.indexOf(chunk);
            chunk = chunks[i + dir];
            if (chunk) {
                this.editor.scrollToLine(chunk.v1Range.start.row, true);
                session.selection.moveToPosition(chunk.v1Range.start);
            }
        }
    };
    
    this.onMouseDown = function(e) {
        e.preventDefault();
        var el = e.target;
        var chunk = e.currentTarget.chunk;
        var session = this.session;
        var actionId = el.getAttribute('actionId');
        if (!actionId && chunk) {
            var pos = chunk.v2Range.start;
            if (e.currentTarget.classList.contains("conflict-widget-2"))
                pos = chunk.v2Range.end;
            else if (e.currentTarget.classList.contains("conflict-widget-1"))
                pos = chunk.v1Range.start;
            session.selection.moveToPosition(pos);
        }
    };
    
    // ace dynamic marker
    this.update = function(html, markerLayer, session, config) {
        var start = config.firstRow;
        var end = config.lastRow;
        var chunks = this.chunks;
        if (!chunks) return;
        for (var i = 0; i < chunks.length; i++) {
            var chunk = chunks[i];
            if (chunk.v1Range.start.row > end)
                break;
            if (chunk.v2Range.end.row < start)
                continue;            
            markerLayer.drawFullLineMarker(
                html,
                chunk.v1Range.toScreenRange(session),
                "conflict-marker-1 " + (chunk.changed1 ? "edited" : ""),
                config
            );
            markerLayer.drawFullLineMarker(
                html,
                chunk.v2Range.toScreenRange(session),
                "conflict-marker-2 " + (chunk.changed2 ? "edited" : ""),
                config
            );
        }
    };
    
}).call(ConflictMarker.prototype);


module.exports = function showConflictMarkers(editor) {
    var conflictMarker = new ConflictMarker(editor);
    // conflictMarker.detect();
    return conflictMarker;
};






});