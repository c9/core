define(function(require, exports, module) {
"use strict";

var Editor = require("ace/editor").Editor;
var UndoManager = require("ace/undomanager").UndoManager;
var Renderer = require("ace/virtual_renderer").VirtualRenderer;
var lang = require("ace/lib/lang");

exports.treeSearch = function treeSearch(tree, keyword, caseInsensitive, results, head) {
    if (caseInsensitive)
        keyword = keyword.toLowerCase();
    results = results || [];
    head = head || 0;
    for (var i = 0; i < tree.length; i++) {
        var node = tree[i];
        var name = node.name || node.label || "";
        if (caseInsensitive)
            name = name.toLowerCase();
        var index = name.indexOf(keyword);
        var items = node.items || node.children;
        if (index === -1) {
            if (items)
                results = treeSearch(items, keyword, caseInsensitive, results, head);
            continue;
        }
        var result = {
            items: items ? treeSearch(items, keyword, caseInsensitive) : []
        };
        for (var p in node) {
            if (node.hasOwnProperty(p) && p !== "items" && p !== "children")
                result[p] = node[p];
        }
        if (index === 0) {
            results.splice(head, 0, result);
            head++;
        }
        else {
            results.push(result);
        }
    }
    return results;
};

exports.getCaptionHTML = function(node){
    var value = node.name || node.label || "";
    
    if (this.reFilter) {
        var re = new RegExp("(" + this.reFilter + ")", 'i');
        value = value.replace(re, "<strong>$1</strong>");
    }
    
    return value;
};

exports.setFilter = function(str){
    if (!str && this.filterString) {
        if (this.unfilteredRoot && this.unfilteredRoot != this.root) {
            this.setRoot(this.unfilteredRoot);
        }
    } else {
        if (!this.unfilteredRoot)
            this.unfilteredRoot = this.root;
        
        var root = this.unfilteredRoot;
        if (str.lastIndexOf(this.filterString, 0) == 0)
            this.root = root;
            
        this.setRoot(exports.treeSearch(root.children, str, true));
        this.filterString = str;
        this.getCaptionHTML = exports.getCaptionHTML;
    }
    
    this.filterString = str;
    this.reFilter = lang.escapeRegExp(this.filterString);
};


exports.$createFilterInputBox = function(tree) {
    if (!tree.filterEditor) {
        tree.filterEditor = new Editor(new Renderer());
        tree.filterEditor.setOptions({
            maxLines: 1,
            showGutter: false,
            highlightActiveLine: false
        });
        tree.filterEditor.session.setUndoManager(new UndoManager());
        
        tree.filterEditor.on("input", function(e, editor) {
            var val = editor.getValue();
            if (tree.provider) {
                if (!tree.provider.setFilter)
                    tree.provider.setFilter = exports.setFilter;
                tree.provider.setFilter(val);
            }
            if (!val)
                tree.focus();
        });

        tree.filterEditor.commands.bindKeys({
            "Return": function(editor) {tree.focus()},
            "Esc": function(editor) {editor.setValue(""); tree.focus(); }
        });
        tree.on("focus", function() {
            if (!tree.filterEditor.getValue())
                tree.filterEditor.hide();
        });
        tree.filterEditor.hide = function() {
            if (this.container.parentNode && tree.$autoShowFilter)
                this.container.parentNode.removeChild(this.container);
        };
        
        var forwardToTree = function() {
            tree.execCommand(this.name);
        };
        tree.filterEditor.commands.addCommands([
            "centerselection",
            "goToStart",
            "goToEnd",
            "pageup",
            "gotopageup",
            "scrollup",
            "scrolldown",
            "goUp",
            "goDown",
            "selectUp",
            "selectDown",
            "selectMoreUp",
            "selectMoreDown"
        ].map(function(name) {
            var command = tree.commands.byName[name];
            return {
                name: command.name,
                bindKey: command.editorKey || command.bindKey,
                exec: forwardToTree
            };
        }));
    }
};

});
