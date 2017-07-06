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

var dom = require("ace/lib/dom");
var Anchor = require("ace/anchor").Anchor;

var HashHandler = require("ace/keyboard/hash_handler").HashHandler;
var Range = require("ace/range").Range;
var comparePoints = Range.comparePoints;

var ReplCell = require("./repl_cell").ReplCell;

var css = require("ace/requirejs/text!./repl.css");
dom.importCssString(css, "ace_repl");


var replCommands = new HashHandler([{
    name: "newLine",
    bindKey: { win: "Shift-Return|Alt-Enter", mac: "Shift-Return|Alt-Enter" },
    exec: function(editor) {editor.insert("\n");},
    scrollIntoView: "cursor"
}, {
    name: "eval",
    bindKey: "Ctrl-Return|Cmd-Return",
    exec: function(editor) {return editor.repl.eval(true);},
    scrollIntoView: "cursor"
}, {
    name: "evalOrNewLine",
    bindKey: "Return",
    exec: function(editor) {return editor.repl.eval();},
    scrollIntoView: "cursor"
}, {
    name: "down",
    bindKey: "down",
    exec: function(editor) {return editor.repl.navigateHistory(1);},
    scrollIntoView: "center-animate"
}, {
    name: "up",
    bindKey: "up",
    exec: function(editor) {return editor.repl.navigateHistory(-1);},
    scrollIntoView: "center-animate"
}, {
    name: "prevCell",
    bindKey: { mac: "cmd-up", win: "ctrl-up" },
    exec: function(editor) {return editor.repl.moveByCells(-1, null, "input");},
    scrollIntoView: "center-animate"
}, {
    name: "nextCell",
    bindKey: { mac: "cmd-down", win: "ctrl-down" },
    exec: function(editor) {return editor.repl.moveByCells(1, null, "input");},
    scrollIntoView: "center-animate"
}, {
    name: "firstCell",
    bindKey: { mac: "alt-up|ctrl-home", win: "ctrl-home" },
    exec: function(editor) {return editor.repl.moveByCells("first", null, "input");},
    scrollIntoView: "center-animate"
}, {
    name: "lastCell",
    bindKey: { mac: "alt-down|ctrl-end", win: "ctrl-end" },
    exec: function(editor) {return editor.repl.moveByCells("last", null, "input");},
    scrollIntoView: "center-animate"
}, {
    name: "clear",
    bindKey: { mac: "cmd-k", win: "Alt-k" },
    exec: function(editor) {return editor.repl.clear();},
    scrollIntoView: "center-animate"
}, {
    name: "removeOutputCell",
    bindKey: { mac: "Shift-delete", win: "Shift-delete" },
    exec: function(editor) {return editor.repl.removeOutputCell();},
    scrollIntoView: "cursor"
}, {
    name: "newInputCell",
    bindKey: { mac: "ctrl-insert", win: "ctrl-insert" },
    exec: function(editor) { editor.repl.insertCell();},
    scrollIntoView: "center-animate"
}]);


for (var key in replCommands.commands) {
    replCommands.commands[key].isRepl = true;
}


