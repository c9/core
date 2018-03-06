define(function(require, module, exports) {
return function(apf) {
var $setTimeout = setTimeout;
var $setInterval = setInterval;


/**
 * This abstraction is using for resizing block elements. Resizing is allowed
 * with square elements in vertical, horizontal or both planes. Symmetric
 * resizing is possible with SHIFT button.
 * 
 * @private
 * @default_private
 * @constructor
 * 
 * @author      Lukasz Lipinski
 * @version     %I%, %G%
 * @since       1.0
 * 
 */

apf.resize = function() {
    /** 
     *     {Boolean} scalex       resizing in horizontal plane, default is true
     *         Possible values:
     *         true   resizing in horizontal plane is allowed
     *         false  resizing in horizontal plane is not allowed
     *     {Boolean} scaley       resizing in vertical plane, default is true
     *         Possible values:
     *         true   resizing in vertical plane is allowed
     *         false  resizing in vertical plane is not allowed
     *     {Boolean} scaleratio   resizing in horizontal or vertical plane only is not allowed. Resizing in two dimensions plane at the same time is allowed.
     *         Possible values:
     *         true   resizing in two dimensions plane at the same time is allowed
     *         false  Resizing in two dimensions plane at the same time is not allowed
     *     {Number}  dwidth       the minimal horizontal size of Block element, default is 56 pixels
     *     {Number}  dheight      the minimal vertical size of Block element, default is 56 pixels
     */
    this.scales = {
        scalex: false,
        scaley: false,
        scaleratio: false,
        dwidth: 0,
        dheight: 0,
        snap: false,
        gridW: 48,
        gridH: 48
    };

    /*
     * html representation of resized block element
     */
    this.htmlElement;

    /**
     * store object representations of inputs elements
     */
    var squares = [];

    this.init = function() {
        squares = [
            new apf.resize.square("top", "left", this),
            new apf.resize.square("top", "middle", this),
            new apf.resize.square("top", "right", this),
            new apf.resize.square("middle", "left", this),
            new apf.resize.square("middle", "right", this),
            new apf.resize.square("bottom", "left", this),
            new apf.resize.square("bottom", "middle", this),
            new apf.resize.square("bottom", "right", this)];
    };
    
    /**
     * Links block element with resize feature
     * 
     * @param {HTMLElement}   oHtml    html representation of block element
     * @param {Object}        scales   blocks scale settings
     */
    this.grab = function(oHtml, scales) {
        this.htmlElement = oHtml;
        this.scales = scales;

        if (!squares.length)
            this.init();
        this.show();
    };

    /**
     * Hides all block squares
     */
    this.hide = function() {
        for (var i = 0, l = squares.length; i < l; i++) {
            squares[i].visible = false;
            squares[i].repaint();
        }
    };

    /**
     * Shows all block squares
     */
    this.show = function() {
        var sx = this.scales.scalex;
        var sy = this.scales.scaley;
        var sr = this.scales.scaleratio;

        for (var i = 0, l = squares.length, s; i < l; i++) {
            s = squares[i];
            s.visible = sx && sy
                ? true
                : (sy && !sx
                    ? (s.posX == "middle"
                        ? true
                        : false)
                    : (sx && !sy
                        ? (s.posY == "middle"
                            ? true
                            : false)
                        : (sr
                            ? ((s.posY == "top" || s.posY == "bottom")
                              && s.posX !== "middle"
                                ? true
                                : false)
                            : false)));
            
            s.repaint();
        }
    };

    /**
     * Destroys all block squares
     */
    this.destroy = function() {
        for (var i = 0; i < squares.length; i++) {
            squares[i].destroy();
        }
    };
};

/*
 * Creates html and object representation for square element. Square is used for
 * resizing block elements.
 * 
 * @param {String}   posY        square vertical align relative to resized block element
 *     Possible values:
 *     top      square is on top of resized block element
 *     middle   square is in the middle of the resized block element
 *     bottom   square is on the bottom of resized block element
 * @param {String}   posX        square vertical align relative to resized block element
 *     Possible values:
 *     left     square is on the left of resized block element
 *     middle   square is in the middle of the resized block element
 *     right    square is on the right of resized block element
 * @param {Object}   objResize   object of resize class
 * @constructor
 */
apf.resize.square = function(posY, posX, objResize) {
    /*
     * Square visibility
     */
    this.visible = true;
    /*
     * square vertical align relative to resized block element
     */
    this.posX = posX;
    /*
     * square vertical align relative to resized block element
     */
    this.posY = posY;

    var margin = 0;
    var _self = this;

    /*
     * html represenation of square element
     */
    this.htmlElement = objResize.htmlElement.parentNode.appendChild(document.createElement('div'));
    apf.setStyleClass(this.htmlElement, "square");

    /*
     * Repaints square
     */
    this.repaint = function() {
        if (this.visible) {
            var block = objResize.htmlElement;
            this.htmlElement.style.display = "block";

            var bw = parseInt(block.style.width) + apf.getDiff(block)[0];
            var bh = parseInt(block.style.height) + apf.getDiff(block)[1];
            var bt = parseInt(block.style.top);
            var bl = parseInt(block.style.left);

            var sw = this.htmlElement.offsetWidth;
            var sh = this.htmlElement.offsetHeight;

            var t = posY == "top"
                ? bt - margin - sh
                : posY == "middle"
                    ? bt + bh / 2 - sh / 2
                    : bt + bh + margin;
            var l = posX == "left"
                ? bl - margin - sw
                : posX == "middle"
                    ? bl + bw / 2 - sw / 2
                    : bl + bw + margin;

            var c = (posY == "middle" 
                ? "w-resize"
                : (posX == "middle"
                     ? "n-resize"
                     : (posY + posX == "topleft"
                       || posY + posX == "bottomright") 
                         ? "nw-resize" 
                         : "ne-resize"));

            this.htmlElement.style.top = (t - 1) + "px";
            this.htmlElement.style.left = (l - 1) + "px";
            this.htmlElement.style.cursor = c;
        }
        else {
            //IE bug
            var sw = this.htmlElement.offsetWidth;
            this.htmlElement.style.display = 'none';
        }
    };

    this.destroy = function() {
        apf.destroyHtmlNode(this.htmlElement);
    };

    /* Events */
    this.htmlElement.onmouseover = function(e) {
        apf.setStyleClass(_self.htmlElement, "squareHover");
    };

    this.htmlElement.onmouseout = function(e) {
        apf.setStyleClass(_self.htmlElement, "", ["squareHover"]);
    };

    this.htmlElement.onmousedown = function(e) {
        e = (e || event);

        var block = objResize.htmlElement,

            sx = e.clientX,
            sy = e.clientY,

            pt = block.parentNode.offsetTop,
            pl = block.parentNode.offsetLeft,

            dw = objResize.scales.dwidth,
            dh = objResize.scales.dheight,
            
            snap = objResize.scales.snap,
            gridH = objResize.scales.gridH,
            gridW = objResize.scales.gridW,

            objBlock = apf.flow.isBlock(block),
            r = objBlock.other.ratio,

            posX = _self.posX,
            posY = _self.posY,

            width, height, top, left, dx, dy,
            prev_w, prev_h,

            l = parseInt(block.style.left),
            t = parseInt(block.style.top),
            w = parseInt(block.style.width),
            h = parseInt(block.style.height),
            resized = false;
            
        objResize.onresizedone(w, h, t, l);

        if (e.preventDefault) {
            e.preventDefault();
        }

        document.onmousemove = function(e) {
            e = (e || event);

            dx = e.clientX - sx;
            dy = e.clientY - sy;
            var shiftKey = e.shiftKey,
                proportion = r;

            if (shiftKey) {
                if (posX == "right" && posY == "bottom") {
                    width = w + dx;
                    height = width / proportion;
                    left = l;
                    top = t;
                }
                else if (posX == "right" && posY == "top") {
                    width = w + dx;
                    height = width / proportion;
                    left = l;
                    top = t - dx / proportion;
                }
                else if (posX == "left" && posY == "bottom") {
                    width = w - dx;
                    height = width / proportion;
                    left = l + dx;
                    top = t;
                }
                else if (posX == "left" && posY == "top") {
                    width = w - dx;
                    height = width / proportion;
                    left = l + dx;
                    top = t + dx / proportion;
                }

                /* Keep minimal size */
                if (width >= dw && height >= dh) {
                    width = prev_w = Math.max(dw, width);
                    height = prev_h = Math.max(dh, height);
                }
                else {
                    width = prev_w;
                    height = prev_h;
                    return false;
                }
            }
            else {
                width = posX == "right"
                    ? w + dx
                    : (posX == "left"
                        ? w - dx
                        : w);
                height = posY == "bottom"
                    ? h + dy
                    : (posY == "top"
                        ? h - dy
                        : h);
                left = posX == "right"
                    ? l
                    : (posX == "left"
                        ? Math.min(l + w - dw, l + dx)
                        : l);
                top = posY == "bottom"
                    ? t
                    : (posY == "top"
                        ? Math.min(t + h - dh, t + dy)
                        : t);

                /* Keep minimal size */
                width = Math.max(dw, width);
                height = Math.max(dh, height);
            }

            if (snap) {
                left = Math.floor(left / gridW) * gridW;
                top = Math.floor(top / gridH) * gridH;
                width = Math.ceil(width / gridW) * gridW;
                height = Math.ceil(height / gridH) * gridH;
            }

            if (objResize.onresize) {
                objResize.onresize(block, top, left, width, height);
            }

            objResize.show();
            
            resized = true;
        };

        document.onmouseup = function(e) {
            document.onmousemove = null;
            if (objResize.onresizedone && resized) {
                objResize.onresizedone(width, height, top, left);
                objBlock.other.ratio = width / height;
                resized = false;
            }
        };
    };
};




/**
 * 
 * A container that stacks two children vertically. 
 * 
 * Programatically, this is identical to a regular [[vbox]], except that it can
 * only accept two children, and uses absolute positioning. Because of this, there
 * is more work required to construct AML that matches a regular `<a:vbox>`; however,
 * the performance improvements in using a `<a:vsplitbox>` are massive.
 *
 * @class apf.vsplitbox
 * @define vsplitbox
 * @layout
 *
 * @inheritDoc apf.hsplitbox
 *
 * @author      Ruben Daniels (ruben AT ajax DOT org)
 * @version     %I%, %G%
 * @since       3.0
 * @see element.hsplitbox
 */
/**
 *
 * A container that stacks two children horizontally.
 * 
 * Programatically, this is identical to a regular [[apf.hbox]], except that it can
 * only accept two children, and uses absolute positioning. Because of this, there
 * is more work required to construct AML that matches a regular `<a:hbox>`; however,
 * the performance improvements in using a `<a:hsplitbox>` are massive.
 *
 * @class apf.hsplitbox
 * @define hsplitbox 
 * @layout
 * @inherits apf.GuiElement
 *
 * @author      Ruben Daniels (ruben AT ajax DOT org)
 * @version     %I%, %G%
 * @since       3.0\
 * @see element.vsplitbox
 */
apf.hsplitbox = function(struct, tagName) {
    this.$init(tagName || "hsplitbox", apf.NODE_VISIBLE, struct);
};
apf.vsplitbox = function(struct, tagName) {
    this.$init(tagName || "vsplitbox", apf.NODE_VISIBLE, struct);
};

(function() {
    this.minwidth = 0;
    this.minheight = 0;
    
    this.padding = 0;
    this.edge = 0;
    this.$edge = [0, 0, 0, 0];
    
    // *** Properties and Attributes *** //

    this.$focussable = false;
    this.$useLateDom = true; 
    this.$box = true;
    this.$layout = true;
    
    /**
     * @attribute {String}  [padding="2"]      Sets or gets the space between each element.
     */
    /**
     * @attribute {String}  [edge="5 5 5 5"]         Sets or gets the space between the container and the elements, space seperated in pixels for each side. Similar to CSS in the sequence of `top right bottom left`.
     */
    this.$booleanProperties["splitter"] = true;
    this.$supportedProperties.push("padding", "edge", "splitter");
    
    this.$propHandlers["padding"] = function(value) {
        this.padding = parseInt(value);
        
        if (!this.$amlLoaded)
            return;
            
        if (this.$handle)
            this.$handle.$ext.style[this.$vbox ? "height" : "width"] = value + "px";
        
        var firstChild = this.getFirstChild();
        var lastChild = this.getSecondChild();
        
        if (this.$vbox) {
            //Two flex children
            if (this.flexChild2) {
                if (firstChild.height) {
                    
                    // This is not needed because with bottom: xx% it already works
                    
                    // if (String(firstChild.height).indexOf("%") == -1) {
                        lastChild.$ext.style.marginTop = firstChild.visible
                            ? value + "px" // + apf.getHeightDiff(firstChild.$ext)
                            : 0;
                    // }
                }
                else {
                    firstChild.$ext.style.marginBottom = lastChild.visible
                        ? (value 
                            + apf.getHeightDiff(lastChild.$ext)) + "px"
                        : 0;
                }
            }
            else if (this.fixedChild && this.fixedChild.visible) {
                //One flex child (first)
                if (this.flexChild1 == firstChild) {
                    if (this.fixedChild.visible) {
                        this.flexChild1.$ext.style.bottom = 
                            (parseInt(this.fixedChild.height) + value + this.$edge[2]) + "px";
                    }
                }
                    
                //One flex child (last)
                else if (lastChild && this.flexChild1 == lastChild) {
                    this.flexChild1.$ext.style.top = 
                        (parseInt(this.fixedChild.height) + value + this.$edge[2]) + "px";
                }
            }
        }
        else {
            //Two flex children
            if (this.flexChild2) {
                if (firstChild.width) {
                    lastChild.$ext.style.marginLeft = 
                        (value 
                            + apf.getWidthDiff(firstChild.$ext)
                            + apf.getMargin(firstChild.$ext)[0]) + "px";
                }
                else {
                    firstChild.$ext.style.marginRight = 
                        (value + (lastChild
                            ? apf.getWidthDiff(lastChild.$ext)
                                + apf.getMargin(lastChild.$ext)[0]
                            : 0)) + "px";
                }
            }
            else if (this.fixedChild && this.fixedChild.visible) {
                //One flex child (first)
                if (this.flexChild1 == firstChild) {
                    this.flexChild1.$ext.style.right =   
                        (parseInt(this.fixedChild.width) + value + this.$edge[1]) + "px";
                }
                    
                //One flex child (last)
                else if (lastChild && this.flexChild1 == lastChild) {
                    this.flexChild1.$ext.style.left = 
                        (parseInt(this.fixedChild.width) + value + this.$edge[3]) + "px";
                }
            }
        }
    };
    
    this.$propHandlers["splitter"] = function(value) {
        if (value) {
            if (this.$handle)
                this.$handle.show();
            else {
                this.$handle = this.insertBefore(
                    this.ownerDocument.createElementNS(apf.ns.aml, "splitter"), 
                    this.lastChild);
            }
        }
        else {
            this.$handle && this.$handle.hide();//destroy(true, true);
        }
    };
    
    this.$propHandlers["edge"] = function(value, setSize) {
        this.$edge = apf.getBox(value);
        
        if (!this.$amlLoaded)
            return;
        
        var fNode = this.getFirstVisibleChild();
        if (!fNode) {
            this.hide();
            return false;
        }
        fNode.$ext.style.left = (this.$edge[3] + fNode.$margin[3]) + "px";
        fNode.$ext.style.top = (this.$edge[0] + fNode.$margin[0]) + "px";
        if (this.$vbox)
            fNode.$ext.style.right = (this.$edge[1] + fNode.$margin[1]) + "px";
        else
            fNode.$ext.style.bottom = (this.$edge[2] + fNode.$margin[2]) + "px";
        
        var lNode = this.getSecondVisibleChild();
        if (lNode && lNode.visible && lNode.$ext) {
            lNode.$ext.style.right = (this.$edge[1] + lNode.$margin[1]) + "px";
            lNode.$ext.style.bottom = (this.$edge[2] + lNode.$margin[2]) + "px";
            if (this.$vbox) {
                var isPercentage;
                
                lNode.$ext.style.left = (this.$edge[3] + lNode.$margin[3]) + "px";
                if (fNode.height || fNode.height === 0) {
                    isPercentage = String(fNode.height).indexOf("%") > -1;
                    lNode.$ext.style.top = isPercentage 
                        ? fNode.height 
                        : ((parseInt(fNode.height) + this.padding 
                            + this.$edge[0] + fNode.$margin[0]) + "px");
                    if (isPercentage) {
                        fNode.$ext.style.height = "";
                        fNode.$ext.style.bottom = (100 - parseFloat(fNode.height)) + "%";
                        lNode.$ext.style.height = "";
                    }
                    
                    if (this.$handle) {
                        this.$handle.$ext.style.top = isPercentage
                            ? fNode.height 
                            : ((parseInt(fNode.height) + this.$edge[0]) + "px");
//                        this.$handle.$ext.style.marginTop = isPercentage
//                            ? this.padding + "px"
//                            : "0";
                    }
                }
                else {
                    isPercentage = String(lNode.height).indexOf("%") > -1;
                    lNode.$ext.style.top = "";
                    fNode.$ext.style.bottom = isPercentage 
                        ? lNode.height 
                        : ((parseInt(lNode.height) + this.padding 
                            + this.$edge[2] + lNode.$margin[2]) + "px");
                    if (isPercentage) {
                        lNode.$ext.style.height = "";
                        lNode.$ext.style.top = (100 - parseFloat(lNode.height)) + "%";
                    }
                    
                    if (this.$handle) {
                        this.$handle.$ext.style.bottom = isPercentage
                            ? lNode.height 
                            : ((parseInt(lNode.height) + this.$edge[0]) + "px");
//                        this.$handle.$ext.style.marginBottom = isPercentage
//                            ? this.padding + "px"
//                            : "0";
                    }
                }
                
                if (this.$handle) {
                    this.$handle.$ext.style.left = this.$edge[3] + "px";
                    this.$handle.$ext.style.right = this.$edge[1] + "px";
                }
            }
            else {
                lNode.$ext.style.top = this.$edge[0] + lNode.$margin[0] + "px";
                
                if (fNode.width || fNode.width === 0) {
                    var isPercentage = String(fNode.width).indexOf("%") > -1;
                    lNode.$ext.style.left = isPercentage
                        ? fNode.width 
                        : ((parseInt(fNode.width) + this.padding 
                            + this.$edge[3] + fNode.$margin[3]) + "px");
                    if (isPercentage) {
                        fNode.$ext.style.width = "";
                        fNode.$ext.style.right = (100 - parseFloat(fNode.width)) + "%";
                    }
                    
                    if (this.$handle) {
                        this.$handle.$ext.style.left = isPercentage
                            ? fNode.width 
                            : ((parseInt(fNode.width) + this.$edge[3]) + "px");
//                        this.$handle.$ext.style.marginLeft = isPercentage
//                            ? this.padding + "px"
//                            : "0";
                    }
                }
                else {
                    var isPercentage = String(lNode.width).indexOf("%") > -1;
                    lNode.$ext.style.left = "";
                    fNode.$ext.style.right = isPercentage
                        ? lNode.width 
                        : ((parseInt(lNode.width) + this.padding 
                            + this.$edge[1] + lNode.$margin[1]) + "px");
                    if (isPercentage) {
                        lNode.$ext.style.width = "";
                        lNode.$ext.style.left = (100 - parseFloat(lNode.width)) + "%";
                    }
                    
                    if (this.$handle) {
                        this.$handle.$ext.style.right = isPercentage
                            ? lNode.width 
                            : ((parseInt(lNode.width) + this.$edge[3]) + "px");
//                        this.$handle.$ext.style.marginRight = isPercentage
//                            ? this.padding + "px"
//                            : "0";
                    }
                }
                
                if (this.$handle) {
                    this.$handle.$ext.style.top = this.$edge[0] + "px";
                    this.$handle.$ext.style.bottom = this.$edge[2] + "px";
                }
            }
            
            if (this.$handle)
                this.$handle.$ext.style.position = "absolute";
        }
        else {
            if (!this.$vbox) {
                fNode.$ext.style.right = (this.$edge[1] + fNode.$margin[1]) + "px";
                fNode.$ext.style.width = "";
            }
            else {
                fNode.$ext.style.bottom = (this.$edge[2] + fNode.$margin[2]) + "px";
                fNode.$ext.style.height = "";
            }
            
            if (this.$handle)
                this.$handle.hide();
        }
        
        if (setSize === true) {
            var size = this.$vbox ? "height" : "width";
            fNode.$propHandlers[size].call(fNode, fNode[size]);
        }
    };
    
    this.getFirstChild = function(startNode) {
        var node = startNode || this.firstChild;
        while (node && node.$splitter) {
            node = node.nextSibling;
        }
        return node || false;
    };
    this.getSecondChild = function() {
        var node = this.getFirstChild();
        if (!node)
            return false;
        return node.nextSibling && this.getFirstChild(node.nextSibling);
    };
    
    this.getFirstVisibleChild = function(startNode) {
        var node = startNode || this.firstChild;
        while (node && (!node.visible || node.$splitter)) {
            node = node.nextSibling;
        }
        if (node && node.visible)
            return node;
        return false;
    };
    
    this.getSecondVisibleChild = function() {
        var node = this.getFirstVisibleChild();
        if (!node)
            return false;
        return node.nextSibling && this.getFirstVisibleChild(node.nextSibling);
    };
    
    function visibleHandler(e) {
        if (this.parentNode.$handle) {
            if (!e.value || this.parentNode.childNodes.length < 3)
                this.parentNode.$handle.hide();
            else
                this.parentNode.$handle.show();
        }
        
        if (e.value && !this.parentNode.visible)
            this.parentNode.show();
        
        this.parentNode.$propHandlers.edge
            .call(this.parentNode, this.parentNode.edge, true);
        
        // apf.layout.forceResize(this.parentNode.$int);
        
        //Change margin
        this.parentNode.$propHandlers.padding
            .call(this.parentNode, this.parentNode.padding);
    }
    
    var handlers = {
        "width": function(value, isLast) {
            //@todo this should check the largest and only allow that one
            //if (this.parentNode.$vbox && this.parentNode.align == "stretch")
                //return;
            
            //@todo change fixedChild flexChild1 and flexChild2 based on this

            this.$ext.style.width = !apf.isNot(value) 
                ? (parseFloat(value) == value 
                    ? (value - apf.getWidthDiff(this.$ext)) + "px"
                    : value)
                : "";
            
            //This can be optimized
            if (this.$amlLoaded && isLast !== false)
                this.parentNode.$propHandlers["edge"].call(this.parentNode, 
                    this.parentNode.edge);
        },
        
        "height": function(value, isLast) {
            //@todo this should check the largest and only allow that one
            //if (!this.parentNode.$vbox && this.parentNode.align == "stretch")
                //return;

            //@todo change fixedChild flexChild1 and flexChild2 based on this

            this.$ext.style.height = !apf.isNot(value) 
                ? (parseFloat(value) == value 
                    ? (value - apf.getHeightDiff(this.$ext)) + "px"
                    : value)
                : "";
            
            //This can be optimized
            if (this.$amlLoaded && isLast !== false)
                this.parentNode.$propHandlers["edge"].call(this.parentNode, 
                    this.parentNode.edge);
        },
        
        "margin": function(value, isLast) {
            this.$margin = apf.getBox(value);
            
            //This can be optimized
            if (this.$amlLoaded && isLast !== false)
                this.parentNode.$propHandlers["edge"].call(this.parentNode, this.parentNode.edge);
        }
    };
    
    this.register = function(amlNode, insert) {
        if (amlNode.$splitter || amlNode.nodeFunc != apf.NODE_VISIBLE)
            return;

        amlNode.$margin = [0, 0, 0, 0];
        
        amlNode.$propHandlers["left"] = 
        amlNode.$propHandlers["top"] = 
        amlNode.$propHandlers["right"] = 
        amlNode.$propHandlers["bottom"] = apf.K;

        for (var prop in handlers) {
            amlNode.$propHandlers[prop] = handlers[prop];
        }

        var fNode = this.getFirstChild();
        var sNode = fNode && this.getSecondChild();
        var prop = this.$vbox ? "height" : "width";
        
        this.flexChild1 = this.flexChild2 = this.fixedChild = null;
        
        if (!fNode[prop] || ~String(fNode[prop]).indexOf("%"))
            this.flexChild1 = fNode;
        else
            this.fixedChild = fNode;
            
        if (sNode) {
            if (!sNode[prop] || ~String(sNode[prop]).indexOf("%"))
                this[this.flexChild1 ? "flexChild2" : "flexChild1"] = sNode;
            else
                this.fixedChild = sNode;
        }
            
        // if (this.flexChild1 && this.flexChild1 == amlNode){ }
        // else if (this.$vbox) {
        //     if (!amlNode.height || String(amlNode.height).indexOf("%") > -1)
        //         this[!this.flexChild1 ? "flexChild1" : "flexChild2"] = amlNode;
        //     else
        //         this.fixedChild = amlNode;
        // }
        // else {
        //     if (!amlNode.width || String(amlNode.width).indexOf("%") > -1)
        //         this[!this.flexChild1 ? "flexChild1" : "flexChild2"] = amlNode;
        //     else
        //         this.fixedChild = amlNode;
        // }

        amlNode.addEventListener("prop.visible", visibleHandler);
        amlNode.$ext.style.position = "absolute";
        amlNode.$ext.style.margin = "";

        if (amlNode.height)
            handlers.height.call(amlNode, amlNode.height, false);
        if (amlNode.width)
            handlers.width.call(amlNode, amlNode.width, false);
        if (amlNode.margin)
            handlers.margin.call(amlNode, amlNode.margin, false);
            
        var isLast = this.lastChild.$amlLoaded || this.lastChild == amlNode;
        if (isLast) {
            this.$propHandlers["padding"].call(this, this.padding);
            this.$propHandlers["edge"].call(this, this.edge, 
                !amlNode[this.$vbox ? "height" : "width"]);
        }
        
        if (this.$handle && this.childNodes.length > 2)
            this.$handle.show();
    };
    
    this.unregister = function(amlNode) {
        if (amlNode.$splitter || amlNode.nodeFunc != apf.NODE_VISIBLE)
            return;
        
        delete amlNode.$margin;
        
        amlNode.$propHandlers["left"] = 
        amlNode.$propHandlers["top"] = 
        amlNode.$propHandlers["right"] = 
        amlNode.$propHandlers["bottom"] = null;
        
        for (var prop in handlers) {
            delete amlNode.$propHandlers[prop];
        }
        
        if (this.fixedChild == amlNode)
            delete this.fixedChild;
        else if (this.flexChild1 == amlNode)
            delete this.flexChild1;
        else if (this.flexChild2 == amlNode)
            delete this.flexChild2;
        
        //Clear css properties and set layout
        amlNode.removeEventListener("prop.visible", visibleHandler);
        amlNode.$ext.style.display = amlNode.visible ? "block" : "none";
        
        if (amlNode.width)
            amlNode.$ext.style.width = "";
        if (amlNode.height)
            amlNode.$ext.style.height = "";
        amlNode.$ext.style.position = 
        amlNode.$ext.style.margin = 
        amlNode.$ext.style.left = 
        amlNode.$ext.style.top = 
        amlNode.$ext.style.right = 
        amlNode.$ext.style.bottom = "";
        
        if (this.$handle)
            this.$handle.hide();
    };
    
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
            return;
        }
        
        if (e.currentTarget.nodeType != 1 
          || e.currentTarget.nodeFunc != apf.NODE_VISIBLE)
            return;
        
//        if (this.$handle) {
//            var _self = this;
//            setTimeout(function(){
//                if (_self.$handle.nextSibling != _self.lastChild)
//                    _self.insertBefore(_self.$handle, _self.lastChild);
//            });
//        }

        if (e.relatedNode == this && !e.$isMoveWithinParent) {
            e.currentTarget.$setLayout(this.localName, true);
            
            if (e.currentTarget.$altExt) {
                
                return false;
            }
        }
    });

    this.$draw = function() {
        var doc = this.$pHtmlNode.ownerDocument;
        this.$ext = this.$pHtmlNode.appendChild(doc.createElement("div"));
        if (this.getAttribute("style"))
            this.$ext.setAttribute("style", this.getAttribute("style"));
        this.$ext.className = this.localName;

        this.$vbox = this.localName == "vsplitbox";
        this.$int = this.$ext;
        this.$ext.host = this;
        
        if (this.getAttribute("class")) 
            apf.setStyleClass(this.$ext, this.getAttribute("class"));
    };
    
    this.$loadAml = function(x) {
    };
}).call(apf.vsplitbox.prototype = new apf.GuiElement());

