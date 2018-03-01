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

var event = require("ace/lib/event");
var useragent = require("ace/lib/useragent");
var DefaultHandlers = require("./default_handlers").DefaultHandlers;
var MouseEvent = require("./mouse_event").MouseEvent;
var config = require("../config");
var dom = require("ace/lib/dom");

function initDragHandlers(mouseHandler) {
    var tree = mouseHandler.editor;
    var UNFOLD_TIMEOUT = 500;
    var WIDGET_UNFOLD_TIMEOUT = 500;
    var AUTOSCROLL_DELAY = 300;
    var MIN_DRAG_T = 500;
    var dragInfo, x, y, dx, dy;
    var scrollerRect;
    
    mouseHandler.drag = function() {
        var ev = this.mouseEvent;
        if (!dragInfo || !ev) return;
        var node = ev.getNode();
        dx = ev.x - x;
        dy = ev.y - y;
        x = ev.x;
        y = ev.y;
        var isInTree = isInRect(x, y, scrollerRect);
        if (!isInTree) {
            node = null;
        }
        
        if (dragInfo.isInTree != isInTree && dragInfo.selectedNodes) {
            dragInfo.isInTree = isInTree;
            ev.dragInfo = dragInfo;
            tree._signal(isInTree ? "dragIn" : "dragOut" , ev);
        }
        if (!isInTree) {
            ev.dragInfo = dragInfo;
            tree._signal("dragMoveOutside", ev);
        }
        
        if (dragInfo.el) {
            dragInfo.el.style.top = ev.y - dragInfo.offsetY + "px";
            dragInfo.el.style.left = ev.x - dragInfo.offsetX + "px";
        }
        
        var hoverNode = node;
        if (hoverNode) {
            var xOffset = x - scrollerRect.left;
            
            var depth = Math.max(0, Math.floor(xOffset / tree.provider.$indentSize));
            var depthDiff = hoverNode.$depth - depth;
            while (depthDiff > 0 && hoverNode.parent) {
                depthDiff--;
                hoverNode = hoverNode.parent;
            }
            
            if (!hoverNode.isFolder && dragInfo.mode != "sort") {
                hoverNode = hoverNode.parent;
            }
        }
        
        if (dragInfo.hoverNode !== hoverNode) {
            if (dragInfo.hoverNode) {
                tree.provider.setClass(dragInfo.hoverNode, "dropTarget", false);
                tree._signal("folderDragLeave", dragInfo);
            }
            if (hoverNode && dragInfo.selectedNodes && dragInfo.selectedNodes.indexOf(hoverNode) != -1) {
                hoverNode = null;
            }
            dragInfo.hoverNode = hoverNode;
            if (dragInfo.hoverNode) {
                tree._signal("folderDragEnter", dragInfo);
                if (dragInfo.mode !== "sort")
                    tree.provider.setClass(dragInfo.hoverNode, "dropTarget", true);
            }
            highlightFolder(tree, dragInfo.hoverNode, dragInfo.insertPos);
        }
        
        var now = Date.now();

        var target = ev.domEvent.target;
        var isFoldWidget = target && (dom.hasCssClass(target, "toggler") 
            && !dom.hasCssClass(target, "empty"));
        
        var distance = Math.abs(dx) + Math.abs(dy);
        
        var pos = ev.y - scrollerRect.top;
        var rowHeight = tree.provider.rowHeight;
        var renderer = tree.renderer;
        var autoScrollMargin = 1.5 * rowHeight;
        var scroll = pos - autoScrollMargin;
        if (scroll > 0) {
            scroll += -renderer.$size.scrollerHeight + 2 * autoScrollMargin;
            if (scroll < 0)
                scroll = 0;
        }
        if (!scroll || !isInTree)
            dragInfo.autoScroll = false;
        
        if (distance <= 2) {
            if (!dragInfo.stopTime)
                dragInfo.stopTime = now;
        } else {
            if (!isFoldWidget)
                dragInfo.stopTime = undefined;
        }
        var dt = now - dragInfo.stopTime;
        
        if (scroll && isInTree) {
            if (dt > AUTOSCROLL_DELAY || dragInfo.autoScroll) {
                tree.renderer.scrollBy(0, scroll / 2);
                dragInfo.autoScroll = true;
            }
        }
        else if (node && dragInfo.mode === "move") {
            if (node.parent === tree.provider.root || node.isRoot || node.parent && node.parent.isRoot)
                isFoldWidget = false;
            
            if (isFoldWidget && dt > WIDGET_UNFOLD_TIMEOUT && dt < 2 * WIDGET_UNFOLD_TIMEOUT) {
                tree.provider.toggleNode(node);
                dragInfo.stopTime = Infinity;
            }
            else if (!isFoldWidget && dt > UNFOLD_TIMEOUT && dt < 2 * UNFOLD_TIMEOUT) {
                tree.provider.open(node);
                dragInfo.stopTime = Infinity;
            }
        }
    };
    
    mouseHandler.dragEnd = function(e, cancel) {
        if (dragInfo) {
            window.removeEventListener("mousedown", keyHandler, true);
            window.removeEventListener("keydown", keyHandler, true);
            window.removeEventListener("keyup", keyHandler, true);
            if (dragInfo.el && dragInfo.el.parentNode)
                dragInfo.el.parentNode.removeChild(dragInfo.el);
            if (dragInfo.hoverNode) {
                tree.provider.setClass(dragInfo.hoverNode, "dropTarget", false);
                tree._signal("folderDragLeave", dragInfo);
            }
            highlightFolder(tree, null);
            
            if (tree.isFocused())
                tree.renderer.visualizeFocus();
            tree.renderer.setStyle("dragOver", false);
            
            dragInfo.target = dragInfo.hoverNode;
            
            if (!cancel && dragInfo.selectedNodes && Date.now() - dragInfo.startT > MIN_DRAG_T)
                tree._emit("drop", dragInfo);
            
            if (!dragInfo.isInTree) {
                if (cancel)
                    dragInfo.selectedNodes = null;
                tree._signal("dropOutside" , {dragInfo: dragInfo});
            }
            dragInfo = null;
        }
    };
    
    mouseHandler.dragStart = function() {
        if (dragInfo)
            this.dragEnd(null, true);
        mouseHandler.setState("drag");
        tree.renderer.visualizeBlur();
        tree.renderer.setStyle("dragOver", true);
        scrollerRect = tree.renderer.scroller.getBoundingClientRect();
        dragInfo = {};
    };
    
    tree.on("startDrag", function(ev) {
        if (!tree.getOption("enableDragDrop"))
            return;
        var node = ev.getNode();
        if (!node || ev.getButton())
            return;
        mouseHandler.dragStart();
        
        window.addEventListener("mousedown", keyHandler, true);
        window.addEventListener("keydown", keyHandler, true);
        window.addEventListener("keyup", keyHandler, true);
        
        var selectedNodes = tree.selection.getSelectedNodes();
        var el = constructDragNode(node);
        
        dragInfo = {
            el: el,
            node: node,
            selectedNodes: selectedNodes,
            offsetX: 10,
            offsetY: 10,
            target: node,
            startT: Date.now(),
            isInTree: true,
            mode: "move"
        };
        
        ev.dragInfo = dragInfo;
        tree._signal("dragStarted", ev);
        
        if (mouseHandler.state == "drag")
            mouseHandler.drag();
    });
    
    function constructDragNode(node) {
        var i = tree.provider.getIndexForNode(node);
        var domNode = tree.renderer.$cellLayer.getDomNodeAtIndex(i);
        if (!domNode) return;
        
        var offset = domNode.offsetHeight;
        
        var selectedNodes = tree.selection.getSelectedNodes();
        var el = document.createElement("div");
        el.className = tree.container.className + " dragImage";
        var ch = el.appendChild(domNode.cloneNode(true));
        ch.removeChild(ch.firstChild);
        ch.style.paddingRight = "5px";
        ch.style.opacity = "0.8";
        
        el.style.position = "absolute";
        el.style.zIndex = "1000000";
        el.style.pointerEvents = "none";
        el.style.overflow = "visible";
        
        if (selectedNodes.length > 1) {
            ch.style.color = "transparent";
            ch = el.appendChild(domNode.cloneNode(true));
            ch.removeChild(ch.firstChild);
            ch.style.paddingRight = "5px";
            ch.style.top = - offset + 2 + "px";
            ch.style.left = "2px";
            ch.style.position = "relative";
            ch.style.opacity = "0.8";
        }

        document.body.appendChild(el);
        return el;
    }
    
    function keyHandler(e){
        if (dragInfo) {
            if (e.keyCode === 27 || e.type == "mousedown") {
                mouseHandler.dragEnd(null, true);
                event.stopEvent(e);
            } else if (dragInfo && e.keyCode == 17 ||  e.keyCode == 18) {
                dragInfo.isCopy = e.type == "keydown";
                dom.setCssClass(dragInfo.el, "copy", dragInfo.isCopy);
            }
        }
        
    }
}

function highlightFolder(tree, node, type) {
    tree.provider.markedFolder = node;
    tree.provider.markedFolderType = type;
    tree.renderer.$loop.schedule(tree.renderer.CHANGE_MARKER);
}

function isInRect(x, y, rect) {
    if (x < rect.right && x > rect.left && y > rect.top && y < rect.bottom)
        return true;
}

module.exports = initDragHandlers;
});
