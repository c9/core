define(function(require, exports, module) {
"use strict";

var oop = require("ace/lib/oop");
var event = require("ace/lib/event");
var Range = require("ace/range").Range;
var dom = require("ace/lib/dom");
var config = require("ace/config");

var LineWidgets = require("ace/line_widgets").LineWidgets;
var css = require("text!./styles.css");
var diff_match_patch = require("./diff_match_patch").diff_match_patch;

var SVG_NS = "http://www.w3.org/2000/svg";

var Editor = require("ace/editor").Editor;
var Renderer = require("ace/virtual_renderer").VirtualRenderer;
var UndoManager = require("ace/undomanager").UndoManager;
var EditSession = require("ace/edit_session").EditSession;
require("ace/theme/textmate");
function createEditor() {
    var editor = new Editor(new Renderer(), null);
    editor.session.setUndoManager(new UndoManager());
    return editor;
}

function DiffView(element, options) {
    this.onInput = this.onInput.bind(this);
    this.onConnectorScroll = this.onConnectorScroll.bind(this);
    this.onMouseWheel = this.onMouseWheel.bind(this);
    this.onScroll = this.onScroll.bind(this);
    this.onChangeFold = this.onChangeFold.bind(this);
    this.onChangeTheme = this.onChangeTheme.bind(this);
    
    dom.importCssString(css, "diffview.css");
    this.options = {};
    this.container = element;

    oop.mixin(this.options, {
        showDiffs: true,
        maxDiffs: 5000
    }, options);

    this.orig = this.left = createEditor();
    this.edit = this.right = createEditor();
    this.gutterEl = document.createElement("div");

    element.appendChild(this.left.container);
    element.appendChild(this.gutterEl);
    element.appendChild(this.right.container);

    this.left.setOption("scrollPastEnd", 0.5);
    this.right.setOption("scrollPastEnd", 0.5);
    this.left.setOption("highlightActiveLine", false);
    this.right.setOption("highlightActiveLine", false);
    this.left.setOption("highlightGutterLine", false);
    this.right.setOption("highlightGutterLine", false);
    this.left.setOption("animatedScroll", true);
    this.right.setOption("animatedScroll", true);

    this.markerLeft = new DiffHighlight(this, -1);
    this.markerRight = new DiffHighlight(this, 1);
    this.setSession({
        orig: this.orig.session,
        edit: this.edit.session,
        chunks: []
    });

    this.connector = new Connector(this);
    this.connector.createGutter();
    this.onChangeTheme();
    
    this.$initArrow();
    
    this.$attachEventHandlers();
    
    config.resetOptions(this);
    config._signal("diffView", this);
}


(function() {
    
    /*** theme/session ***/
    this.setSession = function(session) {
        if (this.session) {
            this.$detachSessionEventHandlers();
        }
        this.session = session;
        if (this.session) {
            this.chunks = this.session.chunks;
            this.orig.setSession(session.orig);
            this.edit.setSession(session.edit);
            this.$attachSessionEventHandlers();
        }
    };
    
    this.getSession = function() {
        return this.session;
    };
    
    this.createSession = function() {
        var session = new EditSession("");
        session.setUndoManager(new UndoManager());
        return session;
    };
    
    this.setTheme = function(theme) {
        this.left.setTheme(theme);
    };
    
    this.getTheme = function() {
        return this.left.getTheme();
    };
    
    this.onChangeTheme = function() {
        this.right.setTheme(this.left.getTheme());
        var theme = this.right.renderer.theme;
        this.gutterEl.className = "ace_diff-gutter " + theme.cssClass;
        dom.setCssClass(this.gutterEl, "ace_dark", theme.isDark);
    };
    
    this.resize = function() {
        this.edit.resize();
        this.orig.resize();
    };
    
    /*** compute diff ***/
    this.getDmp = function() {
        var dmp = new diff_match_patch();
        return dmp;
    };
    this.onInput = 
    this.computeDiff = function() {
        var val1 = this.left.session.doc.getAllLines();
        var val2 = this.right.session.doc.getAllLines();
        
        var chunks = this.$diffLines(val1, val2);
        
        this.session.chunks = this.chunks = chunks;
        // if we"re dealing with too many chunks, fail silently
        if (this.chunks.length > this.options.maxDiffs) {
            return;
        }
        
        if (this.$alignDiffs)
            this.align();
    
        this.left.renderer.updateBackMarkers();
        this.right.renderer.updateBackMarkers();
    };
    
    this.$diffLines = function(val1, val2) {
        var dmp = this.getDmp();
        var a = diff_linesToChars_(val1, val2);
        var diff = dmp.diff_main(a.chars1, a.chars2, false);
        var chunks = [];
        var offset = {
            left: 0,
            right: 0
        };
        var lastChunk;
        diff.forEach(function(chunk) {
            var chunkType = chunk[0];
            var length = chunk[1].length;
    
            // oddly, occasionally the algorithm returns a diff with no changes made
            if (length === 0) {
                return;
            }
            if (chunkType === 0) {
                offset.left += length;
                offset.right += length;
                lastChunk = null;
            }
            else if (chunkType === -1) {
                if (lastChunk) {
                    lastChunk.origEnd = Math.max(offset.left + length, lastChunk.origEnd);
                    lastChunk.editEnd = Math.max(offset.right, lastChunk.editEnd);
                } else {
                    chunks.push(lastChunk = {
                        origStart: offset.left,
                        origEnd: offset.left + length,
                        editStart: offset.right,
                        editEnd: offset.right,
                    });
                }
                offset.left += length;
            }
            else if (chunkType === 1) {
                if (lastChunk) {
                    lastChunk.origEnd = Math.max(offset.left, lastChunk.origEnd);
                    lastChunk.editEnd = Math.max(offset.right + length, lastChunk.editEnd);
                } else {
                    chunks.push(lastChunk = {
                        origStart: offset.left,
                        origEnd: offset.left,
                        editStart: offset.right,
                        editEnd: offset.right + length,
                    });
                }
                offset.right += length;
            }
        }, this);
    
        chunks.forEach(function(diff) {
            var inlineChanges = [];
            var type = 0;
            if (diff.origStart == diff.origEnd) {
                type = 1;
            } else if (diff.editStart == diff.editEnd) {
                type = -1;
            } else {
                var inlineDiff = dmp.diff_main(
                    val1.slice(diff.origStart, diff.origEnd).join("\n"),
                    val2.slice(diff.editStart, diff.editEnd).join("\n"),
                    false
                );
                dmp.diff_cleanupSemantic(inlineDiff);
                inlineDiff.forEach(function(change) {
                    var text = change[1];
                    var lines = text.split("\n");
                    var rowCh = lines.length - 1;
                    var colCh = lines[rowCh].length;
                    var changeType = change[0];
                    if (text.length) {
                        inlineChanges.push([changeType, rowCh, colCh]);
                        // if (changeType) {
                        //     if (!type) {
                        //         type = changeType;
                        //     } else if (type != changeType) {
                        //         type = 2;
                        //     }
                        // }
                    }
                });
            }
            diff.inlineChanges = inlineChanges;
            diff.type = type;
        });
        return chunks;
    };
    
    /*** scroll locking ***/
    this.align = function() {
        var diffView = this;
        function add(editor, w) {
            editor.session.lineWidgets[w.row] = w;
            editor.session.widgetManager.lineWidgets.push(w);
        }
        function init(editor) {
            var session = editor.session;
            if (!session.widgetManager) {
                session.widgetManager = new LineWidgets(session);
                session.widgetManager.attach(editor);
            }
            editor.session.lineWidgets = [];
            editor.session.widgetManager.lineWidgets = [];
        }
        init(diffView.edit);
        init(diffView.orig);
        diffView.chunks.forEach(function(ch) {
            var diff1 = ch.origEnd - ch.origStart;
            var diff2 = ch.editEnd - ch.editStart;

            if (diff1 < diff2) {
                add(diffView.orig, {
                    rowCount: diff2 - diff1,
                    row: ch.origEnd - 1
                });
            }
            else if (diff1 > diff2) {
                add(diffView.edit, {
                    rowCount: diff1 - diff2,
                    row: ch.editEnd - 1
                });
            }
        });
        diffView.edit.session._emit("changeFold", { data: { start: { row: 0 }}});
        diffView.orig.session._emit("changeFold", { data: { start: { row: 0 }}});
    };

    this.onScroll = function(e, session) {
        this.syncScroll(this.left.session == session ? this.left.renderer : this.right.renderer);
    };
    this.syncScroll = function(renderer) {
        if (this.$syncScroll == false) return;

        var r1 = this.left.renderer;
        var r2 = this.right.renderer;
        var isOrig = renderer == r1;
        if (r1.$scrollAnimation && r2.$scrollAnimation) return;

        var now = Date.now();
        if (this.scrollSetBy != renderer && now - this.scrollSetAt < 500) return;
        
        var r = isOrig ? r1 : r2;
        if (this.scrollSetBy != renderer) {
            if (isOrig && this.scrollOrig == r.session.getScrollTop())
                return;
            else if (!isOrig && this.scrollEdit == r.session.getScrollTop())
                return;
        }
        var rOther = isOrig ? r2 : r1;
        
        if (this.$alignDiffs) {
            targetPos = r.session.getScrollTop();
        } else {
            var layerConfig = r.layerConfig;
            var chunks = this.chunks;
            var halfScreen = 0.4 * r.$size.scrollerHeight;
    
            var lc = layerConfig;
            var midY = halfScreen + r.scrollTop;
            var mid = r.session.screenToDocumentRow(midY / lc.lineHeight, 0);
    
            var i = findChunkIndex(chunks, mid, isOrig);
            var ch = chunks[i];
    
            if (!ch) {
                ch = {
                    editStart: 0,
                    editEnd: 0,
                    origStart: 0,
                    origEnd: 0
                };
            }
            if (mid >= (isOrig ? ch.origEnd : ch.editEnd)) {
                var next = chunks[i + 1] || {
                    editStart: r2.session.getLength(),
                    editEnd: r2.session.getLength(),
                    origStart: r1.session.getLength(),
                    origEnd: r1.session.getLength()
                };
                ch = {
                    origStart: ch.origEnd,
                    origEnd: next.origStart,
                    editStart: ch.editEnd,
                    editEnd: next.editStart
                };
            }
            if (r == r1) {
                var start = ch.origStart;
                var end = ch.origEnd;
                var otherStart = ch.editStart;
                var otherEnd = ch.editEnd;
            }
            else {
                otherStart = ch.origStart;
                otherEnd = ch.origEnd;
                start = ch.editStart;
                end = ch.editEnd;
            }
    
            var offOtherTop = rOther.session.documentToScreenRow(otherStart, 0) * lc.lineHeight;
            var offOtherBot = rOther.session.documentToScreenRow(otherEnd, 0) * lc.lineHeight;
    
            var offTop = r.session.documentToScreenRow(start, 0) * lc.lineHeight;
            var offBot = r.session.documentToScreenRow(end, 0) * lc.lineHeight;
    
            var ratio = (midY - offTop) / (offBot - offTop || offOtherBot - offOtherTop);
            var targetPos = (offOtherTop - halfScreen) + ratio * (offOtherBot - offOtherTop);
            targetPos = Math.max(0, targetPos);
        }
        
        this.$syncScroll = false;

        if (isOrig) {
            this.scrollOrig = r.session.getScrollTop();
            this.scrollEdit = targetPos;
        }
        else {
            this.scrollOrig = targetPos;
            this.scrollEdit = r.session.getScrollTop();
        }
        this.scrollSetBy = renderer;
        rOther.session.setScrollTop(targetPos);
        this.$syncScroll = true;
        this.scrollSetAt = now;
    };
    this.onConnectorScroll = function(ev) {
        var dir = ev.wheelY > 0 ? 1 : -1;
        var r1 = this.left.renderer;
        var r2 = this.right.renderer;
        if (r1.$scrollAnimation && r2.$scrollAnimation) return;
        
        var minAmount = ev.wheelY * 2;

        var r = r1.session.getLength() > r2.session.getLength() ? r1 : r2;
        var layerConfig = r.layerConfig;
        var chunks = this.chunks;
        var halfScreen = 0.5 * r.$size.scrollerHeight;
        var lc = layerConfig;
        var isOrig = r == r1;
        var midY = halfScreen + r.scrollTop;
        var mid = r.session.screenToDocumentRow(midY / lc.lineHeight, 0);
        var i = findChunkIndex(chunks, mid, isOrig);
        var ch = chunks[i];

        if (dir < 0) {
            if (!ch)
                ch = {
                    editStart: 0,
                    editEnd: 0,
                    origStart: 0,
                    origEnd: 0
                };
            else if (mid < (isOrig ? ch.origEnd : ch.editEnd))
                ch = chunks[i - 1] || ch;
            else
                ch = chunks[i];
        }
        else {
            ch = chunks[i + 1] || {
                editStart: r2.session.getLength(),
                editEnd: r2.session.getLength(),
                origStart: r1.session.getLength(),
                origEnd: r1.session.getLength()
            };
        }
        
        var scrollTop1 = r1.session.getScrollTop();
        var scrollTop2 = r2.session.getScrollTop();
        this.$syncScroll = false;
        r1.scrollToLine(ch.origStart, true, true);
        r2.scrollToLine(ch.editStart, true, true);
        this.$syncScroll = true;
        if (Math.abs(scrollTop1 - r1.session.getScrollTop()) <= 1
            && Math.abs(scrollTop2 - r2.session.getScrollTop()) <= 1
        ) {
            if (r1.isScrollableBy(0, minAmount))
            r1.scrollBy(0, minAmount);
        }
        
    };
    this.onMouseWheel = function(ev) {
        if (ev.getAccelKey())
            return;
        if (ev.getShiftKey() && ev.wheelY && !ev.wheelX) {
            ev.wheelX = ev.wheelY;
            ev.wheelY = 0;
        }

        var editor = ev.editor;
        var isScrolable = editor.renderer.isScrollableBy(ev.wheelX * ev.speed, ev.wheelY * ev.speed);
        if (!isScrolable) {
            var other = editor == this.left ? this.right : this.left;
            if (other.renderer.isScrollableBy(ev.wheelX * ev.speed, ev.wheelY * ev.speed))
                other.renderer.scrollBy(ev.wheelX * ev.speed, ev.wheelY * ev.speed);
            return ev.stop();
        }
    };
    this.onChangeFold = function(ev, session) {
        if (ev.action == "remove") {
            var other = session == this.orig.session ? this.edit.session : this.orig.session;
            var fold = ev.data;
            if (fold && fold.other) {
                fold.other.other = null;
                other.removeFold(fold.other);
            }
        }
    };
    
    this.$attachSessionEventHandlers = function() {
        this.left.session.on("changeScrollTop", this.onScroll);
        this.right.session.on("changeScrollTop", this.onScroll);
        this.left.session.on("changeFold", this.onChangeFold);
        this.right.session.on("changeFold", this.onChangeFold);
        this.left.session.addDynamicMarker(this.markerLeft);
        this.right.session.addDynamicMarker(this.markerRight);
    };
    
    this.$detachSessionEventHandlers = function() {
        this.left.session.off("changeScrollTop", this.onScroll);
        this.right.session.off("changeScrollTop", this.onScroll);
        this.left.session.off("changeFold", this.onChangeFold);
        this.right.session.off("changeFold", this.onChangeFold);
        this.left.session.removeMarker(this.markerLeft.id);
        this.right.session.removeMarker(this.markerRight.id);
    };
    
    this.$attachEventHandlers = function() {
        var _self = this;
        this.left.renderer.on("themeLoaded", this.onChangeTheme);
        this.right.renderer.on("afterRender", function() {
            if (!_self.left.renderer.$loop.changes)
                _self.connector.decorate();
        });
        this.left.renderer.on("afterRender", function() {
            if (!_self.right.renderer.$loop.changes)
                _self.connector.decorate();
        });
    
        event.addMouseWheelListener(this.gutterEl, this.onConnectorScroll);
    
        this.left.on("mousewheel", this.onMouseWheel);
        this.right.on("mousewheel", this.onMouseWheel);
        
        this.left.on("input", this.onInput);
        this.right.on("input", this.onInput);
    };
    
    this.$initArrow = function() {
        var arrow = document.createElement("div");
        this.gutterEl.appendChild(arrow);
        
        var region = 0;
        var diffView = this;
        arrow.addEventListener("click", function(e) {
            if (region && region.chunk) {
                var range = diffView.useChunk(region.chunk, region.side == 1);
                var editor = region.side == 1 ? diffView.orig : diffView.edit;
                editor.selection.moveToPosition(range.start);
                editor.focus();
            }
            hide();
        });
        this.gutterEl.addEventListener("mousemove", function(e) {
            var rect = e.currentTarget.getBoundingClientRect();
            var x = e.clientX - rect.left;
            var y = e.clientY; // - rect.top;
            
            if (!region) {
                arrow.style.display = "";
                region = {};
            }
            
            if (x < rect.width / 2) {
                if (region.side != -1)
                    arrow.className = "diff-arrow diff-arrow-left";
                region.side = -1;
            } else {
                if (region.side != 1)
                    arrow.className = "diff-arrow diff-arrow-right";
                region.side = 1;
            }
            var editor = region.side == 1 ? diffView.edit : diffView.orig;
            var other = editor == diffView.edit ? diffView.orig : diffView.edit;
            var renderer = editor.renderer;
            
            if (other.getReadOnly())
                return hide();
            
            var p = renderer.screenToTextCoordinates(x, y);
            var row = p.row;
            if (row == renderer.session.getLength() - 1)
                row++;
            var chunks = diffView.chunks;
            var i = findChunkIndex(chunks, row, region.side == -1);
            if (i == -1) i = 0;
            var ch = chunks[i] || chunks[chunks.length - 1];
            var next = chunks[i + 1];
            
            var side = region.side == -1 ? "orig" : "edit";
            if (next && ch) {
                if (ch[side + "End"] + next[side + "Start"] < 2 * row)
                    ch = next;
            }
            region.chunk = ch;
            if (!ch)
                return hide();
            if (renderer.layerConfig.firstRow > ch[side + "End"])
                return hide();
            if (renderer.layerConfig.lastRow < ch[side + "Start"] - 1)
                return hide();
            
            var screenPos = renderer.$cursorLayer.getPixelPosition({
                row: ch[side + "Start"],
                column: 0
            }, true).top;
            if (screenPos < renderer.layerConfig.offset)
                screenPos = renderer.layerConfig.offset;
            arrow.style.top = screenPos - renderer.layerConfig.offset + "px";
            if (region.side == -1) {
                arrow.style.left = "2px";
                arrow.style.right = "";
            } else {
                arrow.style.left = "";
                arrow.style.right = "2px";
            }
        }.bind(this));
        this.gutterEl.addEventListener("mouseout", function(e) {
            hide();
        });
        event.addMouseWheelListener(this.gutterEl, hide);
        function hide() {
            if (region) {
                region = null;
                arrow.style.display = "none";
            }
        }
    };
    
    /*** other ***/
    this.destroy = function() {
        this.left.destroy();
        this.right.destroy();
    };
    
    this.foldUnchanged = function() {
        this.edit.session.unfold();
        this.orig.session.unfold();
        
        var chunks = this.chunks;
        var sep = "---";
        var prev = { editEnd: 0, origEnd: 0 };
        for (var i = 0; i < chunks.length + 1; i++) {
           var ch = chunks[i] || {
               editStart: this.edit.session.getLength(),
               origStart: this.orig.session.getLength()
           };
           var l = ch.editStart - prev.editEnd - 5;
           if (l > 2) {
               var s = prev.origEnd + 2;
               var f1 = this.orig.session.addFold(sep, new Range(s, 0, s + l, Number.MAX_VALUE));
               s = prev.editEnd + 2;
               var f2 = this.edit.session.addFold(sep, new Range(s, 0, s + l, Number.MAX_VALUE));
               f1.other = f2;
               f2.other = f1;
           }
           prev = ch;
        }
    };
    
    this.gotoNext = function(dir) {
        var orig = false;
        var ace = orig ? this.orig : this.edit;
        var row = ace.selection.lead.row;
        var i = findChunkIndex(this.chunks, row, orig);
        var chunk = this.chunks[i + dir] || this.chunks[i];
        
        var scrollTop = ace.session.getScrollTop();
        if (chunk) {
            var line = Math.max(chunk.editStart, chunk.editEnd - 1);
            ace.selection.setRange(new Range(line, 0, line, 0));
        }
        ace.renderer.scrollSelectionIntoView(ace.selection.lead, ace.selection.anchor, 0.5);
        ace.renderer.animateScrolling(scrollTop);
    };
    
    this.transformPosition = function(pos, orig) {
        var chunkIndex = findChunkIndex(this.chunks, pos.row, orig);
        var chunk = this.chunks[chunkIndex];
        
        var result = {
            row: pos.row,
            column: pos.column
        };
        if (orig) {
            if (chunk.origEnd <= pos.row) {
                result.row = pos.row - chunk.origEnd + chunk.editEnd;
            } 
            else {
                console.log("======================================");
                var d = pos.row - chunk.origStart;
                var c = pos.column;
                var r1 = 0, c1 = 0, r2 = 0, c2 = 0;
                var inlineChanges = chunk.inlineChanges;
                for (var i = 0; i < inlineChanges.length; i++) {
                    var diff = inlineChanges[i];
                    if (diff[1]) {
                        if (diff[0] == 0) {
                            r1 += diff[1];
                            r2 += diff[1];
                            if (r1 == d)
                                c2 = c1 = diff[2];
                        } else if (diff[0] == 1) {
                            r2 += diff[1];
                            if (r1 == d)
                                c2 = diff[2];
                        } else if (diff[0] == -1) {
                            r1 += diff[1];
                            if (r1 == d)
                                c1 = diff[2];
                        }
                    }
                    else if (r1 == d) {
                        if (diff[0] == 0) {
                            c1 += diff[2];
                            c2 += diff[2];
                        } else if (diff[0] == 1) {
                            c2 += diff[2];
                        } else if (diff[0] == -1) {
                            c1 += diff[2];
                        }
                    }
                    console.log(diff + "", r1, c1, r2, c2, d, c);
                    if (r1 > d || r1 == d && c1 >= c) {
                        break;
                    }
                }

                if (r1 > d) {
                    r2 -= r1 - d;
                }
                if (c1 != c) {
                    c2 -= c1 - c;
                }
                result.row = r2 + chunk.editStart;
                result.column = c2;
            }
        }

        return result;
    };
    
    this.useChunk = function(chunk, toOrig) {
        var origRange = new Range(chunk.origStart, 0, chunk.origEnd, 0);
        var editRange = new Range(chunk.editStart, 0, chunk.editEnd, 0);
        
        var srcEditor = toOrig ? this.edit : this.orig;
        var destEditor = toOrig ? this.orig : this.edit;
        var destRange = toOrig ? origRange : editRange;
        var srcRange = toOrig ? editRange : origRange;
        
        var value = srcEditor.session.getTextRange(srcRange);
        // missing eol at the end of document
        if (srcRange.isEmpty() && !destRange.isEmpty()) {
            if (destRange.end.row == destEditor.session.getLength()) {
                destRange.start.row--;
                destRange.start.column = Number.MAX_VALUE;
            }
        } else if (destRange.isEmpty() && !srcRange.isEmpty()) {
            if (srcRange.end.row == srcEditor.session.getLength()) {
                value = "\n" + value;
            }
        }
        destRange.end = destEditor.session.replace(destRange, value);
        return destRange;
    };
    
    this.transformRange = function(range, orig) {
        return Range.fromPoints(
            this.transformPosition(range.start, orig),
            this.transformPosition(range.end, orig)
        ); 
    };
    
    this.findChunkIndex = function(row, orig) {
        return findChunkIndex(this.chunks, row, orig);
    };
    
    /*** patch ***/
    this.createPatch = function(options) {
        var chunks = this.chunks;
        var editLines = this.edit.session.doc.getAllLines();
        var origLines = this.orig.session.doc.getAllLines();
        var path1 = options.path1 || options.path || "_";
        var path2 = options.path2 || path1;
        var patch = [
            "diff --git a/" + path1 + " b/" + path2,
            "--- a/" + path1,
            "+++ b/" + path2,
        ].join("\n");
        
        if (!chunks.length) {
            chunks = [{
                origStart: 0,
                origEnd: 0,
                editStart: 0,
                editEnd: 0
            }];
        }
        
        function header(s1, c1, s2, c2) {
            return "@@ -" + (c1 ? s1 + 1 : s1) + "," + c1
                + " +" + (c2 ? s2 + 1 : s2) + "," + c2 + " @@";
        }
        
        var context = options.context || 0;
        // changed newline at the end of file
        var editEOF = !editLines[editLines.length - 1];
        var origEOF = !origLines[origLines.length - 1];
        if (editEOF)
            editLines.pop();
        if (origEOF)
            origLines.pop();
        if (editEOF != origEOF) {
            chunks = chunks.slice();
            var last = chunks.pop();
            chunks.push(last = {
                origStart: Math.min(last.origStart, origLines.length - 1),
                origEnd: Math.min(last.origEnd, origLines.length),
                editStart: Math.min(last.editStart, editLines.length - 1),
                editEnd: Math.min(last.editEnd, editLines.length)
            });
        }
        
        var hunk = "";
        var start1 = 0;
        var start2 = 0;
        var end1 = 0;
        var end2 = 0;
        var length1 = 0;
        var length2 = 0;
        var mergeWithNext = false;
        for (var i = 0; i < chunks.length; i++) {
            var ch = chunks[i];
            var s1 = ch.origStart;
            var e1 = ch.origEnd;
            var s2 = ch.editStart;
            var e2 = ch.editEnd;
            var next = chunks[i + 1];
            
            
            start1 = Math.max(s1 - context, end1);
            start2 = Math.max(s2 - context, end2);
            end1 = Math.min(e1 + context, origLines.length);
            end2 = Math.min(e2 + context, editLines.length);
            
            mergeWithNext = false;
            if (next) {
                if (end1 >= next.origStart - context) {
                    end1 = next.origStart;
                    end2 = next.editStart;
                    mergeWithNext = true;
                }
            }
            
            for (var j = start1; j < s1; j++)
                hunk += "\n " + origLines[j];
            for (var j = s1; j < e1; j++)
                hunk += "\n-" + origLines[j];
            if (ch == last && editEOF)
                hunk += "\n\\ No newline at end of file";
            for (var j = s2; j < e2; j++)
                hunk += "\n+" + editLines[j];
            if (ch == last && origEOF)
                hunk += "\n\\ No newline at end of file";
            for (var j = e1; j < end1; j++)
                hunk += "\n " + origLines[j];
            
            length1 += end1 - start1;
            length2 += end2 - start2;
            if (mergeWithNext)
                continue;
                
            patch += "\n" + header(end1 - length1, length1, end2 - length2, length2) + hunk;
            length2 = length1 = 0;
            hunk = "";
        }
        
        if (!editEOF && !origEOF && end1 == origLines.length) {
            patch += "\n\\ No newline at end of file";
        }
        
        return patch;
    };
    
    this.setValueFromFullPatch = function(fullUniDiff) {
        var lines = fullUniDiff.split("\n");
        var missingEOF = "";
        var oldLines = [];
        var newLines = [];
        var i = 0;
        while (i < lines.length && !(/^@@/.test(lines[i])))
            i++;
        
        while (++i < lines.length) {
            var tag = lines[i][0];
            var line = lines[i].substr(1);
            if (tag === "+") {
                newLines.push(line);
            }
            else if (tag === "-") {
                oldLines.push(line);
            }
            else if (tag === " ") {
                newLines.push(line);
                oldLines.push(line);
            }
            else if (tag === "\\") {
                missingEOF = lines[i - 1][0];
            }
        }
        
        if (missingEOF === "+") {
            oldLines.push("");
        }
        else if (missingEOF === "-") {
            newLines.push("");
        }
        else if (missingEOF === "") {
            newLines.push("");
            oldLines.push("");
        }
        
        this.orig.session.setValue(oldLines.join("\n"));
        this.edit.session.setValue(newLines.join("\n"));
    };
    
    this.applyPatch = function(oldStr, uniDiff) {
        var lines = uniDiff.split("\n");
        var hunks = [];
        var i = 0;
        var EOFChanged = 0;
    
        // Skip to the first change hunk
        while (i < lines.length && !(/^@@/.test(lines[i]))) {
            i++;
        }
    
        // Parse the unified diff
        for (; i < lines.length; i++) {
            var tag = lines[i][0];
            var line = lines[i].substr(1);
            if (tag === "@") {
                var chunkHeader = /@@ -(\d+)(?:,(\d*))? \+(\d+)(?:,(\d*)) @@/.exec(line);
                hunks.unshift({
                    start: +chunkHeader[1],
                    oldlength: +chunkHeader[2] || 1,
                    removed: [],
                    added: []
                });
            }
            else if (tag === "+") {
                hunks[0].added.push(line);
            }
            else if (tag === "-") {
                hunks[0].removed.push(line);
            }
            else if (tag === " ") {
                hunks[0].added.push(line);
                hunks[0].removed.push(line);
            }
            else if (tag === "\\") {
                if (lines[i - 1][0] === "+")
                    EOFChanged = 1;
                else if (lines[i - 1][0] === "-")
                    EOFChanged = -1;
            }
        }
    
        // Apply the diff to the input
        lines = oldStr.split("\n");
        for (i = hunks.length - 1; i >= 0; i--) {
            var hunk = hunks[i];
            // Sanity check the input string. Bail if we don't match.
            for (var j = 0; j < hunk.oldlength; j++) {
                if (lines[hunk.start - 1 + j] !== hunk.removed[j]) {
                    return false;
                }
            }
            lines.splice.apply(lines, [hunk.start - 1, hunk.oldlength].concat(hunk.added));
        }
    
        // Handle EOFNL insertion/removal
        if (EOFChanged == -1) {
            while (!lines[lines.length - 1]) {
                lines.pop();
            }
        }
        else if (EOFChanged == 1) {
            lines.push("");
        }
        return lines.join("\n");
    };
    
    /*** options ***/
    config.defineOptions(this, "editor", {
        alignDiffs: {
            set: function(val) {
                if (val)
                    this.align();
            },
            initialValue: false
        },
    });
}).call(DiffView.prototype);


var diff_linesToChars_ = function(text1, text2) {
    var lineHash = Object.create(null);
    var lineCount = 1;

    function diff_linesToCharsMunge_(lines) {
        var chars = "";
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (typeof lineHash[line] === "number") {
                chars += String.fromCharCode(lineHash[line]);
            }
            else {
                chars += String.fromCharCode(lineCount);
                lineHash[line] = lineCount++;
            }
        }
        return chars;
    }
    var chars1 = diff_linesToCharsMunge_(text1);
    var chars2 = diff_linesToCharsMunge_(text2);
    return {
        chars1: chars1,
        chars2: chars2
    };
};

function findChunkIndex(chunks, row, orig) {
    if (orig) {
        for (var i = 0; i < chunks.length; i++) {
            var ch = chunks[i];
            if (ch.origEnd < row) continue;
            if (ch.origStart > row) break;
        }
    }
    else {
        for (var i = 0; i < chunks.length; i++) {
            var ch = chunks[i];
            if (ch.editEnd < row) continue;
            if (ch.editStart > row) break;
        }
    }
    return i - 1;
}

var Connector = function(diffView) {
    this.diffView = diffView;
};
(function() {
    this.addConnector = function(diffView, origStart, origEnd, editStart, editEnd, type) {
        origStart = Math.ceil(origStart);
        origEnd = Math.ceil(origEnd);
        editStart = Math.ceil(editStart);
        editEnd = Math.ceil(editEnd);
        
        //  p1   p2
        //
        //  p3   p4
        var p1_x = -1;
        var p1_y = origStart + 0.5;
        var p2_x = diffView.gutterWidth + 1;
        var p2_y = editStart + 0.5;
        var p3_x = -1;
        var p3_y = (origEnd === origStart) ? origEnd + 0.5 : origEnd + 1.5;
        var p4_x = diffView.gutterWidth + 1;
        var p4_y = (editEnd === editStart) ? editEnd + 0.5 : editEnd + 1.5;
        var curve1 = this.getCurve(p1_x, p1_y, p2_x, p2_y);
        var curve2 = this.getCurve(p4_x, p4_y, p3_x, p3_y);
    
        var verticalLine1 = "L" + p2_x + "," + p2_y + " " + p4_x + "," + p4_y;
        var verticalLine2 = "L" + p3_x + "," + p3_y + " " + p1_x + "," + p1_y;
        var d = curve1 + " " + verticalLine1 + " " + curve2 + " " + verticalLine2;
    
        var el = document.createElementNS(SVG_NS, "path");
        el.setAttribute("d", d);
        el.setAttribute("class", "ace_diff-connector" + (
            type == 1 ? " insert" :
            type == -1 ? " delete" : ""
        ));
        diffView.gutterSVG.appendChild(el);
    };
    // generates a Bezier curve in SVG format
    this.getCurve = function(startX, startY, endX, endY) {
        var w = endX - startX;
        var halfWidth = startX + w * 0.5;
    
        // position it at the initial x,y coords
        var curve = "M " + startX + "," + startY +
            // now create the curve. This is of the form "C M,N O,P Q,R" where C is a directive for SVG ("curveto"),
            // M,N are the first curve control point, O,P the second control point and Q,R are the final coords
            " C " + halfWidth + "," + startY + " " + halfWidth + "," + endY + " " + endX + "," + endY;
    
        return curve;
    };
    
    this.createGutter = function() {
        var diffView = this.diffView;
        diffView.gutterWidth = diffView.gutterEl.clientWidth;
        
        var leftHeight = diffView.left.renderer.$size.height;
        var rightHeight = diffView.right.renderer.$size.height;
        var height = Math.max(leftHeight, rightHeight);
    
        diffView.gutterSVG = document.createElementNS(SVG_NS, "svg");
        diffView.gutterSVG.setAttribute("width", diffView.gutterWidth);
        diffView.gutterSVG.setAttribute("height", height);
    
        diffView.gutterEl.appendChild(diffView.gutterSVG);
    };
    
    this.clearGutter = function(diffView) {
        var gutterEl = diffView.gutterEl;
        gutterEl.removeChild(diffView.gutterSVG);
    
        this.createGutter();
    };
    
    this.decorate = function() {
        var diffView = this.diffView;
        if (diffView.$alignDiffs) return;
        
        this.clearGutter(diffView);
        
        var orig = diffView.left;
        var edit = diffView.right;
        var chunks = diffView.chunks;
        var c1 = orig.renderer.layerConfig;
        var c2 = edit.renderer.layerConfig;
        
        // var existing = 
        for (var i = 0; i < chunks.length; i++) {
            var ch = chunks[i];
            if (ch.origEnd < c1.firstRow && ch.editEnd < c2.firstRow)
                continue;
            
            if (ch.origStart > c1.lastRow && ch.editStart > c2.lastRow)
                break;
            
            var origStart = orig.renderer.$cursorLayer.getPixelPosition({
                row: ch.origStart, column: 0
            }, true).top - c1.offset;
            var origEnd = orig.renderer.$cursorLayer.getPixelPosition({
                row: ch.origEnd, column: 0
            }, true).top - c1.offset;
            var editStart = edit.renderer.$cursorLayer.getPixelPosition({
                row: ch.editStart, column: 0
            }, true).top - c2.offset;
            var editEnd = edit.renderer.$cursorLayer.getPixelPosition({
                row: ch.editEnd, column: 0
            }, true).top - c2.offset;
            
            if (i == chunks.length - 1) {
                if (ch.origEnd >= orig.session.getLength())
                    origEnd += c1.lineHeight;
                if (ch.origStart >= orig.session.getLength())
                    origStart += c1.lineHeight;
                if (ch.editEnd >= edit.session.getLength())
                    editEnd += c1.lineHeight;
                if (ch.editStart >= edit.session.getLength())
                    editStart += c1.lineHeight;
            }
            
            this.addConnector(diffView, origStart, origEnd, editStart, editEnd, ch.type);
        }
    };
    
}).call(Connector.prototype);




var DiffHighlight = function(diffView, type) {
    this.diffView = diffView;
    this.type = type;
};

(function() {
    this.MAX_RANGES = 500;

    this.update = function(html, markerLayer, session, config) {
        var start = config.firstRow;
        var end = config.lastRow;

        var diffView = this.diffView;
        var chunks = diffView.chunks;
        var isOrig = this.type == -1;
        var type = this.type;
        var index = findChunkIndex(chunks, start, isOrig);
        if (index == -1 && chunks.length && (isOrig ? chunks[0].origStart : chunks[0].editStart) > start)
            index = 0;
        var chunk = chunks[index];
        while (chunk) {
            if (isOrig) {
                if (chunk.origStart > end && chunk.origStart != chunk.origEnd)
                    return;
                var range = new Range(chunk.origStart, 0, chunk.origEnd - 1, 1);
                var l1 = chunk.origEnd - chunk.origStart;
                var l2 = chunk.editEnd - chunk.editStart;
            }
            else {
                if (chunk.editStart > end && chunk.editStart != chunk.editEnd)
                    return;
                range = new Range(chunk.editStart, 0, chunk.editEnd - 1, 1);
                l1 = chunk.origEnd - chunk.origStart;
                l2 = chunk.editEnd - chunk.editStart;
            }
            var className = "";
            if (!l1 && isOrig || !l2 && !isOrig) {
                className = range.start.row == session.getLength() ? "insertEnd" : "insertStart";
            }
            className += chunk.type == -1 ? " delete" : chunk.type == 1 ? " insert" : "";

            markerLayer.drawFullLineMarker(html, range.toScreenRange(session),
                "ace_diff " + className, config);
            var inlineChanges = chunk.inlineChanges;
            var row = range.start.row;
            var column = 0;
            for (var j = 0; j < inlineChanges.length; j++) {
                var diff = inlineChanges[j];
                if (diff[0] == 0) {
                    if (diff[1]) {
                        row += diff[1];
                        column = diff[2];
                    }
                    else {
                        column += diff[2];
                    }
                }
                else {
                    range.start.row = row;
                    range.start.column = column;
                    if (row > end)
                        break;
                    if (diff[0] == (isOrig ? -1 : 1)) {
                        type = isOrig ? "delete" : "insert";
                        if (diff[1]) {
                            row += diff[1];
                            column = diff[2];
                        }
                        else {
                            column += diff[2];
                        }
                    }
                    else {
                        type = isOrig ? "insert" : "delete";
                    }
                    if (row < start)
                        continue;
                    range.end.row = row;
                    range.end.column = column;
                    if (range.isEmpty())
                        type += " empty";
                    
                    var screenRange = range.clipRows(start, end).toScreenRange(session);
                    if (screenRange.isMultiLine()) {
                        markerLayer.drawTextMarker(html, screenRange, "ace_diff inline " + type, config);
                    }
                    else {
                        markerLayer.drawSingleLineMarker(html, screenRange, "ace_diff inline " + type, config);
                    }
                }
            }
            chunk = chunks[++index];
        }
    };

}).call(DiffHighlight.prototype);



module.exports.DiffView = DiffView;

});