apf.hsplitbox.prototype = apf.vsplitbox.prototype;

apf.aml.setElement("hsplitbox", apf.hsplitbox);
apf.aml.setElement("vsplitbox", apf.vsplitbox);


/**
 * @constructor
 * @private
 */
apf.splitter = function(struct, tagName) {
    this.$init(tagName || "splitter", apf.NODE_VISIBLE, struct);
};

(function() {
    this.minwidth = 0;
    this.minheight = 0;
    
    this.$scale = 0; // 0 both, 1 left/top, 2 right/bottom 
    
    this.$focussable = false; // This object can get the focus
    this.$splitter = true;
    
    this.$booleanProperties["realtime"] = true;
    
    this.$propHandlers["realtime"] = function(value) {
        this.$setStyleClass(this.$ext, value && (this.$baseCSSname + "Realtime") || "", 
            [this.$baseCSSname + "Realtime"]);
    };
    
    this.$propHandlers["scale"] = function(value) {
        this.$scale = value == "left" || value == "top"
            ? 1 : (value == "right" || "bottom " 
                ? 2 : 0);
    };
    
    this.$propHandlers["parent"] = function(value) {
        this.$parent = typeof value == "object" ? value : self[value];
    };
    
    this.$propHandlers["type"] = function(value) {
        this.$setStyleClass(this.$ext, value,
            [value == "horizontal" ? "vertical" : "horizontal"]);
        
        if (value == "vertical")
            this.$setStyleClass(this.$ext, "w-resize", ["n-resize"]);
        else
            this.$setStyleClass(this.$ext, "n-resize", ["w-resize"]);

        //Optimize this to not recalc for certain cases
        if (value == "horizontal") {
            this.$info = {
                pos: "top",
                opos: "left",
                size: "width",
                osize: "height",
                offsetPos: "offsetTop",
                offsetSize: "offsetHeight",
                oOffsetPos: "offsetLeft",
                oOffsetSize: "offsetWidth",
                clientPos: "clientY",
                d1: 1,
                d2: 0,
                x1: 0,
                x2: 2
            };
        }
        else {
            this.$info = {
                pos: "left",
                opos: "top",
                size: "height",
                osize: "width",
                offsetPos: "offsetLeft",
                offsetSize: "offsetWidth",
                oOffsetPos: "offsetTop",
                oOffsetSize: "offsetHeight",
                clientPos: "clientX",
                d1: 0,
                d2: 1,
                x1: 3,
                x2: 1
            };
        }
    };
    
    this.addEventListener("DOMNodeInserted", function(e) {
        if (e.currentTarget != this)
            return;
        
        /*if (e.$oldParent) {
            e.$oldParent.removeEventListener("DOMNodeInserted", this.$siblingChange);
            e.$oldParent.removeEventListener("DOMNodeRemoved", this.$siblingChange);
        }*/
        
        this.init && this.init();
    });
    
    /*this.$siblingChange = function(e) {
        //if (e.currentTarget
        
        //this.init();
    }*/
    
    this.$draw = function() {
        //Build Main Skin
        this.$ext = this.$getExternal();

        var template = "vbox|hbox".indexOf(this.parentNode.localName) > -1
            ? "box" : "splitbox";
            
        apf.extend(this, apf.splitter.templates[template]);
        this.decorate();
    };
        
    this.$loadAml = function(x) {
        if (this.realtime !== false)
            this.$propHandlers.realtime.call(this, this.realtime = true);
    };
}).call(apf.splitter.prototype = new apf.Presentation());

