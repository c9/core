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

var Selection = function(parentEl, renderer) {
    this.element = dom.createElement("div");
    this.element.className = "ace_tree_layer ace_tree_selection-layer";
    parentEl.appendChild(this.element);
    
    this.renderer = renderer;
    this.markerEl = null;
    this.arrowEl = null;
};

(function() {

    this.setDataProvider = function(provider) {
        this.provider = provider;
    };

    this.update = function(config) {
        // markedFolderType: 0: folder, -1: before, 1: after
        if (!this.provider.markedFolder || this.provider.markedFolderType) {
            this.markerEl && this.clearFolderMarker();
        } else {
            this.showFolderMarker(config);
        }
        
        if (!this.provider.markedFolder || !this.provider.markedFolderType) {
            this.arrowEl && this.clearInsertionMarker();
        } else {
            this.showInsertionMarker(config);
        }
    };
    
    this.showFolderMarker = function(config) {
        this.config = config;
        var provider = this.provider;
        var node = provider.markedFolder;
        
        var start = provider.getIndexForNode(node);
        var items = provider.visibleItems;
        var end = start + 1;
        var depth = node.$depth;
        while (items[end] && items[end].$depth > depth) {
            end++;
        }
        end --;
        
        if (start > config.lastRow || end < config.firstRow || start === end) {            
            return this.clearFolderMarker();
        }
        start++;
        end++;
        var top = Math.max(start - config.firstRow,  - 1) * provider.rowHeight;
        var left = (depth + 1) * provider.$indentSize;
        var bottom = Math.min(end - config.firstRow, config.lastRow - config.firstRow + 2) * provider.rowHeight;
        
        if (!this.markerEl) {
            this.markerEl = dom.createElement("div");
            this.markerEl.className = "dragHighlight";
            this.element.appendChild(this.markerEl);
        }
        this.markerEl.style.top = top + "px";
        this.markerEl.style.left = left + "px";
        this.markerEl.style.right = "7px";
        this.markerEl.style.height = bottom - top + "px";
    };
    this.showInsertionMarker = function(config) {
        this.config = config;
        var provider = this.provider;
        var node = provider.markedFolder;
        
        var type = this.provider.markedFolderType;
        
        var start = provider.getIndexForNode(node);
        var depth = node.$depth;
        
        if (start > config.lastRow || start < config.firstRow) {            
            return this.clearInsertionMarker();
        }
        
        if (type == 1)
            start++;
        
        var top = Math.max(start - config.firstRow,  - 1) * provider.rowHeight;
        var left = (depth + 1) * provider.$indentSize;
        
        if (!this.arrowEl) {
            this.arrowEl = dom.createElement("div");
            this.arrowEl.className = "dragArrow";
            this.element.appendChild(this.arrowEl);
        }
        this.arrowEl.style.top = top + "px";
        this.arrowEl.style.left = left + "px";
        this.arrowEl.style.right = "7px";
    };
    this.clearFolderMarker = function() {
        if (this.markerEl) {
            this.markerEl.parentNode.removeChild(this.markerEl);
            this.markerEl = null;
        }
    };
    this.clearInsertionMarker = function() {
        if (this.arrowEl) {
            this.arrowEl.parentNode.removeChild(this.arrowEl);
            this.arrowEl = null;
        }
    };
    this.clear = function() {
        this.clearFolderMarker();
        this.clearInsertMarker();
    };
    this.destroy = function() {
        
    };

}).call(Selection.prototype);

exports.Selection = Selection;

});