/******************************************************/
var Repl = function(session, options) {
    options = options || {};
    this.history = new History();
    this.evaluator = options.evaluator || new Evaluator();
    this.session = session;

    this._replResize = this._replResize.bind(this);
    this.updateCellsOnChange = this.updateCellsOnChange.bind(this);
    this.updateWidgets = this.updateWidgets.bind(this);
    this.measureWidgets = this.measureWidgets.bind(this);
    this.session._changedWidgets = [];
    this.detach = this.detach.bind(this);
    
    this.session.on("change", this.updateCellsOnChange);

    session.repl = this;

    session.replCells = [];
    var pos = { row: session.getLength(), column: 0 };
    if (!session.getValue() && options.message)
        pos = session.insert(pos, options.message);
    if (session.getValue())
        this.insertCell({ row: 0, column: 0 }, { type: "start" }, true);
    var last = this.insertCell(pos, { type: "input" });
    this.select(last.range.end);
    

    this.session.on("changeMode", function() {
        session.getFoldWidget = function(row) {
            if (!session.replCells[row])
                return;
            if (session.replCells[row + 1])
                return;
            if (row == session.replCells.length - 1)
                return;
            if (session.replCells[row].lineWidget)
                return;
            return "start";
        };
        session.getFoldWidgetRange = function(row) {
            return session.repl.getCellAt(row).range;
        };
        session.bgTokenizer.$tokenizeRow = session.repl.$tokenizeRow;
        session.bgTokenizer.session = session;
    });
    
    session.getRowLength = function(row) {
        if (this.lineWidgets)
            var h = this.lineWidgets[row] && this.lineWidgets[row].rowCount || 0;
        else 
            h = 0;
        if (!this.$useWrapMode || !this.$wrapData[row]) {
            return 1 + h;
        } else {
            return this.$wrapData[row].length + 1 + h;
        }
    };


    session.$getWidgetScreenLength = function() {
        var screenRows = 0;
        this.lineWidgets.forEach(function(w) {
            if (w && w.rowCount)
                screenRows += w.rowCount;
        });
        return screenRows;
    };
    
    session.gutterRenderer = this.gutterRenderer;
    
    this.session.setMode(options.mode);

    this.$updateSession();
    this._addCursorMonitor();
};

