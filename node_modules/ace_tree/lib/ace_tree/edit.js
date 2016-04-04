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

var Range = require("ace/range").Range;

var UndoManager = require("ace/undomanager").UndoManager;
var Renderer = require("ace/virtual_renderer").VirtualRenderer;
var Editor = require("ace/editor").Editor;
var FontMetrics = require("ace/layer/font_metrics").FontMetrics;
require("ace/multi_select");

var EditableTree = function(tree) {
    this.tree = tree;
    this.tree.on("click", this.onClick = this.onClick.bind(this));
    this.tree.on("blur", this.onTreeBlur = this.onTreeBlur.bind(this));
    this.tree.on("focus", this.onTreeFocus = this.waitForRename.bind(this));
    this.tree.on("mousedown", this.onMouseDown = this.onMouseDown.bind(this));
    this.tree.on("dblclick", this.onDoubleClick = this.onDoubleClick.bind(this));
    this.tree.on("startDrag", this.onTreeBlur);
    this.timer = null;
};

(function() {
    this.RENAME_DELAY = 400;
    this.onTreeBlur = function(e) { this.cancel() };
    
    this.onDoubleClick = function(e) {
        var node = e.getNode();
        if (this.tree.provider.columns) {
            if (e.domEvent.detail == 2 && node) {
                var columnData = this.tree.renderer.$headingLayer.findColumn(e.getDocumentPosition().x);
                var column = columnData && columnData.column;
                if (column.editor) {
                    this.startRename(node, column);
                    e.stop();
                }
            }
            return;
        }
    };
    this.onMouseDown = function(e) {
        this.cancel();
        if (e.domEvent.detail > 1 || e.getButton() !== 0) {
            return;
        }
        var sel = this.tree.selection.getSelectedNodes();
        if (sel.length == 1 &&  e.editor.isFocused() && !this.afterRename) {
            this.lastNode = sel[0];
        }
    };
    this.cancel = function() {
        if (this.timer)
            clearTimeout(this.timer);
        this.lastNode = null;
    };
    this.waitForRename = function() {
        this.afterRename = setTimeout(function() {
            this.afterRename = null;
        }.bind(this), 10);
    };
    this.onClick = function(e) {
        var node = e.getNode();
        if (this.tree.provider.columns)
            return;
        var lastNode = this.lastNode;
        this.cancel();
        var sel = this.tree.selection.getSelectedNodes();
        if (sel.length != 1)
            return;
        
        if (!node || !lastNode || node != sel[0] || node != lastNode)
            return;
        this.timer = setTimeout(function() {
            this.cancel();
            var sel = this.tree.selection.getSelectedNodes();
            if (lastNode === sel[0] && sel.length == 1) {
                this.startRename(lastNode);
            }
        }.bind(this), this.RENAME_DELAY);
    };
    this.createEditor = function(el) {
        var renderer = new Renderer(el);
        var wrapper = document.createElement("div");
        wrapper.className = "ace_wrapper";
        wrapper.appendChild(renderer.container);
        wrapper.style.position = "absolute";

        renderer.screenToTextCoordinates = function(x, y) {
            var pos = this.pixelToScreenCoordinates(x, y);
            return this.session.screenToDocumentPosition(
                Math.min(this.session.getScreenLength() - 1, Math.max(pos.row, 0)),
                Math.max(pos.column, 0)
            );
        };
        renderer.setStyle("ace_one-line");
        renderer.setStyle("ace_tree-editor");
        var editor = new Editor(renderer);
        editor.session.setUndoManager(new UndoManager());
        editor.wrapper = wrapper;

        editor.setHighlightActiveLine(false);
        editor.setShowPrintMargin(false);
        editor.renderer.setShowGutter(false);
        editor.renderer.setHighlightGutterLine(false);
        editor.$mouseHandler.$focusWaitTimout = 0;
        editor.renderer.setPadding(2);
        editor.container.style.font = "inherit";
        editor.renderer.$markerBack.element.style.marginTop =
        editor.renderer.$cursorLayer.element.style.marginTop = "1px";
        if (this.column)
            editor.renderer.scroller.style.paddingTop = "1px";
        
        var tree = this.tree;
        if (!tree.renderer.fontMetrics) {
            tree.renderer.fontMetrics = new FontMetrics(tree.renderer.container);
        }
        tree.renderer.fontMetrics.checkForSizeChanges();
        
        editor.session.$setFontMetrics(tree.renderer.fontMetrics);
        
        return editor;
    };
    
    this._initEditor = function() {
        this.ace = this.createEditor();
        this.ace.treeEditor = this;
        this.ace.commands.bindKeys({
            "Esc": function(ace) {
                ace.treeEditor.endRename(true);
            },
            "Enter": function(ace) {
                ace.treeEditor.endRename();
            },
            "ctrl-s|cmd-s": function(ace) {
                ace.treeEditor.endRename();
            },
            "Tab": function(ace) {
                ace.treeEditor.editNext(1);
            },
            "Shift-Tab": function(ace) {
                ace.treeEditor.editNext(-1);
            }
        });
        this.tree.container.appendChild(this.ace.wrapper);
        
        // make sure no one can steal focus from us
        setTimeout(function() {
            if (this.ace) {
                this.ace.focus();
                this.ace.on("blur", this._onBlur = this._onBlur.bind(this));
            }
        }.bind(this), 20);
        this.tree.renderer.on("afterRender", this._onAfterRender = this._onAfterRender.bind(this));
        this.ace.renderer.on("afterRender", this._onAfterRender);
        this.ace.on("execCommand", function() {
            this.tree.reveal(this.renaming, false);
        }.bind(this));
        this.ace.focus();
        this._onAfterRender();
        
        this.tree._emit("createEditor", {ace: this.ace});
    };
    
    this._onBlur = function() {
        if (!this.ace || !this.ace.textInput || !this.renaming)
            return;
        if (this.ace.$mouseHandler.isMousePressed)
            return;
        // for debugging
        // console.log("comment me out when you are done!")
        // if (document.activeElement === this.ace.textInput.getElement())
        //     return;
        this.endRename();
    };
    
    this._onAfterRender = function() {
        var i = this.tree.provider.getIndexForNode(this.renaming);
        var domNode = this.tree.renderer.$cellLayer.getDomNodeAtIndex(i);
        var style = this.ace.wrapper.style;
        if (!domNode || !domNode.lastChild)
            return style.top = "-100px";
        
        var renameNode = this.column
            ? domNode.children[this.column.index]
            : domNode.lastChild;
        // empty nodes will have wrong height
        if (!renameNode.textContent)
            renameNode.textContent = "\xa0";
        
        if (this.column && this.renaming.fullWidth)
            renameNode = renameNode.parentNode;
        var rect = renameNode.getBoundingClientRect();
        var treeRect = this.tree.container.getBoundingClientRect();
        
        if (this.column) {
            var child = renameNode.lastChild;
            var left = rect.left;
            var offset = this.column.type === "tree" && !this.renaming.fullWidth
                ? (child.nodeType == 1 ? child.getBoundingClientRect() : rect).left - left - 2
                : 0;
            style.top = rect.top - treeRect.top + "px";
            style.left = rect.left - treeRect.left + offset + "px";
            style.width = rect.width - offset + "px";
            style.height = rect.height + "px";
        } else {
            var nodeRect = domNode.getBoundingClientRect();
            var maxWidth = Math.max(nodeRect.right - rect.left, 10);
            var chars = this.ace.session.$getStringScreenWidth(this.ace.session.getLine(0))[0];
            var minWidth = Math.max(chars*this.tree.renderer.fontMetrics.$characterSize.width + 6, 15);
            style.top = rect.top - treeRect.top + 2 + "px";
            style.left = rect.left - treeRect.left - 2 + "px";
            style.width = Math.min(minWidth, maxWidth) + "px";
            style.height = rect.height - 4 + "px";
            domNode.style.color = "transparent";
            this.ace.renderer.onResize(!this.lastDomNode, 0, Math.min(minWidth, maxWidth), this.ace.renderer.$size.height);
            this.lastDomNode = domNode;
        }
    };
    
    this._destroyEditor = function() {
        if (this.lastDomNode) {
            this.lastDomNode.style.color = "";
            this.lastDomNode;
        }
        this.ace.off("blur", this._onBlur);

        this.tree.renderer.off("afterRender", this._onAfterRender);
        
        var ace = this.ace;
        this.ace = null;
        this.$lastAce = ace;
        ace.renderer.freeze();
        setTimeout(function() {
            // doing this after timeout to allow rename event focus something else
            var wasFocused = ace.isFocused();
            ace.destroy();
            if (ace.wrapper.parentNode)
                ace.wrapper.parentNode.removeChild(ace.wrapper);
            if (wasFocused)
                this.tree.focus();
            this.$lastAce = null;
        }.bind(this));
    };
    
    this.findNextEditPoint = function(dir, node, col, keepColumn) {
        if (col == null)
            col = this.column ? this.column.index : 0;
        if (node == null)
            node = this.renaming;
        var provider = this.tree.provider;
        var columns = provider.columns;
        
        if (columns && !keepColumn) {
            var i = col + dir;
            if (columns[i])
                return {node: node, column: i};
            else
                col =  dir < 0 ? columns.length - 1 : 0;
        }
        
        var nodeIndex = provider.getIndexForNode(node);
        var newNode = provider.getNodeAtIndex(nodeIndex + dir);
        
        return newNode && {node: newNode, column: col};
    };
    
    this.editNext = function(dir, keepColumn) {
        var p = this.findNextEditPoint(dir, this.renaming, null, keepColumn);
        if (p) {
            if (this.renaming) {
                var node = this.renaming;
                if (p.node == node && p.column == (this.column && this.column.index) + dir)
                    p = null;
                this.stopRename(); // save current change
                var model = this.tree.provider;
                if (model.updateNodeAfterChange) {
                    node = model.updateNodeAfterChange(node);
                    if (p)
                        p.node = model.updateNodeAfterChange(p.node);
                }
                p = p || this.findNextEditPoint(dir, node);
            }
            if (p && p.node)
                this.startRename(p.node, p.column);
        }
    };
    
    
    this.startRename = function(node, column) {
        var model = this.tree.provider;
        node = node || this.tree.selection.getCursor();
        if (!node)
            return false;
        if (typeof column == "number" && model.columns)
            column = model.columns[column];
        if (model.columns && node.fullWidth)
            column = model.columns[0];
        if (this.renaming === node && this.column == column || node.noSelect)
            return false;

        if (this.renaming)
            this.endRename(true);
        
        if (model.isEditable && !model.isEditable(node) || node.isEditable === false)
            return false;
        
        this.column = column;
        var val = (column || model).getText(node);
        var e = {
            node: node,
            column: column,
            value: val
        };
        this.tree._emit("beforeRename", e);
        
        if (e.defaultPrevented || !e.node)
            return;
        this.renaming = e.node;
        this._initEditor();
        
        this.tree._emit("renameStart", e);
        
        if (e.node != node && e.value == val)
            e.value = (column || model).getText(node);
        
        this.tree.renderer.scrollCaretIntoView(this.renaming);
        this.tree.renderer.visualizeFocus();
        var endCol = -1;
        if (this.renaming.isNew) {
            val = "";
        } else {
            val = e.value;
            // todo move this to c9.ide.tree?
            if (!column && !node.isFolder)
                endCol = val.lastIndexOf(".");
        }
        if (endCol < 0)
            endCol = val.length;
        this.origVal = val;
        this.ace.setValue(val);
        this.ace.selection.setRange(endCol
            ? new Range(0, 0, 0, endCol)
            : new Range(0, 1, 0, val.length)
        );
    };
    
    this.stopRename =
    this.endRename = function(cancel) {
        var node = this.renaming;
        this.renaming = null;
        this.cancel();
        this.waitForRename();
        if (!this.tree.isFocused())
            this.tree.renderer.visualizeBlur();

        if (!node)
            return;
            
        var val = this.ace.getValue();
        
        this._destroyEditor();
        
        if (!cancel && this.origVal !== val) {
            this.tree._emit("rename", {
                node: node,
                value: val,
                oldValue: this.origVal,
                column: this.column
            });
            this.tree.provider._signal("change");
        }
    };

}).call(EditableTree.prototype);

module.exports = EditableTree;
});
