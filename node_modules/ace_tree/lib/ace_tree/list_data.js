define(function(require, exports, module) {
"use strict";

var oop = require("ace/lib/oop");
var DataProvider = require("./data_provider");

var ListData = function(array) {
    this.visibleItems = array || [];
    this._selectStore = Object.create(null);
};

oop.inherits(ListData, DataProvider);

(function() {
    
    this.setRoot = function(array) {
       this.visibleItems = array || [];
       this._signal("change");
    };
    
    this.getDataRange = function(rows, columns, callback) {
        var view = this.visibleItems.slice(rows.start, rows.start + rows.length);        
        callback(null, view, false);
        return view;
    };
    
    this.getRange = function(top, bottom) {
        var start = Math.floor(top / this.rowHeight);
        var end = Math.ceil(bottom / this.rowHeight) + 1;
        var range = this.visibleItems.slice(start, end);
        range.count = start;
        range.size = this.rowHeight * range.count;
        return range;
    };
    
    this.getTotalHeight = function(top, bottom) {
        return this.rowHeight * this.visibleItems.length;
    };
    
    this.getNodePosition = function(node) {
        var i = node ? node.index : 0;
        var top = i * this.rowHeight;
        var height = this.rowHeight;
        return {top: top, height: height};
    };
    
    this.findItemAtOffset = function(offset) {
        var index = Math.floor(offset / this.rowHeight);
        return this.getNodeAtIndex(index);
    };
    this.getNodeAtIndex = function(index) {
        var id = this.visibleItems[index];
        return this._selectStore[id] || {
            id: id, 
            index: index, 
            isSelected: this.isSelected(id)
        };
    };
    
    this.getIndexForNode = function(node) {    
        if (typeof node == "string")
            return this.visibleItems.indexOf(node);
        if (!node)
            return -1;
        if (this.visibleItems[node.index] === node.id)
            return node.index;
        return this.visibleItems.indexOf(node.id);
    };
    
    this.isSelected = function(node) {
        if (typeof node == "object")
            var id = node.id;
        else if (typeof node == "number")
            var id = this.visibleItems[node];
        else
            var id = node;
        return !!this._selectStore[id];
    };
    this.setSelected = function(node, val) {
        if (val)
            this._selectStore[node.id] = node;
        else
            delete this._selectStore[node.id];
        node.isSelected = val;
    };

}).call(ListData.prototype);

return ListData;
});