define(function(require, exports, module) {
"use strict";

var quickSearch = function(tree, str) {
    var node = tree.selection.getCursor()
    var siblings = tree.provider.getChildren(node.parent);
    
    if (!siblings || siblings.length == 1) {
        return;
    }
    
    var index = siblings.indexOf(node);
    var newNode
    for (var i = index + 1; i < siblings.length; i++) {
        node = siblings[i];
        var label = node.label || node.name || "";
        if (label[0] == str) {
            newNode = node;
            break;
        }
    }
    if (!newNode) {
        for (var i = 0; i < index; i++) {
            node = siblings[i];
            var label = node.label || node.name || "";
            if (label[0] == str) {
                newNode = node;
                break;
            }
        }
    }
    
    if (newNode) {
        tree.selection.selectNode(newNode);
        tree.renderer.scrollCaretIntoView(newNode, 0.5);
    }
};

module.exports = quickSearch;
});
