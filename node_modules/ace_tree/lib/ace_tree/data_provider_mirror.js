/**
 * The main class required to set up a Tree instance in the browser.
 *
 * @class Tree
 **/

define(function(require, exports, module) {
"use strict";

var oop = require("ace/lib/oop");
var DataProvider = require("./data_provider");

var Mirror = function(source) {
    this.source = source;
    this.rowHeight = 25;
    this.expandedList = Object.create(null);
    this.selectedList = Object.create(null);
    
    source && this.setRoot(source.root);
};

oop.inherits(Mirror, DataProvider);
 
(function() {
    
    this.setRoot = function(root){
        if (Array.isArray(root))
            root = {items: root};
        
        this.root = root || {};
        
        if (this.root.$depth == undefined) {
            this.root.$depth = -1;
        }
        if (this.root.$depth < 0) {
            this.visibleItems = [];
            this.root.isOpen = false;
            this.open(this.root);
            this.visibleItems.unshift();
        } else {
            this.visibleItems = [this.root];
        }
        this.$selectedNode = this.root;
        
        this._signal("setRoot");
        this._signal("change");
    };
    
    this.setOpen = function(node, val) {
        if (val)
            this.expandedList[node.path] = val;
        else
            delete this.expandedList[node.path];
    };
    this.isOpen = function(node) {
        return this.expandedList[node.path];
    };
    this.isSelected = function(node) {
        return this.selectedList[node.path];
    };
    this.setSelected = function(node, val) {
        if (val)
            this.selectedList[node.path] = !!val;
        else
            delete this.selectedList[node.path];
    };
    
}).call(Mirror.prototype);

module.exports = Mirror;
});
