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

var DRAG_OFFSET = 5; // pixels
function DefaultHandlers(mouseHandler) {
    mouseHandler.$clickSelection = null;

    var editor = mouseHandler.editor;
    editor.setDefaultHandler("mousedown", this.onMouseDown.bind(mouseHandler));
    editor.setDefaultHandler("dblclick", this.onDoubleClick.bind(mouseHandler));
    // editor.setDefaultHandler("tripleclick", this.onTripleClick.bind(mouseHandler));
    // editor.setDefaultHandler("quadclick", this.onQuadClick.bind(mouseHandler));
    editor.setDefaultHandler("mouseleave", this.onMouseLeave.bind(mouseHandler));
    editor.setDefaultHandler("mousemove", this.onMouseMove.bind(mouseHandler));
    editor.setDefaultHandler("mousewheel", this.onMouseWheel.bind(mouseHandler));
    editor.setDefaultHandler("mouseup", this.onMouseUp.bind(mouseHandler));
    editor.setDefaultHandler("click", this.onClick.bind(mouseHandler));

    var exports = ["dragMoveSelection", "dragWait", "dragWaitEnd", "getRegion", "updateHoverState"];

    exports.forEach(function(x) {
        mouseHandler[x] = this[x];
    }, this);
}

(function() {
    
    function isTogglerClick(target) {
        return dom.hasCssClass(target, "toggler") && !dom.hasCssClass(target, "empty");
    }
    
    this.onMouseMove = function(e) {
        var editor = this.editor;
        var node = e.getNode();
        
        var title, provider = editor.provider;
        if (!node) {
            title = "";
        } else if (provider.columns) {
            var pos = e.getDocumentPosition();
            var columnData = editor.renderer.$headingLayer.findColumn(pos.x);
            title = columnData ? columnData.column.getText(node) : "";
        } else {
            title = provider.getTooltipText ? provider.getTooltipText(node) : provider.getText(node);
        }
        
        if (!editor.tooltip && editor.container.title != title)
            editor.container.title = title;
        this.updateHoverState(node);
    };
    
    this.onMouseLeave = function() {
        this.updateHoverState(null);
    };
    
    this.updateHoverState = function(node) {
        var provider = this.editor.provider;
        if (node !== this.node && provider) {
            if (this.node)
                provider.setClass(this.node, "hover", false);
            this.node = node;
            if (this.node)
                provider.setClass(this.node, "hover", true);
        }
    };

    this.onMouseDown = function(ev) {
        var editor = this.editor;
        var provider = editor.provider;

        ev.detail = 1;
        this.mousedownEvent = ev;
        this.delayedSelect = false;
        this.isMousePressed = true;
        
        var button = ev.getButton();
        var selectedNodes = editor.selection.getSelectedNodes();
        var isMultiSelect = selectedNodes.length > 1;
        if (button !== 0 && isMultiSelect) {
            return; // stopping event here breaks contextmenu on ff mac
        }
        
        var node = ev.getNode();
        this.$clickNode = node;
        if (!node) return; // Click outside cells
        
        var inSelection = provider.isSelected(node);

        var target = ev.domEvent.target;
        this.region = null;
        if (isTogglerClick(target) || node.clickAction == "toggle") {
            this.region = "toggler";
            var toggleChildren = ev.getShiftKey();
            var deep = ev.getAccelKey();
            if (button === 0) {
                if (toggleChildren) {
                    if (deep) {
                        node = node.parent;
                    }
                    provider.close(node, true);
                    provider.open(node);
                } else {
                    provider.toggleNode(node, deep);
                }
            }
            this.$clickNode = null;
        } else if (dom.hasCssClass(target, "checkbox")) {
            node.isChecked = !node.isChecked;
            if (inSelection) {
                var nodes = editor.selection.getSelectedNodes();
                nodes.forEach(function(n){ n.isChecked = node.isChecked });
            }
            provider._signal(node.isChecked ? "check" : "uncheck", inSelection ? nodes : [node]);
            provider._signal("change")
        } else if (dom.hasCssClass(target, "icon-ok")) {
            if (ev.getShiftKey()) {
                editor.selection.expandSelection(node, null, true);
            } else {
                editor.selection.toggleSelect(node);
            }
        } else if (ev.getAccelKey()) {
            if (inSelection && isMultiSelect)
                this.delayedSelect = "toggle";
            else if (!inSelection || isMultiSelect)
                editor.selection.toggleSelect(node);
        } else if (ev.getShiftKey()) {
            editor.selection.expandSelection(node);
        } else if (inSelection && isMultiSelect) {
            if (!editor.isFocused())
                this.$clickNode = null;
            else
                this.delayedSelect = true;
        } else {
            editor.selection.setSelection(node);
        }
        if (this.$clickNode)
            editor.$mouseHandler.captureMouse(ev, "dragWait");
        
        return ev.preventDefault();
    };
    
    this.onMouseUp = function(ev) {
        if (this.isMousePressed == 2) return; // wait until release capture
        this.isMousePressed = false;
        var pos = ev.getDocumentPosition();
        var node = this.editor.provider.findItemAtOffset(pos.y);
        if (node && this.$clickNode && this.$clickNode == node) {
            ev.button = ev.getButton();
            ev.target = ev.domEvent.target;
            ev.detail = this.mousedownEvent.detail;
            this.onMouseEvent("click", ev);
        }
        this.$clickNode = this.mouseEvent = null;
    };
    
    this.onClick = function(ev) {
        if (this.mousedownEvent.detail === 2) {
            this.editor._emit("afterChoose");
        }
    };

    this.onDoubleClick = function(ev) {
        var provider = this.editor.provider;
        if (provider.toggleNode && !isTogglerClick(ev.domEvent.target)) {
            var node = ev.getNode();
            if (node)
                provider.toggleNode(node);
        }
        if (this.mousedownEvent)
            this.mousedownEvent.detail = 2;
    };

    this.dragMoveSelection = function() {
        var editor = this.editor;
        var ev = this.mouseEvent;
        ev.$pos = ev.node = null;
        var node = ev.getNode(true);
        if (node != editor.selection.getCursor() && node) {
            if (ev.getShiftKey()) {
                editor.selection.expandSelection(node, null, true);
            } else {
                editor.selection.selectNode(node);
            }
            editor.renderer.scrollCaretIntoView();
        }        
    };

    this.dragWait = function() {
        var ev = this.mousedownEvent;
        if (Math.abs(this.x - ev.x) + Math.abs(this.y - ev.y) > DRAG_OFFSET) {
            this.delayedSelect = false;
            this.editor._emit("startDrag", ev);
            if (this.state == "dragWait" && ev.getButton() === 0)
                this.setState("dragMoveSelection");
        }
    };
    
    this.dragWaitEnd = function() {
        if (this.delayedSelect) {
            var selection = this.editor.selection;
            if (this.$clickNode) {
                if (this.delayedSelect == "toggle")
                    selection.toggleSelect(this.$clickNode);
                else
                    selection.setSelection(this.$clickNode);
            }
            this.delayedSelect = false;
        }
    };
        
        
    this.onMouseWheel = function(ev) {
        if (ev.getShiftKey() || ev.getAccelKey())
            return;
        var t = ev.domEvent.timeStamp;
        var dt = t - (this.$lastScrollTime || 0);
        
        var editor = this.editor;
        var isScrolable = editor.renderer.isScrollableBy(ev.wheelX * ev.speed, ev.wheelY * ev.speed);
        if (isScrolable || dt < 200) {
            this.$lastScrollTime = t;
            editor.renderer.scrollBy(ev.wheelX * ev.speed, ev.wheelY * ev.speed);
            return ev.stop();
        }
    };

}).call(DefaultHandlers.prototype);

exports.DefaultHandlers = DefaultHandlers;

});
