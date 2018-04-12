define(function(require, exports, module) {
"use strict";

var oop = require("ace/lib/oop");
var dom = require("ace/lib/dom");
var config = require("./config");

var CellLayer = require("./layer/cells").Cells;
var MarkerLayer = require("./layer/markers").Selection;
var HeaderLayer = require("./layer/heading").ColumnHeader;

var ScrollBarH = require("ace/scrollbar").ScrollBarH;
var ScrollBarV = require("ace/scrollbar").ScrollBarV;
var RenderLoop = require("ace/renderloop").RenderLoop;
var EventEmitter = require("ace/lib/event_emitter").EventEmitter;
var pivotCss = require("ace/requirejs/text!./css/tree.css");

dom.importCssString(pivotCss, "ace_tree");

var defaultTheme = require("./css/light_theme");
/**
 * The class that is responsible for drawing everything you see on the screen!
 * @class VirtualRenderer
 **/

/**
 * Constructs a new `VirtualRenderer` within the `container` specified, applying the given `theme`.
 * @param {DOMElement} container The root element of the editor
 * @param {Number} cellWidth The default width of a cell in pixels 
 * @param {Number} cellHeight The default height of a cell in pixels 
 *
 * @constructor
 **/

var VirtualRenderer = function(container, cellWidth, cellHeight) {
    var _self = this;

    this.container = container || dom.createElement("div");

    dom.addCssClass(this.container, "ace_tree");
    dom.addCssClass(this.container, "ace_tree");
    
    this.setTheme(this.$theme);
    this.scroller = dom.createElement("div");
    this.scroller.className = "ace_tree_scroller";
    this.container.appendChild(this.scroller);
    
    this.cells = dom.createElement("div");
    this.cells.className = "ace_tree_cells";
    this.scroller.appendChild(this.cells);
    
    this.$headingLayer = new HeaderLayer(this.container, this);
    this.$markerLayer = new MarkerLayer(this.cells, this);
    
    this.$cellLayer = new CellLayer(this.cells);
    this.canvas = this.$cellLayer.element;

    // Indicates whether the horizontal scrollbarscrollbar is visible
    this.$horizScroll = false;

    this.scrollBarV = new ScrollBarV(this.container, this);
    this.scrollBarV.setVisible(true);
    this.scrollBarV.addEventListener("scroll", function(e) {
        if (!_self.$inScrollAnimation)
            _self.setScrollTop(e.data - _self.scrollMargin.top);
    });

    this.scrollBarH = new ScrollBarH(this.container, this);
    this.scrollBarH.addEventListener("scroll", function(e) {
        if (!_self.$inScrollAnimation)
            _self.setScrollLeft(e.data);
    });
    
    this.scrollTop = 0;
    this.scrollLeft = 0;

    this.caretPos = {
        row : 0,
        column : 0
    };

    this.$size = {
        width: 0,
        height: 0,
        scrollerHeight: 0,
        scrollerWidth: 0,
        headingHeight: 0
    };

    this.layerConfig = {
        width : 1,
        padding : 0,
        firstRow : 0,
        firstRowScreen: 0,
        lastRow : 0,
        lineHeight : 1,
        characterWidth : 1,
        minHeight : 1,
        maxHeight : 1,
        offset : 0,
        height : 1
    };
    
    this.scrollMargin = {
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        v: 0,
        h: 0
    };
    
    this.$scrollIntoView = null;

    this.$loop = new RenderLoop(
        this.$renderChanges.bind(this),
        this.container.ownerDocument.defaultView
    );
    this.$loop.schedule(this.CHANGE_FULL);
    this.setTheme(defaultTheme);
    
    this.$windowFocus = this.$windowFocus.bind(this);
    window.addEventListener("focus", this.$windowFocus);
};

(function() {
    this.CHANGE_SCROLL    = 1;
    this.CHANGE_COLUMN    = 2;
    this.CHANGE_ROW       = 4;
    this.CHANGE_CELLS     = 8;
    this.CHANGE_SIZE      = 16;
    this.CHANGE_CLASS     = 32;
    this.CHANGE_MARKER    = 64;
    this.CHANGE_FULL      = 128;

    this.CHANGE_H_SCROLL = 1024;

    oop.implement(this, EventEmitter);

    /**
     *
     * Associates the renderer with an DataProvider.
     **/
    this.setDataProvider = function(provider) {
        this.provider = provider;
        this.model = provider;
        
        if (this.scrollMargin.top && provider && provider.getScrollTop() <= 0)
            provider.setScrollTop(-this.scrollMargin.top);

        this.scroller.className = "ace_tree_scroller";

        this.$cellLayer.setDataProvider(provider);
        this.$markerLayer.setDataProvider(provider);
        this.$headingLayer.setDataProvider(provider);
        
        this.$size.headingHeight = provider && provider.columns
            ? provider.headerHeight || provider.rowHeight
            : 0;
        
        this.$loop.schedule(this.CHANGE_FULL);
    };

    /**
     * Triggers a partial update of the text, from the range given by the two parameters.
     * @param {Number} firstRow The first row to update
     * @param {Number} lastRow The last row to update
     *
     *
     **/
    this.updateRows = function(firstRow, lastRow) {
        if (lastRow === undefined)
            lastRow = Infinity;

        if (!this.$changedLines) {
            this.$changedLines = {
                firstRow: firstRow,
                lastRow: lastRow
            };
        }
        else {
            if (this.$changedLines.firstRow > firstRow)
                this.$changedLines.firstRow = firstRow;

            if (this.$changedLines.lastRow < lastRow)
                this.$changedLines.lastRow = lastRow;
        }

        if (this.$changedLines.firstRow > this.layerConfig.lastRow ||
            this.$changedLines.lastRow < this.layerConfig.firstRow)
            return;
        this.$loop.schedule(this.CHANGE_ROW);
    };
    
    this.updateCaret = function() {
        this.$loop.schedule(this.CHANGE_CLASS);
    };

    /**
     * Triggers a full update of the text, for all the rows.
     **/
    this.updateCells = function() {
        this.$loop.schedule(this.CHANGE_CELLS);
    };

    /**
     * Triggers a full update of all the layers, for all the rows.
     * @param {Boolean} force If `true`, forces the changes through
     *
     *
     **/
    this.updateFull = function(force) {
        if (force)
            this.$renderChanges(this.CHANGE_FULL, true);
        else
            this.$loop.schedule(this.CHANGE_FULL);
    };
    
    this.updateHorizontalHeadings = function(){
        this.$loop.schedule(this.CHANGE_COLUMN);
    };
    
    this.updateVerticalHeadings = function(){
        this.$loop.schedule(this.CHANGE_ROW);
    };


    this.$changes = 0;
    /**
    * [Triggers a resize of the editor.]{: #VirtualRenderer.onResize}
    * @param {Boolean} force If `true`, recomputes the size, even if the height and width haven't changed
    * @param {Number} width The width of the editor in pixels
    * @param {Number} height The hiehgt of the editor, in pixels
    *
    *
    **/
    this.onResize = function(force, width, height) {
        if (this.resizing > 2)
            return;
        else if (this.resizing > 0)
            this.resizing++;
        else
            this.resizing = force ? 1 : 0;
        // `|| el.scrollHeight` is required for outosizing editors on ie
        // where elements with clientHeight = 0 alsoe have clientWidth = 0
        var el = this.container;
        if (!height)
            height = el.clientHeight || el.scrollHeight;
        if (!width)
            width = el.clientWidth || el.scrollWidth;
        var changes = this.$updateCachedSize(force, width, height);

        if (!this.$size.scrollerHeight || (!width && !height))
            return this.resizing = 0;

        if (force)
            this.$renderChanges(changes, true);
        else
            this.$loop.schedule(changes | this.$changes);

        if (this.resizing)
            this.resizing = 0;
    };
    
    this.$windowFocus = function(){
        this.onResize();
    };
    
    this.$updateCachedSize = function(force, width, height) {
        var changes = 0;
        var size = this.$size;
        var provider = this.provider;
        if (provider) {
            var headingHeight = provider.columns
                ? provider.headerHeight || provider.rowHeight
                : 0;
            if (headingHeight != size.headingHeight) {
                size.headingHeight = headingHeight;
                changes |= this.CHANGE_SIZE;
            }
        }
        
        if (height && (force || size.height != height)) {
            size.height = height;
            changes |= this.CHANGE_SIZE;

            size.scrollerHeight = size.height;
            if (this.$horizScroll)
                size.scrollerHeight -= this.scrollBarH.getHeight();
            
            //if (this.heading) {
                size.scrollerHeight -= size.headingHeight;
            // }
            
            this.$headingLayer.element.style.height = 
            this.scroller.style.top = 
            this.scrollBarV.element.style.top = size.headingHeight + "px";
            // this.scrollBarV.setHeight(size.scrollerHeight);
            this.scrollBarV.element.style.bottom = this.scrollBarH.getHeight() + "px";

            if (provider && provider.setScrollTop) {
                // provider.setScrollTop(this.getScrollTop());
                changes |= this.CHANGE_SCROLL;
            }
            
            if (this.$scrollIntoView)
            if (this.$scrollIntoView.model == this.model) {
                this.scrollCaretIntoView(this.$scrollIntoView.caret, this.$scrollIntoView.offset);
                this.$scrollIntoView = null;
            }
        }

        if (width && (force || size.width != width)) {
            changes |= this.CHANGE_SIZE;
            size.width = width;
            
            this.scrollBarH.element.style.left = 
            this.scroller.style.left = 0 + "px";
            size.scrollerWidth = Math.max(0, width  - this.scrollBarV.getWidth());           
            
            this.$headingLayer.element.style.right = 
            this.scrollBarH.element.style.right = 
            this.scroller.style.right = this.scrollBarV.getWidth() + "px";
            this.scroller.style.bottom = this.scrollBarH.getHeight() + "px";
                
            // this.scrollBarH.element.style.setWidth(size.scrollerWidth);
            
            this.$headingLayer.updateWidth(size.scrollerWidth);

            if (provider && provider.columns)
                changes |= this.CHANGE_FULL;
        }
        
        if (changes)
            this._signal("resize");

        return changes;
    };

    this.setVerHeadingVisible = function(value){
        this.$treeLayer.visible = value;
        if (this.layerConfig.vRange && this.layerConfig.hRange) {
            this.$renderChanges(this.CHANGE_FULL, true);
            this.onResize(true);
        }
    };

    /**
     *
     * Returns the root element containing this renderer.
     * @returns {DOMElement}
     **/
    this.getContainerElement = function() {
        return this.container;
    };

    /**
     *
     * Returns the element that the mouse events are attached to
     * @returns {DOMElement}
     **/
    this.getMouseEventTarget = function() {
        return this.scroller;
    };
    /**
     * [Returns array of nodes currently visible on the screen]{: #VirtualRenderer.getVisibleNodes}
     * @param {Object} node Tree node
     * @param {Number} tolerance fraction of the node allowed to be hidden while node still considered visible (default 1/3)
     * @returns {Array}
     **/
    this.getVisibleNodes = function(tolerance) {
        var nodes = this.layerConfig.vRange;
        var first = 0;
        var last = nodes.length - 1;
        while (this.isNodeVisible(nodes[first], tolerance) && first < last)
            first++;
        while (!this.isNodeVisible(nodes[last], tolerance) && last > first)
            last--;
        return nodes.slice(first, last + 1);
    };
    /**
     * [Indicates if the node is currently visible on the screen]{: #VirtualRenderer.isNodeVisible}
     * @param {Object} node Tree node
     * @param {Number} tolerance fraction of the node allowed to be hidden while node still considered visible (default 1/3)
     * @returns {Boolean}
     **/
    this.isNodeVisible = function(node, tolerance) {
       var layerConfig = this.layerConfig;
       if (!layerConfig.vRange) return;
       var provider = this.provider;
       var i = layerConfig.vRange.indexOf(node);
    
       if (i == -1) return false;
       var nodePos = provider.getNodePosition(node);
    
       var top = nodePos.top;
       var height = nodePos.height;
       if (tolerance === undefined)
           tolerance = 1 / 3;
       if (this.scrollTop > top + tolerance * height)
           return false;
       if (this.scrollTop + this.$size.scrollerHeight <= top +  (1 - tolerance) * height)
           return false;
       return true;
    };
    
    this.$updateScrollBar = function() {
        // todo separate event for h v scroll
        this.$updateScrollBarH();
        this.$updateScrollBarV();
    };
    
    this.setScrollMargin = function(top, bottom, left, right) {
        var sm = this.scrollMargin;
        sm.top = top|0;
        sm.bottom = bottom|0;
        sm.right = right|0;
        sm.left = left|0;
        sm.v = sm.top + sm.bottom;
        sm.h = sm.left + sm.right;
        if (sm.top && this.scrollTop <= 0 && this.provider)
            this.provider.setScrollTop(-sm.top);
        this.updateFull();
    };
    this.$updateScrollBarV = function() {
        this.scrollBarV.setInnerHeight(this.layerConfig.maxHeight + this.scrollMargin.v);
        this.scrollBarV.setScrollTop(this.scrollTop + this.scrollMargin.top);
    };
    this.$updateScrollBarH = function() {
        this.scrollBarH.setInnerWidth(this.layerConfig.maxWidth + this.scrollMargin.h);
        this.scrollBarH.setScrollLeft(this.scrollLeft + this.scrollMargin.left);
    };
    
    this.$frozen = false;
    this.freeze = function() {
        this.$frozen = true;
    };
    
    this.unfreeze = function() {
        this.$frozen = false;
    };

    this.$renderChanges = function(changes, force) {
        if (this.$changes) {
            changes |= this.$changes;
            this.$changes = 0;
        }
        if ((!this.provider || !this.container.offsetWidth || this.$frozen) || (!changes && !force)) {
            this.$changes |= changes;
            return; 
        } 
        if (!this.$size.width) {
            this.$changes |= changes;
            return this.onResize(true);
        }
            
        // this.$logChanges(changes);
        
        this._signal("beforeRender");
        var config = this.layerConfig;
        // text, scrolling and resize changes can cause the view port size to change
        if (changes & this.CHANGE_FULL ||
            changes & this.CHANGE_SIZE ||
            changes & this.CHANGE_SCROLL ||
            changes & this.CHANGE_H_SCROLL ||
            changes & this.CHANGE_COLUMN ||
            changes & this.CHANGE_ROW ||
            changes & this.CHANGE_CELLS
        ) {
            changes |=this.$computeLayerConfig();
            
            config = this.layerConfig;
            // update scrollbar first to not lose scroll position when gutter calls resize
            this.$updateScrollBar();
            this.cells.style.marginTop  = -config.vOffset + "px";
            this.cells.style.marginLeft = -config.hOffset + "px";
            this.cells.style.width = config.width + "px";
            this.cells.style.height = config.height + config.rowHeight + "px";
        }
        // full
        if (changes & this.CHANGE_FULL) {
            this.$headingLayer.update(this.layerConfig);
            this.$cellLayer.update(this.layerConfig);
            this.$markerLayer.update(this.layerConfig);
            this._signal("afterRender");
            return;
        }

        // scrolling
        if (changes & this.CHANGE_SCROLL) {
            if (changes & this.CHANGE_ROW || 
                changes & this.CHANGE_COLUMN ||
                changes & this.CHANGE_CELLS
            ) {
                this.$headingLayer.update(this.layerConfig);
                this.$cellLayer.update(this.layerConfig);
            }
            else {
                this.$headingLayer.update(this.layerConfig);
                this.$cellLayer.scroll(this.layerConfig);
            }

            this.$markerLayer.update(this.layerConfig);
            this.$updateScrollBar();
            this._signal("afterRender");
            return;
        }
        
        if (changes & this.CHANGE_CLASS)
            this.$cellLayer.updateClasses(this.layerConfig);
        
        if (changes & this.CHANGE_MARKER || changes & this.CHANGE_CELLS)
            this.$markerLayer.update(this.layerConfig);

        // if (changes & this.CHANGE_ROW)
        //     this.$treeLayer.update(this.layerConfig);
        //     this.$updateRows();
        //@todo analog to updateRows?
        if (changes & this.CHANGE_COLUMN)
            this.$horHeadingLayer.update(this.layerConfig);
        if (changes & this.CHANGE_CELLS)
            this.$cellLayer.update(this.layerConfig);

        if (changes & this.CHANGE_SIZE)
            this.$updateScrollBar();

        this._signal("afterRender");
        
        if (this.$scrollIntoView)
            this.$scrollIntoView = null;
    };

    
    this.$autosize = function() {
        var headingHeight = this.$size.headingHeight;
        var height = this.provider.getTotalHeight() + headingHeight;
        var maxHeight = this.getMaxHeight
            ? this.getMaxHeight()
            : this.$maxLines * this.provider.rowHeight + headingHeight;
        var desiredHeight = Math.max(
            (this.$minLines || 1) * this.provider.rowHeight + headingHeight,
            Math.min(maxHeight, height)
        ) + this.scrollMargin.v;
        var vScroll = height > maxHeight;
        
        if (desiredHeight != this.desiredHeight ||
            this.$size.height != this.desiredHeight || vScroll != this.$vScroll) {
            if (vScroll != this.$vScroll) {
                this.$vScroll = vScroll;
                this.scrollBarV.setVisible(vScroll);
            }
            
            var w = this.container.clientWidth;
            this.container.style.height = desiredHeight + "px";
            this.$updateCachedSize(true, w, desiredHeight);
            // this.$loop.changes = 0;
            this.desiredHeight = desiredHeight;
            this._signal("autoresize");
        }
    };
    
    this.$computeLayerConfig = function() {
        if (this.$maxLines)
            this.$autosize();

        var provider   = this.provider;
        var vertical   = this.$treeLayer;
        var horizontal = this.$horHeadingLayer;
        
        var minHeight = this.$size.scrollerHeight;
        var maxHeight = provider.getTotalHeight();
        
        var minWidth  = this.$size.scrollerWidth;
        var maxWidth  = 0 //horizontal.size;

        var hideScrollbars = this.$size.height <= 2 * 10;
        var horizScroll = !hideScrollbars && (this.$hScrollBarAlwaysVisible ||
            this.$size.scrollerWidth - maxWidth < 0);

        var hScrollChanged = this.$horizScroll !== horizScroll;
        if (hScrollChanged) {
            this.$horizScroll = horizScroll;
            this.scrollBarH.setVisible(horizScroll);
        }
        
        var vScroll = !hideScrollbars && (this.$vScrollBarAlwaysVisible ||
            this.$size.scrollerHeight - maxHeight < 0);
        var vScrollChanged = this.$vScroll !== vScroll;
        if (vScrollChanged) {
            this.$vScroll = vScroll;
            this.scrollBarV.setVisible(vScroll);
        }
        
        this.provider.setScrollTop(Math.max(-this.scrollMargin.top,
            Math.min(this.scrollTop, maxHeight - this.$size.scrollerHeight + this.scrollMargin.bottom)));

        this.provider.setScrollLeft(Math.max(-this.scrollMargin.left, Math.min(this.scrollLeft, 
            maxWidth - this.$size.scrollerWidth + this.scrollMargin.right)));

        
        if (this.provider.getScrollTop() != this.scrollTop)
            this.scrollTop = this.provider.getScrollTop();
            
        var top = Math.max(this.scrollTop, 0);
        var vRange = provider.getRange(top, top + this.$size.height);
        var hRange = { size: 0 };// horizontal.getRange(this.scrollLeft, this.scrollLeft + this.$size.width);

        
        var vOffset  = this.scrollTop - vRange.size;
        var hOffset  = this.scrollLeft - hRange.size;
        
        var rowCount = vRange.length;
        var firstRow = vRange.count;
        var lastRow  = firstRow + rowCount - 1;
        
        var colCount = hRange.length;
        var firstCol = hRange.count;
        var lastCol  = firstCol + colCount - 1;

        if (this.layerConfig)
            this.layerConfig.discard = true;
        
        var changes = 0;
        // Horizontal scrollbar visibility may have changed, which changes
        // the client height of the scroller
        if (hScrollChanged || vScrollChanged) {
            changes = this.$updateCachedSize(true, this.$size.width, this.$size.height);
            this._signal("scrollbarVisibilityChanged");
            //if (vScrollChanged)
            //    longestLine = this.$getLongestLine();
        }
        
        this.layerConfig = {
            vRange : vRange,
            hRange : hRange,
            width : minWidth,
            height : minHeight,
            firstRow : firstRow,
            lastRow : lastRow,
            firstCol : firstCol,
            lastCol : lastCol,
            minHeight : minHeight,
            maxHeight : maxHeight,
            minWidth : minWidth,
            maxWidth : maxWidth,
            vOffset : vOffset,
            hOffset : hOffset,
            rowHeight: provider.rowHeight
        };
        
        var config = this.layerConfig, renderer = this;
        if (vRange) {
            config.view = provider.getDataRange(
                {start: vRange.count, length: vRange.length}, 
                {start: hRange.count, length: hRange.length}, 
                function(err, view, update){
                    if (err) return false; //@todo
                    config.view = view;
                    
                    if (update)
                        renderer.$loop.schedule(renderer.CHANGE_CELLS);
                });
        }

        // For debugging.
        // console.log(JSON.stringify(this.layerConfig));

        return changes;
    };
    
    this.$updateRows = function() {
        var firstRow = this.$changedLines.firstRow;
        var lastRow = this.$changedLines.lastRow;
        this.$changedLines = null;

        var layerConfig = this.layerConfig;

        if (firstRow > layerConfig.lastRow + 1) { return; }
        if (lastRow < layerConfig.firstRow) { return; }

        // if the last row is unknown -> redraw everything
        if (lastRow === Infinity) {
            this.$cellLayer.update(layerConfig);
            return;
        }

        // else update only the changed rows
        this.$cellLayer.updateRows(layerConfig, firstRow, lastRow);
        return true;
    };

    this.scrollSelectionIntoView = function(anchor, lead, offset) {
        // first scroll anchor into view then scroll lead into view
        this.scrollCaretIntoView(anchor, offset);
        this.scrollCaretIntoView(lead, offset);
    };

    /**
     *
     * Scrolls the Caret into the first visible area of the editor
     **/
    this.scrollCaretIntoView = function(caret, offset) {
        this.$scrollIntoView = {
            caret: caret,
            offset: offset,
            scrollTop: this.scrollTop,
            model: this.model,
            height: this.$size.scrollerHeight
        };
        
        // the editor is not visible
        if (this.$size.scrollerHeight === 0)
            return;
        
        var provider = this.provider;
        var node = caret || provider.selection.getCursor();
        if (!node)
            return;
        
        var nodePos = provider.getNodePosition(node);

        var top = nodePos.top;
        var height = nodePos.height;
        var left = 0;
        var width = 0;
        
        if (this.scrollTop > top) {
            if (offset)
                top -= offset * this.$size.scrollerHeight;
            if (top === 0)
                top = -this.scrollMargin.top;
            this.provider.setScrollTop(top);
        } else if (this.scrollTop + this.$size.scrollerHeight < top + height) {
            if (offset)
                top += offset * this.$size.scrollerHeight;
            this.provider.setScrollTop(top + height - this.$size.scrollerHeight);
        }

        var scrollLeft = this.scrollLeft;

        if (scrollLeft > left) {
            if (left < 0)
                left = 0;
            this.provider.setScrollLeft(left);
        } else if (scrollLeft + this.$size.scrollerWidth < left + width) {
            this.provider.setScrollLeft(Math.round(left + width - this.$size.scrollerWidth));
        }
        
        this.$scrollIntoView.scrollTop = this.scrollTop;
    };

    /**
     * @returns {Number}
     **/
    this.getScrollTop = function() {
        return this.scrollTop;
    };

    /**
     * @returns {Number}
     **/
    this.getScrollLeft = function() {
        return this.scrollLeft;
    };
    
    /**
     * This function sets the scroll top value. It also emits the `'changeScrollTop'` event.
     * @param {Number} scrollTop The new scroll top value
     *
     **/
    this.setScrollTop = function(scrollTop) {
        scrollTop = Math.round(scrollTop);
        if (this.scrollTop === scrollTop || isNaN(scrollTop))
            return;

        this.scrollToY(scrollTop);
    };
    
    /**
     * This function sets the scroll top value. It also emits the `'changeScrollLeft'` event.
     * @param {Number} scrollLeft The new scroll left value
     *
     **/
    this.setScrollLeft = function(scrollLeft) {
        scrollLeft = Math.round(scrollLeft);
        if (this.scrollLeft === scrollLeft || isNaN(scrollLeft))
            return;

        this.scrollToX(scrollLeft);
    };

    /**
     *
     * Returns the first visible row, regardless of whether it's fully visible or not.
     * @returns {Number}
     **/
    this.getScrollTopRow = function() {
        return this.layerConfig.firstRow;
    };

    /**
     *
     * Returns the last visible row, regardless of whether it's fully visible or not.
     * @returns {Number}
     **/
    this.getScrollBottomRow = function() {
        return this.layerConfig.lastRow;
        //return Math.max(0, Math.floor((this.scrollTop + this.$size.scrollerHeight) / this.lineHeight) - 1);
    };

    this.alignCaret = function(cursor, alignment) {
        if (typeof cursor == "number")
            cursor = {row: cursor, column: 0};

        var node = this.provider.findNodeByIndex(cursor.row);
        var pos = this.provider.findSizeAtIndex(cursor.row);
        var h = this.$size.scrollerHeight;
        var offset = pos - ((h - node.size) * (alignment || 0));

        this.setScrollTop(offset);
        return offset;
    };

    this.STEPS = 8;
    this.$calcSteps = function(fromValue, toValue){
        var i = 0;
        var l = this.STEPS;
        var steps = [];

        var func  = function(t, x_min, dx) {
            return dx * (Math.pow(t - 1, 3) + 1) + x_min;
        };

        for (i = 0; i < l; ++i)
            steps.push(func(i / this.STEPS, fromValue, toValue - fromValue));

        return steps;
    };

    /**
     * Gracefully scrolls the editor to the row indicated.
     * @param {Number} line A line number
     * @param {Boolean} center If `true`, centers the editor the to indicated line
     * @param {Boolean} animate If `true` animates scrolling
     * @param {Function} callback Function to be called after the animation has finished
     *
     *
     **/
    this.scrollToRow = function(row, center, animate, callback) {
        var node = this.provider.findNodeByIndex(row);
        var offset = this.provider.findSizeAtIndex(row);
        if (center)
            offset -= (this.$size.scrollerHeight - node.size) / 2;

        var initialScroll = this.scrollTop;
        this.setScrollTop(offset);
        if (animate !== false)
            this.animateScrolling(initialScroll, callback);
    };

    this.animateScrolling = function(fromValue, callback) {
        var toValue = this.scrollTop;
        if (!this.$animatedScroll)
            return;
        var _self = this;
        
        if (fromValue == toValue)
            return;
        
        if (this.$scrollAnimation) {
            var oldSteps = this.$scrollAnimation.steps;
            if (oldSteps.length) {
                fromValue = oldSteps[0];
                if (fromValue == toValue)
                    return;
            }
        }
        
        var steps = _self.$calcSteps(fromValue, toValue);
        this.$scrollAnimation = {from: fromValue, to: toValue, steps: steps};

        clearInterval(this.$timer);

        _self.provider.setScrollTop(steps.shift());
        // trick provider to think it's already scrolled to not loose toValue
        _self.provider.$scrollTop = toValue;
        this.$timer = setInterval(function() {
            if (steps.length) {
                _self.provider.setScrollTop(steps.shift());
                _self.provider.$scrollTop = toValue;
            } else if (toValue != null) {
                _self.provider.$scrollTop = -1;
                _self.provider.setScrollTop(toValue);
                toValue = null;
            } else {
                // do this on separate step to not get spurious scroll event from scrollbar
                _self.$timer = clearInterval(_self.$timer);
                _self.$scrollAnimation = null;
                callback && callback();
            }
        }, 10);
    };

    /**
     * Scrolls the editor to the y pixel indicated.
     * @param {Number} scrollTop The position to scroll to
     *
     *
     * @returns {Number}
     **/
    this.scrollToY = function(scrollTop) {
        // after calling scrollBar.setScrollTop
        // scrollbar sends us event with same scrollTop. ignore it
        if (this.scrollTop !== scrollTop) {
            this.$loop.schedule(this.CHANGE_SCROLL);
            this.scrollTop = scrollTop;
        }
    };

    /**
     * Scrolls the editor across the x-axis to the pixel indicated.
     * @param {Number} scrollLeft The position to scroll to
     *
     *
     * @returns {Number}
     **/
    this.scrollToX = function(scrollLeft) {
        if (scrollLeft < 0)
            scrollLeft = 0;

        if (this.scrollLeft !== scrollLeft) {
            this.$loop.schedule(this.CHANGE_SCROLL);
            this.scrollLeft = scrollLeft;
        }
    };

    /**
     * Scrolls the editor across both x- and y-axes.
     * @param {Number} deltaX The x value to scroll by
     * @param {Number} deltaY The y value to scroll by
     *
     *
     **/
    this.scrollBy = function(deltaX, deltaY) {
        deltaY && this.provider.setScrollTop(this.provider.getScrollTop() + deltaY);
        deltaX && this.provider.setScrollLeft(this.provider.getScrollLeft() + deltaX);
    };

    /**
     * Returns `true` if you can still scroll by either parameter; in other words, you haven't reached the end of the file or line.
     * @param {Number} deltaX The x value to scroll by
     * @param {Number} deltaY The y value to scroll by
     *
     *
     * @returns {Boolean}
     **/
    this.isScrollableBy = function(deltaX, deltaY) {
        if (deltaY < 0 && this.getScrollTop() >= 1 - this.scrollMargin.top)
           return true;
        if (deltaY > 0 && this.getScrollTop() + this.$size.scrollerHeight - this.layerConfig.maxHeight
            < -1 + this.scrollMargin.bottom)
           return true;
        if (deltaX < 0 && this.getScrollLeft() >= 1)
           return true;
        if (deltaX > 0 && this.getScrollLeft() + this.$size.scrollerWidth - this.layerConfig.maxWidth < -1)
           return true;
    };

    // @todo this code can be compressed
    this.screenToTextCoordinates = function(x, y) {
        var canvasPos = this.scroller.getBoundingClientRect();
        y -= canvasPos.top;
        x -= canvasPos.left;

        return {
            x : x + this.scrollLeft,
            y : y + this.scrollTop
        };
    };

    /**
     * Returns an object containing the `pageX` and `pageY` coordinates of the document position.
     * @param {Number} row The document row position
     * @param {Number} column The document column position
     *
     *
     *
     * @returns {Object}
     **/
    this.textToScreenCoordinates = function(row, column) {
        throw new Error();

    };
    
    this.findNodeAt = function(x, y, coords) {
        
    };
    
    this.$moveTextAreaToCursor = function(){};

    /**
     *
     * Focuses the current container.
     **/
    this.visualizeFocus = function() {
        dom.addCssClass(this.container, "ace_tree_focus");
    };

    /**
     *
     * Blurs the current container.
     **/
    this.visualizeBlur = function() {
        dom.removeCssClass(this.container, "ace_tree_focus");
    };

    /**
    * [Sets a new theme for the editor. `theme` should exist, and be a directory path, like `ace/theme/textmate`.]{: #VirtualRenderer.setTheme}
    * @param {String} theme The path to a theme
    * @param {Function} cb optional callback
    *
    **/
    this.setTheme = function(theme, cb) {
        var _self = this;
        this.$themeValue = theme;
        _self._dispatchEvent('themeChange',{theme:theme});

        if (!theme || typeof theme == "string") {
            var moduleName = theme || "ace/theme/textmate";
            config.loadModule(["theme", moduleName], afterLoad);
        } else {
            afterLoad(theme);
        }

        function afterLoad(module) {
            if (_self.$themeValue != theme)
                return cb && cb();
            if (!module.cssClass)
                return;
            dom.importCssString(
                module.cssText,
                module.cssClass,
                _self.container.ownerDocument
            );

            if (_self.theme)
                dom.removeCssClass(_self.container, _self.theme.cssClass);

            // this is kept only for backwards compatibility
            _self.$theme = module.cssClass;

            _self.theme = module;
            dom.addCssClass(_self.container, module.cssClass);
            dom.setCssClass(_self.container, "ace_dark", module.isDark);

            var padding = module.padding || 4;
            if (_self.$padding && padding != _self.$padding)
                _self.setPadding(padding);

            // force re-measure of the gutter width
            if (_self.$size) {
                _self.$size.width = 0;
                _self.onResize();
            }

            _self._dispatchEvent('themeLoaded', {theme:module});
            cb && cb();
        }
    };

    /**
    * [Returns the path of the current theme.]{: #VirtualRenderer.getTheme}
    * @returns {String}
    **/
    this.getTheme = function() {
        return this.$themeValue;
    };

    // Methods allows to add / remove CSS classnames to the editor element.
    // This feature can be used by plug-ins to provide a visual indication of
    // a certain mode that editor is in.

    /**
     * [Adds a new class, `style`, to the editor.]{: #VirtualRenderer.setStyle}
     * @param {String} style A class name
     *
     *
     **/
    this.setStyle = function setStyle(style, include) {
        dom.setCssClass(this.container, style, include !== false);
    };

    /**
     * [Removes the class `style` from the editor.]{: #VirtualRenderer.unsetStyle}
     * @param {String} style A class name
     *
     *
     **/
    this.unsetStyle = function unsetStyle(style) {
        dom.removeCssClass(this.container, style);
    };

    /**
     *
     * Destroys the text and Caret layers for this renderer.
     **/
    this.destroy = function() {
        window.removeEventListener("focus", this.$windowFocus);
        
        this.$cellLayer.destroy();
    };

}).call(VirtualRenderer.prototype);

config.defineOptions(VirtualRenderer.prototype, "renderer", {
    animatedScroll: {initialValue: true},
    showInvisibles: {
        set: function(value) {
            if (this.$cellLayer.setShowInvisibles(value))
                this.$loop.schedule(this.CHANGE_TEXT);
        },
        initialValue: false
    },
    showPrintMargin: {
        set: function() { this.$updatePrintMargin(); },
        initialValue: true
    },
    printMarginColumn: {
        set: function() { this.$updatePrintMargin(); },
        initialValue: 80
    },
    printMargin: {
        set: function(val) {
            if (typeof val == "number")
                this.$printMarginColumn = val;
            this.$showPrintMargin = !!val;
            this.$updatePrintMargin();
        },
        get: function() {
            return this.$showPrintMargin && this.$printMarginColumn; 
        }
    },
    displayIndentGuides: {
        set: function(show) {
            if (this.$cellLayer.setDisplayIndentGuides(show))
                this.$loop.schedule(this.CHANGE_TEXT);
        },
        initialValue: true
    },
    hScrollBarAlwaysVisible: {
        set: function(alwaysVisible) {
            this.$hScrollBarAlwaysVisible = alwaysVisible;
            if (!this.$hScrollBarAlwaysVisible || !this.$horizScroll)
                this.$loop.schedule(this.CHANGE_SCROLL);
        },
        initialValue: false
    },
    vScrollBarAlwaysVisible: {
        set: function(val) {
            if (!this.$vScrollBarAlwaysVisible || !this.$vScroll)
                this.$loop.schedule(this.CHANGE_SCROLL);
        },
        initialValue: false
    },
    fontSize:  {
        set: function(size) {
            if (typeof size == "number")
                size = size + "px";
            this.container.style.fontSize = size;
            this.updateFontSize();
        },
        initialValue: 12
    },
    fontFamily: {
        set: function(name) {
            this.container.style.fontFamily = name;
            this.updateFontSize();
        }
    },
    maxLines: {
        set: function(val) {
            this.updateFull();
        }
    },
    minLines: {
        set: function(val) {
            this.updateFull();
        }
    },
    scrollPastEnd: {
        set: function(val) {
            val = +val || 0;
            if (this.$scrollPastEnd == val)
                return;
            this.$scrollPastEnd = val;
            this.$loop.schedule(this.CHANGE_SCROLL);
        },
        initialValue: 0,
        handlesSet: true
    }
});

exports.VirtualRenderer = VirtualRenderer;
});
