define(function(require, exports, module) {

    
function parseXml(xmlStr) {
    return (new DOMParser()).parseFromString(xmlStr, "text/xml");
}
function attributes(list) {
    var map = {};
    for (var i = 0; i < list.length; i++) {
        var attr = list[i];
        map[attr.name] = attr.value;
    }
    return list.length && map;
}
function node2Json(node) {
    var children;
    if (node.nodeType == node.ELEMENT_NODE) {
        children = [];
        var list = node.childNodes;
        for (var i = 0; i < list.length; i++) {
            var ch = node2Json(list[i]);
            ch && children.push(ch);
        }
    } else if (node.nodeType == node.TEXT_NODE) {
        return node.data.trim();
    } else if (node.nodeType == node.DOCUMENT_NODE) {
        return node2Json(node.documentElement);
    } else {
        return;
    }
    
    var json = {name: node.nodeName}; // node.localName}
    var props = attributes(node.attributes);
    if (props) json.props = props;
    if (children.length) json.children = children;
    
    return json;
}
function xml2Json(node) {
    if (typeof node == "string")
        node = parseXml(node);
    return node2Json(node);
}

var oop = require("ace/lib/oop");
var lang = require("ace/lib/lang");
var useragent = require("ace/lib/useragent");
var KeyBinding = require("ace/keyboard/keybinding").KeyBinding;
var EventEmitter = require("ace/lib/event_emitter").EventEmitter;
var CommandManager = require("ace/commands/command_manager").CommandManager;


var Node = function() {
    this.children = [];
    this.childNodes = this.children;
    this.firstChild = 
    this.lastChild =
    this.parentNode =
    this.nextSibling =
    this.previousSibling = null;
};

(function() {
    oop.implement(this, EventEmitter);
        
    this.appendChild = function(node) {
        return this.insertBefore(node);
    };
    this.insertBefore = function(node, beforeNode) {
        if (beforeNode == node)
            return node;
        if (!this || this == node)
            throw new Error("Invalid insertBefore call");
        
        var children = this.childNodes;
        // if (node.parentNode == this)
        //     children[index]
        if (node.parentNode)
            node.removeNode();
        
        var index = beforeNode ? children.indexOf(beforeNode) : children.length;
        node.parentNode = this;
        
        if (beforeNode) {
            children.splice(index, 0, node);
        } else {
            children.push(node);
        }
        
        node.previousSibling = children[index - 1];
        node.nextSibling = children[index + 1];
        if (node.previousSibling)
            node.previousSibling.nextSibling = node;
        else
            this.firstChild = children[0];
            
        if (node.nextSibling)
            node.nextSibling.previousSibling = node;
        else
            this.lastChild = children[this.childNodes.length - 1];
        
        return node;
    };
    this.removeChild = function(node) {
        var children = this.childNodes;
        var index = children.indexOf(node);
        if (index == -1) return;
        
        children.splice(index, 1);
        
        var prev = node.previousSibling;
        var next = node.nextSibling;
        if (prev)
            prev.nextSibling = next;
        if (next)
            next.previousSibling = prev;
            
        node.parentNode = 
        node.nextSibling = 
        node.previousSibling = null;
    };
    this.remove = function() {
        if (this.parentNode)
            this.parentNode.removeChild(this);
    };
    
    
    
}).call(Node.prototype);




});