(function() {
    this.message = "\nWelcome to ace repl!\n";
    
    this.setEvaluator = function(evaluator) {
        this.evaluator = evaluator;
    };
    this.getEvaluator = function() {
        return this.evaluator;
    };
    
    this._replResize = function(oldSize, renderer) {
        var session = renderer.session;
        var size = renderer.$size;
        var dh = size.scrollerHeight - oldSize.scrollerHeight;
        if (dh > 0) 
            return;
            
        var oldMaxScrollTop = renderer.layerConfig.maxHeight
            - oldSize.scrollerHeight + renderer.scrollMargin.v;
        var scrollTop = session.getScrollTop();
        if (scrollTop > oldMaxScrollTop - renderer.layerConfig.lineHeight) {
            session.setScrollTop(scrollTop - dh);
        }
    };
    
    this.gutterRenderer = {
        getText: function(session, row) {
            var cell = session.replCells[row];
            if (cell)
                return cell.prompt || "";
            return row + "";
        },
        getWidth: function(session, lastLineNumber, config) {
            var chars = Math.max(lastLineNumber.toString().length, session.maxPromptLength || 0);
            return chars * config.characterWidth;
        }
    };
    
    // hide cursor in non editable cells
    this._addCursorMonitor = function() {
        this._updateCursorVisibility = this._updateCursorVisibility.bind(this);
        this.$cursorChanged = false;
        var markDirty = function() {
            this.$cursorChanged = true;
        }.bind(this);
        this.session.selection.on("changeSelection", markDirty);
        this.session.selection.on("changeCursor", markDirty);
    };
    
    this._updateCursorVisibility = function(e, renderer) {
        if (!this.$cursorChanged) return;
        this.$cursorChanged = false;
        var cell = this.getCurrentCell();
        var visible = cell && cell.type === "input";
        if (visible != renderer.$cursorLayer.inEditableCell) {
            renderer.$cursorLayer.inEditableCell = visible;
            renderer.$cursorLayer.element.style.opacity = visible ? "" : "0";
        }
    };
    
    this.onMouseUp = function(e) {
        var editor = e.editor;
        if (editor.repl.$mouseTimer)
            clearTimeout(editor.repl.$mouseTimer);
        editor.repl.$mouseTimer = setTimeout(function() {
            var sel = editor.selection;
            if (sel.isEmpty() && !sel.rangeCount) {
                var cell = editor.repl.getCurrentCell();
                if (cell.type != "input") {
                    var r = cell.getRange();
                    if (r && (sel.lead.row - r.start.row) / (r.end.row - r.start.row) < 0.1)
                        cell = editor.repl.getSiblingCell(-1, cell, "input");
                    if (!cell)
                        cell = editor.repl.getSiblingCell(1, cell, "input");
                    if (cell)
                        editor.repl.select(cell.range.end);
                }
            }
        }, 250);
    };
    
    // commands
    this.beforeCommand = function(e) {
        var editor = e.editor;
        var command = e.command;
        var cell = editor.repl.getCurrentCell();
        if (!editor.curReplOp)
            editor.curReplOp = { command: command, cell: cell };
            
        if (command.isRepl)
            return;
        if (cell && cell.lineWidget) {
            editor.repl.moveByCells(-1, cell);
            e.preventDefault();
        }
        
        if (cell && cell.type != "input") {
            if (!command.readOnly)
                e.preventDefault();
            return;
        }
        
        if (!cell)
            return;
        
        var op = editor.curReplOp;

        if (command.readOnly) {
            op.clipSelection = "before";
            if (editor.lastReplOp && editor.lastReplOp.command === command) {
                // todo allow some commands to go outside of cell
                op.clipSelection = "after";
            }
        } else if (command) {
            op.clipSelection = "before";
        }

        if (op.clipSelection == "before") {
            var range = cell.getRange();
            editor.repl.$trackedRange = range;
            setClipToRange(editor.selection.lead, range);
            setClipToRange(editor.selection.anchor, range);
        }
    };

    this.afterCommand = function(e) {
        var editor = e.editor;
        var op = editor.curReplOp;
        editor.curReplOp = null;
        editor.lastReplOp = op;
        if (!op)
            return;
        var command = op.command;
        if (op.clipSelection == "before") {
            setClipToRange(editor.selection.lead, false);
            setClipToRange(editor.selection.anchor, false);
        } else if (op.clipSelection == "after") {
            var range = editor.selection.toOrientedRange();
            if (op.cell) {
                range.clip(op.cell.getRange());
                editor.selection.fromOrientedRange(range);
            }
        }
        editor.repl.$trackedRange = null;
        if (!command.readOnly && !command.isRepl)
            editor.repl.ensureLastInputCell();
    };
    
    this.attach = function(editor) {
        if (editor.repl && editor.repl != this)
            editor.repl.detach();

        if (this.editor == editor)
            return;

        this.detach();
        this.editor = editor;
        
        this.editor.on("changeSession", this.detach);
        
        editor.keyBinding.addKeyboardHandler(replCommands);
        editor.commands.on("exec", this.beforeCommand);
        editor.commands.on("afterExec", this.afterCommand);
        
        editor.on("mouseup", this.onMouseUp);
        
        editor.repl = this;

        // editor.setOption("enableLineWidgets", true);
        editor.renderer.on("beforeRender", this.measureWidgets);
        editor.renderer.on("afterRender", this.updateWidgets);
        editor.renderer.on("afterRender", this._updateCursorVisibility);
        editor.renderer.on("resize", this._replResize);
    };
    this.detach = function(e) {
        console.log("detach", this.session.getLength(), e);
        if (e && e.session == this.session)
            return; // sometimes attach can be called before setSession
        var editor = this.editor;
        if (!editor)
            return;

        editor.keyBinding.removeKeyboardHandler(replCommands);
        editor.commands.off("exec", this.beforeCommand);
        editor.commands.off("afterExec", this.afterCommand);
        
        editor.off("mouseup", this.onMouseUp);
        editor.off("changeSession", this.detach);
        
        delete editor.renderer.$gutterLayer.update;
        this.editor = null;
        editor.repl = null;
        
        editor.renderer.off("beforeRender", this.measureWidgets);
        editor.renderer.off("afterRender", this.updateWidgets);
        this.session.lineWidgets.forEach(function(w) {
            if (w && w.el && w.el.parentNode) {
                w._inDocument = false;
                w.el.parentNode.removeChild(w.el);
            }
        });
        
        editor.renderer.off("afterRender", this._updateCursorVisibility);
        editor.renderer.off("resize", this._replResize);
    };
    this.navigateHistory = function(dir) {
        var cell = this.getCurrentCell();
        if (!cell || cell.type != "input")
            return false;
        var row = this.editor.getCursorPosition().row;
        if (dir == 1 && cell.range.end.row != row)
            return false;
        else if (dir == -1 && cell.range.start.row != row)
            return false;
        var val = cell.getValue();
        val = this.history.navigateList(dir == -1 ? "prev" : "next", val);
        if (typeof val == "string") {
            dir = -dir;
            if (dir == -1 && val.indexOf("\n") == -1)
                dir = 1;
            cell.setValue(val, dir);
        }
    };
    this.getCurrentCell = function(returnAdjacent) {
        var range = this.editor.getSelectionRange();
        var cell = this.getCellAt(range.start);

        if (returnAdjacent || cell && cell.range.contains(range.end.row, range.end.column)) {
            return cell;
        }
    };
    this.getCellAt = function(pos) {
        if (pos == undefined)
            pos = { row: this.session.getLength(), column: 0 };
        else if (typeof pos == "number")
            pos = { row: pos, column: 0 };
        
        var cells = this.session.replCells;

        for (var i = pos.row; i > 0; i--) {
            if (cells[i])
                break;
        }
        var cell = cells[i];
        if (!cell)
            return;
        cell.row = i;
        for (var i = pos.row + 1, l = this.session.getLength(); i < l; i++) {
            if (cells[i])
                break;
        }
        cell.endRow = Math.min(i - 1, l - 1);
        cell.range = new Range(cell.row, 0, cell.endRow, Number.MAX_VALUE);
        return cell;
    };
    
    this.getSiblingCell = function(dir, cell, type) {
        if (dir == -1) {
            var pos = cell.range.clone().start;
            pos.row--;
        } else {
            var pos = cell.range.clone().end;
            pos.row++;
        }
        cell = this.getCellAt(pos);
        if (!cell)
            return;
        if (!type || cell.type == type)
            return cell;
        return this.getSiblingCell(dir, cell, type);
    };
    
    this.moveByCells = function(dir, cell, type) {
        if (dir == "first")
            cell = this.getFirstCell(type);
        else if (dir == "last")
            cell = this.getLastCell(type);
        else
            cell = this.getSiblingCell(dir, cell || this.getCurrentCell(), type);
        
        if (cell)
            return this.select(cell.range.end);    
    };
    
    this.getFirstCell = function(type) {
        var cell = this.getCellAt(0);
        if (type && cell.type != type)
            return this.getSiblingCell(1, cell, type);
        return cell;
    };
    this.getLastCell = function(type) {
        var cell = this.getCellAt(null);
        if (type && cell.type != type)
            return this.getSiblingCell(-1, cell, type);
        return cell;
    };
    
    this.removeOutputCell = function(cell) {
        cell = cell || this.getCurrentCell();
        if (cell && cell.type == "input")
            cell = cell.output;
        if (cell) 
            this.removeCell(cell);
    };
    
    this.removeCell = function(cell) {
        var range = cell.getRange().clone();
        range.start.row--;
        range.start.column = this.session.getLine(range.start.row).length;
        this.session.replace(range, "");
    };
    
    this.clear = function() {
        this.session.setValue("");
        this.ensureLastInputCell();
    };
    
    this.ensureLastInputCell = function() {
        var end = { row: this.session.getLength(), column: 0 };
        var cell = this.getCellAt(end);
        if (!cell || cell.type != "input") {
            this.insertCell(end, { type: "input" }, true);
        }
    };
    
    this.select = function(pos) {   
        var sel = this.session.selection;
        if (typeof pos.row == "number" && typeof pos.column == "number") {
            if (sel.rangeCount)
                sel.toSingleRange();
            sel.setRange(Range.fromPoints(pos, pos));
        }
    };

    this.eval = function(force, cell) {
        cell = cell || this.getCurrentCell();
        if (!cell)
            return;
        if (!force && cell.type != "input")
            cell = cell.input || this.getSiblingCell(1, cell) || this.getSiblingCell(-1, cell);
        var str = cell.getValue();
        if (force || this.evaluator.canEvaluate(str)) {
            this.session.getUndoManager().reset();
            
            if (!cell.output || !cell.output.session) {
                cell.output = this.insertCell(cell.range.end, { type: "output" });                
                var newCell = this.getSiblingCell(1, cell.output);
            }
            this.history.add(str);
            cell.output.waiting = true;
            cell.output.input = cell;
            
            var self = this;
            var success = this.evaluator.evaluate(str, cell.output, function(result) {
                cell.output.waiting = false;
                if (result !== undefined)
                    cell.output.setValue(result);
                
                var renderer = self.editor.renderer;
                renderer.scrollSelectionIntoView(cell.range.end, cell.range.start);
                renderer.scrollCursorIntoView();
            });
            if (success !== false && newCell && newCell.type != "input") {
                newCell = this.insertCell(cell.output.range.end, { type: "input" });
                this.session.selection.setRange(newCell.range);
            }
            if (cell.output.waiting) {
                cell.output.setPlaceholder("...");
            }
        } else
            this.editor.insert("\n");
        
        if (this.evaluator.afterEvaluate)
            this.evaluator.afterEvaluate(cell, newCell);
    };
    this.insertCell = function(pos, options, allowSplit) {
        pos = pos || this.session.selection.getCursor();
        if (!options)
            options = { type: "input" };

        var cell = !allowSplit && this.getCellAt(pos);

        if (cell) {
            pos = cell.range.end;
            pos = this.session.insert(pos, "\n");
        }
        var newCell = new ReplCell(options, this.session);
        
        pos.row = Math.max(0, Math.min(pos.row, this.session.getLength() - 1));
        
        var range = Range.fromPoints(pos, pos);
        range.end.column = Number.MAX_VALUE;
        range.start.column = 0;
        newCell.range = range;
        newCell.row = range.end.row;
        
        var oldCell = this.session.replCells[pos.row];
        if (oldCell)
            oldCell.destroy();
        
        this.session.replCells[pos.row] = newCell;        
        this.$updateSession();
        return newCell;
    };

    this.$updateSession = function() {
        var session = this.session;
        session.$decorations = [];
        var lastType = "";
        session.replCells.forEach(function(c, row) {
            if (!c) {
                if (lastType)
                    session.$decorations[row] = lastType;
                return;
            }
            var dec = "";
            if (c.type == "input") {
                dec = "repl_prompt ";
                lastType = "repl_dots ";
            } else if (c.type == "output") {
                dec = "repl_output ";
                lastType = "repl_nonum ";
            }

            if (c && c.waiting)
                dec += "waiting ";
            session.$decorations[row] = dec;
        });
        session.addGutterDecoration(0, session.$decorations[0]);
        
        session.lineWidgets = session.replCells.map(function(c) {
            return c && c.lineWidget;
        });
    };

    this.updateCellsOnChange = function(delta) {
        var startRow = delta.start.row;
        var len = delta.end.row - startRow;
        
        var range = this.$trackedRange;
        var cells = this.session.replCells;
        if (len === 0) {
            
        } else if (delta.action == "remove") {
            var removed = cells.splice(startRow + 1, len);
            removed.forEach(function(cell) {
                if (cell) {
                    cell.destroy();
                }
            });
            if (range && range.start.row <= startRow && range.end.row >= startRow) {
                this.$trackedRange.end.row = Math.max(this.$trackedRange.end.row - len, this.$trackedRange.start.row);
            }
            if (cells.length <= 1)
                this.ensureLastInputCell();
        } else {
            var args = Array(len);
            args.unshift(startRow + 1, 0);
            cells.splice.apply(cells, args);
            if (range && range.start.row <= startRow && range.end.row >= startRow) {
                this.$trackedRange.end.row += len;
            }
        }
        this.$updateSession();
        this.session._signal("updateCells");
    };

    this.$tokenizeRow = function(row) {
        var line = this.doc.getLine(row);
        var state = this.states[row - 1];

        var cell = this.session.replCells[row];
        if (!cell && !state) {
            cell = this.session.repl.getCellAt(row);
        }
        if (cell) {
            state = cell.tokenizerState || cell.type;
            if (!this.tokenizer.regExps[state])
                state = "start";
        }

        var data = this.tokenizer.getLineTokens(line, state, row);

        if (this.states[row] + "" !== data.state + "") {
            if (!this.states[row] || !this.states[row].cellData)
                this.states[row] = data.state;
            this.lines[row + 1] = null;
            if (this.currentLine > row + 1)
                this.currentLine = row + 1;
        } else if (this.currentLine == row) {
            this.currentLine = row + 1;
        }
        if (this.session.repl.onTokenizeRow)
            data.tokens = this.session.repl.onTokenizeRow(row, data.tokens) || data.tokens;
        return this.lines[row] = data.tokens;
    };

    this.addLineWidget = function(w) {
        var renderer = this.editor.renderer;
        if (w.html && !w.el) {
            w.el = dom.createElement("div");
            w.el.innerHTML = w.html;
        }
        if (w.el) {
            dom.addCssClass(w.el, "ace_lineWidgetContainer");
            renderer.container.appendChild(w.el);
            w._inDocument = true;
        }
        
        if (!w.coverGutter) {
            w.el.style.zIndex = 3;
        }
        if (!w.pixelHeight) {
            w.pixelHeight = w.el.offsetHeight;
        }
        if (w.rowCount == null)
            w.rowCount = w.pixelHeight / renderer.layerConfig.lineHeight;
        
        this.session._emit("changeFold", { data: { start: { row: w.row }}});
        
        this.$updateSession();
        this.updateWidgets(null, renderer);
        return w;
    };
    
    this.removeLineWidget = function(w) {
        w._inDocument = false;
        if (w.el && w.el.parentNode)
            w.el.parentNode.removeChild(w.el);
        if (w.editor && w.editor.destroy) try {
            w.editor.destroy();
        } catch (e) {}
        this.session._emit("changeFold", { data: { start: { row: w.row }}});
        this.$updateSession();
    };
    
    this.onWidgetChanged = function(w) {
        this.session._changedWidgets.push(w);
        this.editor && this.editor.renderer.updateFull();
    };
    
    this.measureWidgets = function(e, renderer) {
        var ws = this.session._changedWidgets;
        var config = renderer.layerConfig;
        
        if (!ws || !ws.length) return;
        var min = Infinity;
        for (var i = 0; i < ws.length; i++) {
            var w = ws[i].lineWidget;
            if (!w._inDocument) {
                w._inDocument = true;
                renderer.container.appendChild(w.el);
            }
            
            w.h = w.el.offsetHeight;
            
            if (!w.fixedWidth) {
                w.w = w.el.offsetWidth;
                w.screenWidth = Math.ceil(w.w / config.characterWidth);
            }
            
            var rowCount = w.h / config.lineHeight;
            if (w.coverLine)
                rowCount -= this.session.getRowLineCount(w.row);
                
            if (w.rowCount != rowCount) {
                w.rowCount = rowCount;
                if (w.row < min)
                    min = w.row;
            }
        }
        if (min != Infinity) {
            this.session._emit("changeFold", { data: { start: { row: min }}});
            this.session.lineWidgetWidth = null;
        }
        this.session._changedWidgets = [];
    };
    
    this.updateWidgets = function(e, renderer) {
        var config = renderer.layerConfig;
        var cells = this.session.replCells;
        if (!cells)
            return;
        var first = Math.min(this.firstRow, config.firstRow);
        var last = Math.max(this.lastRow, config.lastRow, cells.length);
        
        while (first > 0 && !cells[first])
            first--;
        
        this.firstRow = config.firstRow;
        this.lastRow = config.lastRow;

        renderer.$cursorLayer.config = config;
        for (var i = first; i <= last; i++) {
            var c = cells[i];
            var w = c && c.lineWidget;
            if (!w || !w.el) continue;

            if (!w._inDocument) {
                w._inDocument = true;
                renderer.container.appendChild(w.el);
            }
            var top = renderer.$cursorLayer.getPixelPosition({ row: i, column: 0 }, true).top;
            if (!w.coverLine)
                top += config.lineHeight * this.session.getRowLineCount(w.row);
            w.el.style.top = top - config.offset + "px";
            
            var left = w.coverGutter ? 0 : renderer.gutterWidth;
            if (!w.fixedWidth)
                left -= renderer.scrollLeft;
            w.el.style.left = left + "px";

            if (w.fixedWidth) {
                w.el.style.right = renderer.scrollBar.getWidth() + "px";
            } else {
                w.el.style.right = "";
            }
        }
    };
    
    
}).call(Repl.prototype);

