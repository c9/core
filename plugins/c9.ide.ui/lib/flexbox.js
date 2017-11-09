define(function(require, module, exports) {
return function(apf) {
var $setTimeout = setTimeout;
var $setInterval = setInterval;











/**
 * A container that stacks its children vertically.
 * 
 * #### Example
 * 
 * ```xml, demo
 * <a:application xmlns:a="http://ajax.org/2005/aml">
 *   <!-- startcontent -->
 *   <a:vbox width="100">
 *       <a:button height="28" edge="5">Button 1</a:button>
 *       <a:button height="28" edge="5">Button 2</a:button>
 *       <a:button height="28" edge="5">Button 3</a:button>
 *   </a:vbox>
 *   <!-- endcontent -->
 * </a:application>
 * ```
 * 
 * @class apf.vbox
 * @layout
 * @define vbox 
 * 
 * 
 * @see element.hbox
 * 
 * @author      Ruben Daniels (ruben AT ajax DOT org)
 * @version     %I%, %G%
 * @since       0.9
 * @layout
 */
/**
 * A container that stacks its children horizontally.
 * 
 * #### Example
 * 
 * ```xml, demo
 * <a:application xmlns:a="http://ajax.org/2005/aml">
 *   <!-- startcontent -->
 *   <a:hbox height="29" width="300" lean="right" margin="5 0 0 0">
 *       <a:button width="100" edge="5">Button 1</a:button>
 *       <a:button width="100">Button 2</a:button>
 *       <a:button width="100">Button 3</a:button>
 *   </a:hbox>
 *   <!-- endcontent -->
 * </a:application>
 * ```
 * 
 * 
 * #### Remarks
 * 
 * Firefox has some issues:
 * 
 * 1. Sometimes it's necessary to put a fixed width to have it calculate the right
 * height value.
 * 2. Using flex="1" on non fixed height/width tree's will give unexpected results.
 * 
 *
 *
 * @class apf.hbox
 * @inherits apf.GuiElement
 * @define hbox
 * @layout
 * 
 * @see element.vbox
 * @author      Ruben Daniels (ruben AT ajax DOT org)
 * @version     %I%, %G%
 * @since       0.9
 */
apf.hbox = function(struct, tagName) {
    this.$init(tagName || "hbox", apf.NODE_VISIBLE, struct);
};
apf.vbox = function(struct, tagName) {
    this.$init(tagName || "vbox", apf.NODE_VISIBLE, struct);
};

(function() {
    this.minwidth = 0;
    this.minheight = 0;
    
    // *** Properties and Attributes *** //

    this.$focussable = false;
    this.$useLateDom = true; 
    this.$box = true;
    this.$layout = true;
    
    var input = { "INPUT": 1, "SELECT": 1, "TEXTAREA": 1 };

    /**
     * @attribute {String}  [padding=2]      Sets or gets the space between each element.
     */
    /**
     * @attribute {Boolean} reverse      Sets or gets whether the sequence of the elements is in reverse order.
     */
    /**
     * @attribute {String}  [edge="5,5,5,5"]         Sets or gets the space between the container and the elements, space seperated in pixels for each side. Similar to CSS in the sequence (_.i.e._. `top right bottom left`).
     * 
     * #### Example
     * 
     * ```xml
     *  <a:vbox edge="10 10 40 10" />
     * ```
     */
    // @todo Doc
    /**
     * @attribute {String} pack     
     *   
     *  Possible values include:
     * 
     *   - `"start"`:
     *   - `"center"`:
     *   - `"end"`:
     */
    /**
     * @attribute {Boolean} align
     *   
     *  Possible values include:
     * 
     *   - `"start"`:
     *   - `"center"`:
     *   - `"end"`:
     *   - `"stretch"`:
     */
    this.$booleanProperties["splitters"] = true;
    this.$supportedProperties.push("padding", "reverse", "edge", "pack", "align", "splitters");
    
    this.$propHandlers["padding"] = function(value) {
        this.padding = parseInt(value);
        
        var node, nodes = this.childNodes, elms = [];
        for (var i = 0, l = nodes.length; i < l; i++) {
            if ((node = nodes[i]).nodeFunc == apf.NODE_VISIBLE 
              && node.$ext && node.visible !== false)
                elms.push(node);
        }
        
        if (!elms.length)
            return;

        for (var last, b, el, i = elms.length - 2; i >= 0; i--) {
            b = (el = elms[i]).margin && apf.getBox(el.margin) || [0, 0, 0, 0];
            
            if ((!last || !last.$splitter) && !el.$splitter) {
                b[this.$vbox ? 2 : 1] += this.padding;

                if (!apf.hasFlexibleBox && i != 0 && this.align == "stretch" && this.$vbox)
                    b[0] += this.padding;
            }
            
            el.$ext.style.margin = b.join("px ") + "px";
            last = el;
        }
        b = (el = elms[elms.length - 1]).margin && apf.getBox(el.margin) || [0, 0, 0, 0];
        el.$ext.style.margin = b.join("px ") + "px";
        
        if (!apf.hasFlexibleBox)
            this.$resize();
    };
    
    this.$propHandlers["reverse"] = function(value) {
        if (apf.hasFlexibleBox)
            this.$int.style[apf.CSSPREFIX + "BoxDirection"] = value ? "reverse" : "normal";
        else {
            //@todo
        }
    };
    
    this.$propHandlers["edge"] = function(value) {
        var el = !apf.hasFlexibleBox && this.$vbox ? this.$ext : this.$int;
        el.style.padding = (this.$edge = apf.getBox(value)).join("px ") + "px";
        
        if (!apf.hasFlexibleBox)
            this.$resize();
    };
    
    this.$propHandlers["pack"] = function(value) {
        if (apf.hasFlex) {
            if (value == "start" || value == "end")
                value = "flex-" + value;
            this.$int.style.justifyContent = value || "flex-start";
        } else if (apf.hasFlexibleBox) {
            this.$int.style[apf.CSSPREFIX + "BoxPack"] = value || "start";
        } else if (this.$amlLoaded) {
            if (this.$vbox) {
                this.$int.style.verticalAlign = value == "center" ? "middle" : (value == "end" ? "bottom" : "top");
            }    
            else {
                this.$int.style.textAlign = "";
                
                var nodes = this.childNodes;
                for (var i = 0, l = nodes.length; i < l; i++) {
                    var node = nodes[i];
                    if (node.nodeFunc != apf.NODE_VISIBLE || !node.$amlLoaded) //|| node.visible === false 
                        continue;

                    node.$ext.style.textAlign = apf.getStyle(node.$ext, "textAlign") || "left";
                }
                
                this.$int.style.textAlign = value == "center" ? "center" : (value == "end" ? "right" : "left");
            }
        }
    };
    
    //@todo change overflow when height/width changes depending on $vbox
    
    this.$propHandlers["align"] = function(value) {
        if (apf.hasFlex) {
            if (value == "start" || value == "end")
                value = "flex-" + value;
            this.$int.style.alignItems = value || "stretch"; // flex-start
        }
        else if (apf.hasFlexibleBox) {
            this.$int.style[apf.CSSPREFIX + "BoxAlign"] = value || "stretch";

            //@todo this should probably be reinstated
            var stretch = !value || value == "stretch";
            var nodes = this.childNodes;
            var size = this.$vbox ? "width" : "height";
            
            var isInFixed = false, loopNode = this;
            while (!isInFixed && loopNode) {
                isInFixed = loopNode[size] || loopNode.anchors || (loopNode.$vbox ? loopNode.top && loopNode.bottom : loopNode.left && loopNode.right);
                if (!loopNode.flex)
                    break;
                loopNode = loopNode.parentNode || loopNode.$parentNode;
            }
            
            for (var i = 0, l = nodes.length; i < l; i++) {
                if (!(node = nodes[i]).$ext || node.$ext.nodeType != 1)
                    continue;

                //(this[size] || this.anchors || (this.$vbox ? this.top && this.bottom : this.left && this.right)
                if (stretch && !node[size]) //(node.$altExt || 
                    node.$ext.style[size] = (input[node.$ext.tagName] 
                        ? "100%" : "auto");
                else if (node[size])
                    handlers["true"][size].call(node, node[size]);
            }
        }
        else if (this.$amlLoaded) {
            var stretch = !value || value == "stretch";
            
            if (!this.$vbox) {
                var nodes = this.childNodes;
                for (var i = 0, l = nodes.length; i < l; i++) {
                    if ((node = nodes[i]).nodeFunc != apf.NODE_VISIBLE || !node.$amlLoaded) //|| node.visible === false 
                        continue;
                    
                    node.$ext.style.verticalAlign = value == "center" ? "middle" : (value == "end" ? "bottom" : "top");
                }
            }
            else {
                var el = !apf.hasFlexibleBox && this.$vbox ? this.$ext : this.$int;
                el.style.textAlign = "";
                
                var node, nodes = this.childNodes;
                for (var i = 0, l = nodes.length; i < l; i++) {
                    if ((node = nodes[i]).nodeFunc != apf.NODE_VISIBLE || !node.$amlLoaded) //|| node.visible === false 
                        continue;

                    if (node.visible !== false) {
                        node.$ext.style.display = value == "stretch" ? "block" : "inline-block";
                        node.$br.style.display = value == "stretch" ? "none" : "";
                    }
                    node.$ext.style.textAlign = apf.getStyle(node.$ext, "textAlign") || "left";
                }
                
                el.style.textAlign = value == "center" ? "center" : (value == "end" ? "right" : "left");
            }
        }
    };
    
    function visibleHandler(e) {
        
        if (this.parentNode.splitters && !this.$splitter) {
            if (!e.value) {
                if (this.nextSibling && this.nextSibling.$splitter)
                    this.nextSibling.removeNode();
                else if (this.previousSibling && this.previousSibling.$splitter)
                    this.previousSibling.removeNode();
            }
            else {
                var isLast = isLastVisibleChild(this);
                if (!isLast) {
                    if (!this.nextSibling.$splitter && !this.nextSibling.nosplitter
                      && !isFirstVisibleChild(this) && !this.nosplitter) {
                        this.parentNode.insertBefore(
                            this.ownerDocument.createElementNS(apf.ns.aml, "splitter"), 
                            this.nextSibling);
                    }
                }
                else if (this.previousSibling && !this.previousSibling.$splitter
                   && !this.previousSibling.nosplitter) {
                    this.parentNode.insertBefore(
                        this.ownerDocument.createElementNS(apf.ns.aml, "splitter"), 
                        this);
                }
            }
        }
        
        
        //@todo this can be more optimized by calcing if it WAS the last vis child.
        if (this.parentNode.$propHandlers["padding"]) {// && isLastVisibleChild(this)) {
            this.parentNode.$propHandlers["padding"]
                .call(this.parentNode, this.parentNode.padding);
        }
        
        apf.layout.forceResize(this.parentNode.$int);
        
        if (apf.hasFlexibleBox) {
            if (this.$altExt)
                this.$altExt.style.display = e.value 
                    ? apf.CSS_DISPLAY_FLEX
                    : "none";
            return;
        }
        
        if (e.value) {
            this.$ext.style.display = this.parentNode.$vbox 
                && this.parentNode.align == "stretch" ? "block" : "inline-block";
            if (this.$br)
                this.$br.style.display = this.parentNode.align == "stretch" ? "none" : "";
        }
        else {
            if (this.$br)
                this.$br.style.display = "none";
        }

        this.parentNode.$resize();
    }
    
    function resizeHandler() {
        if (!this.flex) {
            if (this.$isRszHandling || this.$lastSizeChild && 
              this.$lastSizeChild[0] == this.$ext.offsetWidth && 
              this.$lastSizeChild[1] == this.$ext.offsetHeight)
                return;
            
            /*if (this.$skipResizeOnce)
                delete this.$skipResizeOnce;
            else*/
                this.parentNode.$resize(true);
            
            this.$lastSizeChild = [this.$ext.offsetWidth, this.$ext.offsetHeight];
        }
    }
    
    var handlers = {
        //Handlers for flexible box layout
        "true": {
            "optimize": function(value) {
                this.optimize = apf.isTrue(value);
            },
            
            "width": function(value) {
                //@todo this should check the largest and only allow that one
                //if (this.parentNode.$vbox && this.parentNode.align == "stretch")
                    //return;

                (this.$altExt || this.$ext).style.width = !apf.isNot(value) 
                    ? (parseFloat(value) == value 
                        ? value + "px"
                        : value)
                    : "";
            },
            
            "height": function(value) {
                //@todo this should check the largest and only allow that one
                //if (!this.parentNode.$vbox && this.parentNode.align == "stretch")
                    //return;

                (this.$altExt || this.$ext).style.height = !apf.isNot(value) 
                    ? (parseFloat(value) == value 
                        ? value + "px"
                        : value)
                    : (apf.isGecko && this.flex && this.parentNode.$vbox ? "auto" : "");
            },
            
            "margin": function(value) {
                var b = apf.getBox(value);
                if (!isLastVisibleChild(this))
                    b[this.parentNode.$vbox ? 2 : 1] += this.parentNode.padding;
                this.$ext.style.margin = b.join("px ") + "px";
            },
            
            "flex": function(value) {
                this.flex = value = parseInt(value);
                if (value) {
                    if (!this.optimize && !this.$altExt) {
                        this.$altExt = this.$ext.ownerDocument.createElement("div");
                        this.parentNode.$int.replaceChild(this.$altExt, this.$ext);
                        this.$altExt.appendChild(this.$ext);
                        this.$altExt.style.boxSizing = "border-box";
                        this.$altExt.style.display = apf.CSS_DISPLAY_FLEX;
                        this.$altExt.style.flexDirection = this.parentNode.$vbox ? "column" : "row";
                        this.$altExt.style[apf.CSSPREFIX + "BoxOrient"] = "vertical";
                        this.$ext.style[apf.CSS_FLEX_PROP] = 1;
                        var size = this.parentNode.$vbox ? "height" : "width";
                        //var osize = this.parentNode.$vbox ? "width" : "height";
                        
                        if (!this.preventforcezero)
                            this.$altExt.style[size] = "0px";
                    }
                    
                    (this.$altExt || this.$ext).style[apf.CSS_FLEX_PROP] = parseInt(value) || 1;
                }
                else if (this.$altExt) {
                    this.parentNode.$int.replaceChild(this.$ext, this.$altExt);
                    this.$ext.style[apf.CSS_FLEX_PROP] = "";
                    delete this.$altExt;
                }
            }
        },
        
        //Handlers for older browsers
        "false": {
            "width": function(value) {
                //@todo this should check the largest and only allow that one
                //if (this.parentNode.$vbox && this.parentNode.align == "stretch")
                    //return;
              
                this.$ext.style.width = value
                    ? (parseFloat(value) == value 
                        ? Math.max(0, value - apf.getWidthDiff(this.$ext)) + "px"
                        : value)
                    : "";
            },
            
            "height": function(value) {
                //@todo this should check the largest and only allow that one
                //if (this.parentNode.localName == "hbox" && this.parentNode.align == "stretch")
                    //return;
      
                this.$ext.style.height = value 
                    ? (parseFloat(value) == value 
                        ? Math.max(0, value - apf.getHeightDiff(this.$ext)) + "px"
                        : value)
                    : "";
            },
            
            "margin": function(value) {
                var b = apf.getBox(value);
                if (this.padding) {
                    if (!isLastVisibleChild(this))
                        b[this.parentNode.$vbox ? 2 : 1] += this.padding;
                    if (this != this.parentNode.firstChild && this.parentNode.align == "stretch" && this.parentNode.$vbox) //@todo
                        b[0] += this.padding;
                }
                this.$ext.style.margin = b.join("px ") + "px";
            },
            
            "flex": function(value) {
                this.flex = parseInt(value);
                if (this.$amlLoaded)
                    this.parentNode.$resize(true);
            }
        }
    };
    
    function isFirstVisibleChild(amlNode) {
        var firstChild = amlNode.parentNode.firstChild;
        while (firstChild && (firstChild.nodeFunc != apf.NODE_VISIBLE 
          || firstChild.visible === false 
          || firstChild.visible == 2 && apf.isFalse(firstChild.getAttribute("visible")))) {
            firstChild = firstChild.nextSibling;
        }
        
        return firstChild && firstChild == amlNode;
    }
    
    function isLastVisibleChild(amlNode) {
        var lastChild = amlNode.parentNode.lastChild;
        while (lastChild && (lastChild.nodeFunc != apf.NODE_VISIBLE 
          || lastChild.visible === false 
          || lastChild.visible == 2 && apf.isFalse(lastChild.getAttribute("visible")))) {
            lastChild = lastChild.previousSibling;
        }
        
        return lastChild && lastChild == amlNode;
    }
    
    //@todo move this to enableTable, disableTable
    this.register = function(amlNode, insert) {
        if (amlNode.$altExt) //@todo hack, need to re-arch layouting
            return;

        amlNode.$propHandlers["left"] = 
        amlNode.$propHandlers["top"] = 
        amlNode.$propHandlers["right"] = 
        amlNode.$propHandlers["bottom"] = apf.K;

        var propHandlers = handlers[apf.hasFlexibleBox];
        for (var prop in propHandlers) {
            amlNode.$propHandlers[prop] = propHandlers[prop];
        }

        if (amlNode.nodeFunc == apf.NODE_VISIBLE) {
            if (apf.hasFlexibleBox) {
                //input elements are not handled correctly by firefox and webkit
                if (amlNode.$ext.tagName == "INPUT" || input[amlNode.$ext.tagName]) {
                    var doc = amlNode.$ext.ownerDocument;
                    amlNode.$altExt = doc.createElement("div");
                    amlNode.parentNode.$int.replaceChild(amlNode.$altExt, amlNode.$ext);
                    amlNode.$altExt.style.boxSizing = "border-box";
                    amlNode.$altExt.appendChild(amlNode.$ext);
                    
                    var d = apf.getDiff(amlNode.$ext);
                    //amlNode.$altExt.style.padding = "0 " + d[0] + "px " + d[1] + "px 0";
                    amlNode.$altExt.style.height = "100%";
                    amlNode.$altExt.style.width = "0";
                    amlNode.$altExt.style.lineHeight = 0;
                    amlNode.$altExt.style.margin = "-1px 0 0 0";
                    amlNode.$ext.style.width = "100%";
                    amlNode.$ext.style.height = "100%";
                    amlNode.$ext.style.top = "1px";
                    amlNode.$ext.style.position = "relative";
                }
                else {
                    if (apf.getStyle(amlNode.$ext, "display") == "inline")
                        amlNode.$ext.style.display = "block"; //@todo undo
                    //This is nice for positioning elements in the context of an hbox/vbox
                    //if (apf.getStyle(amlNode.$ext, "position") == "absolute")
                        //amlNode.$ext.style.position = "relative"; //@todo undo
                }
                
                amlNode.$ext.style.boxSizing = "border-box";
            }
            else {
                if (this.$vbox) {
                    amlNode.$br = this.$int.insertBefore(amlNode.$ext.ownerDocument.createElement("br"), amlNode.$ext.nextSibling);
                    if (amlNode.visible === false)
                        amlNode.$br.style.display = "none";
                }
                else {
                    if (amlNode.visible !== false) {
                        amlNode.$ext.style.display = "inline-block";
                    }
                    this.$int.style.whiteSpace = "";
                    amlNode.$ext.style.whiteSpace = apf.getStyle(amlNode.$ext, "whiteSpace") || "normal";
                    this.$int.style.whiteSpace = "nowrap";
                }
                
                this.$int.style.fontSize = "0";
                if (!amlNode.$box) {
                    var fontSize = apf.getStyle(amlNode.$ext, "fontSize");
                    if (fontSize == "0px") {
                        amlNode.$ext.style.fontSize = "";
                        var pNode = this.$int.parentNode;
                        while (apf.getStyle(pNode, "fontSize") == "0px") {
                            pNode = pNode.parentNode;
                        }
                        fontSize = apf.getStyle(pNode, "fontSize");
                    }
                    amlNode.$ext.style.fontSize = fontSize;//apf.getStyle(amlNode.$ext, "fontSize") || "normal";
                }
                
                amlNode.addEventListener("resize", resizeHandler);
            }
            
            amlNode.addEventListener("prop.visible", visibleHandler);
    
            this.$noResize = true;
            
            if (amlNode.height)
                propHandlers.height.call(amlNode, amlNode.height);
            if (amlNode.width)
                propHandlers.width.call(amlNode, amlNode.width);
            if (amlNode.margin)
                propHandlers.margin.call(amlNode, amlNode.margin);
            if (amlNode.flex)
                propHandlers.flex.call(amlNode, amlNode.flex);    
                
            //Ie somehow sets the visible flags in between registration
            var isLast = isLastVisibleChild(amlNode);
            if (isLast || insert) {
                this.$propHandlers["padding"].call(this, this.padding);
                this.$propHandlers["align"].call(this, this.align);
                
                if (!apf.hasFlexibleBox)
                    this.$propHandlers["pack"].call(this, this.pack);
                    
                if (amlNode.visible !== false) //insert && - removed because for new nodes that are being attached to the tree insert is not set
                    visibleHandler.call(amlNode, { value: true });
                
                //@todo this needs more work
                if (insert && amlNode.previousSibling) {
                    var prev = amlNode.previousSibling;
                    while (prev && (prev.nodeType != 1 || prev.localName == "splitter"))
                        prev = prev.previousSibling;
                    if (prev)
                        visibleHandler.call(prev, { value: true });
                }
            }
            
            else if (this.splitters && !amlNode.$splitter && amlNode.visible !== false && !amlNode.nosplitter) {
                if (amlNode.$ext.nextSibling != (amlNode.nextSibling 
                  && (amlNode.nextSibling.$altExt || amlNode.nextSibling.$ext))) {
                    var _self = this;
                    setTimeout(function() {
                        _self.insertBefore(
                            _self.ownerDocument.createElementNS(apf.ns.aml, "splitter"), 
                            amlNode.nextSibling);
                    });
                }
                else {
                    this.insertBefore(
                        this.ownerDocument.createElementNS(apf.ns.aml, "splitter"), 
                        amlNode.nextSibling);
                }
            }
            
        
            delete this.$noResize;
            
            if (!apf.hasFlexibleBox && isLast)
                this.$resize();
        }
    };
    
    this.unregister = function(amlNode) {
        if (!amlNode.$propHandlers)
            return;
            
        if (!amlNode.$ext) return;
        
        amlNode.$propHandlers["left"] = 
        amlNode.$propHandlers["top"] = 
        amlNode.$propHandlers["right"] = 
        amlNode.$propHandlers["bottom"] = null;
        
        var propHandlers = handlers[apf.hasFlexibleBox];
        for (var prop in propHandlers) {
            delete amlNode.$propHandlers[prop];
        }
        
        //Clear css properties and set layout
        if (amlNode.nodeFunc == apf.NODE_VISIBLE) {
            if (amlNode.flex) {
                var flex = amlNode.flex;
                propHandlers.flex.call(amlNode, 0);
                amlNode.flex = flex;
            }
            
            if (apf.hasFlexibleBox) {
                amlNode.$ext.style.boxSizing = "";
            }
            else {
                amlNode.$ext.style.verticalAlign = "";
                amlNode.$ext.style.textAlign = "";
                amlNode.$ext.style.whiteSpace = "";
                
                if (amlNode.$br) {
                    amlNode.$br.parentNode.removeChild(amlNode.$br);
                    delete amlNode.$br;
                    //amlNode.$ext.style.fontSize = "";
                }
                
                amlNode.removeEventListener("resize", resizeHandler);
            }
            
            amlNode.removeEventListener("prop.visible", visibleHandler);
            
            amlNode.$ext.style.display = amlNode.visible ? "block" : "none";
            
            if (amlNode.margin)
                amlNode.$ext.style.margin = "";
            
            if (amlNode.width)
                amlNode.$ext.style.width = "";

            
            if (this.splitters && !amlNode.$splitter) {
                if (amlNode.nextSibling && amlNode.nextSibling.$splitter)
                    amlNode.nextSibling.removeNode();
                if (isLastVisibleChild(amlNode) && amlNode.previousSibling 
                  && amlNode.previousSibling.$splitter)
                    amlNode.previousSibling.removeNode();
            }
            
        }
    };
    /*
         this.addEventListener("DOMNodeInsertedIntoDocument", function(e) {
        this.register(this.parentNode);
    });
    */
    
    // *** DOM Hooks *** //
    
    this.addEventListener("DOMNodeRemoved", function(e) {
        if (e.$doOnlyAdmin || e.currentTarget == this)
            return;

        if (e.relatedNode == this) {
            this.unregister(e.currentTarget);
            //e.currentTarget.$setLayout();
        }
    });

    this.addEventListener("DOMNodeInserted", function(e) {
        if (e.currentTarget == this) {
            if (this.visible)
                this.$ext.style.display = apf.CSS_DISPLAY_FLEX; //Webkit issue
            return;
        }
        
        if (e.currentTarget.nodeType != 1 
          || e.currentTarget.nodeFunc != apf.NODE_VISIBLE)
            return;

        if (e.relatedNode == this && !e.$isMoveWithinParent) {
            e.currentTarget.$setLayout(this.localName, true);
            
            if (e.currentTarget.$altExt) {
                
                return false;
            }
        }
    });

    function myVisibleHandler(e) {
        if (e.value)
            this.$int.style.display = apf.CSS_DISPLAY_FLEX;
    }
    
    function myHeightHandler(e) {
        clearInterval(this.$heighttimer);
        if (e.value || this.align != "stretch") {
            delete this.$heighttimer;
        }
        else if (!this.$heighttimer) {
            var _self = this;
            this.$heighttimer = $setInterval(function() {
                if (_self.$amlDestroyed)
                    return;

                var nodes = _self.childNodes;
                for (var $int, i = 0, l = nodes.length; i < l; i++) {
                    if (!($int = (node = nodes[i]).$int || node.$container))
                        continue;

                    if (Math.min($int.scrollHeight, node["maxheight"] || 10000) > $int.offsetHeight)
                        return _self.$resize(true);
                }
                
                if (_self.flex)
                    clearInterval(this.$heighttimer);
            }, this.flex ? 1 : 500);
        }
    }
    
    this.$draw = function() {
        var doc = this.$pHtmlNode.ownerDocument;
        this.$ext = this.$pHtmlNode.appendChild(doc.createElement("div"));
        if (this.getAttribute("style"))
            this.$ext.setAttribute("style", this.getAttribute("style"));
        this.$ext.className = this.localName;

        this.$vbox = this.localName == "vbox";
        this.$int = !apf.hasFlexibleBox && this.$vbox //@todo reparenting for gecko needs some admin work
            ? this.$ext.appendChild(doc.createElement("div")) 
            : this.$ext;
        this.$ext.host = this;
        
        if (!apf.hasFlexibleBox && this.$vbox) {
            this.$int.style.display = "inline-block";
            this.$int.style.width = "100%";
        }
        
        if (apf.hasFlex) {
            this.$display = "-" + apf.CSSPREFIX + "-box";
            
            this.$int.style.display = this.$int.style.display || apf.CSS_DISPLAY_FLEX;
            this.$int.style.flexDirection = this.localName == "hbox" ? "" : "column";
            this.$int.style.alignItems = "stretch";
            
            this.addEventListener("prop.visible", myVisibleHandler);
        }
        else if (apf.hasFlexibleBox) {
            this.$display = "-" + apf.CSSPREFIX + "-box";
            
            this.$int.style.display = apf.CSS_DISPLAY_FLEX;
            this.$int.style[apf.CSSPREFIX + "BoxOrient"] = this.localName == "hbox" ? "horizontal" : "vertical";
            this.$int.style[apf.CSSPREFIX + "BoxAlign"] = "stretch";
            
            this.addEventListener("prop.visible", myVisibleHandler);
        }
        else {
            if (!this.$vbox) {
                this.$int.style.whiteSpace = "nowrap";
                this.addEventListener("prop.height", myHeightHandler);
            }

            var spacer = (!apf.hasFlexibleBox && this.$vbox ? this.$ext : this.$int)
                            .appendChild(doc.createElement("strong"));
            spacer.style.height = "100%";
            spacer.style.display = "inline-block";
            //spacer.style.marginLeft = "-4px";
            spacer.style.verticalAlign = "middle";
            
            this.addEventListener("resize", this.$resize);
        }

        if (this.getAttribute("class")) 
            apf.setStyleClass(this.$ext, this.getAttribute("class"));
        
        this.$originalMin = [this.minwidth || 0, this.minheight || 0];
    };
    
    this.$resize = function(force) {
        if (!this.$amlLoaded || this.$noResize)
            return;

        //Protection for stretch re-resizing
        if (force !== true && this.$lastSize && 
          this.$lastSize[0] == this.$int.offsetWidth && 
          this.$lastSize[1] == this.$int.offsetHeight)
            return;
        
        if (!apf.window.vManager.check(this, this.$uniqueId, this.$resize))
            return;
        
        this.$noResize = true;
        this.$lastSize = [this.$int.offsetWidth, this.$int.offsetHeight];

        var total = 0;
        var size = this.$vbox ? "width" : "height";
        var minsize = this.$vbox ? "minWidth" : "minHeight";
        var osize = this.$vbox ? "height" : "width";
        var scroll = this.$vbox ? "scrollWidth" : "scrollHeight";
        var offset = this.$vbox ? "offsetWidth" : "offsetHeight";
        var ooffset = this.$vbox ? "offsetHeight" : "offsetWidth";
        var getDiff = this.$vbox ? "getWidthDiff" : "getHeightDiff";
        var ogetDiff = this.$vbox ? "getHeightDiff" : "getWidthDiff";
        var borders = this.$vbox ? "getVerBorders" : "getHorBorders";

        var nodes = this.childNodes, hNodes = [], fW = 0, max = 0;
        for (var node, i = 0; i < nodes.length; i++) {
            if ((node = nodes[i]).nodeFunc != apf.NODE_VISIBLE || node.visible === false || !node.$amlLoaded)
                continue;

            hNodes.push(node);
            if (!node[size]) {
                var m = node.margin && apf.getBox(node.margin);
                if (m && this.$vbox) m.unshift();
                var mdiff = (m ? m[0] + m[2] : 0);
                max = Math.max(max, mdiff + Math.min(node.$ext[scroll] + apf[borders](node.$ext), node["max" + size] || 10000));
            }

            if (parseInt(node.flex))
                total += parseFloat(node.flex);
            else {
                var m = node.margin && apf.getBox(node.margin);
                if (m && !this.$vbox) m.shift();
                fW += node.$ext[ooffset] + (m ? m[0] + m[2] : 0); //this.padding + 
            }
        }
        if (!max && this[size]) {
            max = this[size] 
                //- (this.$vbox ? this.$edge[0] + this.$edge[2] : this.$edge[1] + this.$edge[3]);
                - apf[ogetDiff](this.$ext);
        }

        /*
             && (this[size] || this.flex)
        */
        if (this.align == "stretch") {
            //var hasSize = this[size] || this.flex;
            var l = hNodes.length;
            var pH = max;//this.$int[offset] - apf[getDiff](this.$int);// - (2 * this.padding);
            for (var i = 0; i < l; i++) {
                node = hNodes[i];

                if (!node[size] && !this.$vbox || this.$vbox && input[node.$ext.tagName]) {
                    var m = node.margin && apf.getBox(node.margin);
                    if (m && this.$vbox) m.unshift();
                    var mdiff = (m ? m[0] + m[2] : 0);
                    
                    if (max && Math.min(node.$ext[scroll], node["max" + size] || 10000) != max)
                        node.$ext.style[size] = Math.max(0, max - apf[getDiff](node.$ext) - mdiff) + "px";
                    else
                        node.$ext.style[size] = "";
                }
            }
        }

        //Flexing
        if (total > 0) {
            if (this.$vbox)
                this.$int.style.height = "100%";
            this.$int.style.overflow = "hidden";
            
            var splitterCount = this.$aml.querySelectorAll("splitter").length * 2;
            
            var rW = this.$int[ooffset] - apf[ogetDiff](this.$int) - fW 
              - ((hNodes.length - 1 - splitterCount) * this.padding);// - (2 * this.edge);
            var lW = rW, done = 0;
            for (var i = 0, l = hNodes.length; i < l; i++) {
                if ((node = hNodes[i]).flex) {
                    var v = (i % 2 == 0 ? Math.floor : Math.ceil)((rW / total) * parseInt(node.flex));
                    done += parseInt(node.flex);
                    var m = node.margin && apf.getBox(node.margin);
                    if (m && !this.$vbox) m.shift();
                    node.$ext.style[osize] = Math.max(0, (done == total ? lW : v) - apf[ogetDiff](node.$ext) - (m ? m[0] + m[2] : 0)) + "px";
                    lW -= v;
                }
            }
        }
        else {
            if (this.$vbox)
                this.$int.style.height = "";
            this.$int.style.overflow = "";
        }
        
        this.$noResize = false;
    };
    
    this.$loadAml = function(x) {
        if (this.padding == undefined)
            this.padding = 0;
            //this.$propHandlers.padding.call(this, this.padding = 0);
        if (this.edge == undefined)
            this.$propHandlers.edge.call(this, this.edge = 0);
        if (this.pack == undefined)
            this.$propHandlers.pack.call(this, this.edge = "start");
        if (this.align == undefined)
            this.align = "stretch";
            //this.$propHandlers.align.call(this, this.align = "stretch");
        if (!apf.hasFlexibleBox && !this.$vbox && !this.height && this.align == "stretch")
            myHeightHandler.call(this, {});
    };
}).call(apf.vbox.prototype = new apf.GuiElement());

apf.hbox.prototype = apf.vbox.prototype;

apf.aml.setElement("hbox", apf.hbox);
apf.aml.setElement("vbox", apf.vbox);


};
});