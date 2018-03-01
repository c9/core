define(function(require, exports, module) {
"use strict";
var oop = require("ace/lib/oop");
var dom = require("ace/lib/dom");
var lang = require("ace/lib/lang");
var EventEmitter = require("ace/lib/event_emitter").EventEmitter;

var RESIZER_WIDTH = 3;

function getColumnText(node) {
    return node[this.value] || this.defaultValue || "";
}

function ColumnHeader(parentEl, renderer) {
    this.element = dom.createElement("div");
    parentEl.appendChild(this.element);
    this.element.className = "tree-headings";
    this.visible = false;
}
(function() {
    
    this.minWidth = 25;
    
    this.update = function() {
        if (!this.provider || !this.visible)
            return;
        var columns = this.provider.columns;
        var html = [];
        for (var i = 0; i < columns.length; i++) {
            var col = columns[i];
            html.push("<span class='tree-column " 
                + (col.className || "")
                + "' style='width:" + col.$width + ";height:'>"
                + col.caption
                + "</span>"
                + "<span class='tree-column-resizer' >"
                + "</span>"
            );
        }
        this.element.style.paddingRight = columns.$fixedWidth;
        this.element.innerHTML = html.join("");
    };
    
    this.setDataProvider = function(provider) {
        this.provider = provider;
        if (!provider)
            return;
        var columns = this.provider.columns;
        if (!columns) {
            this.visible = false;
            return;
        }
        this.visible = true;
        var fixedWidth = 0;
        
        columns.forEach(function(col, i) {
            col.index = i;
            if (col.value && !col.getText)
                col.getText = getColumnText;
            var w = col.width;
            if (typeof w == "string" && w.slice(-1) == "%") {
                col.flex = parseInt(w, 10) / 100;
                col.$width = col.width;
            } else {
                col.width = parseInt(w, 10) || this.minWidth;
                fixedWidth += col.width;
                col.$width = col.width + "px";
            }
            col.pixelWidth = 0;
        }, this);
        columns.fixedWidth = fixedWidth;
        columns.$fixedWidth = fixedWidth + "px";
        columns.width = null;
        provider.columns = columns;
    };
    
    this.updateWidth = function(width) {
        if (!this.provider || !this.visible)
            return;

        var columns = this.provider.columns;
        var fixedWidth = 0;
        
        columns.width = width;
        
        
        columns.forEach(function(col) {
            if (!col.flex) {
                fixedWidth += col.width;
            }
        });
        
        var flexWidth = width - fixedWidth;
        
        columns.forEach(function(col) {
            if (col.flex) {
                col.pixelWidth = flexWidth * col.flex;
                col.$width = col.flex * 100 + "%";
            } else {
                col.pixelWidth = col.width;
                col.$width = col.width + "px";
            }
        });
        columns.fixedWidth = fixedWidth;
        columns.$fixedWidth = fixedWidth + "px";
    };
    
    this.changeColumnWidth = function(changedColumn, dw, total) {
        this.updateWidth(total);
        
        var columns = this.provider.columns;
        var minWidth = this.minWidth;
        
        if (!dw)
            return;
            
        var index = columns.indexOf(changedColumn);
        var col, nextCol, prevCol;
        for (var i = index + 1; i < columns.length; i++) {
            col = columns[i];
            if (Math.floor(col.pixelWidth) > minWidth || dw < 0) {
                if (col.flex) {
                    nextCol = col;
                    break;
                } else if (!nextCol) {
                    nextCol = col;
                }
            }
        }
        for (var i = index; i >= 0; i--) {
            col = columns[i];
            if (Math.floor(col.pixelWidth) > minWidth || dw > 0) {
                if (col.flex) {
                    prevCol = col;
                    break;
                } else if (!prevCol) {
                    prevCol = col;
                    if (col == changedColumn)
                        break;
                }
            }
        }
        if (!prevCol || !nextCol)
            return;
        
        if (nextCol.pixelWidth - dw < minWidth)
            dw = nextCol.pixelWidth - minWidth;
        
        if (prevCol.pixelWidth + dw < minWidth)
            dw = minWidth - prevCol.pixelWidth;
        
        nextCol.pixelWidth -= dw;
        prevCol.pixelWidth += dw;
        
        if (!nextCol.flex)
            columns.fixedWidth -= dw;
        if (!prevCol.flex)
            columns.fixedWidth += dw;
        var flexWidth = total - columns.fixedWidth;
        
        columns.forEach(function(col) {
            if (col.flex) {
                col.flex = col.pixelWidth / flexWidth;
            } else {
                col.width = col.pixelWidth;
            }
        });
        
        this.updateWidth(total);
    };
    
    this.findColumn = function(x) {
        var columns = this.provider.columns;
        if (this.element.offsetWidth != columns.width)
            this.updateWidth(this.element.offsetWidth);
        var w = 0;
        for (var i = 0; i < columns.length; i++) {
            var column = columns[i];
            w += column.pixelWidth;
            if (x < w + RESIZER_WIDTH) {
                return {
                    index: i, 
                    column: column,
                    overResizer: x > w - RESIZER_WIDTH
                };
            }
        }
    };
    
}).call(ColumnHeader.prototype);


exports.ColumnHeader = ColumnHeader;

});
