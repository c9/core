define(function(require, exports, module) {
    "use strict";
    
    var oop = require("ace/lib/oop");
    var Base = require("ace_tree/list_data");
    var escapeHTML = require("ace/lib/lang").escapeHTML;
    
    var ListData = function(array) {
        Base.call(this);
        
        this.classes = {};
        // todo compute these automatically
        this.innerRowHeight = 34;
        this.rowHeight = 42;
        
        Object.defineProperty(this, "loaded", {
            get: function() { return this.visibleItems.length; }
        });
    };
    oop.inherits(ListData, Base);
    (function() {
        
        this.updateData = function(array) {
            this.visibleItems = array || [];
            
            // @TODO Deal with selection
            this._signal("change");
        };
        
        this.isLoading = function() {};
        
        this.getEmptyMessage = function() {
            if (!this.keyword)
                return this.isLoading()
                    ? "Loading file list. One moment please..."
                    : "No files found.";
            else
                return "No files found that match '" + this.keyword + "'";
        };
        
        this.replaceStrong = function(value) {
            if (!value)
                return "";
                
            var keyword = (this.keyword || "").replace(/\*/g, "");
            var i = value.lastIndexOf(keyword);
            if (i !== -1)
                return escapeHTML(value.substring(0, i))
                    + "<strong>" + escapeHTML(keyword) + "</strong>" 
                    + escapeHTML(value.substring(i + keyword.length));
            
            var result = this.search.matchPath(value, keyword);
            if (!result.length)
                return escapeHTML(value);
                
            result.forEach(function(part, i) {
                if (part.match)
                    result[i] = "<strong>" + escapeHTML(part.val) + "</strong>";
                else
                    result[i] = escapeHTML(part.val);
            });
            return result.join("");
        };
    
        this.renderRow = function(row, html, config) {
            var path = this.visibleItems[row];
            var isSelected = this.isSelected(row);
            var filename = path.substr(path.lastIndexOf("/") + 1);
            html.push("<div class='item " + (isSelected ? "selected " : "") 
                + this.getClassName(row)
                + "' style='height:" + this.innerRowHeight + "px'><span>"
                + this.replaceStrong(filename)
                + "</span><span class='path'>"
                + this.replaceStrong(path)
                + "</span></div>");
        };
        
        this.getClassName = function(row) {
            return this.classes[row] || "";
        };
        
        this.setClass = function(node, className, include) {
            if (include)
                this.classes[node.index] = className;
            else
                delete this.classes[node.index];
            this._signal("changeClass");
        };
        
    }).call(ListData.prototype);
    
    return ListData;
});