var History = function() {
    this._data = [];
    this._tempData = Object.create(null);
    this.position = 0;
};
History.prototype = {
    add: function(text) {
        if (text && this._data[0] !== text) {
            this._data.unshift(text);
        }
        delete this._tempData[this.position];
        this.position = -1;
        this._tempData[-1] = "";
        return this._data;
    },
    navigateList: function(type, value) {
        var lines = this._data;
        if (value && (lines[this.position] != value)) {
            this._tempData[this.position] = value;
        }

        if (type == "next") {
            if (this.position <= 0) {
                this.position = -1;
                return this._tempData[this.position] || "";
            }
            var next = Math.max(0, this.position - 1);
        }
        else if (type == "prev")
            next = Math.min(lines.length - 1, this.position + 1);
        else if (type == "last")
            next = Math.max(lines.length - 1, 0);
        else if (type == "first")
            next = 0;

        if (lines[next] && next != this.position) {
            this.position = next;
            return this._tempData[next] || lines[next];
        }
    }
};



function clonePos(pos) {
    return { row: pos.row, column: pos.column };
}
function setPos(pos, newPos) {
    pos.row = newPos.row;
    pos.column = newPos.column;
}
function clipPos(pos, range) {
    if (comparePoints(pos, range.start) < 0) {
        setPos(pos, range.start);
    } else if (comparePoints(pos, range.end) > 0) {
        setPos(pos, range.end);
    }
}
Range.prototype.clip = function(range) {
    clipPos(this.start, range);
    clipPos(this.end, range);
};


function setClipToRange(anchor, range) {
    anchor.$clip_default = Anchor.prototype.$clipPositionToDocument;
    if (!range) {
        anchor.$clipPositionToDocument = anchor.$clip_default;
        return;
    }
    anchor.$clipPositionToDocument = function(row, column) {
        var pos = this.$clip_default(row, column);
        clipPos(pos, range);
        return pos;
    };
}



// dummy example
var Evaluator = function() {
};

(function() {
    this.canEvaluate = function(str) {
        return !!str.trim();
    };

    this.evaluate = function(str, cell, cb) {
        cb("evaluator is missing!");
    };
}).call(Evaluator.prototype);

Repl.fromEditor = function(editor, options) {
    // todo different modes for input and output
    var repl = new Repl(editor.session, options);
    // this should happen on session.changeEditor event
    repl.attach(editor);
    
    editor.setOption("showPrintMargin", false);
    return repl;
};
exports.Repl = Repl;

});
