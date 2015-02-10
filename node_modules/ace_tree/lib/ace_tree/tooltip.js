define(function(require, exports, module) {
"use strict";
var dom = require("ace/lib/dom");
var lang = require("ace/lib/lang");
dom.importCssString(".no-events * {pointer-events:none!important}");
function Tooltip(tree) {
    this.tree = tree;
    this.tree.on("mousemove", this.onMouseMove.bind(this));
    this.tree.on("mousewheel", this.onMouseMove.bind(this, null));
    this.tree.renderer.scroller.addEventListener("mouseout", this.onMouseOut.bind(this));
    this.setUp();
 //   this.tree.renderer.on("afterRender", this.updateNodeClass.bind(this));
    this.clearDelayed = lang.delayedCall(this.onMouseMove.bind(this), 50);
}

(function() {
    this.setUp = function() {
        var container = this.tree.container;
        this.root = document.createElement("div");
        this.root.className = container.className + " no-events";
        this.root.style.cssText = "border: 0px;margin: 0px;"
            + "position: absolute; bottom: initial; right: initial; width: auto; height: auto;"
            + "overflow: visible;z-index: 1000000; white-space: pre;"
            + "pointer-events: none";
        // var color = dom.computedStyle(container).backgroundColor;
        // if (!color)
        this.root.style.backgroundColor = "rgb(48, 49, 48)";
        document.body.appendChild(this.root);
        
    };
    this.updateNode = function(treeNode) {
        if (this.node) {
            this.node.parentNode.removeChild(this.node);
            this.node = null;
        }
        this.treeNode = treeNode;
        if (!treeNode) {
            this.root.style.display = "none";
            return;
        }
        this.root.className = this.tree.container.className + " no-events";
        this.root.style.display = "";
        var rect = treeNode.getBoundingClientRect();
        this.node = treeNode.cloneNode(true);
        this.node.style.margin = "0px";
        
        this.root.appendChild(this.node);
        this.root.style.top = rect.top + "px";
        this.root.style.left = rect.left + "px";
    };
    
    this.updateNodeClass = function() {
        if (this.node && this.treeNode) {
            if (this.treeNode.parentNode == this.tree.renderer.$cellLayer.element)
                this.node.className = this.treeNode.className;
            else
                this.updateNode(null);
        }
    };
    
    this.dettach = function() {
        
    };
    
    this.attach = function() {
        
    };
    
    this.onMouseMove = function(ev) {
        var target = ev && ev.domEvent.target;
        while (target && !dom.hasCssClass(target, "tree-row")) {
            target = target.parentElement;
        }
        if (target == this.treeNode)
            return;
        this.updateNode(target);
        if (target)
            this.clearDelayed.cancel();
    };
    
    
    this.onMouseOut = function(e) {
        this.onMouseMove({domEvent: e})
    };
    this.onMouseOver = function(ev) {
        this.clearDelayed.schedule();
    };
    
}).call(Tooltip.prototype);

module.exports = Tooltip;

});