apf.splitter.templates = {
    box: {
        update: function(newPos, finalPass) {
                //var pos = Math.ceil(apf.getAbsolutePosition(this.$ext, this.parentNode.$int)[d1] - posPrev[d1]);
                var max = this.$previous 
                    ? this.$previous.$ext[this.$info.offsetSize] + this.$next.$ext[this.$info.offsetSize]
                    : (this.parentNode).getWidth();
                var method = finalPass ? "setAttribute" : "setProperty";
                if (apf.hasFlexibleBox)
                    newPos -= this.$previous ? apf.getAbsolutePosition(this.$previous.$ext, this.parentNode.$int)[this.$info.d1] : 0;
    
                //Both flex
                if (this.$previous && this.$next && (this.$previous.flex || this.$previous.flex === 0) && (this.$next.flex || this.$next.flex === 0)) {
                    if (!finalPass && !this.realtime) 
                        newPos -= this.$ext[this.$info.offsetSize];
    
                    //var totalFlex = this.$previous.flex + this.$next.flex - (finalPass && !this.realtime ? this.parentNode.padding : 0);
                    if (!this.$scale || this.$scale == 1)
                        this.$previous[method]("flex", newPos);
                    if (!this.$scale || this.$scale == 2)
                        this.$next[method]("flex", this.$totalFlex - newPos);
                }
                //Fixed
                else {
                    if (this.$next && !this.$next.flex && (!this.$scale || this.$scale == 2))
                        this.$next[method](this.$info.osize, max - newPos);
                    if (this.$previous && !this.$previous.flex && (!this.$scale || this.$scale == 1))
                        this.$previous[method](this.$info.osize, newPos);
                }
    
            if (apf.hasSingleResizeEvent)
                apf.layout.forceResize(this.$ext.parentNode);
        },
        
        $setSiblings: function() {
            this.$previous = this.previousSibling;
            while (this.$previous && (this.$previous.nodeType != 1 
              || this.$previous.visible === false 
              || this.$previous.nodeFunc != apf.NODE_VISIBLE))
                this.$previous = this.$previous.previousSibling;
            this.$next = this.nextSibling;
            while (this.$next && (this.$next.nodeType != 1 
              || this.$next.visible === false 
              || this.$next.nodeFunc != apf.NODE_VISIBLE))
                this.$next = this.$next.nextSibling;
        },
        
        init: function(size, refNode, oItem) {
            //this.parentNode.addEventListener("DOMNodeInserted", this.$siblingChange);
            //this.parentNode.addEventListener("DOMNodeRemoved", this.$siblingChange);
            
            this.$setSiblings();
            
            this.$thickness = null;
            if (this.parentNode && this.parentNode.$box) {
                this.setProperty("type", this.parentNode.localName == "vbox" 
                    ? "horizontal" 
                    : "vertical");
                this.$thickness = parseInt(this.parentNode.padding);
            }
            
            if (!this.$previous || !this.$next)
                return this;
            
                var diff = apf.getDiff(this.$ext);
                if (!this.parentNode.$box) {
                    var iSize = Math.max(
                        this.$previous.$ext[this.$info.offsetSize], this.$next.$ext[this.$info.offsetSize]);
                    this.$ext.style[size] = (iSize - diff[this.$info.d1]) + "px";
                }
    
                var iThick = this[this.$info.osize] = this.$thickness 
                    || (this.$next[this.$info.oOffsetPos] - this.$previous[this.$info.oOffsetPos] 
                        - this.$previous[this.$info.oOffsetSize]);
    
                this.$ext.style[this.$info.osize] = (iThick - diff[this.$info.d2]) + "px";
            
            return this;
        },
        
        decorate: function() {
            var _self = this;
            this.$ext.onmousedown = function(e) {
                if (!e)
                    e = event;
                
                if (_self.dispatchEvent("dragstart") === false)
                    return;
                
                apf.dragMode = true; //prevent selection
                
                _self.$setSiblings();
    
                var changedPosition, pHtml = _self.parentNode.$int, diff = 0;
                if ("absolute|fixed|relative".indexOf(apf.getStyle(pHtml, "position")) == -1) {
                    pHtml.style.position = "relative";
                    changedPosition = true;
                }
    
                _self.$totalFlex = 0;
                    if (_self.$parent) {
                        if (!_self.$previous) {
                            var posNext = apf.getAbsolutePosition(_self.$next.$ext, _self.parentNode.$int);
                            var wd = _self.$parent.getWidth();
                            
                            if (_self.$scale == 2) {
                                var max = posNext[_self.$info.d1] + _self.$next.$ext[_self.$info.offsetSize] - this[_self.$info.offsetSize];
                                diff = (_self.parentNode.$int[_self.$info.offsetSize] - max);
                                var min = max - wd - diff;
                            }
                        }
                        else if (!_self.$next) {
                            //@todo
                        }
                    }
                    else {
                        if (_self.$previous) {
                            var posPrev = apf.getAbsolutePosition(_self.$previous.$ext, _self.parentNode.$int);
                            var min = _self.$scale 
                                ? 0 
                                : (posPrev[_self.$info.d1] || 0) + (parseInt(_self.$previous.minwidth) || 0);
                        }
                        if (_self.$next) {
                            var posNext = apf.getAbsolutePosition(_self.$next.$ext, _self.parentNode.$int);
                            var max = posNext[_self.$info.d1] + _self.$next.$ext[_self.$info.offsetSize] 
                                - this[_self.$info.offsetSize] - (parseInt(_self.$next.minwidth) || 0);
                        }
                    }
                    
                    //Set flex to pixel sizes
                    if (_self.$previous && _self.$next) {
                        if ((_self.$previous.flex || _self.$previous.flex === 0) 
                          && (_self.$next.flex || _self.$next.flex === 0)) {
                            var set = [], nodes = _self.parentNode.childNodes, padding = 0;
                            for (var node, i = 0, l = nodes.length; i < l; i++) {
                                if ((node = nodes[i]).visible === false 
                                  || node.nodeFunc != apf.NODE_VISIBLE || node.$splitter)
                                    continue;
                                
                                if (node.flex)
                                    set.push(node, node.$ext[_self.$info.offsetSize] 
                                        + (apf.hasFlexibleBox && !_self.realtime && node == _self.$previous 
                                            ? 2 * _self.parentNode.padding : 0));
                            }
                            for (var i = 0, l = set.length; i < l; i += 2) {
                                set[i].setAttribute("flex", set[i + 1]);
                            }
                        }
                        
                        _self.$totalFlex += _self.$next.flex + _self.$previous.flex;
                    }
                    
                    var startPos, startOffset;
                    if (apf.hasFlexibleBox) {
                        var coords = apf.getAbsolutePosition(this);
                        startPos = e[_self.$info.clientPos] - coords[_self.$info.d1];
    
                        if (!_self.realtime) {
                            if (_self.$previous.flex && !_self.$next.flex) {
                                var mBox = apf.getBox(_self.$next.margin);
                                mBox[_self.$info.x1] = _self.parentNode.padding;
                                _self.$next.$ext.style.margin = mBox.join("px ") + "px";
                            }
                            else {
                                var mBox = apf.getBox(_self.$previous.margin);
                                mBox[_self.$info.x2] = _self.parentNode.padding;
                                _self.$previous.$ext.style.margin = mBox.join("px ") + "px";
                            }
                            
                            var diff = apf.getDiff(this);
                            this.style.left = coords[0] + "px";
                            this.style.top = coords[1] + "px"; //(apf.getHtmlTop(this) - Math.ceil(this.offsetHeight/2))
                            this.style.width = (this.offsetWidth - diff[0]) + "px";
                            this.style.height = (this.offsetHeight - diff[1]) + "px";
                            this.style.position = "absolute";
                        }
                    }
                    else {
                        var coords = apf.getAbsolutePosition(this.offsetParent);
                        startOffset = apf.getAbsolutePosition(_self.$previous.$ext)[_self.$info.d1];
                        startPos = e[_self.$info.clientPos] - coords[_self.$info.d1];
                        
                        if (!_self.realtime) {
                            this.style.left = "0px";
                            this.style.top = "0px";
                            this.style.position = "relative";
                        }
                        min = -1000; //@todo
                    }
                
                
                apf.plane.setCursor(_self.type == "vertical" ? "ew-resize" : "ns-resize");
                
    
                _self.$setStyleClass(this, _self.$baseCSSname + "Moving");
                
                //@todo convert to proper way
                document.onmouseup = function(e) {
                    if (!e) e = event;
                    
                        var newPos;
                        if (e[_self.$info.clientPos] >= 0) {
                            var coords = apf.getAbsolutePosition(_self.$ext.offsetParent);
                            newPos = (Math.min(max, Math.max(min, (e[_self.$info.clientPos] - coords[_self.$info.d1]) - 
                                (apf.hasFlexibleBox ? startPos : startOffset)))) + diff;
                        }
    
                    _self.$setStyleClass(_self.$ext, "", [_self.$baseCSSname + "Moving"]);

                    if (changedPosition)
                        pHtml.style.position = "";
                    
                    if (apf.hasFlexibleBox && !_self.realtime)
                        (_self.$previous.flex && !_self.$next.flex
                          ? _self.$next : _self.$previous).$ext.style.margin 
                            = apf.getBox(_self.$previous.margin).join("px ") + "px";
                    
                    if (newPos)
                        _self.update(newPos, true);
                    
                    
                    apf.plane.unsetCursor();
                    
                    if (!_self.realtime) {
                        _self.$ext.style.left = "";
                        _self.$ext.style.top = "";
                        _self.$ext.style[_self.$info.size] = "";
                        _self.$ext.style.position = "";
                    }
                    
                    _self.dispatchEvent("dragdrop");
                    
                    document.onmouseup = 
                    document.onmousemove = null;
                    
                    apf.dragMode = false; //return to default selection policy
                };
                
                //@todo convert to proper way
                document.onmousemove = function(e) {
                    if (!e) e = event;
                        var newPos;
                        if (e[_self.$info.clientPos] >= 0) {
                            var coords = apf.getAbsolutePosition(_self.$ext.offsetParent);
                            newPos = (Math.min(max, Math.max(min, (e[_self.$info.clientPos] - coords[_self.$info.d1]) - 
                                (apf.hasFlexibleBox || !_self.realtime ? startPos : startOffset)))) + diff;
    
                            if (_self.realtime)
                                _self.update(newPos);
                            else {
                                _self.$ext.style[_self.$info.pos] = newPos + "px";
                            }
                        }
                    
                    apf.stopEvent(e);
                    //e.returnValue = false;
                    //e.cancelBubble = true;
                    
                    _self.dispatchEvent("dragmove");
                };
            };
            
            apf.queue.add("splitter" + this.$uniqueId, function() {
                _self.init();
            });
        }
    },
    
    splitbox: {
        update: function(newPos, finalPass) {
            this[this.parentNode.$vbox ? "updateV" : "updateH"](newPos, finalPass);
        },
        
        updateV: function(newPos, finalPass) {
            var method = finalPass ? "setAttribute" : "setProperty";
            
            var pNode = this.$parent || this.parentNode;
            var firstChild = pNode.firstChild;
            if (firstChild.localName == "splitter")
                firstChild = firstChild.nextSibling;
            if (pNode.fixedChild) {
                if (pNode.fixedChild == pNode.firstChild) {
                    pNode.fixedChild[method]("height", newPos - pNode.$edge[0]);
                }
                else {
                    pNode.fixedChild[method]("height", 
                        apf.getHtmlInnerHeight(pNode.$int) - newPos 
                        - pNode.padding - pNode.$edge[1]);
                }
            }
            else if (firstChild.height) {
                var total = apf.getHtmlInnerHeight(pNode.$int);
                firstChild[method]("height", 
                    ((newPos - pNode.$edge[0]) / total * 100) + "%");
            }
            else {
                var total = apf.getHtmlInnerHeight(pNode.$int) ;
                pNode.lastChild[method]("height", 
                    ((total - newPos - pNode.$edge[2] - pNode.padding) / total * 100) + "%");
            }
    
            apf.dispatchEvent("splitter.resize", { splitter: this, final: finalPass });
        },
        
        updateH: function(newPos, finalPass) {
            var method = finalPass ? "setAttribute" : "setProperty";

            var pNode = this.$parent || this.parentNode;
            var firstChild = pNode.firstChild;
            if (firstChild.localName == "splitter")
                firstChild = firstChild.nextSibling;
            if (pNode.fixedChild) {
                if (pNode.fixedChild == pNode.firstChild) {
                    pNode.fixedChild[method]("width", newPos - pNode.$edge[3]);
                }
                else {
                    pNode.fixedChild[method]("width", 
                        apf.getHtmlInnerWidth(pNode.$int) - newPos 
                        - pNode.padding - pNode.$edge[2]);
                }
            }
            else if (firstChild.width) {
                var total = apf.getHtmlInnerWidth(pNode.$int);
                firstChild[method]("width", 
                    ((newPos - pNode.$edge[3]) / total * 100) + "%");
            }
            else {
                var total = apf.getHtmlInnerWidth(pNode.$int) ;
                pNode.lastChild[method]("width", 
                    ((total - newPos - pNode.$edge[1] - pNode.padding) / total * 100) + "%");
            }
    
            apf.dispatchEvent("splitter.resize", { splitter: this, final: finalPass });
        },
        
        $setSiblings: function() {
            this.$previous = this.parentNode.firstChild;
            this.$next = this.parentNode.lastChild;
        },
        
        decorate: function() {
            var _self = this;
            
            if (this.parentNode && this.parentNode.$box) {
                this.setProperty("type", this.parentNode.$vbox
                    ? "horizontal" 
                    : "vertical");
            }
            
            this.$ext.onmousedown = function(e) {
                if (!e)
                    e = event;

                if (_self.dispatchEvent("dragstart") === false)
                    return;

                apf.dragMode = true; //prevent selection
                
                _self.$setSiblings();

                var pNode = _self.$parent || _self.parentNode;
                var firstChild = pNode.firstChild.$splitter ? pNode.childNodes[1] : pNode.firstChild;
                if (pNode.$vbox) {
                    var min = parseInt(firstChild.minheight) + pNode.$edge[0];
                    var max = apf.getHtmlInnerHeight(pNode.$ext) - pNode.lastChild.minheight 
                        - pNode.$edge[2] - pNode.padding;
                    var offset = _self.$ext.getBoundingClientRect().top - e.clientY;
                }
                else {
                    var min = parseInt(firstChild.minwidth) + pNode.$edge[3];
                    var max = apf.getHtmlInnerWidth(pNode.$ext) - pNode.lastChild.minwidth 
                        - pNode.$edge[1] - pNode.padding;
                    var offset = _self.$ext.getBoundingClientRect().left - e.clientX;
                }
                
                function update(e, final) {
                    if (!_self.$ext.offsetParent)
                        return;
                    
                    var newPos, coords;
                    if (pNode.$vbox) {
                        if (e.clientY >= 0) {
                            coords = apf.getAbsolutePosition(_self.$parent ? _self.$parent.$ext : _self.$ext.offsetParent);
                            newPos = Math.min(max, Math.max(min, (e.clientY - coords[1] - offset)));
                        }
                    }
                    else {
                        if (e.clientX >= 0) {
                            coords = apf.getAbsolutePosition(_self.$parent ? _self.$parent.$ext : _self.$ext.offsetParent);
                            newPos = Math.min(max, Math.max(min, (e.clientX - coords[0] - offset)));
                        }
                    }
                    
                    if (!newPos) return;
                    
                    if (_self.realtime || final)
                        _self.update(newPos, final);
                    else {
                        _self.$ext.style[pNode.$vbox ? "top" : "left"] = newPos + "px";
                    }
                }
    
                apf.plane.setCursor(_self.type == "vertical" ? "ew-resize" : "ns-resize");
                _self.$ext.classList.add("hover");
    
                _self.$setStyleClass(this, _self.$baseCSSname + "Moving");
                
                //@todo convert to proper way
                document.onmouseup = function(e) {
                    if (!e) e = event;
                    
                    _self.$setStyleClass(_self.$ext, "", [_self.$baseCSSname + "Moving"]);
                    _self.$ext.classList.remove("hover");
                    
                    update(e, true);
                    
                    
                    apf.plane.unsetCursor();
                    
                    if (!_self.realtime) {
                        _self.$ext.style.left = "";
                        _self.$ext.style.top = "";
                        _self.$ext.style[_self.$info.size] = "";
                        _self.$ext.style.position = "";
                    }
                    
                    _self.dispatchEvent("dragdrop");
                    
                    document.onmouseup = 
                    document.onmousemove = null;
                    
                    apf.dragMode = false; //return to default selection policy
                };
                
                //@todo convert to proper way
                document.onmousemove = function(e) {
                    if (!e) e = event;
            
                    update(e);
                    
                    apf.stopEvent(e);
                    
                    _self.dispatchEvent("dragmove");
                };
            };
        }
    }
};

apf.aml.setElement("splitter", apf.splitter);



};
});