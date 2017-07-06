define(function(require, exports, module) {
    var oop = require("ace/lib/oop");
    var escapeHTML = require("ace/lib/lang").escapeHTML;
    var BaseClass = require("ace_tree/data_provider");
    
    var CLASS_SELECTED = "item selected";
    var CLASS_UNSELECTED = "item";
    
    var DataProvider = function(root) {
        BaseClass.call(this, root || {});
        
        this.rowHeight = 20;
        // this.rowHeightInner = 18;
        
        Object.defineProperty(this, "loaded", {
            get: function() { return this.visibleItems.length; }
        });
    };
    oop.inherits(DataProvider, BaseClass);
    
    (function() {
        this.$sortNodes = false;
        
        this.getEmptyMessage = function() {
            return "No outline available for the active view";
        };
        
        this.setRoot = function(root) {
            if (Array.isArray(root))
                root = { items: root };
            this.root = root || {};
            this.$selectedNode = this.root;
            this.visibleItems = [];
            this.open(this.root, true);
            
            // @TODO Deal with selection
            this._signal("change");
        };
        
        this.select = function(index) {
            this.selectNode(index === 0 ? this.root : { index: index });
        };
        
        this.getIconHTML = function(node) {
            return "<span class='icon " + node.icon + "'></span>";
        };
        this.getClassName = function(node) {
            return node.className || "";
        };
        
        this.getCaptionHTML = function(node) {
            var value = escapeHTML(node.name);
            
            if (this.filter) {
                var re = new RegExp("(" + this.reFilter + ")", 'i');
                value = value.replace(re, "<strong>$1</strong>");
            }
            
            return value + 
                (node.meta 
                    ? "<code style='color:gray;'>" + node.meta + "</code>" 
                    : "");
        };
        
        // this.renderRow = function(row, html) {
        //     debugger;
        //     var match = this.visibleItems[row];
        //     html.push("<div>" + match.name + "</div>");
        // }

        // this.sort = function(children, compare) {
        //     return children;
        // }
    }).call(DataProvider.prototype);
 
    return DataProvider;
});
