define(function(require, exports, module) {
"use strict";

var oop = require("ace/lib/oop");
var dom = require("ace/lib/dom");
var lang = require("ace/lib/lang");
var escapeHTML = lang.escapeHTML;
var EventEmitter = require("ace/lib/event_emitter").EventEmitter;

var Cells = function(parentEl) {
    this.element = dom.createElement("div");
    this.element.className = "ace_tree_layer ace_tree_cell-layer";
    parentEl.appendChild(this.element);
};

(function() {

    oop.implement(this, EventEmitter);
    
    this.config = {},

    this.setDataProvider = function(provider) {
        this.provider = provider;
        if (provider)
            this.update = provider.renderRow ? this.$customUpdate : this.$treeModeUpdate;
    };
    
    this.update = function (config) {
    };
    
    this.measureSizes = function() {
        var domNode = this.element.firstChild;
        if (domNode) {
            this.provider.rowHeight = domNode.offsetHeight;
            this.provider.rowHeightInner = domNode.clientHeight;
        }
    };
    
    this.$treeModeUpdate = function (config) {
        this.config = config;
        
        var provider = this.provider;
        var row, html = [], view = config.view, datarow;
        var firstRow = config.firstRow, lastRow = config.lastRow + 1;
        var hsize = "auto;", vsize = provider.rowHeightInner || provider.rowHeight;
        
        for (row = firstRow; row < lastRow; row++) {
            datarow = view[row - firstRow];
            if (provider.getItemHeight)
                vsize = provider.getItemHeight(datarow, row);
            this.$renderRow(html, datarow, vsize, hsize, row);
        }
        
        if (firstRow <= 0 && lastRow <= 0) {
            this.renderPlaceHolder(provider, html, config);
        }
        
        this.element = dom.setInnerHtml(this.element, html.join(""));
        
        if (!vsize) {
            this.measureSizes();
        }
    };
    
    this.columnNode = function(datarow, column) {
        return "<span class='tree-column " 
        + (column.className || "")
        + "' style='"
        + (datarow.fullWidth ? "" : "width:" + column.$width + ";")
        + "'>";
    };
    
    this.getRowClass = function(datarow, row) {
        var provider = this.provider;
        return "tree-row " 
            + (provider.isSelected(datarow) ? "selected ": '')  
            + (provider.getClassName(datarow) || "") + (row & 1 ? " odd" : " even");
    };
    
    this.$renderRow = function(html, datarow, vsize, hsize, row) {
        var provider = this.provider;
        var columns = provider.columns;
        var indent = provider.$indentSize;// provider.getIndent(datarow);
        html.push("<div style='height:" + vsize + "px;"
            + (columns ? "padding-right:" + columns.$fixedWidth : "")
            + "' class='"
            + this.getRowClass(datarow, row)
            + "'>");
        
        if (!columns || columns[0].type == "tree") {
            if (columns) {
                html.push(this.columnNode(datarow, columns[0], row));
            }
            var depth = provider.getRowIndent(datarow);
            html.push(
                (depth ? "<span style='width:" + depth * indent + "px' class='tree-indent'></span>" : "" )
                + "<span class='toggler " + (provider.hasChildren(datarow)
                    ? (provider.isOpen(datarow) ? "open" : "closed")
                    : "empty")
                + "'></span>"
                + (provider.getCheckboxHTML ? provider.getCheckboxHTML(datarow) : "")
                + provider.getIconHTML(datarow)
                + ( provider.getContentHTML ? provider.getContentHTML(datarow)
                    : "<span class='caption' style='width: " + hsize + "px;height: " + vsize + "px'>"
                    +   provider.getCaptionHTML(datarow)
                    + "</span>"
                )
            );
        }
        if (columns) {
            for (var col = columns[0].type == "tree" ? 1 : 0; col < columns.length; col++) {
                var column = columns[col];
                var rowStr = (column.getHTML) ? column.getHTML(datarow) : escapeHTML(column.getText(datarow) + "");
                html.push("</span>" + this.columnNode(datarow, column, row) + rowStr);
            }
            html.push("</span>");
        }
        
        html.push("</div>");
    };
    
    this.$customUpdate = function(config) {
        this.config = config;
        
        var provider = this.provider;
        var html = [];
        var firstRow = config.firstRow, lastRow = config.lastRow + 1;

        for (var row = firstRow; row < lastRow; row++) {
           provider.renderRow(row, html, config);
        }
        
        if (firstRow <= 0 && lastRow <= 0) {
            this.renderPlaceHolder(provider, html, config);
        }
        
        this.element = dom.setInnerHtml(this.element, html.join(""));
    };
    
    this.updateClasses = function(config) {
        // fallback to full redraw for customUpdate
        if (this.update == this.$customUpdate && !this.provider.updateNode)
            return this.update(config);
            
        this.config = config;
        
        var provider = this.provider;
        var row, view = config.view, datarow;
        var firstRow = config.firstRow, lastRow = config.lastRow + 1;
        var children = this.element.children;
        
        if (children.length != lastRow - firstRow)
            return this.update(config);
        
        for (row = firstRow; row < lastRow; row++) {
            datarow = view[row - firstRow];
            var el = children[row - firstRow];
            el.className = this.getRowClass(datarow, row);
            if (provider.redrawNode)
                provider.redrawNode(el, datarow);
        }
    };

    this.scroll = function(config) {
        // not implemented
        return this.update(config);
        
        this.element.insertAdjacentHTML("afterBegin", "<span>a</span><s>r</s>");
        this.element.insertAdjacentHTML("beforeEnd", "<span>a</span><s>r</s>");
    };
    
    this.updateRows = function(config, firstRow, lastRow) {
        // not implemented
    };

    this.destroy = function() {
        
    };
    
    this.getDomNodeAtIndex = function(i) {
        return this.element.children[i - this.config.firstRow];
    };
    
    this.renderPlaceHolder = function(provider, html, config) {
        if (provider.renderEmptyMessage) {
            provider.renderEmptyMessage(html, config);
        } else if (provider.getEmptyMessage) {
            html.push(
                "<div class='message empty'>",
                    escapeHTML(provider.getEmptyMessage()),
                "</div>"
            );
        }
    };

}).call(Cells.prototype);

exports.Cells = Cells;

});
