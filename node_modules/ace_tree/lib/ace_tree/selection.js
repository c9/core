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

var oop = require("ace/lib/oop");
var EventEmitter = require("ace/lib/event_emitter").EventEmitter;

var Selection = function(provider) {
    this.provider = provider;
    if (this.provider && !this.provider.selectedItems)
        this.provider.selectedItems = [];
    this.provider.on("remove", this.unselectRemoved = this.unselectRemoved.bind(this));
};

(function() {

    oop.implement(this, EventEmitter);
    
    this.$wrapAround = false;
    this.getRange = function() {};
            
    this.selectAll = function() {
        var sel = this.provider.selectedItems;
        this.expandSelection(sel[0], sel[sel.length -1]);
        
        this._signal("change");
    };
    
    this.moveSelection = function(dir, select, add) {
        var provider = this.provider;
        var cursor = this.getCursor();
        var anchor = this.getAnchor();
        var i = provider.getIndexForNode(cursor);
        if (!add) {
            this.clear(true);
        } else if (add && !select) {
            this.unselectNode(cursor);
        }
        
        var min = provider.getMinIndex();
        var max = provider.getMaxIndex();
        var wrapped = false;
        var newI = i;
        do {
            newI += dir;
            if (newI < min) {
                newI = this.$wrapAround ? max : min;
                wrapped = true;
            } else if (newI > max) {
                newI = this.$wrapAround ? min : max;
                wrapped = true;
            }
            var newNode = provider.getNodeAtIndex(newI);
            
        } while (!wrapped && newNode && !provider.isSelectable(newNode));
        
        if (!newNode || !provider.isSelectable(newNode))
            newNode = cursor;
            
        if (select) {
            this.expandSelection(newNode, anchor, add);
        } else {
            this.selectNode(newNode, add);
        }
    };
    
    this.getCursor = function() {
        var sel = this.provider.selectedItems;
        return sel.cursor || sel[sel.length - 1];
    };
    this.getAnchor = function() {
        var sel = this.provider.selectedItems;
        return sel.anchor || sel.cursor || sel[0];
    };
    this.getSelectedNodes = function() {
        var sel = this.provider.selectedItems;
        return sel.slice();
    };
    this.getVisibleSelectedNodes = function() {
        var provider = this.provider;
        var sel = provider.selectedItems;
        return sel.filter(function(node) {
            return provider.isVisible(node);
        });
    };
    
    this.isEmpty = function() {
        var sel = this.provider.selectedItems;
        return sel.length === 0;
    };
    this.isMultiRow = function() {
        var sel = this.provider.selectedItems;
        return sel.length > 1;
    };
    this.toggleSelect = function(node) {
        var provider = this.provider;
        var sel = provider.selectedItems;
        var i = sel.indexOf(node);
        if (i != -1)
            sel.splice(i, 1);
        provider.setSelected(node, !provider.isSelected(node));
        if (provider.isSelected(node)) {
            sel.push(node);
            sel.anchor = sel.cursor = node;
        } else
            sel.anchor = sel.cursor = sel[sel.length - 1];
        
        this._signal("change");
    };
    this.selectNode = function(node, add, silent) {
        var provider = this.provider;
        var sel = provider.selectedItems;
        if (!provider.isSelectable(node))
            return;
        if (!add)
            this.clear(true);
        if (node) {
            var i = sel.indexOf(node);
            if (i != -1)
                sel.splice(i, 1);
            provider.setSelected(node, true);
            if (provider.isSelected(node))
                sel.push(node);
        }
        sel.anchor = sel.cursor = node;
        this._signal("change");
    };
    this.add = function(node) {
        this.selectNode(node, true);
    };
    this.remove = function(node) {
        if (this.provider.isSelected(node))
            this.toggleSelect(node);
    };
    this.clear =
    this.clearSelection = function(silent) {
        var provider = this.provider;
        var sel = provider.selectedItems;
        sel.forEach(function(node) { provider.setSelected(node, false); });
        sel.splice(0, sel.length);
        sel.anchor = sel.cursor;
        
        silent || this._signal("change");
    };
    this.unselectNode = function(node, silent) {
        var provider = this.provider;
        var sel = provider.selectedItems;
        var i = sel.indexOf(node);
        if (i != -1) {
            sel.splice(i, 1);
            provider.setSelected(node, false);
            if (sel.anchor == node)
                sel.anchor = sel[i-1] || sel[i];
            if (sel.cursor == node)
                sel.cursor = sel[i] || sel[i-1];        
            silent || this._signal("change");
        }
    };
    this.setSelection = function(nodes) {
        if (Array.isArray(nodes)) {
            this.clear(true);
            nodes.forEach(function(node) {
                this.selectNode(node, true, true);
            }, this);
        } else
            this.selectNode(nodes, false, true);
    };
    this.expandSelection = function(cursor, anchor, additive) {
        anchor = anchor || this.getAnchor();
        
        if (!additive)
            this.clear(true);
        var provider = this.provider;
        var sel = provider.selectedItems;
        
        var end = provider.getIndexForNode(cursor);
        var start = provider.getIndexForNode(anchor || cursor);
        
        if (end > start) {
            for (var i = start; i <= end; i++) {
                var node = provider.getNodeAtIndex(i);
                var index = sel.indexOf(node);
                if (index != -1)
                    sel.splice(index, 1);
                if (provider.isSelectable(node))
                    provider.setSelected(node, true);
                sel.push(node);
            }
        } else {
            for (var i = start; i >= end; i--) {
                var node = provider.getNodeAtIndex(i);
                var index = sel.indexOf(node);
                if (index != -1)
                    sel.splice(index, 1);
                if (provider.isSelectable(node))
                    provider.setSelected(node, true);
                sel.push(node);
            }
        }
        
        sel.cursor = cursor;
        sel.anchor = anchor;
        
        this._signal("change");
    };
    
    this.unselectRemoved = function(toRemove) {
        var sel = this.getSelectedNodes();
        var provider = this.provider;
        var changed, cursor = this.getCursor();
        sel.forEach(function(n) {
            if (provider.isAncestor(toRemove, n)) {
                changed = true;
                this.unselectNode(n, true);
            }
        }, this);
        if (changed && !provider.isSelected(cursor)) {
            var parent = toRemove.parent;
            var ch = [];
            if (parent && provider.isOpen(parent)) {
                ch = provider.getChildren(parent);
                var i = ch.indexOf(toRemove);
            }
            if (i == -1) {
                i = toRemove.index;
                var node = ch[i] || ch[i - 1] || parent;
            } else {
                node = ch[i + 1] || ch[i - 1] || parent;
            }
            if (node == provider.root)
                node = ch[0] || node;
            if (node)
                this.selectNode(node, true);
            this._signal("change");
        }
    };
}).call(Selection.prototype);

exports.Selection = Selection;
});
