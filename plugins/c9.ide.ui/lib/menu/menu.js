define(function(require, module, exports) {
return function(apf) {
var $setTimeout  = setTimeout;
var $setInterval = setInterval;

apf.popup = {
    cache      : {},
    focusFix   : {"INPUT":1,"TEXTAREA":1,"SELECT":1},
    
    setContent : function(cacheId, content, style, width, height){
        if (!this.popup) this.init();

        this.cache[cacheId] = {
            content : content,
            style   : style,
            width   : width,
            height  : height
        };
        content.style.position = "absolute";
        //if(content.parentNode) content.parentNode.removeChild(content);
        //if(style) apf.importCssString(style, this.popup.document);
        
        content.onmousedown  = function(e) {
            if (!e) e = event;

            
            
            //@todo can this cancelBubble just go?
            //apf.cancelBubble(e, null, true);
            //e.cancelBubble = true;
        };
        
        return content.ownerDocument;
    },
    
    removeContent : function(cacheId){
        this.cache[cacheId] = null;
        delete this.cache[cacheId];
    },
    
    init : function(){
        //consider using iframe
        this.popup = {};
        
        apf.addEventListener("hotkey", function(e){
            if (e.keyCode == "27" || e.altKey) 
                apf.popup.forceHide();
        });
    },
    
    show : function(cacheId, options){
        if (!this.popup) this.init();
        
        options = apf.extend({
            x            : 0,
            y            : 0,
            animate      : false,
            ref          : null,
            width        : null,
            height       : null,
            callback     : null,
            draggable    : false,
            resizable    : false,
            allowTogether: false,
            autoCorrect  : true,
            noleft       : false,
            setZindex    : true
        }, options);
        
        if ((!options.allowTogether 
          || options.allowTogether !== true && options.allowTogether != this.last) 
          && this.last != cacheId
          && this.cache[this.last]
          && (!this.cache[this.last].options || this.cache[this.last].options.autohide !== false))
            this.hide();

        var o = this.cache[cacheId];
        o.options = options;

        var dp,
            popup  = o.content,
            moveUp = false,
            moveLeft = false,
            fixed  = false;

        if (options.setZindex)
            apf.window.zManager.set(options.zindextype || "popup", o.content);
        
        if ((dp = o.content.style.display) && dp.indexOf("none") > -1)
            o.content.style.display = "";

        var x = options.x;
        var y = options.y;

        var refNode = options.ref;
        while (refNode && refNode.nodeType == 1) {
            if (fixed = apf.getStyle(refNode, "position") == "fixed")
                break;
            refNode = refNode.parentNode || refNode.$parentNode;
        }

        if (!fixed) {
            if (refNode) {
                var pos = apf.getAbsolutePosition(options.ref, 
                    o.content.offsetParent || o.content.parentNode);
                x = (x || 0) + pos[0];
                y = (y || 0) + pos[1];
            }
            
            if (options.width || o.width)
                popup.style.width = ((options.width || o.width) - 3) + "px";

            popup.style.position = "absolute";
            popup.style.maxHeight = "";
            
            var parentMenu = this.cache[options.allowTogether];
            var pOverflow  = apf.getOverflowParent(o.content);
            var edgeY      = (pOverflow == document.documentElement
                ? (apf.isIE 
                    ? pOverflow.offsetHeight 
                    : (window.innerHeight + window.pageYOffset)) + pOverflow.scrollTop
                : pOverflow.offsetHeight + pOverflow.scrollTop);
            moveUp = options.up || options.autoCorrect && (y
                + (options.height || o.height || o.content.offsetHeight))
                > edgeY;
            
            var maxHeight = 0;
            if (moveUp) {
                var value;
                var height = (options.height || o.height || o.content.offsetHeight);
                if (options.ref)
                    value = (pos[1] - height);
                else
                    value = Math.max(0, edgeY - height);
                
                if (!options.up && value < 0) {
                    moveUp = false;
                    popup.style.top = y + "px";
                    maxHeight = edgeY - y - this.$screenMargin.bottom - 10;
                }
                else {
                    var minTop = this.$screenMargin.top + 3;
                    maxHeight = (pos ? pos[1] : edgeY) - minTop  - 10;
                    popup.style.top = Math.max(value, minTop) + "px";
                }
                
            }
            else {
                popup.style.top = y + "px";
                maxHeight = edgeY - y - this.$screenMargin.bottom - 10;
            }
            
            popup.style.overflowY = "auto";
            popup.style.maxHeight = maxHeight ? maxHeight + "px" : "";
            
            if (!options.noleft) {
                var edgeX     = (pOverflow == document.documentElement
                    ? (apf.isIE 
                        ? pOverflow.offsetWidth
                        : (window.innerWidth + window.pageXOffset)) + pOverflow.scrollLeft
                    : pOverflow.offsetWidth + pOverflow.scrollLeft);
                moveLeft = options.autoCorrect && (x
                    + (options.width || o.width || o.content.offsetWidth))
                    > edgeX;

                if (moveLeft) {
                    var value;
                    if (options.ref) {
                        value = (pos[0] - (options.width || o.width || o.content.offsetWidth))
                                + (options.ref.offsetWidth);
                    }
                    else {
                        value = (edgeX - (options.width || o.width || o.content.offsetWidth) 
                                - (parentMenu ? (edgeX - parentMenu.content.offsetLeft) : 0))
                                + 5;
                                //parentMenu.width || parentMenu.content.offsetWidth) : 0));
                    }
                    popup.style.left = value < 0 ? x : (value - 1) + "px";
                }
                else {
                    popup.style.left = x + "px";
                }
            }
        }
        else {
            pos = apf.getAbsolutePosition(options.ref, refNode);
            y = (y || 0) + pos[1] + refNode.offsetTop;
            pos[0] += refNode.offsetLeft;
            popup.style.position = "fixed";
            popup.style.top      = y + "px";
            
            if (!options.noleft)
                popup.style.left = x + "px";
        }

        
        // set a className that specifies the direction, to help skins with
        // specific styling options.
        apf.setStyleClass(popup, moveUp ? "upward" : "downward", [moveUp ? "downward" : "upward"]);
        apf.setStyleClass(popup, moveLeft ? "moveleft" : "moveright", [moveLeft ? "moveright" : "moveleft"]);
        

        if (options.animate) {
            if (options.animate == "fade") {
                apf.tween.single(popup, {
                    type  : 'fade',
                    from  : 0,
                    to    : 1,
                    anim  : apf.tween.NORMAL,
                    steps : options.steps || 15 * apf.animSteps
                });
            }
            else {
                var iVal, steps = apf.isIE8 ? 5 : 7, i = 0;
                iVal = setInterval(function(){
                    var value = ++i * ((options.height || o.height) / steps);

                    popup.style.height = value + "px";
                    if (moveUp)
                        popup.style.top = (y - value - (options.y || 0)) + "px";
                    else
                        (options.container || popup).scrollTop = -1 * (i - steps) * ((options.height || o.height) / steps);
                    popup.style.display = "block";

                    if (i >= steps) {
                        clearInterval(iVal)
                        
                        if (options.callback)
                            options.callback(popup);
                    }
                }, 10);
            }
        }
        else {
            if (!refNode) {
                if (options.height || o.height)
                    popup.style.height = (options.height || o.height) + "px";
                value = (edgeY - (options.height || o.height || o.content.offsetHeight));
                popup.style.top = y + (options.height || o.height || o.content.offsetHeight) < edgeY 
                                    ? y 
                                    : value 
                                  + "px";
            }
            popup.style.display = "block";
            
            if (options.callback)
               options.callback(popup);
        }

        $setTimeout(function(){
            apf.popup.last = cacheId;
        });

        if (options.draggable) {
            options.id = cacheId;
            this.makeDraggable(options);
        }
    },
    
    hide : function(){
        if (this.isDragging) return;

        var o = this.cache[this.last];
        if (o) {
            if (o.content)
                o.content.style.display = "none";

            if (o.options && o.options.onclose) {
                o.options.onclose(apf.extend(o.options, {htmlNode: o.content}));
                o.options.onclose = false;
            }
        }
    },
    
    isShowing : function(cacheId){
        return this.last && this.last == cacheId 
            && this.cache[this.last]
            && this.cache[this.last].content.style.display != "none";
    },

    isDragging   : false,

    makeDraggable: function(options) {
        if (!apf.Interactive || this.cache[options.id].draggable) 
            return;

        var oHtml = this.cache[options.id].content;
        this.cache[options.id].draggable = true;
        var o = {
            $propHandlers : {},
            minwidth      : 10,
            minheight     : 10,
            maxwidth      : 10000,
            maxheight     : 10000,
            dragOutline   : false,
            resizeOutline : false,
            draggable     : true,
            resizable     : options.resizable,
            $ext          : oHtml,
            oDrag         : oHtml.firstChild
        };

        oHtml.onmousedown =
        oHtml.firstChild.onmousedown = function(e){
            if (!e) e = event;
            
            
            
            (e || event).cancelBubble = true;
        }

        apf.implement.call(o, apf.Interactive);

        o.$propHandlers["draggable"].call(o, true);
        o.$propHandlers["resizable"].call(o, true);
    },
    
    getCurrentElement : function(){
        return typeof this.last == "number" && apf.lookup(this.last);
    },
    
    $mousedownHandler : function(amlNode, e){
        if (!this.last || (amlNode && this.last == amlNode.$uniqueId) || !this.cache[this.last])
          return;

        var htmlNode = e.srcElement || e.target;
        
        var uId = this.last;
        
        while (this.cache[uId]) {
            if (apf.isChildOf(this.cache[uId].content, htmlNode, true))
                return;
            
            if (!this.cache[uId].options)
                return;
            
            uId = this.cache[uId].options.allowTogether;
        }
        
        this.forceHide();
    },
    
    forceHide : function(){
        if (document.body.classList.contains("noInput")) return;
        
        if (this.last 
          
          && !apf.plane.current
          
          && this.isShowing(this.last)
          && this.cache[this.last]
          && this.cache[this.last].options
          && this.cache[this.last].options.autohide !== false) {
            var o = apf.lookup(this.last);
            if (!o)
                this.last = null;
            else if (o.dispatchEvent("popuphide") !== false)
                this.hide();
        }
    },

    destroy : function(){
        for (var cacheId in this.cache) {
            if (this.cache[cacheId]) {
                this.cache[cacheId].content.onmousedown = null;
                apf.destroyHtmlNode(this.cache[cacheId].content);
                this.cache[cacheId].content = null;
                this.cache[cacheId] = null;
            }
        }
        
        if (!this.popup) return;
        //this.popup.document.body.c = null;
        //this.popup.document.body.onmouseover = null;
    },
    
    setMargin: function(m) {
        for (var i in this.$screenMargin)
            if (i in m)
                this.$screenMargin[i] = m[i] || 0;
    },
    $screenMargin: {top: 0, left: 0, right: 0, bottom: 0}
};






/**
 * This element displays a skinnable menu of items which can be choosen.
 * 
 * Based on the context of the menu, items can be shown and hidden. 
 * 
 *
 * #### Example
 * 
 * ```xml, demo
 *  <a:application xmlns:a="http://ajax.org/2005/aml">
 *   <!-- startcontent -->
 *   <a:menu id="menu1">
 *       <a:item>Tutorials</a:item>
 *       <a:item icon="email.png">Contact</a:item>
 *       <a:divider></a:divider>
 *       <a:item 
 *         icon    = "application_view_icons.png"
 *         hotkey  = "Ctrl+T"
 *         onclick = "setTimeout(function(){alert('You did it');}, 1000)">
 *         Tutorials</a:item>
 *       <a:divider />
 *       <a:item disabled="true">Visit Ajax.org</a:item>
 *       <a:item>Exit</a:item>
 *   </a:menu>
 *   <a:window
 *     width     = "400"
 *     height    = "150"
 *     visible   = "true"
 *     resizable = "true"
 *     title     = "Mail message"
 *     skin      = "bk-window2">
 *       <a:toolbar>
 *           <a:menubar>
 *               <a:button submenu="menu1">File</a:button>
 *               <a:button submenu="menu1" disabled="true">Edit</a:button>
 *           </a:menubar>
 *       </a:toolbar>
 *   </a:window>
 *   <!-- endcontent -->
 *  </a:application>
 * ```
 *
 * @class apf.menu
 * @define menu
 * @selection
 * @allowchild item, divider, check, radio
 *
 * @author      Ruben Daniels (ruben AT ajax DOT org)
 * @version     %I%, %G%
 * @since       0.4
 *
 * @inherits apf.Presentation
 */
/**
 * @event display   Fires when the contextmenu is shown.
 */
/**
 * @event itemclick Fires when a user presses the mouse button while over a child of this element.
 * @param {Object} e The standard event object. The following property is available:
 *   - `value` ([[String]]): the value of the clicked element.
 *
 */
apf.menu = function(struct, tagName){
    this.$init(tagName || "menu", apf.NODE_VISIBLE, struct);
    
    this.animate = apf.enableAnim;
};

(function(){
    this.$focussable  = apf.MENU;
    this.$positioning = "basic"
    //var _self         = this;
    //var blurring      = false;

    // *** Properties and Attributes *** //
    
    //this.zindex    = 10000000;
    this.visible   = false;
    this.matchhide = false;

    this.$booleanProperties["animate"]  = true;
    this.$booleanProperties["pinned"] = true;
    this.$booleanProperties["sticky"] = true;
    this.$booleanProperties["matchhide"] = true;
    
    this.$propHandlers["visible"] = function(value, prop, force, nofocus, hideOpener){
        if (!this.$ext)
            return;
        
        if (value) {
            this.$ext.style.display = "block";
            if (this.opener && this.opener.localName.indexOf('item') > -1)
                this.opener.parentNode.$showingSubMenu = this;
        }
        else {
            this.$ext.style.display = "none";

            var lastFocus = apf.menu.lastFocussed;
            var opener    = this.opener;
            //@todo test this with a list being the opener of the menu
            if (lastFocus != this.opener && this.opener && this.opener.$blur)
                this.opener.$blur();

            if (this.opener && this.opener.parentNode && this.opener.parentNode.localName == "menu") {
                if (!this.$hideTree)
                    this.$hideTree = -1
                this.opener.parentNode.focus();
            }
            
            
            else if (lastFocus) {
                //We're being hidden because some other object gets focus
                if (apf.window.$settingFocus) {
                    if (apf.window.$settingFocus != lastFocus && lastFocus.$blur)
                        lastFocus.$blur();
                    this.$blur();

                    if (apf.window.$settingFocus.localName != "menu") //not menu walking
                        apf.menu.lastFocussed = null;
                }
                //We're being hidden because window looses focus
                
                //We're just being hidden
                else if (this.$hideTree) {
                    if (!this.$hideTree)
                        this.$hideTree = -1

                    var visTest = (lastFocus.disabled || lastFocus.$ext 
                        && !lastFocus.$ext.offsetHeight) // || !lastFocus.visible
                        && lastFocus != apf.document.documentElement;

                    if (nofocus || visTest) {
                        if (lastFocus.$blur)
                            lastFocus.$blur();
                        this.$blur();
                        apf.document.activeElement = null;

                        if (visTest && apf.window.moveNext() === false)
                            apf.window.$focusRoot();
                    }
                    else {
                        lastFocus.focus(null, null, true);
                    }

                    apf.menu.lastFocussed = null;
                }
            }
            

            clearTimeout(this.$submenuTimer);

            if (this.$showingSubMenu) {
                this.$showingSubMenu.hide();
                this.$showingSubMenu = null;
            }

            if (this.opener && this.opener.$submenu) {
                this.opener.$submenu(true, true);

                //@todo problem with loosing focus when window looses focus
                if (this.$hideTree === true && this.opener
                  && this.opener.parentNode 
                  && this.opener.parentNode.localName == "menu"
                  && this.opener.parentNode.$hideTree != -1) {
                    this.opener.parentNode.$hideTree = true
                    this.opener.parentNode.hide();
                }
                
                this.opener = null;
            }
            this.$hideTree = null;

            if (this.$selected) {
                apf.setStyleClass(this.$selected.$ext, "", ["hover"]);
                this.$selected = null;
            }
            
            this.dispatchEvent("hide", {opener: opener});
        }
    };

    // *** Public Methods *** //

    var lastFocus;

    /**
     * Shows the menu, optionally within a certain context.
     * @param {Number}     x        The left position of the menu.
     * @param {Number}     y        The top position of the menu.
     * @param {Boolean}    noanim   Whether to animate the showing of this menu.
     * @param {apf.AmlElement} opener   The element that is the context of this menu.
     * @param {XMLElement} xmlNode  The {@link term.datanode data node} that provides data context to the menu child nodes.
     * @see apf.GuiElement@contextmenu
     */
    this.display = function(x, y, noanim, opener, xmlNode, openMenuId, btnWidth){
        this.opener = opener;
        
        var lastFocus;
        if (!apf.menu.lastFocussed)
            lastFocus = apf.menu.lastFocussed = apf.menu.lastFocussedItem;
        
        //Show / hide Child Nodes Based on XML
        if (xmlNode && !this.disabled) {
            var last, i, node,
                nodes = this.childNodes,
                c     = 0,
                l     = nodes.length, result;
            for (i = 0; i < l; i++) {
                node = nodes[i];
                if (node.nodeType != 1 || node.localName != "item")
                    continue;
    
                result = !xmlNode || !node.match || (node.cmatch || (node.cmatch = apf.lm.compile(node.match, {
                    xpathmode  : 3,
                    injectself : true
                })))(xmlNode)
    
                if (result) {
                    if (this.matchhide)
                        node.show();
                    else
                        node.enable();
    
                    if (node.localName == "divider" && this.matchhide) {
                        last = node;
                        if (c == 0)
                            node.hide();
                        c = 0;
                    }
                    else c++;
                }
                else {
                    if (this.matchhide)
                        node.hide();
                    else
                        node.disable();
    
                    if (!node.nextSibling && c == 0 && last)
                        last.hide();
                }
            }
        }

        if (this.oOverlay) {
            if (btnWidth) {
                this.oOverlay.style.display = "block";
                this.oOverlay.style.width   = btnWidth + "px";
            }
            else
                this.oOverlay.style.display = "none";
        }

        function afterRender(){
            if (x === null) {
                apf.popup.show(this.$uniqueId, {
                    x            : 0, 
                    y            : this.ref ? 0 : opener.$ext.offsetHeight, 
                    animate      : noanim || !this.animate ? false : "fade",
                    steps        : 10,
                    ref          : (this.ref || opener).$ext,
                    allowTogether: openMenuId,
                    autohide     : !this.pinned,
                    noleft       : this.left !== undefined,
                    setZindex    : this.zindex ? false : true,
                    up           : (this.ref || opener).submenudir == "up"
                });
            }
            else {
                //var bodyPos = apf.getAbsolutePosition(document.body);
                apf.popup.show(this.$uniqueId, {
                    x            : x, 
                    y            : y - (apf.isIE && apf.isIE < 8 ? 1 : 0), 
                    animate      : noanim || !this.animate ? false : "fade",
                    steps        : 10,
                    //ref          : this.$ext.offsetParent,
                    allowTogether: openMenuId,
                    autohide     : !this.pinned,
                    setZindex    : this.zindex ? false : true
                    //autoCorrect  : false
                });
            }
            
            // var lastFocus      =
            // apf.menu.lastFocus = opener && opener.$focussable === true
            //     ? opener
            //     : apf.menu.lastFocus || apf.document.activeElement;
            
            apf.popup.last = null;
            
            //if (!apf.isGecko) //This disables keyboard support for gecko - very strange behaviour
                this.focus();
    
            //Make the component that provides context appear to have focus
            // second argument is needed for ace tree
            if (lastFocus && lastFocus != this && lastFocus.$focus)
                lastFocus.$focus(null, {fromContextMenu: true});
    
            this.xmlReference = xmlNode;

            //@todo consider renaming this to onshow and onhide
            this.dispatchEvent("display", {opener: opener});
        }
        
        this.visible = false;
        
        if (!this.parentNode)
            apf.document.documentElement.appendChild(this);
        
        if (this.$rendered !== false) {
            this.show();
            afterRender.call(this);
        }
        else {
            this.addEventListener("afterrender", afterRender);
            this.show();
        }                
    };

    /**
     * Returns the current group value of this element.
     * @return {String} The current selected value.
     */
    this.getValue = function(group){
        return this.getSelected(group).value || "";
    };

    /**
     * Retrieves the selected element from a group of radio elements.
     * @param {String} group The name of the group.
     * @return {apf.radiobutton} The selected radio element.
     */
    this.getSelected = function(group){
        var nodes = this.childNodes;
        var i, l = nodes.length;
        for (i = 0; i < l; i++) {
            if (nodes[i].group != group)
                continue;

            if (nodes[i].selected)
                return nodes[i];
        }

        return false;
    };

    /**
     * Selects an element within a radio group.
     * @param {String} group  The name of the group.
     * @param {String} value  The value of the item to select.
     */
    this.select = function(group, value){
        this.selectedValue = value;
        
        var nodes = this.childNodes;
        var i, l = nodes.length;
        for (i = 0; i < l; i++) {
            if (nodes[i].group != group)
                continue;

            if (value && (nodes[i].value == value || !nodes[i].value && nodes[i].caption == value))
                nodes[i].setProperty("selected", true, false, true);
                //nodes[i].$handlePropSet("selected", true);
            else if (nodes[i].selected)
                nodes[i].setProperty("selected", false, false, true);
                //nodes[i].$handlePropSet("selected", false);
        }
    };

    // *** Events *** //

    
    this.addEventListener("prop.visible", function() {
        this.$initChildren();
    }, true);
    
    this.addEventListener("keydown", function(e){
        var node, key = e.keyCode;
        //var ctrlKey  = e.ctrlKey;
        //var shiftKey = e.shiftKey;

        switch (key) {
            case 13:
                if (!this.$selected)
                    return;

                node = this.$selected;
                node.$down();
                node.$up();
                node.$click();
                break;
            case 27:
                this.hide();
                break;
            case 38:
                //UP
                node = this.$selected && this.$selected.previousSibling
                  || this.lastChild;

                if (node && node.localName == "divider")
                    node = node.previousSibling;

                if (!node)
                    return;

                if (this.$selected)
                    apf.setStyleClass(this.$selected.$ext, "", ["hover"]);

                apf.setStyleClass(node.$ext, "hover");
                this.$selected = node;
                break;
            case 40:
                //DOWN
                node = this.$selected && this.$selected.nextSibling
                  || this.firstChild;

                if (node && node.localName == "divider")
                    node = node.nextSibling;

                if (!node)
                    return;

                if (this.$selected)
                    apf.setStyleClass(this.$selected.$ext, "", ["hover"]);

                apf.setStyleClass(node.$ext, "hover");
                this.$selected = node;
                break;
            case 37:
                //LEFT
                //if (this.$selected && this.$selected.submenu)
                    //this.$selected.$submenu(true, true);

                if (!this.opener)
                    return;

                if (this.opener.localName == "button") {
                    node = this.opener.previousSibling;
                    while(node && !node.submenu)
                        node = node.previousSibling;

                    if (node) {
                        node.dispatchEvent("mouseover");

                        var btnMenu = node.parentNode.menuIsPressed;
                        if (btnMenu) {
                            self[btnMenu.submenu].dispatchEvent("keydown", {
                                keyCode : 40
                            });
                        }
                    }
                }
                else if (this.opener.parentNode.localName == "menu") {
                    //@todo Ahum bad abstraction boundary
                    var op = this.opener;
                    this.hide();
                    apf.setStyleClass(op.$ext, "hover");
                    op.parentNode.$showingSubMenu = null;
                }

                break;
            case 39:
                //RIGHT
                if (this.$selected && this.$selected.submenu) {
                    this.$selected.$submenu(null, true);
                    this.$showingSubMenu.dispatchEvent("keydown", {
                       keyCode : 40
                    });

                    return;
                }

                if (this.opener) {
                    var op = this.opener;
                    while (op && op.parentNode && op.parentNode.localName == "menu")
                        op = op.parentNode.opener;

                    if (op && op.localName == "button") {
                        node = op.nextSibling;
                        while(node && !node.submenu)
                            node = node.nextSibling;

                        if (node) {
                            node.dispatchEvent("mouseover");

                            var btnMenu = node.parentNode.menuIsPressed;
                            if (btnMenu) {
                                (self[btnMenu.submenu] || btnMenu.submenu).dispatchEvent("keydown", {
                                    keyCode : 40
                                });
                            }

                            return;
                        }
                    }
                }

                if (!this.$selected) {
                    arguments.callee.call(this, {
                       keyCode : 40
                    });
                }

                break;
            default:
                return;
        }

        return false;
    }, true);
    

    //Hide menu when it looses focus or when the popup hides itself
    function forceHide(e){
        if (this.$showingSubMenu || this.pinned
                || apf.isChildOf(e.fromElement, e.toElement)
                || apf.isChildOf(e.toElement, e.fromElement)
                || apf.isChildOf(this, e.toElement) 
                || (e.name !== "popuphide" && !e.toElement)
                || e.toElement && apf.popup.cache[e.toElement.$uniqueId])
            return;

        if (this.$hideTree != -1) {
            this.$hideTree = true;
            this.hide();
        }

        return false;
    }

    this.addEventListener("focus", function(e){
        apf.popup.last = this.$uniqueId;
        
        if (!apf.menu.lastFocussed)
            apf.menu.lastFocussed = apf.menu.lastFocussedItem;
    });

    this.addEventListener("blur", forceHide);
    this.addEventListener("popuphide", forceHide);

    // *** Init *** //

    this.$draw = function(){
        this.$pHtmlNode = document.body;

        //Build Main Skin
        this.$ext = this.$getExternal();
        this.oOverlay = this.$getLayoutNode("main", "overlay", this.$ext);

        apf.popup.setContent(this.$uniqueId, this.$ext, "", null, null);
        
        // workaround for a chrome bug where clicking on shadow clciks on contents of overflown element
        this.$ext.addEventListener("mouseup", function(e) {
            var rect = this.getBoundingClientRect();
            if (e.clientY > rect.bottom && rect.height) {
                e.stopPropagation();
                e.preventDefault();
            }
        }, true);
    };

    this.$loadAml = function(x){
        this.$int = this.$getLayoutNode("main", "container", this.$ext);
    };

    this.$destroy = function(){
        apf.popup.removeContent(this.$uniqueId);
    };
    
    this.$initChildren = function() {
        var ch = this.childNodes;
        for (var i = 0; i < ch.length; i++) {
            var amlNode = ch[i];
            if (!amlNode.$amlLoaded)
                amlNode.dispatchEvent("DOMNodeInsertedIntoDocument");
            // sometimes DOMNodeInsertedIntoDocument event handler puts $ext at the end of the popup
            if (!amlNode.previousSibling || !amlNode.previousSibling.$ext || !amlNode.$ext)
                continue;
            if (amlNode.$ext.previousSibling == amlNode.previousSibling.$ext)
                continue;
            if (amlNode.$ext.parentNode == amlNode.previousSibling.$ext.parentNode)
                amlNode.$ext.parentNode.insertBefore(amlNode.$ext, amlNode.previousSibling.$ext.nextSibling);
        }
    };
    var insertBefore = this.insertBefore;
    this.insertBefore = function(node, beforeNode) {
        // if menu is visible call apf insertBefore since it rearranges html nodes
        // otherwise use fake and much faster method
        if (this.visible)
            return insertBefore.call(this, node, beforeNode);
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
    
    this.appendChild = function(node) {
        return this.insertBefore(node);
    };
}).call(apf.menu.prototype = new apf.Presentation());

apf.addEventListener("movefocus", function(e){
    var next = e.toElement;
    if (next && next.localName != "menu")
        apf.menu.lastFocussedItem = next;
});

apf.aml.setElement("menu", apf.menu);



/**
 * Element displaying a divider. For use in toolbars, menus, and such.
 * @class apf.divider
 * @define divider
 * @inherits apf.Presentation
 */
apf.divider = function(struct, tagName){
    this.$init(tagName || "divider", apf.NODE_VISIBLE, struct);
};

(function() {
    this.$focussable = false;

    this.minwidth = 0;
    this.minheight = 0;

    this.implement(apf.ChildValue);
    this.$childProperty = "caption";
    
    //@todo apf3.0 fix this
    this.addEventListener("AMLReparent", function(beforeNode, pNode, withinParent){
        if (!this.$amlLoaded)
            return;
        
        if (!withinParent && this.skinName != pNode.skinName) {
            //@todo for now, assuming dom garbage collection doesn't leak
            this.loadAml();
        }
    });
    
    /** 
     * @attribute {String} caption the text displayed in the area defined by this 
     * element. 
     */
    this.$supportedProperties.push("caption", "value", "for", "textalign");
    this.$propHandlers["caption"] = function(value){
        if (this.$caption) {
            this.$setStyleClass(this.$ext, this.$baseCSSname + "Caption");
            this.$caption.innerHTML = value;
        }
        else {
            this.$setStyleClass(this.$ext, "", [this.$baseCSSname + "Caption"]);
        }
    };
    
    this.$canLeechSkin = true;
    
    /**
     * @private
     */
    this.$draw = function() {
        if (this.parentNode.isPaged && this.parentNode.$buttons)
            this.$pHtmlNode = this.parentNode.$buttons;
        
        if (this.$isLeechingSkin) {
            this.$ext = apf.insertHtmlNode(
                this.parentNode.$getLayoutNode("divider"), this.$pHtmlNode);
        }
        else {
            this.$ext     = this.$getExternal("main");
            this.$caption = this.$getLayoutNode("main", "caption", this.$ext);
        }
    };
}).call(apf.divider.prototype = new apf.Presentation());

apf.aml.setElement("divider", apf.divider);






/**
 * Represents an item in a menu, displaying a clickable area.
 * 
 * #### Example
 * 
 * ```xml, demo
 * <a:application xmlns:a="http://ajax.org/2005/aml">
 *   <!-- startcontent -->
 *   <a:menu id="menu1">
 *      <a:item>Tutorials</a:item>
 *      <a:item>Contact</a:item>
 *   </a:menu>
 *   <a:toolbar>
 *      <a:menubar>
 *          <a:button submenu="menu1">File</a:button>
 *      </a:menubar>
 *   </a:toolbar>
 *   <!-- endcontent -->
 * </a:application>
 * ```
 * 
 * @class apf.item
 * @selection
 * @define item
 * @inherits apf.Presentation
 *
 */
/**
 * @event click Fires when a user presses the mouse button while over this element.
 * @param {Object} e The standard event object. It contains the following properties:
 *  - xmlContext ([[XMLElement]]): The XML data node that was selected in the opener at the time of showing the context menu.
 *  - opener ([[apf.AmlElement]]): The element that was clicked upon when showing the context menu.
 */
apf.item  = function(struct, tagName){
    this.$init(tagName || "item", apf.NODE_VISIBLE, struct);
};

(function(){
    this.$focussable    = false;
    this.$childProperty = "caption";
    this.$canLeechSkin  = "item";

    this.checked  = false;
    this.selected = false;

    this.implement(apf.ChildValue);

    // *** Properties and Attributes *** //
    
    //1 = force no bind rule, 2 = force bind rule
    this.$attrExcludePropBind = apf.extend({
        "match" : 1
    }, this.$attrExcludePropBind);

    this.$booleanProperties["checked"] = true;
    this.$booleanProperties["selected"] = true;

    this.$supportedProperties.push("submenu", "value", "match", "group", "icon",
                                   "checked", "selected", "disabled", "caption", 
                                   "type", "values");

    /**
     * @attribute {String} submenu Sets or gets the id of the menu that is shown
     * when the user hovers over this menu item.
     * 
     * #### Example
     * 
     * ```xml
     *  <a:menu id="msub">
     *      <a:item icon="tbicons:12">test</a:item>
     *      <a:item icon="tbicons:14">test2</a:item>
     *  </a:menu>
     *
     *  <a:menu id="mmain">
     *      <a:item submenu="msub">Sub menu</a:item>
     *  </a:menu>
     *  
     *  <a:toolbar>
     *      <a:menubar>
     *          <a:button submenu="mmain">File</a:button>
     *      </a:menubar>
     *  </a:toolbar>
     * ```
     */
    this.$propHandlers["submenu"] = function(value){
        apf.setStyleClass(this.$ext, "submenu");
    }
    
    /**
     * @attribute {String} value Sets or gets the value of this element.
     */

    /**
     * @attribute {String} [select] Sets or gets the XPath statement which works on the
     * XML context of the parent menu element to determine whether this
     * item is shown.
     * 
     * #### Example
     * 
     * This example shows a list:
     * 
     * ```xml
     *   <a:menu id="mnuTest">
     *       <a:item match="[person]" method="send">Send an E-mail</a:item>
     *       <a:item match="[phone]" method="call">Call Number</a:item>
     *       <a:divider />
     *       <a:item match="[phone]" method="remove">Remove</a:item>
     *       <a:divider />
     *       <a:item match="[person|phone]" method="viewpictures">View Pictures</a:item>
     *   </a:menu>
     *   
     *   <a:menu id="mnuXY">
     *       <a:item method="reboot">Reboot</a:item>
     *   </a:menu>
     *   
     *   <a:text contextmenu="mnuXY" width="200" height="200">
     *       Please right-click on this plane
     *   </a:text>
     *   
     *   <a:list id="lstTest" allow-deselect="true" width="200" height="200">
     *       <a:each match="[person|phone|computer]">
     *           <a:caption match="[@caption]" />
     *           <a:icon match="[person]" value="user.png" />
     *           <a:icon match="[phone]" value="phone.png" />
     *           <a:icon match="[computer]" value="computer.png" />
     *       </a:each>
     *       <a:model>
     *           <data>
     *               <person caption="Ruben Daniels" />
     *               <person caption="Rik Arends" />
     *               <phone caption="+31 555 544486" />
     *               <phone caption="+1 555 2392" />
     *               <computer caption="Mail Server" />
     *               <computer caption="File Server" />
     *           </data>
     *       </a:model>
     *       <a:contextmenu menu="mnuXY" match="[computer]" />
     *       <a:contextmenu menu="mnuTest" />
     *   </a:list>
     * ```
     */
    this.$propHandlers["select"] = function(value){
        this.select = value
            ? "self::" + value.split("|").join("|self::")
            : value;
    }
    
    /**
     * @attribute {String} [group] Sets or gets the name of the group this item belongs
     * to.
     * 
     * #### Example
     * 
     * ```xml
     *  <a:menu>
     *      <a:item type="radio" group="example">item 1</a:item>
     *      <a:item type="radio" group="example">item 2</a:item>
     *      <a:item type="radio" group="example">item 3</a:item>
     *      <a:item type="radio" group="example">item 4</a:item>
     *  </a:menu>
     * ```
     */
    this.$propHandlers["group"] = function(value){
        if (this.$group && this.$group.$removeRadio)
            this.$group.$removeRadio(this);
            
        if (!value) {
            this.$group = null;
            return;
        }
        
        var group = typeof value == "string"
            ? 
            
            apf.nameserver.get("group", value)
            
            : value;
        if (!group) {
            
            group = apf.nameserver.register("group", value, 
                new apf.$group());
            group.setAttribute("id", value);
            group.dispatchEvent("DOMNodeInsertedIntoDocument");
            group.parentNode = this;
            
        }
        this.$group = group;
        
        this.$group.$addRadio(this);
    };

    
    /**
     * @attribute {String} hotkey Sets or gets the key combination a user can press
     * to active the function of this element. Use any combination of
     * [[keys: Ctrl]], [[keys: Shift]], [[keys: Alt]], [[keys: F1]]-[[keys: F12]], and alphanumerical characters. Use a
     * space, a minus or plus sign as a seperator.
     * 
     * #### Example
     * 
     * ```xml
     *  <a:item hotkey="Ctrl+Q">Quit</a:item>
     * ```
     */
    this.$propHandlers["hotkey"] = function(value){
        if (!this.$amlLoaded) {
            var _self = this;
            this.addEventListener("DOMNodeInsertedIntoDocument", function(e){
                if (_self.$hotkey && _self.hotkey)
                    apf.setNodeValue(this.$hotkey, apf.isMac 
                      ? apf.hotkeys.toMacNotation(_self.hotkey) : _self.hotkey);
            });
        }
        else if (this.$hotkey)
            apf.setNodeValue(this.$hotkey, apf.isMac ? apf.hotkeys.toMacNotation(value) : value);

        if (this.$lastHotkey) {
            apf.hotkeys.remove(this.$lastHotkey[0], this.$lastHotkey[1]);
            delete this.$lastHotkey[0];
        }

        if (value) {
            this.$lastHotkey = [value];
            var _self = this;
            apf.hotkeys.register(value, this.$lastHotkey[1] = function(){
                if (_self.disabled || !_self.visible)
                    return;
                
                //hmm not very scalable...
                if (_self.parentNode) {
                    var buttons = apf.document.getElementsByTagNameNS(apf.ns.aml, "button");
                    for (var i = 0; i < buttons.length; i++) {
                        if (buttons[i].submenu == _self.parentNode.name) {
                            var btn = buttons[i];
                            btn.$setState("Over", {});
    
                            $setTimeout(function(){
                                btn.$setState("Out", {});
                            }, 200);
    
                            break;
                        }
                    }
                }
                
                _self.$down();
                _self.$up();
                _self.$click();
            });
        }
    }
    
    /**
     * @attribute {String} icon Sets or gets the URL of the image used as an icon or
     * a reference to an iconmap.
     */
    this.$propHandlers["icon"] = function(value){
        if (this.$icon)
            apf.skins.setIcon(this.$icon, value, this.parentNode.iconPath);
    }
    
    /**
     * @attribute {String} caption Sets or gets the text displayed on the item.
     */
    this.$propHandlers["caption"] = function(value){
        if (this.$caption)
            apf.setNodeValue(this.$caption, value);
    }
    
    /**
     * @attribute {String} type Sets or gets the function of this item.
     * 
     * Possible values include:
     * - `"item"`
     * - `"check"`
     * - `"radio"`
     */
    this.$propHandlers["type"] = function(value){
        apf.setStyleClass(this.$ext, value, ["item", "check", "radio"]);
    }
    
    this.$propHandlers["values"] = function(value){
        this.$values = typeof value == "string"
            ? value.split("\|")
            : (value || [1, 0]);

        this.$propHandlers["value"].call(this, this.value);
    };
    
    this.$propHandlers["value"] = function(value){
        if (this.type != "check")
            return;
        
        value = (typeof value == "string" ? value.trim() : value);
        
        var checked;
        if (this.$values) {
            checked = (typeof value != "undefined" && value !== null
                && value.toString() == this.$values[0].toString());
        }
        else {
            checked = apf.isTrue(value);
        }
        
        if (checked != this.checked) {
            this.checked = checked;
            this.$propHandlers.checked.call(this, checked);
        }
    };
    
    /**
     * @attribute {Boolean} checked Sets or gets whether the item is checked.
     */
    this.$propHandlers["checked"] = function(value){
        if (this.type != "check")
            return;

        if (apf.isTrue(value))
            apf.setStyleClass(this.$ext, "checked");
        else
            apf.setStyleClass(this.$ext, "", ["checked"]);
        
        if (!this.$values) {
            if (this.getAttribute("values"))
                this.$propHandlers["values"].call(this, this.getAttribute("values"));
            else
                this.$values = [true, false];
        }
        
        if(this.$values && this.$values[value ? 0 : 1] != this.value)
            this.setProperty("value", this.$values ? this.$values[value ? 0 : 1] : true);
    }
    
    this.select = function(){
        this.parentNode.select(this.group, this.value || this.caption);
    }
    
    this.check = function(){
        this.setProperty("value", this.$values
            ? this.$values[0]
            : true);
    }
    this.uncheck = function(){
        this.setProperty("value", this.$values
            ? this.$values[1]
            : false);
    }
    
    this.$check = function(){
        apf.setStyleClass(this.$ext, "selected");
    }
    
    this.$uncheck = function(){
        apf.setStyleClass(this.$ext, "", ["selected"]);
    }

    /**
     * @attribute {Boolean} selected Sets or gets whether the item is selected.
     */
    this.$propHandlers["selected"] = function(value){
        if (this.type != "radio")
            return;


        if (apf.isTrue(value)) {
            if (this.$group)
                this.$group.setProperty("value", this.value);
            this.$check();
        }
        else
            this.$uncheck();
    }
    
    /**
     * @attribute {Boolean} disabled Sets or gets whether the item is active.
     */
    this.$propHandlers["disabled"] = function(value){
        if (apf.isTrue(value) || value == -1)
            apf.setStyleClass(this.$ext, "disabled");
        else
            apf.setStyleClass(this.$ext, "", ["disabled"]);
    }

    // *** Dom Hooks *** //

    //@todo apf3.0
    this.addEventListener("AMLReparent", function(beforeNode, pNode, withinParent){
        if (!this.$amlLoaded)
            return;

        if (!withinParent && this.skinName != pNode.skinName) {
            //@todo for now, assuming dom garbage collection doesn't leak
            this.loadAml();
        }
    });

    // *** Events *** //

    this.$down = function(){
    
    };

    this.$up = function(){
   
        
        if (this.type == "radio")
            this.parentNode.select(this.group, this.value || this.caption);

        else if (this.type == "check") {
            this.setProperty("checked", !this.checked);
            //this.$handlePropSet("checked", !this.checked);
        }

        if (this.submenu) {
            this.$over(null, true);
            return;
        }

        this.parentNode.$hideTree = true;
        
        //@todo This statement makes the menu loose focus.
        if (!this.parentNode.sticky)
            this.parentNode.hide();//true not focus?/

        this.parentNode.dispatchEvent("itemclick", {
            value       : this.value || this.caption,
            relatedNode : this,
            checked     : this.checked,
            selected    : this.selected
        });

        //@todo Anim effect here?
        
        this.dispatchEvent("click", {
            xmlContext : (this.parentNode || 0).xmlReference,
            opener     : (this.parentNode || 0).opener
        });
        
        
    };

    this.$click = function(){
        
    };

    var timer;
    this.$out = function(e){
        if (apf.isChildOf(this.$ext, e.toElement || e.explicitOriginalTarget)
          || apf.isChildOf(this.$ext, e.srcElement || e.target))  //@todo test FF
            return;

        clearTimeout(timer);
        if (!this.submenu || this.$submenu(true)) {
            apf.setStyleClass(this.$ext, "", ['hover']);

            var sel = this.parentNode.$selected;
            if (sel && sel != this)
                apf.setStyleClass(sel.$ext, "", ["hover"]);

            this.parentNode.$selected = null;
        }
        
        
    };

    this.$over = function(e, force){
        function selectItem(el) {
            if (el.parentNode.$selected == el && e)
                return false;
    
            if (el.parentNode.$selected)
                apf.setStyleClass(el.parentNode.$selected.$ext, "", ["hover"]);
    
            apf.setStyleClass(el.$ext, "hover");
            el.parentNode.$selected = el;
            return true;
        }
        
        if (!selectItem(this))
            return;
        
        var opener = this.parentNode.opener;
        if (opener && opener.parentNode.$showingSubMenu)
            selectItem(opener);
        
        if (!force && (apf.isChildOf(this.$ext, e.toElement || e.explicitOriginalTarget)
          || apf.isChildOf(this.$ext, e.fromElement || e.target)))  //@todo test FF
            return;
        
        var _self = this, ps = this.parentNode.$showingSubMenu;
        if (ps && ps.name && ps.name == this.submenu) {
            this.parentNode.$selected = null;
            this.parentNode.$showingSubMenu = null;
            _self.$submenu();
            return;
        }
            
        clearTimeout(timer);
        
        
        function submenu(){
            if (ps && ps.visible) {
                ps.hide();
                
                if (_self.parentNode.$showingSubMenu == ps)
                    _self.parentNode.$showingSubMenu = null;
            }
            if (_self.submenu && (!_self.parentNode.opener 
              || _self.parentNode.opener.visible))
                _self.$submenu();
        }

        if (force)
            submenu();
        else {
            timer = $setTimeout(function(){
                submenu();
                timer = null;
            }, 210);
        }
    };

    this.$submenu = function(hide, force){
        if (!this.submenu)
            return true;

        var menu = self[this.submenu] || this.submenu;
        if (!menu) {
            

            return;
        }

        if (!hide) {
            //if (this.parentNode.showingSubMenu == this.submenu)
                //return;

            this.parentNode.$showingSubMenu = menu;

            var pos = apf.getAbsolutePosition(this.$ext, this.parentNode.$ext.offsetParent);
            menu.display(pos[0] + this.$ext.offsetWidth - 3,
                pos[1] + 3, true, this,
                this.parentNode.xmlReference, this.parentNode.$uniqueId);
            menu.setAttribute("zindex", (this.parentNode.zindex || this.parentNode.$ext.style.zIndex || 1) + 1);
        }
        else {
            if (menu.visible && !force) {
                return false;
            }
            
            if (this.parentNode.$showingSubMenu == menu)
                this.parentNode.$showingSubMenu = null;
            
            apf.setStyleClass(this.$ext, '', ['hover']);
            menu.hide();
            return true;
        }
    };

    // *** Init *** //
    
    this.$draw = function(isSkinSwitch){
        var p = this.parentNode;
        while (p.$canLeechSkin == "item")
            p = p.parentNode;
        
        if (p.hasFeature(apf.__MULTISELECT__)) {
            var _self = this;
            
            //@todo DOMNodeInserted should reset this
            //@todo DOMNodeRemoved should reset this
            if (!this.$hasSetSkinListener) {
                var f;
                this.parentNode.addEventListener("$skinchange", f = function(){
                    if (_self.$amlDestroyed) //@todo apf3.x
                        return;
                    
                    if (_self.$ext.parentNode)
                        this.$deInitNode(_self, _self.$ext);
    
                    var oInt = p == _self.parentNode ? p.$container : _self.parentNode.$container;
                    var node = oInt.lastChild;//@todo this should be more generic
                    p.$add(_self, _self.getAttribute(apf.xmldb.xmlIdTag) + "|" + this.$uniqueId, 
                        _self.parentNode, oInt != p.$container && oInt, null);
                    p.$fill();
                    
                    if (p.$isTreeArch) {
                        _self.$container = p.$getLayoutNode("item", "container", 
                           _self.$ext = node && node.nextSibling || oInt.firstChild);//@todo this should be more generic
                    }
                    else _self.$ext = node && node.nextSibling || oInt.firstChild;
                    
                    var ns = _self;
                    while((ns = ns.nextSibling) && ns.nodeType != 1);
        
                    if (!ns || ns.$canLeechSkin != "item")
                        p.dispatchEvent("afterload");
                });
                this.addEventListener("DOMNodeRemoved", function(e){
                    if (e.currentTarget == this)
                        this.parentNode.removeEventListener("$skinchange", f);
                });
                
                this.$hasSetSkinListener = true;
            }
            
            if (!p.$itemInited) {
                p.canrename = false; //@todo fix rename
                p.$removeClearMessage(); //@todo this should be more generic
                p.$itemInited = [p.getTraverseNodes, p.getFirstTraverseNode, p.getTraverseParent];
                
                p.getTraverseNodes = function(xmlNode){
                    return (xmlNode || p).getElementsByTagNameNS(apf.ns.apf, "item");
                }
                p.getFirstTraverseNode = function(xmlNode){
                    return (xmlNode || p).getElementsByTagNameNS(apf.ns.apf, "item")[0];
                }
                p.getTraverseParent = function(xmlNode){
                    return xmlNode && xmlNode.parentNode;
                }
                p.each = (this.prefix ? this.prefix + ":" : "") + "item";

                //@todo this is all an ugly hack (copied to baselist.js line 868)
                p.$preventDataLoad = true;//@todo apf3.0 add remove for this

                p.$initingModel = true;
                p.$setDynamicProperty("icon", "[@icon]");
                p.$setDynamicProperty("image", "[@image]");
                p.$setDynamicProperty("caption", "[label/text()|@caption|text()]");
                p.$setDynamicProperty("eachvalue", "[value/text()|@value|text()]");
                p.$canLoadDataAttr = false;
                
                if (!p.xmlRoot)
                    p.xmlRoot = p;
            }
            
            this.$loadAml = function(){
                //hack
                if (!this.getAttribute("caption"))
                    this.setAttribute("caption", this.caption);
                
                var oInt = p == this.parentNode ? p.$container : this.parentNode.$container;
                var node = oInt.lastChild;//@todo this should be more generic
                if (!p.documentId)
                    p.documentId = apf.xmldb.getXmlDocId(this);
                p.$add(this, apf.xmldb.nodeConnect(p.documentId, this, null, p), 
                    this.parentNode, oInt != p.$container && oInt, null);
                p.$fill();
    
                if (p.$isTreeArch) {
                    this.$container = p.$getLayoutNode("item", "container", 
                       this.$ext = node && node.nextSibling || oInt.firstChild);//@todo this should be more generic
                }
                else this.$ext = node && node.nextSibling || oInt.firstChild;
                
                var ns = this;
                while((ns = ns.nextSibling) && ns.nodeType != 1);
    
                if (!ns || ns.$canLeechSkin != "item") {
                    p.dispatchEvent("afterload");
                    if (p.autoselect)
                        p.$selectDefault(this.parentNode);
                }
            }
            
            return;
        }
        
        this.$ext = this.$getExternal(this.$isLeechingSkin
          ? "item" //this.type 
          : "main", null, function($ext){
            var o = 'var o = apf.lookup(' + this.$uniqueId + '); if (!o || o.disabled) return; o';
            $ext.setAttribute("onmouseup",   o + '.$up(event)');
            $ext.setAttribute("onmousemove", o + '.$over(event)');
            $ext.setAttribute("onmouseout",  o + '.$out(event)');
            $ext.setAttribute("onmousedown", o + '.$down()');
            $ext.setAttribute("onclick",     o + '.$click()');
        });
        // getExternal always appends to the end which is wrong when drawing is delayed
        var next = this.nextSibling && this.nextSibling.$ext;
        if (next && next.parentNode === this.$ext.parentNode && this.$ext.nextSibling !== next) {
            next.parentNode.insertBefore(this.$ext, next);
        }

        var _self = this;
        apf.addListener(this.$ext, "mouseover", function(e) {
            if (!_self.disabled)
                _self.dispatchEvent("mouseover", {htmlEvent: e});
        });
        
        apf.addListener(this.$ext, "mouseout", function(e) {
            if (!_self.disabled)
                _self.dispatchEvent("mouseout", {htmlEvent: e});
        });
        
        /*p.$getNewContext("item");
        var elItem = p.$getLayoutNode("item");*/
        
        //@todo if not elItem try using own skin
        
        //this.$ext   = apf.insertHtmlNode(elItem, this.parentNode.$container);
        this.$caption = this.$getLayoutNode("item", "caption", this.$ext)
        this.$icon    = this.$getLayoutNode("item", "icon", this.$ext);
        this.$hotkey  = this.$getLayoutNode("item", "hotkey", this.$ext);

        if (!isSkinSwitch && this.nextSibling && this.nextSibling.$ext 
            && this.nextSibling.$ext.parentNode == this.$ext.parentNode) {
            this.$ext.parentNode.insertBefore(this.$ext, this.nextSibling.$ext);
        }
    };
    
    /*
     * @private
     */
    this.addEventListener("DOMNodeInsertedIntoDocument", function(e){
        //var x = this.$aml;

        //this.skinName    = this.parentNode.skinName;
        var isSkinSwitch = this.$ext ? true : false;
        if (isSkinSwitch) {
            if (typeof this.checked !== "undefined")
                this.$handlePropSet("checked", this.checked);
            else if (typeof this.selected !== "undefined")
                this.$handlePropSet("selected", this.selected);

            if (this.disabled)
                this.$handlePropSet("disabled", this.disabled);

            if (this.caption)
                this.$handlePropSet("caption", this.caption);
        }
    });
}).call(apf.item.prototype = new apf.Presentation());

//apf.aml.setElement("radio", apf.radio);
//apf.aml.setElement("check", apf.check);
apf.aml.setElement("item",  apf.item);

};

});