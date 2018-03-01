define(function(require, exports, module) {
"use strict";
var dom = require("ace/lib/dom");
var lang = require("ace/lib/lang");
var MouseEvent = require("./mouse/mouse_event").MouseEvent;
dom.importCssString(".no-events * {pointer-events:none!important}");
function Tooltip(tree) {
    this.tree = tree;
    this.tree.on("mousemove", this.onMouseMove.bind(this));
    this.tree.on("mousewheel", this.onMouseMove.bind(this, null));
    this.tree.renderer.scroller.addEventListener("mouseout", this.onMouseOut.bind(this));
    this.setUp();
    this.update = this.update.bind(this);
    this.tree.renderer.on("afterRender", this.updateNodeClass.bind(this));
    this.clearDelayed = lang.delayedCall(this.onMouseMove.bind(this), 50);
}

(function() {
    this.setUp = function() {
        var container = this.tree.container;
        this.root = document.createElement("div");
        this.root.className = container.className + " no-events";
        this.root.style.cssText = "border: 0px;margin: 0px;"
            + "position: absolute; bottom: initial; right: initial; width: auto; height: auto;"
            + "overflow: visible;z-index: 190000; white-space: pre;"
            + "pointer-events: none";
        // var color = dom.computedStyle(container).backgroundColor;
        // if (!color)
        this.root.style.backgroundColor = "rgb(48, 49, 48)";
        document.body.appendChild(this.root);
        
    };
    this.updateNode = function(treeDomNode) {
        if (this.node) {
            this.node.parentNode.removeChild(this.node);
            this.node = null;
        }
        this.treeDomNode = treeDomNode;
        var rect = treeDomNode && treeDomNode.getBoundingClientRect();
        var maxW = this.tree.renderer.layerConfig.width;
        if (!rect || treeDomNode.lastChild.getBoundingClientRect().right <= maxW) {
            this.root.style.display = "none";
            return;
        }
        // if (rect.width )
        
        this.root.className = this.tree.container.className + " no-events";
        this.root.style.display = "";
            
        this.node = treeDomNode.cloneNode(true);
        this.node.style.margin = "0px";
        
        this.root.appendChild(this.node);
        this.root.style.top = rect.top + "px";
        this.root.style.left = rect.left + "px";
    };
    
    this.updateNodeClass = function() {
        if (this.node && this.treeDomNode) {
            if (this.treeDomNode.parentNode == this.tree.renderer.$cellLayer.element) {
                this.node.className = this.treeDomNode.className;
                this.root.className = this.tree.container.className + " no-events";
            } else
                this.updateNode(null);
        }
    };
    
    this.dettach = function() {
        
    };
    
    this.attach = function() {
        
    };
    
    this.onMouseMove = function(ev) {
        var node = ev && ev.getNode && ev.getNode();
        if (node == this.treeNode)
            return;
        this.treeNode = node;
        if (node)
            this.clearDelayed.cancel();
        this.tree.renderer.on("afterRender", this.update);
    };
    
    this.update = function() {
        var renderer = this.tree.renderer;
        renderer.off("afterRender", this.update);
        var i = renderer.layerConfig.vRange.indexOf(this.treeNode);
        var domNode = renderer.$cellLayer.getDomNodeAtIndex(i + renderer.layerConfig.firstRow);
        this.updateNode(domNode, this.treeNode);
    };
    
    this.onMouseOut = function(e) {
        this.onMouseMove();
    };
    this.onMouseOver = function(ev) {
        this.clearDelayed.schedule();
    };
    
}).call(Tooltip.prototype);

module.exports = Tooltip;

});