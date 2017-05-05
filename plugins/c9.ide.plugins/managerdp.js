define(function(require, exports, module) {
    var oop = require("ace/lib/oop");
    var TreeData = require("ace_tree/data_provider");
    
    var DataProvider = function(root) {
        TreeData.call(this, root);
        this.rowHeight = 18;
    };
    oop.inherits(DataProvider, TreeData);
    
    (function() {
        this.getCaptionHTML = function(node) {
            if (!node.name) return "";
            return node.name.replace(this.reKeyword, "<strong>$1</strong>");
        };
        
        this.sort = function(children) {
            var compare = TreeData.alphanumCompare;
            return children.sort(function(a, b) {
                var aIsSpecial = a.noSelect;
                var bIsSpecial = b.noSelect;
                if (aIsSpecial && !bIsSpecial) return 1;
                if (!aIsSpecial && bIsSpecial) return -1;
                if (aIsSpecial && bIsSpecial) return a.index - b.index;
                
                return compare(a.name + "", b.name + "");
            });
        };
        
        this.updateNode = function(node) {
            var isOpen = node.isOpen;
            this.close(node, null, true);
            if (isOpen)
                this.open(node, null, true);
        };
        
        // this.getIconHTML = function(node) {
        //     return node.isNew ? "" : "<span class='dbgVarIcon'></span>";
        // };
        
        this.getClassName = function(node) {
            return node.className || "";
        };

    }).call(DataProvider.prototype);
 
    return DataProvider;
});

