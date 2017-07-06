// TODO docs, see data/breakpoint.js
define(function(require, exports, module) {
    
    var Data = require("./data");
    
    function Node(options) {
        this.data = options || {};
        if (!this.data.items)
            this.data.items = [];
        if (!this.data.type)
            this.data.type = "node";
    }
    
    Node.prototype = new Data(
        ["passed", "type", "runner", "index", "tree"], 
        ["items", "annotations"],
        ["pos", "selpos"]
    );
    
    Node.prototype.equals = function(node) {
        return this.data.label == node.label;
    };
    
    module.exports = Node;
});