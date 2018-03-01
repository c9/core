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

/*global editor:true, txt:true, tree:true, datagrid:true*/
define(function(require, exports, module) {

// var ace = require("ace/ace");
// editor = ace.edit("editor-container");

var Tooltip = require("ace_tree/tooltip");

txt = require("ace/requirejs/text!root/list.txt").trim().replace(/\r/g, "");

var root = {};
txt.split(/[\r\n]+/).forEach(function(x) {
    var parts = x.split(":");
    var node = root;
    parts.forEach(function(p, i) {
        var map = node.map || (node.map = {});
        node = map[p] || (map[p] = {label: p, $depth: i});
    });
});



var Tree = require("ace_tree/tree");
var DataProvider = require("ace_tree/data_provider");

var treeEl = document.getElementById("tree");
tree = new Tree(treeEl);
tree.setDataProvider(new DataProvider(root));


DataProvider.variableHeightRowMixin.call(tree.provider);
tree.provider.getItemHeight = function(node, i) {
    return this.rowHeight; // * (i%2 + 1);
};

new Tooltip(tree);

var datagridEl = document.getElementById("datagrid");
datagrid = new Tree(datagridEl);
var gridData = new DataProvider();
gridData.getChildrenFromMap = gridData.getChildren;
gridData.getChildren = function(node) {
    node.children = node.map && Object.keys(node.map).map(function(key) {
        var child = node.map[key];
        return {
            label: key.toUpperCase(),
            key: key,
            length: key.length,
            childCount: Object.keys(child.map || child),
            map: child.map
        };
    });
    return this.getChildrenFromMap(node);
};

gridData.setRoot({map: root.map});



gridData.columns = [{
    caption: "Key",
    getText: function(node) { return node.key },
    width: "60%",
    className: "main",
    type: "tree"
}, {
    caption: "Len",
    getText: function(node) { return node.length },
    width: "50px",
    className: "red"
}, {
    caption: "Child Count",
    getText: function(node) { return node.childCount },
    width: "40%"
}];


datagrid.setDataProvider(gridData);


window.addEventListener("resize", function() {
    tree.resize();
    datagrid.resize();
});


});
