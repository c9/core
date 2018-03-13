define(["require", "module", "exports", "./lib/menu/menu", "./lib/crypto",
    "./lib/page", "./lib/dropdown", "./lib/splitbox", "./lib/flexbox"],
(function(require, module, exports) {
    main.consumes = ["ext"];
    main.provides = ["apf"]
    return main;

    function main(options, imports, register) {
        imports.ext.on("register", function(e) {
            apf.nameserver.register("all", e.plugin.name, e.plugin)
        });
        imports.ext.on("unregister", function(e) {
            apf.nameserver.remove("all", e.plugin)
            delete apf.nameserver.lookup.all[e.plugin.name];
        });








/**
 * @class apf
 * The Ajax.org Platform.
 *
 * @author    Ruben Daniels (ruben AT ajax DOT org)
 * @version   3.0
 * @default_private
 *
 */
/**
 * @event domready      Fires when the browsers' DOM is ready to be manipulated.
 */
/** 
 * @event movefocus         Fires when the focus moves from one element to another.
 * @param {apf.AmlElement} toElement The element that receives the focus.
 */
/** 
 * @event exit              Fires when the application wants to exit.
 * @cancelable  Prevents the application from exiting. The return value of the event object is displayed in a popup, asking the user for permission.
 */
/** 
 * @event keyup         Fires when the user stops pressing a key (by lifting up)
 * @cancelable Prevents the keypress.
 * @param {Object} e An object containing the following properties:
 *  - keyCode ([[Number]]): The character code of the pressed key.
 *  - ctrlKey ([[Boolean]]): Whether the [[keys: Ctrl]] key was pressed.
 *  - shiftKey ([[Boolean]]): Whether the [[keys: Shift]] key was pressed.
 *  - altKey ([[Boolean]]): Whether the [[keys: Alt]] key was pressed.
 *  - htmlEvent ([[Object]]): The html event object.
 */
/** 
 * @event mousescroll   Fires when the user scrolls the mouse
 * @cancelable Prevents the container from scrolling
 * @param {Object} e An object containing the following properties:
 *  - htmlEvent ([[Object]]): The HTML event object
 *  - amlElement ([[apf.AmlElement]]): The element which was clicked.
 *  - delta ([[Number]]): The scroll impulse.
 */
/** 
 * @event hotkey        Fires when the user presses a hotkey
 * @bubbles
 * @cancelable Prevents the default hotkey behavior.
 * @param {Object} e An object containing the following properties:
 *  - keyCode ([[Number]]): The character code of the pressed key.
 *  - ctrlKey ([[Boolean]]): Whether the [[keys: Ctrl]] key was pressed.
 *  - shiftKey ([[Boolean]]): Whether the [[keys: Shift]] key was pressed.
 *  - altKey ([[Boolean]]): Whether the [[keys: Alt]] key was pressed.
 *  - htmlEvent ([[Object]]): The html event object.
 */
/** 
 * @event keydown       Fires when the user presses down on a key
 * @bubbles
 * @cancelable Prevents the default hotkey behavior.
 * @param {Object} e An object containing the following properties:
 *  - keyCode ([[Number]]): The character code of the pressed key.
 *  - ctrlKey ([[Boolean]]): Whether the [[keys: Ctrl]] key was pressed.
 *  - shiftKey ([[Boolean]]): Whether the [[keys: Shift]] key was pressed.
 *  - altKey ([[Boolean]]): Whether the [[keys: Alt]] key was pressed.
 *  - htmlEvent ([[Object]]): The html event object.
 */
/** 
 * @event mousedown     Fires when the user presses a mouse button
 * @param {Object} e An object containing the following properties:
 *  - htmlEvent ([[Object]]): The HTML event object
 *  - amlElement ([[apf.AmlElement]]): The element which was clicked.
 */
/** 
 * @event onbeforeprint Fires before the application prints.
 */
/** 
 * @event onafterprint  Fires after the application prints.
 */
/** 
 * @event load          Fires after the application is loaded.
 */
var apf = window.apf = {
    getPlugin: function(name) {
        return apf.nameserver.get("all", name);
    },
    
    //AML nodeFunc constants
    /**
     * A constant for the hidden AML element.
     * @type {Number}
     */
    NODE_HIDDEN: 101,
    /**
     * A constant for a visible AML element.
     * @type {Number}
     */
    NODE_VISIBLE: 102,

    /**
     * A constant for specifying that a widget is using only the keyboard to receive focus.
     * @type {Number}
     * @see apf.GuiElement@focus
     */
    KEYBOARD: 2,
    /**
     * A constant for specifying that a widget is using the keyboard or the mouse to receive focus.
     * @type {Boolean}
     * @see apf.GuiElement@focus
     */
    KEYBOARD_MOUSE: true,
    /**
     * A constant for specifying that a widget is a menu
     * @type {Number}
     */
    MENU: 3,

    includeStack: [],
    initialized: false,
    AppModules: [],
    
    /**
     * Specifies whether APF has started loading scripts and started the init process.
     * @type {Boolean}
     */
    started: false,
    /**
     * The namespace for all crypto libraries included with Ajax.org Platform.
     * @type {Object}
     */
    crypto: {}, //namespace
    config: {},
    
    /**
     * Contains several known and often used namespace URI's.
     * @type {Object}
     * @private
     */
    ns: {
        apf: "http://ajax.org/2005/aml",
        aml: "http://ajax.org/2005/aml",
        xsd: "http://www.w3.org/2001/XMLSchema",
        xhtml: "http://www.w3.org/1999/xhtml",
        xslt: "http://www.w3.org/1999/XSL/Transform",
        xforms: "http://www.w3.org/2002/xforms",
        ev: "http://www.w3.org/2001/xml-events"
    },
    
    /**
     * @private
     */
    browserDetect: function(){
        if (this.$bdetect)
            return;
        
        // remove non-standard window.event
        try { delete window.event } catch(e) {}
        
        /* Browser -  platform and feature detection, based on prototype's and mootools 1.3.
         *
         * Major browser/engines flags
         *
         * 'Browser.name' reports the name of the Browser as string, identical to the property names of the following Boolean values:
         *  - Browser.ie - (boolean) True if the current browser is Internet Explorer.
         *  - Browser.firefox - (boolean) True if the current browser is Firefox.
         *  - Browser.safari - (boolean) True if the current browser is Safari.
         *  - Browser.chrome - (boolean) True if the current browser is Chrome.
         *  - Browser.opera - (boolean) True if the current browser is Opera.
         *
         * In addition to one of the above properties a second property consisting of the name
         * and the major version is provided ('Browser.ie6', 'Browser.chrome15', ...).
         * If 'Browser.chrome' is True, all other possible properties, like 'Browser.firefox', 'Browser.ie', ... , will be undefined.
         *
         * 'Browser.version' reports the version of the Browser as number.
         *
         * 'Browser.Plaform' reports the platform name:
         *  - Browser.Platform.mac - (boolean) True if the platform is Mac.
         *  - Browser.Platform.win - (boolean) True if the platform is Windows.
         *  - Browser.Platform.linux - (boolean) True if the platform is Linux.
         *  - Browser.Platform.ios - (boolean) True if the platform is iOS.
         *  - Browser.Platform.android - (boolean) True if the platform is Android
         *  - Browser.Platform.webos - (boolean) True if the platform is WebOS
         *  - Browser.Platform.other - (boolean) True if the platform is neither Mac, Windows, Linux, Android, WebOS nor iOS.
         *  - Browser.Platform.name - (string) The name of the platform.
         */
        var Browser = this.$bdetect = (function() {
            
            var ua = navigator.userAgent.toLowerCase(),
                platform = navigator.platform.toLowerCase(),
                UA = ua.match(/(opera|ie|firefox|chrome|version)[\s\/:]([\w\d\.]+)?.*?(safari|version[\s\/:]([\w\d\.]+)|$)/) || [null, 'unknown', 0];
            if (ua.match(/Trident\/.*rv:([0-9]{1,}[\.0-9]{0,})/))
                UA = ["ie", null, Regexp.$2];
            var mode = UA[1] == 'ie' && document.documentMode;

            var b = {

                name: (UA[1] == 'version') ? UA[3] : UA[1],

                version: mode || parseFloat((UA[1] == 'opera' && UA[4]) ? UA[4] : UA[2]),

                Platform: {
                    name: ua.match(/ip(?:ad|od|hone)/) ? 'ios' : (ua.match(/(?:webos|android)/) || platform.match(/mac|win|linux/) || ['other'])[0]
                },
            };

            b[b.name] = true;
            b[b.name + parseInt(b.version, 10)] = true;
            b.Platform[b.Platform.name] = true;
            
            return b;
            
        })();

        var UA = navigator.userAgent.toLowerCase();
        
        this.isGecko = !!Browser.firefox;
        this.isChrome = !!Browser.chrome;
        this.isSafari = !!Browser.safari;
        this.isSafariOld = Browser.safari && Browser.version === 2.4;
        this.isWebkit = this.isSafari || this.isChrome || UA.indexOf("konqueror") != -1;
        this.isOpera = !!Browser.opera;
        this.isIE = !!Browser.ie;
        
        this.isWin = Browser.Platform.win;
        this.isMac = Browser.Platform.mac;
        this.isLinux = Browser.Platform.linux;
        this.isIphone = Browser.Platform.ios || UA.indexOf("aspen simulator") != -1;
        
        this.versionWebkit = this.isWebkit ? Browser.version : null;
        this.versionGecko = this.isGecko ? Browser.version : null;
        this.versionFF = this.isGecko ? Browser.version : null;
        this.versionSafari = this.isSafari ? Browser.version : null;
        this.versionChrome = this.isChrome ? Browser.version : null;
        this.versionOpera = this.isOpera ? Browser.version : null;
    },

    /**
     * @private
     */
    setCompatFlags: function(){
        apf.isIE11 = (!apf.isGecko && !apf.isWebkit && !apf.isOpera && !apf.isIE);
       
        this.hasSingleResizeEvent = !apf.isIE;
        this.hasSingleRszEvent = !apf.isIE;

        this.hasAutocompleteXulBug = apf.isGecko;
        this.mouseEventBuffer = 6;
        this.hasComputedStyle = typeof document.defaultView != "undefined"
                                           && typeof document.defaultView.getComputedStyle != "undefined";
        this.w3cRange = Boolean(window["getSelection"]);
        var t = document.createElement("div");
        this.hasContentEditable = (typeof t.contentEditable == "string"
                                       || typeof t.contentEditable == "boolean");
        
        // use display: flex; instead of old version http://css-tricks.com/snippets/css/a-guide-to-flexbox/
        this.hasFlex = "flexFlow" in  t.style;
        if (!this.hasFlex && apf.isWebkit) {
            // http://robertnyman.com/2010/12/02/css3-flexible-box-layout-module-aka-flex-box-introduction-and-demostest-cases/
            t.style.display = "-webkit-box";
            this.hasFlexibleBox = t.style.display == "-webkit-box";
        } else {
            this.hasFlexibleBox = this.hasFlex;
        }
        
        // Try transform first for forward compatibility
        var props = ["transform", "OTransform", "KhtmlTransform", "MozTransform", "WebkitTransform"],
            props2 = ["transition", "OTransition", "KhtmlTransition", "MozTransition", "WebkitTransition"],
            prefixR = ["", "O", "Khtml", "Moz", "Webkit"],
            prefixC = ["", "o-", "khtml-", "moz-", "webkit-"],
            events = ["transitionend", "transitionend", "transitionend", "transitionend", "webkitTransitionEnd"],
            i = 0,
            l = 5;
        this.supportCSSAnim = false;
        this.supportCSSTransition = false;
        for (; i < l && !this.supportCSSAnim; ++i) {
            if (typeof t.style[props[i]] == "undefined") continue;
            this.supportCSSAnim = props[i];
            this.supportCSSTransition = props2[i];
            this.runtimeStylePrefix = prefixR[i];
            this.classNamePrefix = prefixC[i];
            this.cssAnimEvent = events[i];
        }
        t = null;

        this.animSteps = 1;
        this.animInterval = 1;

        this.CSSPREFIX = apf.isGecko ? "Moz" : (apf.isWebkit ? "webkit" : "");
        this.CSSPREFIX2 = apf.isGecko ? "-moz" : (apf.isWebkit ? "-webkit" : "");
        
        if (apf.hasFlex) {
            apf.CSS_FLEX_PROP = "flex";
            apf.CSS_DISPLAY_FLEX = "flex";
        } else {
            apf.CSS_FLEX_PROP = apf.CSSPREFIX + "BoxFlex";
            apf.CSS_DISPLAY_FLEX = apf.CSSPREFIX2 + "-box";
        }
        
        this.percentageMatch = new RegExp();
        this.percentageMatch.compile("([\\-\\d\\.]+)\\%", "g");
    },

    

    /**
     * Extends an object with one or more other objects by copying all of its
     * properties.
     * @param {Object} dest The destination object
     * @param {Object} src The object that is copied from
     * @return {Object} The destination object
     */
    extend: function(dest, src) {
        var prop, i, x = !dest.notNull;
        if (arguments.length == 2) {
            for (prop in src) {
                if (x || src[prop])
                    dest[prop] = src[prop];
            }
            return dest;
        }

        for (i = 1; i < arguments.length; i++) {
            src = arguments[i];
            for (prop in src) {
                if (x || src[prop])
                    dest[prop] = src[prop];
            }
        }
        return dest;
    },
    
    $extend: function(dest, src) {
        for (var prop in src) {
            dest[prop] = src[prop];
        }
        return dest;
    },
    
    /**
     * Starts the application.
     * @private
     */
    start: function(){
        this.started = true;
        var sHref = location.href.split("#")[0].split("?")[0];

        //Set Variables
        this.host = location.hostname && sHref.replace(/(\/\/[^\/]*)\/.*$/, "$1");
        this.hostPath = sHref.replace(/\/[^\/]*$/, "") + "/";
        
        this.setCompatFlags();

        if (apf.onstart && apf.onstart() === false)
            return false;

        

        //Load Browser Specific Code
        
        if (apf.isWebkit) apf.runWebkit();
        else if (this.isGecko) apf.runGecko();
        else if (!this.isIE11) apf.runIE(); // ie11
        
        
        this.started = true;

        this.root = true;
        
    },

    nsqueue: {},

    all: [],

    /**
    * This method implements all the properties and methods to this object from another class
    * @param {Function}    classRef    The class reference to implement
    * @private
    */
    implement: function(classRef) {
        // for speed, we check for the most common  case first
        if (arguments.length == 1) {
            
            classRef.call(this);//classRef
        }
        else {
            for (var a, i = 0, l = arguments.length; i < l; i++) {
                a = arguments[i];
                
                arguments[i].call(this);//classRef
            }
        }

        return this;
    },

    /**
     * @private
     */
    uniqueHtmlIds: 0,

    /**
     * Adds a unique id attribute to an HTML element.
     * @param {HTMLElement} oHtml the object getting the attribute.
     */
    setUniqueHtmlId: function(oHtml) {
        var id;
        oHtml.setAttribute("id", id = "q" + this.uniqueHtmlIds++);
        return id;
    },

    /**
     * Retrieves a new unique id
     * @returns {Number} A number representing the new ID.
     */
    getUniqueId: function(){
        return this.uniqueHtmlIds++;
    },

    /**
     * Finds an AML element based on its unique id.
     * @param {Number} uniqueId The unique id to search on.
     * @returns {apf.AmlElement} The returned element.
     */
    lookup: function(uniqueId) {
        return this.all[uniqueId];
    },

    /**
     * Searches in the HTML tree from a certain point to find the
     * AML element that is responsible for rendering a specific html
     * element.
     * @param {HTMLElement} oHtml The html context to start the search from.
     * @returns {apf.AmlElement} The parent HTML element
     */
    findHost: function(o) {
        while (o && o.parentNode) { //!o.host && 
            try {
                if ((o.host || o.host === false) && typeof o.host != "string")
                    return o.host;
            }
            catch (e) {}
            
            o = o.parentNode;
        }
        
        return null;
    },

    /**
     * Formats an Ajax.org Platform error message.
     * @param {Number}      number      The number of the error. This can be used to look up more information about the error.
     * @param {apf.AmlElement}  control     The aml element that will throw the error.
     * @param {String}      process     The action that was being executed.
     * @param {String}      message     The actual error message.
     * @param {XMLElement}  amlContext  The XML relevant to the error. For instance, this could be a piece of Ajax.org Markup Language XML.
     */
    formatErrorString: function(number, control, process, message, amlContext, outputname, output) {
        
        apf.lastErrorMessage = message;
        return message;
        
    },

    /* Init */
    
    /**
     * Returns an absolute url based on url.
     * @param {String} base The start of the URL where relative URLs work.
     * @param {String} url  The URL to transform.
     * @return {String} The absolute URL.
     */
    getAbsolutePath: function(base, url) {
        return url && url.charAt(0) == "/"
            ? url
            : (!url || !base || url.match(/^\w+\:\/\//) ? url : base.replace(/\/$/, "") + "/" + url.replace(/^\//, ""));
    },
    

    namespaces: {},
    setNamespace: function(namespaceURI, oNamespace) {
        this.namespaces[namespaceURI] = oNamespace;
        oNamespace.namespaceURI = namespaceURI;
    },

    /**
     * @private
     */
    initialize: function() {
        apf.window.init();
    },

    fireEvent: function(el, type, e, capture) {
        if (el.dispatchEvent)
            el.dispatchEvent(type, e, capture);
        else
            el.fireEvent("on" + type, e);
    },
    
    addListener: function(el, type, fn, capture) {
        if (el.addEventListener)
            el.addEventListener(type, fn, capture || false);
        else if (el.attachEvent)
            el.attachEvent("on" + type, fn);
        return this;
    },
    
    removeListener: function(el, type, fn, capture) {
        if (el.removeEventListener)
            el.removeEventListener(type, fn, capture || false);
        else if (el.detachEvent)
            el.detachEvent("on" + type, fn);
        return this;
    },

    stopEvent: function(e) {
        this.stopPropagation(e).preventDefault(e);
        return false;
    },

    stopPropagation: function(e) {
        if (e.stopPropagation)
            e.stopPropagation();
        else
            e.cancelBubble = true;
        return this;
    },

    preventDefault: function(e) {
        if (e.preventDefault)
            e.preventDefault();
        else
            e.returnValue = false;
        return this;
    },

    /* Destroy */

    /**
     * Unloads the aml application.
     */
    unload: function(exclude) {
        
    }
};

/*
 * Replacement for getElementsByTagNameNS because some browsers don't support
 * this call yet.
 */
var $xmlns = function(xmlNode, tag, xmlns, prefix) {
    return xmlNode.querySelectorAll(tag) || [];
};

var $setTimeout = setTimeout;
var $setInterval = setInterval;

apf.setTimeout = function(f, t) {
    apf.$eventDepth++;
    return $setTimeout(function(){
        f();
        
        if (--apf.$eventDepth == 0)
            apf.queue.empty();
    }, t);
}

document.documentElement.className += " has_apf";

apf.browserDetect();


apf.buildDom = function buildDom(arr, parent) {
    if (typeof arr == "string" && arr) {
        var txt = document.createTextNode(arr);
        if (parent)
            parent.appendChild(txt);
        return txt;
    }
    
    if (!Array.isArray(arr))
        return arr;
    if (typeof arr[0] != "string" || !arr[0]) {
        var els = [];
        for (var i = 0; i < arr.length; i++) {
            var ch = buildDom(arr[i], parent);
            ch && els.push(ch);
        }
        return els;
    }
    
    var el = document.createElement(arr[0]);
    var options = arr[1];
    var childIndex = 1;
    if (options && typeof options == "object" && !Array.isArray(options)) {
        childIndex = 2;
        Object.keys(options).forEach(function(n) {
            var val = options[n];
            if (n == "class") {
                el.className = Array.isArray(val) ? val.join(" ") : val;
            } 
            else if (typeof val == "function")
                el[n] = val;
            else    
                el.setAttribute(n, val);
        });
    }
    for (var i = childIndex; i < arr.length; i++)
        buildDom(arr[i], el);
    if (parent)
        parent.appendChild(el);
    return el;
};



/**
 * All elements that implemented this {@link term.baseclass baseclass} have
 * {@link term.propertybinding property binding},
 * event handling and constructor & destructor hooks. The event system is
 * implemented following the W3C specification, similar to the
 * {@link http://en.wikipedia.org/wiki/DOM_Events event system of the HTML DOM}.
 *
 * @class apf.Class
 *
 * @baseclass
 * @author      Ruben Daniels (ruben AT ajax DOT org)
 * @version     %I%, %G%
 * @since       0.8
 */

/**
 * @event propertychange Fires when a property changes.
 * @param {Object} e An object containing the following properties:
 * - name ([[String]]): The name of the changed property
 * - originalvalue (`Mixed`): The value it had before the change
 * - value (`Mixed`): The value it has after the change
 *
 */
apf.Class = function(){};

apf.Class.prototype = new (function(){
    // privates
    var FUN = "function",
        OBJ = "object",
        UNDEF = "undefined",
        SEL = "model", //selected|selection|properties|
        PROP = "prop.",
        MODEL = "model",
        VALUE = "value";

    this.$regbase = 0;
    /**
     * Tests whether this object has implemented a {@link term.baseclass baseclass}.
     * @param {Number} test The unique number of the {@link term.baseclass baseclass}.
     */
    this.hasFeature = function(test) {
        return this.$regbase & test;
    };

    this.$initStack = [];
    this.$bufferEvents = [];
    this.$init = function(callback, nodeFunc, struct) {
        if (typeof callback == FUN || callback === true) {
            this.$bufferEvents = this.$bufferEvents.slice();

            if (callback === true)
                return this;

            this.$initStack = this.$initStack.slice(); //Our own private stack
            this.$initStack.push(callback);

            return this;
        }

        this.addEventListener = realAddEventListener;

        if (this.nodeType != 2) //small little hack
            this.$uniqueId = apf.all.push(this) - 1;

        this.$captureStack = {};
        this.$eventsStack = {};
        this.$funcHandlers = {};

        var i = 0, l = this.$initStack.length;
        for (; i < l; i++)
            this.$initStack[i].apply(this, arguments);

        for (i = 0, l = this.$bufferEvents.length; i < l; i++)
            this.addEventListener.apply(this, this.$bufferEvents[i]);

        delete this.$initStack;
        delete this.$bufferEvents;

        if (struct && (struct.htmlNode || this.nodeFunc == apf.NODE_HIDDEN)) {
            this.$pHtmlNode = struct.htmlNode;
                if (this.$onInsertedIntoDocument)
                    this.$onInsertedIntoDocument();
                apf.queue.empty();
        }

        return this;
    };

    this.implement = apf.implement;

    // **** Property Binding **** //

    this.$handlePropSet = function(prop, value) {
        this[prop] = value;
    };

    
    

    /**
     * Gets an array of properties for this element which can be bound.
     * @returns {Array}
     */
    this.getAvailableProperties = function(){
        return this.$supportedProperties.slice();
    };

    /**
     * Sets the value of a property of this element.
     *
     * Note: The value is the only thing set. Dynamic properties remain bound and the
     * value will be overridden.
     *
     * @param  {String}  prop        The name of the property of this element to
     *                               set using a dynamic rule.
     * @param  {String}  value       The value of the property to set.
     * @param  {Boolean} [forceOnMe] Specifies whether the property should be set even when
     *                               it has the same value.
     */
    this.setProperty = function(prop, value, forceOnMe, setAttr, inherited) {
        var s, r, arr, e, i, l,
            oldvalue = this[prop],
            eventName = PROP + prop;//@todo prop event should be called too;

        //Try catch here, because comparison of a string with xmlnode gives and error in IE
        try{
            var isChanged = (typeof value == OBJ)
                ? value != (typeof oldvalue == OBJ ? oldvalue : null)
                : (this.$booleanProperties && this.$booleanProperties[prop]
                    ? oldvalue != apf.isTrue(value)
                    : String(oldvalue) !== String(value));
        } catch (e) {
            var isChanged = true;
        }

        //Check if property has changed
        if (isChanged) {
            if (this.$handlePropSet(prop, value, forceOnMe) === false)
                return;

            value = this[prop];
        }

        //Optimized event calling
        if ((arr = this.$eventsStack[eventName]) && isChanged) {
            if (this.dispatchEvent(eventName, {
                prop: prop,
                value: value,
                oldvalue: oldvalue,
                changed: isChanged
            }) === false) {
                e.returnValue = false;
            }
        }

        
        /*
            States:
                    -1 Set
             undefined Pass through
                     2 Inherited
                     3 Semi-inherited
                    10 Dynamic property
        */
        //@todo this whole section should be about attribute inheritance and moved
        //      to AmlElement
        if ((aci || (aci = apf.config.$inheritProperties))[prop]) {
            //@todo this is actually wrong. It should be about removing attributes.
            var resetting = value === "" || typeof value == "undefined";
            if (inherited != 10 && !value) {
                delete this.$inheritProperties[prop];
                if (this.$setInheritedAttribute && this.$setInheritedAttribute(prop))
                    return;
            }
            else if (inherited != 10) { //Keep the current setting (for dynamic properties)
                this.$inheritProperties[prop] = inherited || -1;
            }

            //cancelable, needed for transactions
            //@todo the check on $amlLoaded is not as optimized as can be because $loadAml is not called yet
            if (this.$amlLoaded && (!e || e.returnValue !== false) && this.childNodes) {
                var inheritType = aci[prop];

                (function recur(nodes) {
                    var i, l, node, n;
                    for (i = 0, l = nodes.length; i < l; i++) {
                        node = nodes[i];
                        if (node.nodeType != 1 && node.nodeType != 7)
                            continue;

                        //Pass through
                        n = node.$inheritProperties[prop];
                        if (inheritType == 1 && !n)
                            recur(node.childNodes);

                        //Set inherited property
                        //@todo why are dynamic properties overwritten??
                        else if (!(n < 0)) {//Will also pass through undefined - but why??? @todo seems inefficient
                            if (n == 3 || inherited == 3) { //Because when parent sets semi-inh. prop the value can be the same
                                var sameValue = node[prop];
                                node[prop] = null;
                            }
                            node.setProperty(prop, n != 3
                                ? value
                                : sameValue, false, false, n || 2); //This is recursive already
                        }
                    }
                })(this.childNodes);
            }
        }
        

        return value;
    };
    var aci;

    /**
     * Gets the value of a property of this element.
     *
     * @param  {String}  prop   The name of the property of this element for which to get the value.
     */
    this.getProperty = function(prop) {
        return this[prop];
    };

    // *** Event Handling ****/

    apf.$eventDepth = 0;
    this.$eventDepth = 0;

    /**
     * Calls all functions that are registered as listeners for an event.
     *
     * @param  {String}  eventName  The name of the event to dispatch.
     * @param  {Object}  [options]  The properties of the event object that will be created and passed through. These can be:
     *  - bubbles ([[Boolean]]): Specifies whether the event should bubble up to it's parent
     *  - captureOnly ([[Boolean]]): Specifies whether only the captured event handlers should be executed
     * @return {Mixed} return value of the event
     */
    this.dispatchEvent = function(eventName, options, e) {
        var arr, result, rValue, i, l;
        
        if (!options)
            options = {};
            
        if (!options.name)
            options.name = eventName;

        apf.$eventDepth++;
        this.$eventDepth++;

        e = options && options.name ? options : e;
            
            //@todo rewrite this and all dependencies to match w3c
            if ((!e || !e.currentTarget) && (!options || !options.currentTarget)) {
                options.currentTarget = this;

                //Capture support
                if (arr = this.$captureStack[eventName]) {
                    for (i = arr.length; i--;) {
                        rValue = arr[i].call(this, e || (e = new apf.AmlEvent(eventName, options)));
                        if (typeof rValue != UNDEF)
                            result = rValue;
                    }
                }
            }

            //@todo this should be the bubble point

            if (options && options.captureOnly) {
                return e && typeof e.returnValue != UNDEF ? e.returnValue : result;
            }
            else {
                if (this["on" + eventName]) {
                    result = this["on" + eventName].call(this, e || (e = options)); 
                }

                if (arr = this.$eventsStack[eventName]) {
                    for (i = arr.length; i--;) {
                        if (!arr[i]) continue;
                        rValue = arr[i].call(this, e || (e = options));
                        if (typeof rValue != UNDEF)
                            result = rValue;
                    }
                }
            }
        
        if ((e && e.bubbles && !e.cancelBubble || !e && options && options.bubbles) && this != apf) {
            rValue = (this.parentNode || this.ownerElement || apf).dispatchEvent(eventName, options, e);

            if (typeof rValue != UNDEF)
                result = rValue;
        }
        
        if (--apf.$eventDepth == 0 && this.ownerDocument && apf.queue) {
            apf.queue.empty();
        }

        this.$eventDepth--;

        return e && typeof e.returnValue != UNDEF ? e.returnValue : result;
    };

    /**
     * Adds a function to be called when a event is called.
     *
     * @param  {String}   eventName The name of the event for which to register
     *                              a function.
     * @param  {Function} callback  The code to be called when an event is dispatched.
     */
    this.addEventListener = function(a, b, c) {
        this.$bufferEvents.push([a,b,c]);
    };

    var realAddEventListener = function(eventName, callback, useCapture) {
        if (eventName[0] == "o" && eventName[1] == "n")
            eventName = eventName.substr(2);

        var stack = useCapture ? this.$captureStack : this.$eventsStack;
        var s = stack[eventName]
        if (!s)
            s = stack[eventName] = [];

        if (s.indexOf(callback) > -1)
            return;

        s.push(callback);

        var f;
        if (f = this.$eventsStack["$event." + eventName])
            f[0].call(this, callback);
    };

    /**
     * Removes a function registered for an event.
     *
     * @param  {String}   eventName The name of the event for which to unregister
     *                              a function.
     * @param  {Function} callback  The function to be removed from the event stack.
     */
    this.removeEventListener = function(eventName, callback, useCapture) {
        var stack = (useCapture ? this.$captureStack : this.$eventsStack)[eventName];

        //@todo is this the best way?
        if (stack) {
            if (this.$eventDepth)
                stack = (useCapture ? this.$captureStack : this.$eventsStack)[eventName] = stack.slice()

            stack.remove(callback);
            if (!stack.length)
                delete (useCapture ? this.$captureStack : this.$eventsStack)[eventName];
        }
    };

    /**
     * Checks if there is an event listener specified for the event.
     *
     * @param  {String}  eventName  The name of the event to check.
     * @return {Boolean} Specifies whether the event has listeners
     */
    this.hasEventListener = function(eventName) {
        return (this.$eventsStack[eventName] && this.$eventsStack[eventName].length > 0);
    };

    /**
     * The destructor of a Class.
     * Calls all the destructor functions, and removes all memory leaking references.
     * This function is called when exiting the application or closing the window.
     * @param {Boolean} deep whether the children of this element should be destroyed.
     * @param {Boolean} [clean]
     */
    this.destroy = function(deep, clean) {
        //Remove from apf.all
        if (typeof this.$uniqueId == UNDEF && this.nodeType != 2)
            return;

        this.$amlLoaded = false;
        this.$amlDestroyed = true;

        if (this.$destroy)
            this.$destroy();

        this.dispatchEvent("DOMNodeRemoved", {
            relatedNode: this.parentNode,
            bubbles: true
        });
        this.dispatchEvent("DOMNodeRemovedFromDocument");

        apf.all[this.$uniqueId] = undefined;

        // != 2 && this.nodeType != 3
        if (!this.nodeFunc && !this.nodeType) { //If this is not a AmlNode, we're done.
            //Remove id from global js space
            try {
                if (this.id || this.name)
                    self[this.id || this.name] = null;
            }
            catch (ex) {}
            return;
        }

        if (this.$ext && !this.$ext.isNative) { // && this.$ext.nodeType == 1
            if (this.nodeType == 1 && this.localName != "a")
                this.$ext.oncontextmenu = this.$ext.host = null;
            if (clean) {
                if (this.localName != "collection" && this.$ext.parentNode)
                    this.$ext.parentNode.removeChild(this.$ext);
            }
        }
        if (this.$int && !this.$int.isNative && this.$int.nodeType == 1 && this.localName != "a")
            this.$int.host = null;

        //if (this.$aml && this.$aml.parentNode)
            //this.$aml.parentNode.removeChild(this.$aml);
        this.$aml = null;

        //Clear all children too
        if (deep && this.childNodes) {
            var nodes = this.childNodes;
            for (i = nodes.length - 1; i >= 0; i--) {
                if (nodes[i].destroy)
                    nodes[i].destroy(true, clean && this.localName == "collection");
            }
            this.childNodes = null;
        }

        //Remove from DOM tree if we are still connected
        if (this.parentNode && this.removeNode)
            this.removeNode();
        else if (this.ownerElement && !this.ownerElement.$amlDestroyed)
            this.ownerElement.removeAttribute(this.name);

        //Remove from focus list - Should be in AmlNode
        
        if (this.$focussable && this.focussable)
            apf.window.$removeFocus(this);
        

        
        //Remove dynamic properties
        for (var prop in this.$funcHandlers) {
            var f = this.$funcHandlers[prop];
            //Remove any bounds if relevant
            if (f && f.amlNode) {
                f.amlNode.removeEventListener(PROP + f.prop, f.handler);
            }
        }
        

        if (this.attributes) {
            var attr = this.attributes;
            var keys = Object.keys(attr)
            for (var i = attr.length - 1; i >= 0; i--) {
                
                attr[keys[i]].destroy();
            }
        }

        

        //Remove id from global js space
        try {
            if (this.id || this.name)
                delete self[this.id || this.name];
        }
        catch (ex) {}

        this.$eventsStack = {};
        this.$captureStack = {};
        this.$funcHandlers = {};

        if (this.$bufferEvents) {
            for (var i = this.$bufferEvents.length - 1; i >= 0; i--)
                this.$bufferEvents = null;
        }

        
        apf.nameserver.remove(this.localName, this);
        
    };
    
    // Before we have Proxy Objects, we'll extend the apf objects with the needed api
    this.on = function() {
        this.addEventListener.apply(this, arguments);
    }
    this.once = function(name, listener) {
        var _self = this;
        function callback() {
            listener.apply(this, arguments);
            _self.removeEventListener(name, callback);
        }
        this.addEventListener(name, callback);
    };
    this.emit = this.dispatchEvent;
    this.off = this.removeEventListener;
    
    Object.defineProperty(this, '$html', {
        get: function() { return this.$int || this.$container || this.$ext; },
        enumerable: false,
        configurable: true
    });
})();

apf.extend(apf, new apf.Class().$init());







apf.color = {
/*
    colors: {
        aliceblue: "#f0f8ff",antiquewhite:"#faebd7",aqua:"#00ffff",
        aquamarine: "#7fffd4",azure:"#f0ffff",beige:"#f5f5dc",bisque:"#ffe4c4",
        black: "#000000",blanchedalmond:"#ffebcd",blue:"#0000ff",
        blueviolet: "#8a2be2",brown:"#a52a2a",burlywood:"#deb887",
        cadetblue: "#5f9ea0",chartreuse:"#7fff00",chocolate:"#d2691e",
        coral: "#ff7f50",cornflowerblue:"#6495ed",cornsilk:"#fff8dc",
        crimson: "#dc143c",cyan:"#00ffff",darkblue:"#00008b",darkcyan:"#008b8b",
        darkgoldenrod: "#b8860b",darkgray:"#a9a9a9",darkgrey:"#a9a9a9",
        darkgreen: "#006400",darkkhaki:"#bdb76b",darkmagenta:"#8b008b",
        darkolivegreen: "#556b2f",darkorange:"#ff8c00",darkorchid:"#9932cc",
        darkred: "#8b0000",darksalmon:"#e9967a",darkseagreen:"#8fbc8f",
        darkslateblue: "#483d8b",darkslategray:"#2f4f4f",
        darkslategrey: "#2f4f4f",darkturquoise:"#00ced1",darkviolet:"#9400d3",
        deeppink: "#ff1493",deepskyblue:"#00bfff",dimgray:"#696969",
        dimgrey: "#696969",dodgerblue:"#1e90ff",firebrick:"#b22222",
        floralwhite: "#fffaf0",forestgreen:"#228b22",fuchsia:"#ff00ff",
        gainsboro: "#dcdcdc",ghostwhite:"#f8f8ff",gold:"#ffd700",
        goldenrod: "#daa520",gray:"#808080",grey:"#808080",green:"#008000",
        greenyellow: "#adff2f",honeydew:"#f0fff0",hotpink:"#ff69b4",
        indianred: "#cd5c5c",indigo:"#4b0082",ivory:"#fffff0",khaki:"#f0e68c",
        lavender: "#e6e6fa",lavenderblush:"#fff0f5",lawngreen:"#7cfc00",
        lemonchiffon: "#fffacd",lightblue:"#add8e6",lightcoral:"#f08080",
        lightcyan: "#e0ffff",lightgoldenrodyellow:"#fafad2",lightgray:"#d3d3d3",
        lightgrey: "#d3d3d3",lightgreen:"#90ee90",lightpink:"#ffb6c1",
        lightsalmon: "#ffa07a",lightseagreen:"#20b2aa",lightskyblue:"#87cefa",
        lightslategray: "#778899",lightslategrey:"#778899",
        lightsteelblue: "#b0c4de",lightyellow:"#ffffe0",lime:"#00ff00",
        limegreen: "#32cd32",linen:"#faf0e6",magenta:"#ff00ff",maroon:"#800000",
        mediumaquamarine: "#66cdaa",mediumblue:"#0000cd",
        mediumorchid: "#ba55d3",mediumpurple:"#9370d8",mediumseagreen:"#3cb371",
        mediumslateblue: "#7b68ee",mediumspringgreen:"#00fa9a",
        mediumturquoise: "#48d1cc",mediumvioletred:"#c71585",
        midnightblue: "#191970",mintcream:"#f5fffa",mistyrose:"#ffe4e1",
        moccasin: "#ffe4b5",navajowhite:"#ffdead",navy:"#000080",
        oldlace: "#fdf5e6",olive:"#808000",olivedrab:"#6b8e23",orange:"#ffa500",
        orangered: "#ff4500",orchid:"#da70d6",palegoldenrod:"#eee8aa",
        palegreen: "#98fb98",paleturquoise:"#afeeee",palevioletred:"#d87093",
        papayawhip: "#ffefd5",peachpuff:"#ffdab9",peru:"#cd853f",pink:"#ffc0cb",
        plum: "#dda0dd",powderblue:"#b0e0e6",purple:"#800080",red:"#ff0000",
        rosybrown: "#bc8f8f",royalblue:"#4169e1",saddlebrown:"#8b4513",
        salmon: "#fa8072",sandybrown:"#f4a460",seagreen:"#2e8b57",
        seashell: "#fff5ee",sienna:"#a0522d",silver:"#c0c0c0",skyblue:"#87ceeb",
        slateblue: "#6a5acd",slategray:"#708090",slategrey:"#708090",
        snow: "#fffafa",springgreen:"#00ff7f",steelblue:"#4682b4",tan:"#d2b48c",
        teal: "#008080",thistle:"#d8bfd8",tomato:"#ff6347",turquoise:"#40e0d0",
        violet: "#ee82ee",wheat:"#f5deb3",white:"#ffffff",whitesmoke:"#f5f5f5",
        yellow: "#ffff00",yellowgreen:"#9acd32"
    },*/
    colorshex: {
        aliceblue: 0xf0f8ff,antiquewhite:0xfaebd7,aqua:0x00ffff,
        aquamarine: 0x7fffd4,azure:0xf0ffff,beige:0xf5f5dc,bisque:0xffe4c4,
        black: 0x000000,blanchedalmond:0xffebcd,blue:0x0000ff,
        blueviolet: 0x8a2be2,brown:0xa52a2a,burlywood:0xdeb887,
        cadetblue: 0x5f9ea0,chartreuse:0x7fff00,chocolate:0xd2691e,
        coral: 0xff7f50,cornflowerblue:0x6495ed,cornsilk:0xfff8dc,
        crimson: 0xdc143c,cyan:0x00ffff,darkblue:0x00008b,darkcyan:0x008b8b,
        darkgoldenrod: 0xb8860b,darkgray:0xa9a9a9,darkgrey:0xa9a9a9,
        darkgreen: 0x006400,darkkhaki:0xbdb76b,darkmagenta:0x8b008b,
        darkolivegreen: 0x556b2f,darkorange:0xff8c00,darkorchid:0x9932cc,
        darkred: 0x8b0000,darksalmon:0xe9967a,darkseagreen:0x8fbc8f,
        darkslateblue: 0x483d8b,darkslategray:0x2f4f4f,
        darkslategrey: 0x2f4f4f,darkturquoise:0x00ced1,darkviolet:0x9400d3,
        deeppink: 0xff1493,deepskyblue:0x00bfff,dimgray:0x696969,
        dimgrey: 0x696969,dodgerblue:0x1e90ff,firebrick:0xb22222,
        floralwhite: 0xfffaf0,forestgreen:0x228b22,fuchsia:0xff00ff,
        gainsboro: 0xdcdcdc,ghostwhite:0xf8f8ff,gold:0xffd700,
        goldenrod: 0xdaa520,gray:0x808080,grey:0x808080,green:0x008000,
        greenyellow: 0xadff2f,honeydew:0xf0fff0,hotpink:0xff69b4,
        indianred: 0xcd5c5c,indigo:0x4b0082,ivory:0xfffff0,khaki:0xf0e68c,
        lavender: 0xe6e6fa,lavenderblush:0xfff0f5,lawngreen:0x7cfc00,
        lemonchiffon: 0xfffacd,lightblue:0xadd8e6,lightcoral:0xf08080,
        lightcyan: 0xe0ffff,lightgoldenrodyellow:0xfafad2,lightgray:0xd3d3d3,
        lightgrey: 0xd3d3d3,lightgreen:0x90ee90,lightpink:0xffb6c1,
        lightsalmon: 0xffa07a,lightseagreen:0x20b2aa,lightskyblue:0x87cefa,
        lightslategray: 0x778899,lightslategrey:0x778899,
        lightsteelblue: 0xb0c4de,lightyellow:0xffffe0,lime:0x00ff00,
        limegreen: 0x32cd32,linen:0xfaf0e6,magenta:0xff00ff,maroon:0x800000,
        mediumaquamarine: 0x66cdaa,mediumblue:0x0000cd,
        mediumorchid: 0xba55d3,mediumpurple:0x9370d8,mediumseagreen:0x3cb371,
        mediumslateblue: 0x7b68ee,mediumspringgreen:0x00fa9a,
        mediumturquoise: 0x48d1cc,mediumvioletred:0xc71585,
        midnightblue: 0x191970,mintcream:0xf5fffa,mistyrose:0xffe4e1,
        moccasin: 0xffe4b5,navajowhite:0xffdead,navy:0x000080,
        oldlace: 0xfdf5e6,olive:0x808000,olivedrab:0x6b8e23,orange:0xffa500,
        orangered: 0xff4500,orchid:0xda70d6,palegoldenrod:0xeee8aa,
        palegreen: 0x98fb98,paleturquoise:0xafeeee,palevioletred:0xd87093,
        papayawhip: 0xffefd5,peachpuff:0xffdab9,peru:0xcd853f,pink:0xffc0cb,
        plum: 0xdda0dd,powderblue:0xb0e0e6,purple:0x800080,red:0xff0000,
        rosybrown: 0xbc8f8f,royalblue:0x4169e1,saddlebrown:0x8b4513,
        salmon: 0xfa8072,sandybrown:0xf4a460,seagreen:0x2e8b57,
        seashell: 0xfff5ee,sienna:0xa0522d,silver:0xc0c0c0,skyblue:0x87ceeb,
        slateblue: 0x6a5acd,slategray:0x708090,slategrey:0x708090,
        snow: 0xfffafa,springgreen:0x00ff7f,steelblue:0x4682b4,tan:0xd2b48c,
        teal: 0x008080,thistle:0xd8bfd8,tomato:0xff6347,turquoise:0x40e0d0,
        violet: 0xee82ee,wheat:0xf5deb3,white:0xffffff,whitesmoke:0xf5f5f5,
        yellow: 0xffff00,yellowgreen:0x9acd32
    },
    fixHSB: function (hsb) {
        return {
            h: Math.min(360, Math.max(0, hsb.h)),
            s: Math.min(100, Math.max(0, hsb.s)),
            b: Math.min(100, Math.max(0, hsb.b))
        };
    },

    fixRGB: function (rgb) {
        return {
            r: Math.min(255, Math.max(0, rgb.r)),
            g: Math.min(255, Math.max(0, rgb.g)),
            b: Math.min(255, Math.max(0, rgb.b))
        };
    },

    fixHex: function (hex, asBrowser) {
        hex = hex.toLowerCase().replace(/[^a-f0-9]/g, "");
        var len = 6 - hex.length;
        if (len > 0) {
            var ch = "0";
            var o = [];
            var i = 0;
            if (asBrowser) {
                ch = hex.charAt(hex.length - 1);
                o.push(hex);
            }
            for (; i < len; i++)
                o.push(ch);
            if (!asBrowser)
                o.push(hex);
            hex = o.join("");
        }
        return hex;
    },
    
    hexToRGB: function (hex) {
        hex = parseInt(((hex.indexOf("#") > -1) ? hex.substring(1) : hex), 16);
        return {r: hex >> 16, g: (hex & 0x00FF00) >> 8, b: (hex & 0x0000FF)};
    },

    hexToHSB: function (hex) {
        return this.RGBToHSB(this.hexToRGB(hex));
    },

    RGBToHSB: function (rgb) {
        var hsb = {
            h: 0,
            s: 0,
            b: 0
        };
        var min = Math.min(rgb.r, rgb.g, rgb.b),
            max = Math.max(rgb.r, rgb.g, rgb.b),
            delta = max - min;
        hsb.b = max;
        if (max != 0) { }
        hsb.s = max != 0 ? 255 * delta / max : 0;
        if (hsb.s != 0) {
            if (rgb.r == max)
                hsb.h = (rgb.g - rgb.b) / delta;
            else if (rgb.g == max)
                hsb.h = 2 + (rgb.b - rgb.r) / delta;
            else
                hsb.h = 4 + (rgb.r - rgb.g) / delta;
        }
        else
            hsb.h = -1;
        hsb.h *= 60;
        if (hsb.h < 0)
            hsb.h += 360;
        hsb.s *= 100/255;
        hsb.b *= 100/255;
        return hsb;
    },
    
    HSBToRGB: function(hsb) {
        var rgb = {},
            h = Math.round(hsb.h),
            s = Math.round(hsb.s * 255 / 100),
            v = Math.round(hsb.b * 255 / 100);
        if (s == 0)
            rgb.r = rgb.g = rgb.b = v;
        else {
            var t1 = v,
                t2 = (255 - s) * v / 255,
                t3 = (t1 - t2) * (h % 60)/60;
            if (h == 360)
                h = 0;
            if (h < 60)
                rgb.r = t1, rgb.b = t2, rgb.g = t2 + t3;
            else if (h < 120)
                rgb.g = t1, rgb.b = t2, rgb.r = t1 - t3;
            else if (h < 180)
                rgb.g = t1, rgb.r = t2, rgb.b = t2 + t3;
            else if (h < 240)
                rgb.b = t1, rgb.r = t2, rgb.g = t1 - t3;
            else if (h < 300)
                rgb.b = t1, rgb.g = t2, rgb.r = t2 + t3;
            else if (h < 360)
                rgb.r = t1, rgb.g = t2, rgb.b = t1 - t3;
            else
                rgb.r = 0, rgb.g = 0, rgb.b = 0;
        }
        return {r: Math.round(rgb.r), g: Math.round(rgb.g), b: Math.round(rgb.b)};
    },

    RGBToHex: function(rgb) {
        return ('00000'+(rgb.r<<16 | rgb.g<<8 | rgb.b).toString(16)).slice(-6);
    },

    HSBToHex: function(hsb) {
        return this.RGBToHex(this.HSBToRGB(hsb));
    }
};








/**
 * Performs an async function in serial on each of the list items.
 * 
 * @param {Array} list A list of elements to iterate over asynchronously
 * @param {Function} async An ssync function of the form `function(item, callback)`
 * @param {Function} callback A function of the form `function(error)`, which is
 *      called after all items have been processed
 */
apf.asyncForEach = function(list, async, callback) {
    var i = 0;
    var len = list.length;

    if (!len) return callback(null, []);

    async(list[i], function handler(err) {
        if (err) return callback(err);
        i++;

        if (i < len) {
            async(list[i], handler, i);
        } else {
            callback(null);
        }
    }, i);
};

/**
 * Performs an async function in serial, as long as the function 'condition' (first 
 * argument) evaluates to true.
 * 
 * @param {Function} condition A function that returns a [Boolean], which determines
 *                             if the loop should continue
 * @param {Function} async     async A function of the form `function(iteration_no, callback)`
 * @param {Function} callback  A function of the form `function(error)`, which is
 *                             called after all items have been processed
 */
apf.asyncWhile = function(condition, async, callback) {
    var i = 0;
    async(i, function handler(err) {
        if (err)
            return callback ? callback(err, i) : null;

        ++i;
        if (condition(i))
            async(i, handler);
        else
            callback && callback(null, i);
    });
};

/**
 * Maps each element from the list to the result returned by the async mapper
 * function. 
 *
 * The mapper takes an element from the list and a callback as arguments.
 * After completion, the mapper has to call the callback with an (optional) error
 * object as the first argument, and the result of the map as second argument. After all
 * list elements have been processed, the last callback is called with the mapped
 * array as second argument.
 * 
 * @param {Array} list A list of elements to iterate over asynchronously
 * @param {Function}  mapper A function of the form `function(item, next)`
 * @param {Function} callback A function of the form `function(error, result)`
 */
apf.asyncMap = function(list, mapper, callback) {
    var i = 0;
    var len = list.length;

    if (!len) return callback(null, []);
    var map = [];

    async(list[i], function handler(err, value) {
        if (err) return callback(err);
        
        map[i] = value;
        i++;

        if (i < len) {
            async(list[i], handler);
        } else {
            callback(null, map);
        }
    });
};


/**
 * Chains an array of functions. 
 *
 * Each of the functions (except the last one) must
 * have exactly one `callback` argument, which must be called after the functions has
 * finished. If the callback fails, it must pass a non-null error object as the
 * first argument to the callback.
 * 
 * @param {Array} funcs An array of functions to chain together.
 */
apf.asyncChain = function(funcs) {
    var i = 0;
    var len = funcs.length;
    
    function next() {
        var f = funcs[i++];
        if (i == len)
            f()
        else
            f(next)
    }
    
    next();
};






// start closure:
//(function(){

apf.NUMBER = 1;
apf.BOOLEAN = 2;
apf.STRING = 3;
apf.ARRAY = 4;
apf.DATE = 5;
apf.REGEXP = 6;
apf.FUNCTION = 7;

function defineProp(obj, name, val) {
    Object.defineProperty(obj, name, {
        value: val,
        enumerable: false,
        writable: true,
        configurable: true,
    });
}

if (!Element.prototype.remove) {
    defineProp(Element.prototype, "remove", function() {
        this.parentNode && this.parentNode.removeChild(this) 
    });
}

defineProp(Array.prototype, "dataType", apf.ARRAY);
defineProp(Number.prototype, "dataType", apf.NUMBER);
defineProp(Date.prototype, "dataType", apf.DATE);
defineProp(Boolean.prototype, "dataType", apf.BOOLEAN);
defineProp(String.prototype, "dataType", apf.STRING);
defineProp(RegExp.prototype, "dataType", apf.REGEXP);
defineProp(Function.prototype, "dataType", apf.FUNCTION);


/*
 * Extends a Function object with properties from other objects, specified as
 * arguments.
 *
 * @param {Mixed} obj1, obj2, obj3, etc.
 * @type Function
 * @see apf.extend
 */
defineProp(Function.prototype, "extend", function() {
    apf.extend.apply(this, [this].concat(Array.prototype.slice.call(arguments)));
    return this;
});

/*
 * Attach a Function object to an event as handler method. If apf.AbstractEvent
 * is available, the active event is extended with convinience accessors as
 * declared in apf.AbstractEvent
 *
 * @param {Object} The context the execute the Function within
 * @param {Boolean} Whether the passed event object should be extended with AbstractEvent
 * @param {Mixed}  param1, param2, param3, etc.
 * @type Function
 * @see apf.AbstractEvent
 */
defineProp(Function.prototype, "bindWithEvent", function() {
    var __method = this,
        args = Array.prototype.slice.call(arguments),
        o = args.shift(),
        ev = args.shift();
    return function(event) {
        if (!event)
            event = window.event;
        
        return __method.apply(o, [event].concat(args)
            .concat(Array.prototype.slice.call(arguments)));
    }
});

/*
 * Copy an array, like this statement would: 'this.concat([])', but then do it
 * recursively.
 */
defineProp(Array.prototype, "copy", function(){
    var ar = [];
    for (var i = 0, j = this.length; i < j; i++)
        ar[i] = this[i] && this[i].copy ? this[i].copy() : this[i];

    return ar;
});

/*
 * Concatenate the current Array instance with one (or more) other Arrays, like
 * Array.concat(), but return the current Array instead of a new one that
 * results from the merge.
 *
 * @param {Array} array1, array2, array3, etc.
 * @type  {Array}
 */
defineProp(Array.prototype, "merge", function(){
    for (var i = 0, k = arguments.length; i < k; i++) {
        for (var j = 0, l = arguments[i].length; j < l; j++) {
            this.push(arguments[i][j]);
        }
    }
});

/*
 * Add the values of one or more arrays to the current instance by using the
 * '+=' operand on each value.
 *
 * @param {Array} array1, array2, array3, etc.
 * @type  {Array}
 * @see Array.copy
 */
defineProp(Array.prototype, "arrayAdd", function(){
    var s = this.copy();
    for (var i = 0, k = arguments.length; i < k; i++) {
        for (var j = 0, l = s.length; j < l; j++) {
            s[j] += arguments[i][j];
        }
    }

    return s;
});

/*
 * Check if an object is contained within the current Array instance.
 *
 * @param {Mixed}   obj The value to check for inside the Array
 * @type  {Boolean}
 */
defineProp(Array.prototype, "equals", function(obj) {
    for (var i = 0, j = this.length; i < j; i++)
        if (this[i] != obj[i])
            return false;
    return true;
});

defineProp(Array.prototype, "makeUnique", function(){
    var out = [],
        seen = new Set,
        i = this.length;

    while (i--) {
        if (!seen.has(this[i])) {
            out[out.length] = this[i];
            seen.add(this[i]);
        }
    }

    return out;
});

/*
 * Check if this array instance contains a value 'obj'.
 *
 * @param {Mixed}  obj    The value to check for inside the array
 * @param {Number} [from] Left offset index to start the search from
 * @type  {Boolean}
 * @see Array.indexOf
 */
defineProp(Array.prototype, "contains", function(obj, from) {
    return this.indexOf(obj, from) != -1;
});


/*
 * Like Array.push, but only invoked when the value 'item' is already present
 * inside the array instance.
 *
 * @param {Mixed} item, item, ...
 * @type  {Array}
 */
defineProp(Array.prototype, "pushUnique", function(){
    var item,
        i = 0,
        l = arguments.length;
    for (; i < l; ++i) {
        item = arguments[i];
    if (this.indexOf(item) == -1)
        this.push(item);
    }
    return this;
});

/*
 * Iterate through each value of an array instance from left to right (front to
 * back) and execute a callback Function for each value.
 *
 * @param {Function} fn
 * @type  {Array}
 */
defineProp(Array.prototype, "each", function(fn) {
    for (var i = 0, l = this.length; i < l; i++)
        if (fn.call(this, this[i], i, this) === false)
            break;
    return this;
});

/*
 * Search for a value 'obj' inside an array instance and remove it when found.
 *
 * @type {Mixed} obj
 * @type {Array}
 */
defineProp(Array.prototype, "remove", function(obj) {
    for (var i = this.length - 1; i >= 0; i--) {
        if (this[i] != obj)
            continue;

        this.splice(i, 1);
    }

    return this;
});

/*
 * Remove an item from an array instance which can be identified with key 'i'
 *
 * @param  {Number} i
 * @return {Mixed}  The removed item
 */
defineProp(Array.prototype, "removeIndex", function(i) {
    if (!this.length) return null;
    return this.splice(i, 1);
});

/*
 * Insert a new value at a specific object; alias for Array.splice.
 *
 * @param {Mixed}  obj Value to insert
 * @param {Number} i   Index to insert 'obj' at
 * @type  {Number}
 */
defineProp(Array.prototype, "insertIndex", function(obj, i) {
    this.splice(i, 0, obj);
});

/*
 * Reverses the order of the elements of an array; the first becomes the last,
 * and the last becomes the first.
 *
 * @type {Array}
 */
defineProp(Array.prototype, "invert", Array.prototype.reverse);



/*
 * Transform a number to a string and pad it with a zero digit its length is one.
 *
 * @type {String}
 */
Number.prototype.toPrettyDigit = Number.prototype.toPrettyDigit || function() {
    var n = this.toString();
    return (n.length == 1) ? "0" + n : n;
};

/*
 * Casts the first character in a string to uppercase.
 *
 * @type {String}
 */
String.prototype.uCaseFirst = function(){
    return this.substr(0, 1).toUpperCase() + this.substr(1)
};

/*
 * Removes spaces and other space-like characters from the left and right ends
 * of a string
 *
 * @type {String}
 */
if (!String.prototype.trim) {
    String.prototype.trim = function(){
        return this.replace(/\s+$/, "").replace(/^\s+/, "");
    };
}
/**
 * annex b, but useful until trimStart/End are implemented by browsers
 */
if (!String.prototype.trimLeft) {
    String.prototype.trimLeft = function(){
        return this.replace(/^\s+/, "");
    };
}

if (!String.prototype.trimRight) {
    String.prototype.trimRight = function(){
        return this.replace(/\s+$/, "");
    };
}

/*
 * Concatenate a string with itself n-times.
 *
 * @param {Number} times Number of times to repeat the String concatenation
 * @type  {String}
 */
if (!String.prototype.repeat) {
    String.prototype.repeat = function(times) {
        return Array(times + 1).join(this);
    };
}

/*
 * Trim a string down to a specific number of characters. Optionally, append an
 * ellipsis ('...') as a suffix.
 *
 * @param {Number}  nr
 * @param {Boolean} [ellipsis] Append an ellipsis
 * @type  {String}
 */
String.prototype.truncate = function(nr, ellipsis) {
    return this.length >= nr
        ? this.substring(0, nr - (ellipsis ? 4 : 1)) + (ellipsis ? "..." : "")
        : this;
};

/*
 * Pad a string at the right or left end with a string 'pad' to a specific
 * number of characters. Highly optimized version for speed, not readability.
 *
 * @param {Number}  len   Specifies the amount of characters required to pad to.
 * @param {String}  pad   Specifies the character(s) to pad the string with
 * @param {Boolean} [dir] Specifies at which end to append the 'pad' character (left or right).
 * @type  {String}
 */
String.prototype.pad = function(len, pad, dir) {
    return dir ? (this + Array(len).join(pad)).slice(0, len)
        : (Array(len).join(pad) + this).slice(-len);
};

apf.PAD_LEFT = false;
apf.PAD_RIGHT = true;

/*
 * Special String.split; optionally lowercase a string and trim all results from
 * the left and right.
 *
 * @param {String}  separator
 * @param {Number}  limit      Maximum number of items to return
 * @param {Boolean} bLowerCase Flag to lowercase the string prior to split
 * @type  {String}
 */
String.prototype.splitSafe = function(separator, limit, bLowerCase) {
    return (bLowerCase && this.toLowerCase() || this)
        .replace(/(?:^\s+|\n|\s+$)/g, "")
        .split(new RegExp("[\\s ]*" + separator + "[\\s ]*", "g"), limit || 999);
};

/*
 * Returns a string produced according to the formatting string. It replaces
 * all <i>%s</i> occurrences with the arguments provided.
 *
 * @link http://www.php.net/sprintf
 * @type {String}
 */
String.prototype.sprintf = function() {
    // Create a new string from the old one, don't just create a copy
    var str = this.toString(),
        i = 0,
        inx = str.indexOf("%s");
    while (inx >= 0) {
        var replacement = arguments[i++] || " ";
        str = str.substr(0, inx) + replacement + str.substr(inx + 2);
        inx = str.indexOf("%s");
    }
    return str;
};

/*
 * The now method returns the milliseconds elapsed since
 * 1 January 1970 00:00:00 UTC up until now as a number.
 *
 * @type {Number}
 */
if (!Date.now) {
    Date.now = function now() {
        return +new Date();
    };
}

//})(); //end closure








//@todo maybe generalize this to pub/sub event system??
/**
 * @private
 */
apf.hotkeys = {};
(function() {
    /**
     * @private
     */
    var keyMods = {"ctrl": 1, "alt": 2, "option" : 2, "shift": 4, "meta": 8, "command": 8};

    /**
     * @private
     */
    this.keyNames = {
        "8"  : "Backspace",
        "9"  : "Tab",
        "13" : "Enter",
        "27" : "Esc",
        "32" : "Space",
        "33" : "PageUp",
        "34" : "PageDown",
        "35" : "End",
        "36" : "Home",
        "37" : "Left",
        "38" : "Up",
        "39" : "Right",
        "40" : "Down",
        "45" : "Insert",
        "46" : "Del",
        "107": "+",
        "112": "F1",
        "113": "F2",
        "114": "F3",
        "115": "F4",
        "116": "F5",
        "117": "F6",
        "118": "F7",
        "119": "F8",
        "120": "F9",
        "121": "F10",
        "122": "F11",
        "123": "F12",
        "188": ",",
        "219": "[",
        "221": "]"
    };

    var macUnicode = {
        "meta"     : "\u2318", // ⌘
        "command"  : "\u2318",
        "alt"      : "\u2325", // ⌥
        "option"   : "\u2325",
        "shift"    : "\u21E7", // ⇧
        //"esc"      : "\u238B", // ⎋
        "ctrl"     : "\u2303" // ⌃
        // "backspace": "\u232B", // ⌫
        // "del"      : "\u2326", // ⌦
        // "enter"    : "\u21A9"  // ↩
    };
    
    var macUnicodeHtml = {
        "meta"     : "&#8984;", // ⌘
        "command"  : "&#8984;",
        "alt"      : "&#8997;", // ⌥
        "option"   : "&#8997;",
        "shift"    : "&#8679;", // ⇧
        //"esc"      : "&#9099;", // ⎋
        "ctrl"     : "&#2303;" // ⌃ TODO
        // "backspace": "&#232B;", // ⌫ TODO
        // "del"      : "&#2326;", // ⌦ TODO
        // "enter"    : "&#21A9;"  // ↩ TODO
    };

    // hash to store the hotkeys in
    this.$keys = {};

    var _self = this, trace = 0;
    
    function register(hotkey, handler, remove) {
        var key,
            hashId = 0,
            keys = hotkey.splitSafe("\\-", null, true),
            i = 0,
            l = keys.length;

        for (; i < l; ++i) {
            if (keyMods[keys[i]])
                hashId = hashId | keyMods[keys[i]];
            else
                key = keys[i] || "-"; //when empty, the splitSafe removed a '-'
        }

        
        if (!key) return;
        

        if (!_self.$keys[hashId])
            _self.$keys[hashId] = {};

        if (remove) {
            if (handler == _self.$keys[hashId][key])
                _self.$keys[hashId][key] = null;
        }
        else
            _self.$keys[hashId][key] = handler;
    }

    /**
     * Registers a hotkey handler to a key combination.
     * 
     * #### Example:
     * ```javascript
     *   apf.registerHotkey('Ctrl-Z', undoHandler);
     * ```
     * @param {String}   hotkey  The key combination to user. This is a
     * combination of [[keys: Ctrl]], [[keys: Alt]], [[keys: Shift]] and a normal key to press. Use `+` to
     * seperate the keys.
     * @param {Function} handler The code to be executed when the key
     * combination is pressed.
     */
    apf.registerHotkey = this.register = function(hotkey, handler) {
        var parts = hotkey.split("|"),
            i = 0,
            l = parts.length;
        for (; i < l; ++i)
            register(parts[i], handler);
    };

    this.$exec = function(eInfo) {
        var handler
        var hashId = 0 | (eInfo.ctrlKey ? 1 : 0) | (eInfo.altKey ? 2 : 0)
            | (eInfo.shiftKey ? 4 : 0) | (eInfo.metaKey ? 8 : 0);
        var code = eInfo.keyCode;

        var key = _self.keyNames[code] 
            || (code && code > 46 && code != 91 ? String.fromCharCode(code) : null);
        if (!hashId && (!key || !key.match(/^F\d{1,2}$/)) || !key) //Hotkeys should always have one of the modifiers
            return;

        if (_self.$keys[hashId] && (handler = _self.$keys[hashId][key.toLowerCase()])) {
            handler(eInfo.htmlEvent);
            eInfo.returnValue = false;
            
            apf.queue.empty();
            
        }

        return eInfo.returnValue;
    };

    /**
     * Removes a registered hotkey.
     * @param {String} hotkey The hotkey combination to remove
     * @param {Function} handler The code to be executed when the key
     * combination is pressed.
     */
    apf.removeHotkey = this.remove = this.unregister = function(hotkey, handler) {
        var parts = hotkey.split("|"),
            i = 0,
            l = parts.length;
        for (; i < l; ++i)
            register(parts[i], handler, true);
    };
    
    function toMacNotation(hotkey, bHtml) {
        var t;
        var str = hotkey.trim();
        if (!str) return "";
        var keys = str.splitSafe("\\-+");
        var i = 0;
        var l = keys.length;

        for (; i < l; ++i) {
            if (!keys[i]) keys[i] = "-";
            if (t = (bHtml ? macUnicodeHtml : macUnicode)[keys[i].toLowerCase()])
                keys[i] = t;
        }
        return keys.join(" ");
    }

    this.toMacNotation = function(hotkey, bHtml) {
        var parts = hotkey.split("|"),
            i = 0,
            l = parts.length,
            res = [];
        for (; i < l; ++i)
            res.push(toMacNotation(parts[i], bHtml));
        return res.join(" | ");
    };

    apf.addEventListener("keydown", function(eInfo) {
        var e = eInfo.htmlEvent;
        //Hotkey
        if (/*!eInfo.isTextInput && */_self.$exec(eInfo) === false
          || eInfo.returnValue === false) {
            apf.stopEvent(e);
            return false;
        }

        
    });
}).call(apf.hotkeys);








/**
 * @private
 */
apf.nameserver = {
    lookup: {},
    
    add: function(type, item) {
        if (!this.lookup[type])
            this.lookup[type] = [];
        
        
        
        return this.lookup[type].push(item) - 1;
    },
    
    register: function(type, id, item) {
        if (!this.lookup[type])
            this.lookup[type] = {};

        
        
        if (this.waiting[id]) {
            var list = this.waiting[id];
            for (var i = 0; i < list.length; i++) {
                list[i]();
            }
            delete this.waiting[id];
        }

        return (this.lookup[type][id] = item);
    },
    
    waiting: {},
    waitFor: function(name, callback) {
        (this.waiting[name] || (this.waiting[name] = [])).push(callback);
    },
    
    remove: function(type, item) {
        var list = this.lookup[type];
        if (list) {
            for (var prop in list) {
                if (list[prop] == item) {
                    delete list[prop];
                }
            }
        }
    },
    
    get: function(type, id) {
        return this.lookup[type] ? this.lookup[type][id] : null;
    },
    
    getAll: function(type) {
        var name, arr = [], l = this.lookup[type];
        if (!l) return arr;
        
        if (l.dataType == apf.ARRAY) {
            for (var i = 0; i < l.length; i++) {
                arr.push(l[i]);
            }
        }
        else {
            for (name in l) {
                
                
                
                arr.push(l[name]);
            }
        }
        
        return arr;
    }, 
    
    getAllNames: function(type) {
        var name, arr = [];
        for (name in this.lookup[type]){
            if (parseInt(name) == name) continue;
            arr.push(name);
        }
        return arr;
    }
};








/**
 * @todo needs refactor
 * @private
 */
apf.plane = {
    $set: [],
    $lookup: {},
    $find: function(id) {
        if (this.$lookup[id])
            return this.$lookup[id];
        
        var item = this.$set.pop();
        if (!item)
            item = this.$factory();
        
        //item.id = id;
        this.$lookup[id] = item;
        
        return item;
    },
    
    get: function(options) {
        return this.$find(options && options.protect || "default");
    },
    
    show: function(o, options) {
        this.options = options || {};
        var item = this.$find(options && options.protect || "default");
        item.show(o, options);
    },
    
    hide: function(protect, noAnim) {
        var item = this.$lookup[protect || "default"];
        if (item) {
            item.hide(noAnim);
            delete this.$lookup[protect || "default"];
            this.$set.push(item);
        }
    },

    setCursor: function(cursor) {
        this.show("cursorCover", {
            cursor: cursor, zClass: "print", protect: "cursorCover"
        });
    },

    unsetCursor: function() { 
        this.hide("cursorCover"); 
    },

    $factory: function(){
        var _self = this;
        
        function createCover(){
            var cover = apf.buildDom(["div"], document.body);
            cover.style.position = "fixed";
            cover.style.left = 0;
            cover.style.top = 0;
            cover.host = false;
            
            return cover;
        }
        
        var plane = createCover();
        
        return {
            host: this,
            plane: plane,
            lastCoverType: "default",
            
            show: function(o, options) {
                if (!options) options = {}
                var coverType = options.customCover ? "custom" : "default",
                    plane;
                
                if (coverType == "custom" || this.lastCoverType != coverType)
                    this.plane = createCover();
                
                plane = this.plane;
            
                if (!options.customCover)
                    this.plane.style.background = options.color || "";
                
                this.protect = options.protect;
                
                if (this.protect)
                    apf.setProperty("planes", (apf.planes || 0) + 1);
                
                this.current = o.style && o;
                if (options.zIndex || options.zClass)
                    apf.window.zManager.set(options.zClass || "plane", this.plane, this.current);
                
                this.plane.style.cursor = options.cursor || "";
                
                this.plane.style.display = "block";
                this.plane.style.opacity = parseFloat(options.opacity) || (options.color ? 1 : 0);
                
                this.plane.style.width = "100%";
                this.plane.style.height = "100%";
        
                this.lastCoverType = options.customCover ? "custom" : "default";
        
                return plane;
            },
        
            hide: function(noAnim) {
                if (this.protect)
                    apf.setProperty("planes", apf.planes - 1);
                
                if (this.current && this.current.parentNode == this.plane)
                    this.$originalPlace[0].insertBefore(this.current, this.$originalPlace[1]);
                
                this.plane.style.opacity = 0;
                if (this.current)
                    apf.window.zManager.clear(this.plane, this.current);
                this.plane.style.display = "none";
                
                this.current = null;
                
                return this.plane;
            }
        };
    }
};







function findCssRule(name, stylesheet, win) {
    // chrome normalizes pseudo-elements to :: and firefox to :
    name = name.replace(/([.*+?^${}()|[\]\/\\])/g, '\\$1')
        .replace(/::?(after|before)/g, "::?$1");
    var nameRe = new RegExp("^" + name + "$", "i");
    
    if (!stylesheet) {
        var sheets = (win || self).document.styleSheets;
        for (var j = sheets.length - 1; j >= 0; j--) {
            try {
                var rules = sheets[j].cssRules || [];
                for (var i = 0; i < rules.length; i++) {
                    if (nameRe.test(rules.item(i).selectorText)) {
                        return rules.item(i);
                    }
                }
            }
            catch (e) {}
        }
    }
    else {
        if (typeof stylesheet == "number")
            stylesheet = (win || self).document.styleSheets[stylesheet || 0];
        var rules = stylesheet.cssRules;
        if (!rules) return false;
        for (var i = 0; i < rules.length; i++) {
            if (nameRe.test(rules.item(i).selectorText)) {
                return rules.item(i);
            }
        }
    }
}


function toCssPropertyName(name) {
    return name.replace(/[A-Z]/g, function(a) {return "-" + a.toLowerCase()});
}
function toCamelCase(name) {
    return name.replace(/-(\w)/g, function(_, a) {return a.toUpperCase()});
}

/**
 * This method sets a single CSS rule.
 * @param {String} name         The CSS name of the rule (i.e. `.cls` or `#id`).
 * @param {String} type         The CSS property to change.
 * @param {String} value        The CSS value of the property.
 * @param {String} [stylesheet] The name of the stylesheet to change.
 * @param {Object} [win]        A reference to a window
 */
apf.setStyleRule = function(name, type, value, stylesheet, win) {
    if (!stylesheet)
        stylesheet = apf.$dynamicStyles || (apf.$dynamicStyles = apf.createStylesheet("", "dynamicStyles.css"));
    var rule = findCssRule(name, stylesheet, win);
    if (rule) {
        if (value.indexOf("!important") > -1) {
            type = toCssPropertyName(type);
            rule.style.cssText = type + ":" + value;
        } else {
            type = toCamelCase(type);
            rule.style[type] = value;
        }
    } else {
        type = toCssPropertyName(type);
        apf.importStylesheet([
            [name, type + ":" + value]
        ], win, stylesheet);
    }
    return !!rule;
};

apf.removeStyleRule = function(name, stylesheet, win) {
    var rule = findCssRule(name, stylesheet, win);
    if (rule) {
        var i = Array.prototype.indexOf.call(rule.parentStyleSheet.cssRules, rule);
        if (i != -1)
            rule.parentStyleSheet.deleteRule(i);
    }
    return !!rule;
}
/**
 * This method gets a single CSS rule.
 * @param {String} name         The CSS name of the rule (i.e. `.cls` or `#id`).
 * @param {String} type         The CSS property to change.
 * @param {String} [stylesheet] The name of the stylesheet to change.
 * @param {Object} [win]        A reference to a window
 */
apf.getStyleRule = function(name, type, stylesheet, win) {
    var rule = findCssRule(name, stylesheet, win);
    if (rule) {
        return rule.style[type];
    }
    return false;
};

/**
 * This method adds one class name to an HTMLElement. It can also remove classes.
 * @param {HTMLElement} oHtml        The HTMLElement to apply the CSS class to.
 * @param {String}      className    The name of the CSS class to apply.
 * @param {Array}       [exclusion]  A list of strings specifying names of CSS classes to remove.
 * @returns {HTMLElement} The modified `oHtml` element.
 */
apf.setStyleClass = function(oHtml, className, exclusion, userAction) {
    if (!oHtml || userAction && this.disabled)
        return;

    

    if (className) {
        if (exclusion)
            exclusion[exclusion.length] = className;
        else
            exclusion = [className];
    }

    //Create regexp to remove classes
    //var re = new RegExp("(?:(^| +)" + (exclusion ? exclusion.join("|") : "") + "($| +))", "gi");
    var re = new RegExp("(^| +)(?:" + (exclusion ? exclusion.join("|") : "") + ")", "gi");

    //Set new class
    oHtml.className != null
        ? (oHtml.className = oHtml.className.replace(re, " ") + (className ? " " + className : ""))
        : oHtml.setAttribute("class", (oHtml.getAttribute("class") || "")
            .replace(re, " ") + (className ? " " + className : ""));

    return oHtml;
};

/**
 * This method imports a CSS stylesheet from a string.
 * @param {String} cssString  The CSS definition
 * @param {Object} [doc]      The reference to the document where the CSS is applied on
 * @param {String} [media]    The media to which this CSS applies (_i.e._ `print` or `screen`)
 */
apf.importCssString = function(cssString, doc, media) {
    doc = doc || document;
    var htmlNode = doc.head;
    var style = doc.createElement("style");
    if (cssString)
        style.appendChild(doc.createTextNode(cssString));
    if (media)
        style.setAttribute('media', media);
    var before = apf.$dynamicStyles && apf.$dynamicStyles.ownerNode;
    htmlNode.insertBefore(style, before);
    return style;
};

/**
 * This method retrieves the current value of a property on a HTML element
 * recursively. If the style isn't found on the element itself, its parent is
 * checked.
 * @param {HTMLElement} el    The element to read the property from
 * @param {String}      prop  The property to read
 * @returns {String} The retrieved value
 */
apf.getStyleRecur = function(el, prop) {
    var value = apf.hasComputedStyle
        ? document.defaultView.getComputedStyle(el,'').getPropertyValue(
            prop.replace(/([A-Z])/g, function(m, m1) {
                return "-" + m1.toLowerCase();
            }))
        : el.currentStyle[prop]

    return ((!value || value == "transparent" || value == "inherit")
      && el.parentNode && el.parentNode.nodeType == 1)
        ? this.getStyleRecur(el.parentNode, prop)
        : value;
};

/**
 * This method imports a stylesheet defined by a multidimensional array. 
 * @param {Array}    def  A multidimensional array specifying stylesheets to import
 * @param {Object}   [win] A reference to a window
 * @method
 * @deprecated
 */    
apf.importStylesheet = function (def, win, stylesheet) {
    if (!def.length)
        return;
    
    if (!stylesheet) {
        var re = new RegExp("^" + document.domain, 'g');
        var doc = (win || window).document;
        for (var index=document.styleSheets.length - 1; index >= 0; index--) {
            if (!doc.styleSheets[index].href || doc.styleSheets[index].href.match(re)) {
                break;
            }
        }
        stylesheet = doc.styleSheets[index];
    }
    
    if (!stylesheet)
        stylesheet = apf.createStylesheet(win);
    
    for (var i = 0; i < def.length; i++) {
        if (!def[i][1])
            continue;

        var rule = def[i][0] + " {" + def[i][1] + "}";
        try {
            stylesheet.insertRule(rule, stylesheet.cssRules.length);
        }
        catch (e) {
            console.error(e);
        }
    }
};

/**
 * This method constructs a stylesheet.
 * @param {Object}  [win] A reference to a window
 * @returns {String} The created CSS stylesheet
 */ 
apf.createStylesheet = function(win, id) {
    var elem = apf.importCssString(null, (win || window).document)
    if (id) elem.id = id;
    return elem.sheet;
};

/**
 * This method determines if specified coordinates are within the HTMLElement.
 * @param {HTMLElement} el  The element to check
 * @param {Number}      x   The x-coordinate in pixels
 * @param {Number}      y   The y-coordinate in pixels
 * @returns {Boolean} `true` if the coordinates are within the element.
 */
apf.isInRect = function(oHtml, x, y) {
    var pos = this.getAbsolutePosition(oHtml);
    if (x < pos[0] || y < pos[1] || x > oHtml.offsetWidth + pos[0] - 10
      || y > oHtml.offsetHeight + pos[1] - 10)
        return false;
    return true;
};

/**
 * Retrieves the parent providing the rectangle to which the HTMLElement is
 * bound and cannot escape. In CSS, this is accomplished by having the overflow
 * property set to `"hidden"` or `"auto"`.
 * @param {HTMLElement} o  The element to check
 * @returns {HTMLElement} The parent element
 */
apf.getOverflowParent = function(o) {
    //not sure if this is the correct way. should be tested

    o = o.offsetParent;
    while (o && (this.getStyle(o, "overflow") != "hidden"
      || "absolute|relative".indexOf(this.getStyle(o, "position")) == -1)) {
        o = o.offsetParent;
    }
    return o || document.documentElement;
};

/**
 * Retrieves the first parent element which has a position `absolute` or
 * `relative` set.
 * @param {HTMLElement} o  The element to check
 * @returns {HTMLElement} The parent element
 */
apf.getPositionedParent = function(o) {
    o = o.offsetParent;
    while (o && o.tagName.toLowerCase() != "body"
      && "absolute|relative".indexOf(this.getStyle(o, "position")) == -1) {
        o = o.offsetParent;
    }
    return o || document.documentElement;
};

/**
 * Retrieves the absolute x- and y-coordinates, relative to the browser's
 * drawing area or the specified `refParent`.
 * @param {HTMLElement} o           The element to check
 * @param {HTMLElement} [refParent] The reference parent
 * @param {Boolean}     [inclSelf]  Whether to include the position of the element to check in the return value.
 * @returns {Array} The x- and y-coordinates of `oHtml`.
 */
apf.getAbsolutePosition = function(o, refParent, inclSelf) {
    if (o == document.body) {
        return [
            o.offsetLeft + (parseFloat(apf.getStyle(o, "marginLeft")) || 0),
              + (o.scrollLeft || 0),
            o.offsetTop  + (parseFloat(apf.getStyle(o, "marginTop")) || 0)
              + (o.scrollTop || 0)
        ];
    }
    
    var box = o.getBoundingClientRect(), 
        top = box.top,
        left = box.left;

    if (refParent && refParent != document.body) {
        var pos = apf.getAbsolutePosition(refParent, null, true);
        top -= pos[1];
        left -= pos[0];
    }
    
    left += (refParent || document.body).scrollLeft || document.documentElement.scrollLeft || 0;
    top  += (refParent || document.body).scrollTop  || document.documentElement.scrollTop  || 0;
    
    if (inclSelf && !refParent) {
        left += parseInt(apf.getStyle(o, "borderLeftWidth")) || 0
        top  += parseInt(apf.getStyle(o, "borderTopWidth")) || 0;
    }

    return [left, top];
};

//@todo its much faster to move these to browser specific files and eliminate apf.getStyle()
/**
 * Returns the distance between the border left and border right values of an element.
 * @param {HTMLElement} oHtml The element to check
 * @returns {Number} The final calculation, or 0, if there's no difference
 * @see apf.getWidthDiff
 */
apf.getHorBorders = function(oHtml) {
    return Math.max(0,
          (parseInt(apf.getStyle(oHtml, "borderLeftWidth")) || 0)
        + (parseInt(apf.getStyle(oHtml, "borderRightWidth")) || 0));
};

/**
 * Returns the distance between the border top and border bottom values of an element.
 * @param {HTMLElement} oHtml The element to check
 * @returns {Number} The final calculation, or 0, if there's no difference
 */
apf.getVerBorders = function(oHtml) {
    return Math.max(0,
          (parseInt(apf.getStyle(oHtml, "borderTopWidth")) || 0)
        + (parseInt(apf.getStyle(oHtml, "borderBottomWidth")) || 0));
};

/**
 * Returns the distance between the border left and border right values of an element, taking padding into consideration.
 * @param {HTMLElement} oHtml The element to check
 * @returns {Number} The final calculation, or 0, if there's no difference
 * @see apf.getHorBorders
 */
apf.getWidthDiff = function(oHtml) {
    if (apf.hasFlexibleBox 
      && apf.getStyle(oHtml, apf.CSSPREFIX + "BoxSizing") != "content-box")
        return 0;
    
    return Math.max(0, (parseInt(apf.getStyle(oHtml, "paddingLeft")) || 0)
        + (parseInt(apf.getStyle(oHtml, "paddingRight")) || 0)
        + (parseInt(apf.getStyle(oHtml, "borderLeftWidth")) || 0)
        + (parseInt(apf.getStyle(oHtml, "borderRightWidth")) || 0));
};

/**
 * Returns the distance between the border top and border bottom values of an element, taking padding into consideration.
 * @param {HTMLElement} oHtml The element to check
 * @returns {Number} The final calculation, or 0, if there's no difference
 */
apf.getHeightDiff = function(oHtml) {
    if (apf.hasFlexibleBox 
      && apf.getStyle(oHtml, apf.CSSPREFIX + "BoxSizing") != "content-box")
        return 0;
    
    return Math.max(0, (parseInt(apf.getStyle(oHtml, "paddingTop")) || 0)
        + (parseInt(apf.getStyle(oHtml, "paddingBottom")) || 0)
        + (parseInt(apf.getStyle(oHtml, "borderTopWidth")) || 0)
        + (parseInt(apf.getStyle(oHtml, "borderBottomWidth")) || 0));
};

/**
 * Returns an array with two elements. The first is the distance between the border top and border bottom values of an element, taking padding into consideration; 
 * the second is the distance between the border top and border bottom values of an element, taking padding into consideration.
 * @param {HTMLElement} oHtml The element to check
 * @returns {[Number]} An array containing the differences
 */
apf.getDiff = function(oHtml) {
    if (apf.hasFlexibleBox 
      && apf.getStyle(oHtml, apf.CSSPREFIX + "BoxSizing") != "content-box")
        return [0,0];
    
    return [Math.max(0, (parseInt(apf.getStyle(oHtml, "paddingLeft")) || 0)
        + (parseInt(apf.getStyle(oHtml, "paddingRight")) || 0)
        + (parseInt(apf.getStyle(oHtml, "borderLeftWidth")) || 0)
        + (parseInt(apf.getStyle(oHtml, "borderRightWidth")) || 0)),
        Math.max(0, (parseInt(apf.getStyle(oHtml, "paddingTop")) || 0)
        + (parseInt(apf.getStyle(oHtml, "paddingBottom")) || 0)
        + (parseInt(apf.getStyle(oHtml, "borderTopWidth")) || 0)
        + (parseInt(apf.getStyle(oHtml, "borderBottomWidth")) || 0))];
};

/**
 * Returns an array with two elements. The first is the distance between the margin left and margin right values of an element; 
 * the second is the distance between the margin top top and margin bottom values of an element.
 * @param {HTMLElement} oHtml The element to check
 * @returns {[Number]} An array containing the differences
 */
apf.getMargin = function(oHtml) {
    return [(parseInt(apf.getStyle(oHtml, "marginLeft")) || 0)
        + (parseInt(apf.getStyle(oHtml, "marginRight")) || 0),
      (parseInt(apf.getStyle(oHtml, "marginTop")) || 0)
        + (parseInt(apf.getStyle(oHtml, "marginBottom")) || 0)]
};

/**
 * Returns the difference between an element's `offsetWidth`, with its border left and border right widths removed. 
 * @param {HTMLElement} oHtml The element to check
 * @returns {Number} The final calculation
 */
apf.getHtmlInnerWidth = function(oHtml) {
    return (oHtml.offsetWidth
        - (parseInt(apf.getStyle(oHtml, "borderLeftWidth")) || 0)
        - (parseInt(apf.getStyle(oHtml, "borderRightWidth")) || 0));
};

/**
 * Returns the difference between an element's `offsetWidth`, with its border top and border bottom widths removed. 
 * @param {HTMLElement} oHtml The element to check
 * @returns {Number} The final calculation
 */
apf.getHtmlInnerHeight = function(oHtml) {
    return (oHtml.offsetHeight
        - (parseInt(apf.getStyle(oHtml, "borderTopWidth")) || 0)
        - (parseInt(apf.getStyle(oHtml, "borderBottomWidth")) || 0));
};

/**
 * Determines whether the keyboard input was a character that can influence
 * the value of an element (like a textbox).
 * @param {Number} charCode The ascii character code
 * @returns {Boolean} `true` if it was a character
 */
apf.isCharacter = function(charCode) {
    return (charCode < 112 || charCode > 122)
      && (charCode == 32 || charCode > 42 || charCode == 8);
};

/*
 * Shorthand for an empty function.
 */
apf.K = function(){};



/**
 * Reliably determines whether a variable is a Number.
 *
 * @param {Mixed}   value The variable to check
 * @type  {Boolean} `true` if the argument is a number
 */
apf.isNumber = function(value) {
    return parseFloat(value) == value;
};

/**
 * Reliably determines whether a variable is an array. For more information, see 
 * <http://perfectionkills.com/instanceof-considered-harmful-or-how-to-write-a-robust-isarray/>
 *
 * @param {Mixed}   value The variable to check
 * @type  {Boolean} `true` if the argument is an array
 */
apf.isArray = function(value) {
    return Object.prototype.toString.call(value) === "[object Array]";
};

/**
 * Determines whether a string is true (in the HTML attribute sense).
 * @param {Mixed} value The variable to check. Possible truth values include:
 *  - true  
 *  - 'true'
 *  - 'on'  
 *  - 1     
 *  - '1'   
 * @return {Boolean} Whether the string is considered to imply truth.
 */
apf.isTrue = function(c) {
    return (c === true || c === "true" || c === "on" || typeof c == "number" && c > 0 || c === "1");
};

/**
 * Determines whether a string is false (in the HTML attribute sense).
 * @param {Mixed} value The variable to check. Possible false values include:
 *   - false   
 *   - 'false' 
 *   - 'off'   
 *   - 0       
 *   - '0'     
 * @return {Boolean} whether the string is considered to imply untruth.
 */
apf.isFalse = function(c) {
    return (c === false || c === "false" || c === "off" || c === 0 || c === "0");
};

/**
 * Determines whether a value should be considered false. This excludes, amongst
 * others, the number 0.
 * @param {Mixed} value The variable to check
 * @return {Boolean} Whether the variable is considered false.
 */
apf.isNot = function(c) {
    // a var that is null, false, undefined, Infinity, NaN and c isn't a string
    return (!c && typeof c != "string" && c !== 0 || (typeof c == "number" && !isFinite(c)));
};

/*
 * @private
 * @todo why is this done like this?
 */
apf.cancelBubble = function(e, o) {
    if (e.stopPropagation)
        e.stopPropagation()
    else 
        e.cancelBubble = true;
    
    if (o && o.$ext && o.$ext["on" + (e.type || e.name)])
        o.$ext["on" + (e.type || e.name)](e);
    apf.window.$mousedown(e);
};



/*
 * Attempt to fix memory leaks
 * @private
 */
apf.destroyHtmlNode = function (element) {
    if (element && element.parentNode)
        element.parentNode.removeChild(element);
};


/**
 * @private
 */
apf.getRules = function(node) {
    var rules = {};

    for (var w = node.firstChild; w; w = w.nextSibling) {
        if (w.nodeType != 1)
            continue;
        else {
            if (!rules[w.localName])
                rules[w.localName] = [];
            rules[w.localName].push(w);
        }
    }

    return rules;
};


apf.isCoord = function (n) {
    return n || n === 0;
};

apf.getCoord = function (n, other) {
    return n || n === 0 ? n : other;
};

/**
 * @private
 */
apf.getBox = function(value, base) {
    if (!base) base = 0;

    if (value == null || (!parseInt(value) && parseInt(value) != 0))
        return [0, 0, 0, 0];

    var x = String(value).splitSafe(" ");
    for (var i = 0; i < x.length; i++)
        x[i] = parseInt(x[i]) || 0;
    switch (x.length) {
        case 1:
            x[1] = x[0];
            x[2] = x[0];
            x[3] = x[0];
            break;
        case 2:
            x[2] = x[0];
            x[3] = x[1];
            break;
        case 3:
            x[3] = x[1];
            break;
    }

    return x;
};

/**
 * @private
 */
apf.getNode = function(data, tree) {
    var nc = 0;//nodeCount
    //node = 1
    if (data != null) {
        for (var i = 0; i < data.childNodes.length; i++) {
            if (data.childNodes[i].nodeType == 1) {
                if (nc == tree[0]) {
                    data = data.childNodes[i];
                    if (tree.length > 1) {
                        tree.shift();
                        data = this.getNode(data, tree);
                    }
                    return data;
                }
                nc++
            }
        }
    }

    return null;
};

/**
 * Retrieves the first XML node with a `nodeType` of 1 from the children of an XML element.
 * @param {XMLElement} xmlNode The XML element that is the parent of the element to select.
 * @return {XMLElement} The first child element of the XML parent.
 * @throws An error when no child element is found.
 */
apf.getFirstElement = function(xmlNode) {
    

    return xmlNode.firstChild.nodeType == 1
        ? xmlNode.firstChild
        : xmlNode.firstChild.nextSibling;
};

/**
 * Retrieves the last XML node with `nodeType` of 1 from the children of an XML element.
 * @param {XMLElement} xmlNode The XML element that is the parent of the element to select.
 * @return {XMLElement} The last child element of the XML parent.
 * @throw An error when no child element is found.
 */
apf.getLastElement = function(xmlNode) {
    

    return xmlNode.lastChild.nodeType == 1
        ? xmlNode.lastChild
        : xmlNode.lastChild.previousSibling;
};




/**
 * Manages visibility hooks for elements that need to be visible to set their
 * layout.
 *
 * @private
 */
apf.visibilitymanager = function(){
    var tree = {};
    var _self = this;
    var inited = false;
    
    this.check = function(amlNode, type, callback) {
        if (amlNode.$ext.offsetHeight || amlNode.$ext.offsetWidth)
            return true;

        if (amlNode.$visibleCheck) {
            if (amlNode.$visibleCheck[type])
                return;
        }
        else
            amlNode.$visibleCheck = {};

        function cleanup(setInsertion) {
            var p = amlNode;
            while (p) {
                p.removeEventListener("prop.visible", check);
                p.removeEventListener("DOMNodeRemoved", remove); 
                p.removeEventListener("DOMNodeRemovedFromDocument", remove); 
                if (setInsertion)
                    p.addEventListener("DOMNodeInserted", add);
                p = p.parentNode || p.$parentNode;
            }
            
            delete amlNode.$visibleCheck[type];
        }

        function check(e) {
            //apf.isTrue(e.value)
            if (!amlNode.$ext.offsetHeight && !amlNode.$ext.offsetWidth)
                return;
                
            callback.call(amlNode);
            cleanup();
        }
        
        function remove(e) {
            if (e.currentTarget != this)
                return;
            
            cleanup(e.name == "DOMNodeRemoved");
        }

        function add(){
            //Set events on the parent tree
            var p = amlNode;
            while (p) {
                p.addEventListener("prop.visible", check);
                p.addEventListener("DOMNodeRemoved", remove); 
                p.addEventListener("DOMNodeRemovedFromDocument", remove); 
                p.removeEventListener("DOMNodeInserted", add);
                p = p.parentNode || p.$parentNode;
            }
            
            amlNode.$visibleCheck[type] = true;
        }
        
        add();
        
        return false;
    }
};








/**
 * Determines whether a node is a child of another node.
 *
 * @param {DOMNode} pNode      The potential parent element.
 * @param {DOMNode} childnode  The potential child node.
 * @param {Boolean} [orItself] Whether the method also returns `true` when `pNode` is the `childnode`.
 * @return {Boolean} `false` if the second argument is not a child of the first.
 */
apf.isChildOf = function(pNode, childnode, orItself) {
    if (!pNode || !childnode)
        return false;

    if (childnode.nodeType == 2)
        childnode = childnode.ownerElement;

    if (orItself && pNode == childnode)
        return true;

    var loopnode = childnode.parentNode;
    while (loopnode) {
        if (loopnode == pNode)
            return true;
        loopnode = loopnode.parentNode;
    }

    return false;
};

var HTML_ENTITY_MAP = {
    "&": "&#38;",
    "<": "&#60;",
    ">": "&#62;",
    '"': "&#34;",
    "'": "&#39;"
};
var HTML_CHARACTERS_EXPRESSION = /[&"'<>]/gm;
apf.escapeHTML = apf.escapeXML = function(text) {
    return text && text.replace(HTML_CHARACTERS_EXPRESSION, function(c) {
        return HTML_ENTITY_MAP[c] || c;
    });
};

/**
 * Determines whether a node is its parent's only child.
 * @param {DOMNode} node     The potential only child.
 * @param {Array}   nodeType List of the node types that this child can be.
 * @returns {Boolean} Whether the node is the only child and of one of the specified node types.
 */
apf.isOnlyChild = function(node, nodeType) {
    if (!node || !node.parentNode || nodeType && nodeType.indexOf(node.nodeType) == -1)
        return false;

    var i, l, cnode, nodes = node.parentNode.childNodes;
    for (i = 0, l = nodes.length; i < l; i++) {
        cnode = nodes[i];
        if (cnode.nodeType == 1 && cnode != node)
            return false;
        if (cnode.nodeType == 3 && !cnode.nodeValue.trim())
            return false;
    }

    return true;
};

/**
 * Gets the position of a DOM node within the list of child nodes of its
 * parent.
 *
 * @param {DOMNode} node The node for which the child position is being determined.
 * @return {Number} The child position of the node.
 */
apf.getChildNumber = function(node, fromList) {
    if (!node) return -1;

    var p = node.parentNode, j = 0;
    if (!p) return -1;
    if (!fromList)
        fromList = p.childNodes;

    if (fromList.indexOf) {
        var idx = fromList.indexOf(node);
        return idx == -1 ? fromList.length : idx;
    }

    for (var i = 0, l = fromList.length; i < l; i++) {
        if (fromList[i] == node)
            return j;
        j++;
    }
    return -1;
};

/**
 * Sets the node value of a DOM node.
 *
 * @param {XMLElement} xmlNode       The XML node that should receive the node value.
 *                                   When an element node is passed the first text node is set.
 * @param {String}     nodeValue     The value to set.
 * @param {Boolean}    applyChanges  Whether the changes are propagated to the databound elements.
 * @param {apf.UndoData}    undoObj       The undo object that is responsible for archiving the changes.
 */
apf.setNodeValue = function(xmlNode, nodeValue) {
    if (!xmlNode)
        return;

    if (xmlNode.nodeType == 1) {
        if (!xmlNode.firstChild)
            xmlNode.appendChild(xmlNode.ownerDocument.createTextNode(""));

        xmlNode.firstChild.nodeValue = apf.isNot(nodeValue) ? "" : nodeValue;
    }
    else {
        var oldValue = xmlNode.nodeValue;
        xmlNode.nodeValue = nodeValue == null ? "" : String(nodeValue);

        //AML support - getters/setters would be awesome
        if (xmlNode.$triggerUpdate)
            xmlNode.$triggerUpdate(null, oldValue);
    }
};

/**
 * Executes an xpath expression on any DOM node. This is especially useful
 * for DOM nodes that don't have a good native xpath processor, such as HTML
 * in some versions of Internet Explorer and XML in Webkit.
 *
 * @param {DOMNode} contextNode  The XML node that is subject to the query
 * @param {String}  sExpr        The xpath expression
 * @returns {Array} A list of found XML nodes. The list can be empty
 */
apf.queryNodes = function(contextNode, sExpr) {
    return contextNode.selectNodes(sExpr);
};

/**
 * Executes an xpath expression on any DOM node. 
 * This is especially useful for DOM nodes that don't have a good native 
 * xpath processor such as html in some versions of internet explorer and XML in
 * webkit. This function only returns the first node found.
 *
 * @param {DOMNode} contextNode  The DOM node that is subject to the query.
 * @param {String}  sExpr        The xpath expression.
 * @returns {XMLNode} The DOM node, or `null` if none was found.
 */
apf.queryNode = function(contextNode, sExpr) {
    return contextNode.selectSingleNode(sExpr);
};

/**
 * Queries an XML node using xpath for a single string value.
 * @param {XMLElement} xmlNode The XML element to query
 * @param {String}     xpath   The xpath query
 * @return {String} The value of the query result or empty string
 */
apf.queryValue = function (xmlNode, xpath) {
    if (!xmlNode)
        return "";
    if (xmlNode.nodeType == 2)
        return xmlNode.nodeValue;

    if (xpath) {
        xmlNode = apf.queryNode(xmlNode, xpath);
        if (!xmlNode)
            return "";
    }
   return xmlNode.nodeType == 1
        ? (!xmlNode.firstChild ? "" : xmlNode.firstChild.nodeValue)
        : xmlNode.nodeValue;
};


/**
 * Queries an xml node using xpath for multiple string values.
 * @param {XMLElement} xmlNode The xml element to query
 * @param {String}     xpath   The xpath query
 * @return {Array} A list of values resulting from the query
 */
apf.queryValues = function(xmlNode, xpath) {
    var out = [];
    if (!xmlNode) return out;

    var nodes = apf.queryNodes(xmlNode, xpath);
    if (!nodes.length) return out;

    for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (n.nodeType == 1)
            n = n.firstChild;
        out.push(n.nodeValue || "");
    }
    return out;
};


/**
 * Retrieves the attribute of an XML node, or the first parent node that has
 * that attribute set. If no attribute is set, the value is searched for on
 * the appsettings element.
 *
 * @param {XMLElement} xml    The XML node that is the starting point of the search.
 * @param {String}     attr   The name of the attribute.
 * @param {Function}   [func] A callback that is run for every node that is searched.
 * @return {String} The found value, or empty string if none was found.
 */
apf.getInheritedAttribute = function(xml, attr, func) {
    var result, avalue;

    //@todo optimize this and below
    if (xml.nodeType != 1)
        xml = xml.parentNode;

    while (xml && (xml.nodeType != 1 || !(result = attr
      && ((avalue = xml.getAttribute(attr)) || typeof avalue == "string")
      || func && func(xml)))) {
        xml = xml.parentNode;
    }
    if (avalue === "")
        return "";

    return !result && attr && apf.config
        ? apf.config[attr]
        : result;
};

/**
 * Returns the first text or cdata child of a [[term.datanode data node]].
 *
 * @param {XMLElement} x The XML node to search.
 * @return {XMLNode} The found XML node, or `null`.
 */
apf.getTextNode = function(x) {
    for (var i = 0, l = x.childNodes.length; i < l; ++i) {
        if (x.childNodes[i].nodeType == 3 || x.childNodes[i].nodeType == 4)
            return x.childNodes[i];
    }
    return false;
};

/**
 * Creates XML nodes from an XML string recursively.
 *
 * @param {String}  strXml     The XML definition
 * @param {Boolean} [noError]  Whether an exception should be thrown by the parser
 *                             when the XML is not valid
 * @param {Boolean} [preserveWhiteSpace]  Whether whitespace that is present between
 *                                        XML elements should be preserved
 * @return {XMLNode} The created XML node
 */
apf.getXml = function(strXml, noError, preserveWhiteSpace) {
    return apf.getXmlDom(strXml, noError, preserveWhiteSpace).documentElement;
};


/**
 * Manages the z-index of all elements in the UI. It takes care of different
 * regions in the z-dimension preserved for certain common UI scenarios.
 *
 * #### Remarks
 * 
 *  The following regions are defined:
 *  From:         To:           For:
 *           10        10000  Common Elements (each element a unique z index)
 *       100000       110000  Plane (Modal Windows / Maximized Panels) (latest shown highest)
 *       200000       210000  Popup (Menus / Dropdown Containers) (latest shown highest)
 *       300000       310000  Notifiers
 *       400000       410000  Drag Indicators
 *      1000000      1100000  Print
 *
 * @private
 */
apf.zmanager = function(){
    var count = {
        "default" : {
            level: 10
        },
        "plane" : {
            level: 100000
        },
        "popup" : {
            level: 195000
        },
        "notifier" : {
            level: 300000
        },
        "popup+" : {
            level: 350000
        },
        "drag" : {
            level: 400000
        },
        "print" : {
            level: 1000000
        }
    };
    
    this.set = function(type, main, companion) {
        main.style.zIndex = count[type].level++;
        if (companion) {
            //if (companion.$storedZ == undefined)
                companion.$storedZ = companion.style.zIndex;
            companion.style.zIndex = count[type].level++
        }
    }
    
    this.clear = function(main, companion) {
        if (companion.style.zIndex == parseInt(main.style.zIndex) + 1)
            companion.style.zIndex = companion.$storedZ;
        companion.$storedZ = undefined;
    }
};






apf.config = new apf.Class().$init();
apf.extend(apf.config, {
    //Defaults
    disableRightClick: false,
    allowSelect: false,
    allowBlur: true,
    autoDisableActions: true,
    autoDisable: false, /** @todo fix this to only autodisable when createmodel is not true */
    disableF5          : true,
    autoHideLoading: true,
    disableSpace: true,
    defaultPage: "home",
    disableBackspace: true,
    undokeys: false,
    outline: false,
    dragOutline: false,
    resizeOutline: false,
    autoDisableNavKeys: true,
    disableTabbing: false,
    resourcePath: null,
    initdelay: true,
    
    
    skinset: "default",

    tags: {},
    defaults: {},
    baseurl: "",
    
    "empty-message"    : "No items",
    "loading-message"  : "Loading...",
    "offline-message"  : "You are currently offline.",
    
    setDefaults: function(){
        
    },

    getDefault: function(type, prop) {
        var d = this.defaults[type];
        if (!d)
            return;

        for (var i = d.length - 1; i >= 0; i--) {
            if (d[i][0] == prop)
                return d[i][1];
        }
    },

    $handlePropSet: function(name, value) {
        //this[name] = value;
        //@todo I dont want to go through all the code again, maybe later
        this[name.replace(/-(\w)/g, function(m, m1) {
            return m1.toUpperCase()
        })] = this[name] = value;
        
        (this.$propHandlers && this.$propHandlers[name]
          || apf.GuiElement.propHandlers[name] || apf.K).call(this, value);
    },
    
    $inheritProperties: {},
    
    $propHandlers: {
        "skinset" : function(value) {
            if (this.$amlLoaded)
                apf.skins .changeSkinset(value);
        },
        
        
        "outline" : function(value) {
            this.dragOutline = 
            this.resizeOutline = 
            this.outline = apf.isTrue(value);
        },
        "drag-outline" : function(value) {
            this.dragOutline = value
              ? apf.isTrue(value)
              : false;
        },
        "resize-outline" : function(value) {
            this.resizeOutline = value
              ? !apf.isFalse(value)
              : false;
        },
    }
});





apf.layout = {
    compile: function(oHtml) {
        var l = this.layouts[oHtml.getAttribute("id")];
        if (!l) return false;

        var root = l.root.copy();//is there a point to copying?
        
        l.layout.compile(root);
        l.layout.reset();
    },

    removeAll: function(aData) {
        aData.children.length = null

        var htmlId = this.getHtmlId(aData.pHtml);
        if (!this.rules[htmlId])
            delete this.qlist[htmlId];
    },
    
    timer: null,
    qlist: {},
    dlist: [],
    $hasQueue: false,
    
    queue: function(oHtml, obj, compile, q) {
        if (!q) {
            this.$hasQueue = true;
            q = this.qlist;
        }
        
        var id;
        if (!(id = this.getHtmlId(oHtml)))
            id = apf.setUniqueHtmlId(oHtml);
            
        if (q[id]) {
            if (obj)
                q[id][2].push(obj);
            if (compile)
                q[id][1] = compile;
            return;
        }

        q[id] = [oHtml, compile, [obj]];

        if (!this.timer)
            this.timer = apf.setZeroTimeout(function(){
                apf.layout.processQueue();
            });
    },

    processQueue: function(){
        var i, id, l, qItem, list;

        for (i = 0; i < this.dlist.length; i++) {
            if (this.dlist[i].hidden)
                this.dlist[i].hide();
            else
                this.dlist[i].show();
        }

        do {
            var newq = {};
            var qlist = this.qlist;
            this.qlist = {};
            
            this.$hasQueue = false;
            
            for (id in qlist) {
                qItem = qlist[id];
    
                if (qItem[1])
                    apf.layout.compileAlignment(qItem[1]);
    
                list = qItem[2];
                for (i = 0, l = list.length; i < l; i++) {
                    if (list[i]) {
                        if (list[i].$amlDestroyed)
                            continue;
                        //if (list[i].$amlLoaded)
                            list[i].$updateLayout();
                        /*else
                            this.queue(qItem[0], list[i], null, newq);*/
                    }
                }
    
                apf.layout.activateRules(qItem[0]);
            }
        } while (this.$hasQueue);
        
        if (apf.hasSingleRszEvent)
            apf.layout.forceResize();

        this.dlist = [];
        
        apf.setZeroTimeout.clearTimeout(this.timer);
        this.timer = null;
    },
    
    rules: {},
    onresize: {},

    getHtmlId: function(oHtml) {
        return oHtml.getAttribute ? oHtml.getAttribute("id") : 1;
    },

    /**
     * Adds layout rules to the resize event of the browser. Use this instead
     * of `"onresize"` events to add rules that specify determine the layout.
     * @param {HTMLElement} oHtml       The element that triggers the execution of the rules.
     * @param {String}      id          The identifier for the rules within the resize function of this element. Use this to easily update or remove the rules added.
     * @param {String}      rules       The JavaScript code that is executed when the html element resizes.
     * @param {Boolean}     [overwrite] Whether the rules are added to the resize function or overwrite the previous set rules with the specified id.
     */
    setRules: function(oHtml, id, rules, overwrite) {
        if (!this.getHtmlId(oHtml))
            apf.setUniqueHtmlId(oHtml);
        if (!this.rules[this.getHtmlId(oHtml)])
            this.rules[this.getHtmlId(oHtml)] = {};

        var ruleset = this.rules[this.getHtmlId(oHtml)][id];
        if (!overwrite && ruleset) {
            this.rules[this.getHtmlId(oHtml)][id] = rules + "\n" + ruleset;
        }
        else
            this.rules[this.getHtmlId(oHtml)][id] = rules;
    },

    /**
     * Retrieves the rules set for the `"resize"` event of an HTML element specified by an identifier
     * @param {HTMLElement} oHtml       The element that triggers the execution of the rules.
     * @param {String}      id          The identifier for the rules within the resize function of this element.
     */
    getRules: function(oHtml, id) {
        return id
            ? this.rules[this.getHtmlId(oHtml)][id]
            : this.rules[this.getHtmlId(oHtml)];
    },

    /**
     * Removes the rules set for the `"resize"` event of an html element specified by an identifier
     * @param {HTMLElement} oHtml       The element that triggers the execution of the rules.
     * @param {String}      id          The identifier for the rules within the resize function of this element.
     */
    removeRule: function(oHtml, id) {
        var htmlId = this.getHtmlId(oHtml);
        if (!this.rules[htmlId])
            return;

        var ret = this.rules[htmlId][id] ||  false;
        delete this.rules[htmlId][id];

        var prop;
        for (prop in this.rules[htmlId]) {

        }
        if (!prop)
            delete this.rules[htmlId]

        if (apf.hasSingleRszEvent) {
            if (this.onresize[htmlId])
                this.onresize[htmlId] = null;
            else {
                var p = oHtml.parentNode;
                while (p && p.nodeType == 1 && !this.onresize[p.getAttribute("id")]) {
                    p = p.parentNode;
                }
    
                if (p && p.nodeType == 1) {
                    var x = this.onresize[p.getAttribute("id")];
                    if (x.children)
                        delete x.children[htmlId]
                }
            }
        }
        
        return ret;
    },

    /**
     * Activates the rules set for an HTML element
     * @param {HTMLElement} oHtml       The element that triggers the execution of the rules.
     * @param {Boolean} [no_exec]       
     */
    activateRules: function(oHtml, no_exec) {
        if (!oHtml) { //!apf.hasSingleRszEvent &&
            var prop, obj;
            for (prop in this.rules) {
                obj = document.getElementById(prop);
                if (!obj || obj.onresize) // || this.onresize[prop]
                    continue;
                this.activateRules(obj);
            }

             if (apf.hasSingleRszEvent && apf.layout.$onresize)
                apf.layout.$onresize();
            return;
        }

        var rsz, id, rule, rules, strRules = [];
        if (!apf.hasSingleRszEvent) {
            rules = this.rules[this.getHtmlId(oHtml)];
            if (!rules) {
                oHtml.onresize = null;
                return false;
            }

            for (id in rules) { //might need optimization using join()
                if (typeof rules[id] != "string")
                    continue;
                strRules.push(rules[id]);
            }

            rsz = new Function(strRules.join("\n"));

            oHtml.onresize = rsz;
            if (!no_exec) 
                rsz();
        }
        else {
            var htmlId = this.getHtmlId(oHtml);
            rules = this.rules[htmlId];
            if (!rules) {
                //@todo keep .children
                //delete this.onresize[htmlId];
                return false;
            }

            for (id in rules) { //might need optimization using join()
                if (typeof rules[id] != "string")
                    continue;
                strRules.push(rules[id]);
            }
            
            var p = oHtml.parentNode;
            while (p && p.nodeType == 1 && !this.onresize[p.getAttribute("id")]) {
                p = p.parentNode;
            }

            var f = new Function(strRules.join("\n"));//.replace(/try\{/g, "").replace(/}catch\(e\)\{\s*\}/g, "\n")
            if (this.onresize[htmlId])
                f.children = this.onresize[htmlId].children;
            
            if (p && p.nodeType == 1) {
                var x = this.onresize[p.getAttribute("id")];
                this.onresize[htmlId] = (x.children || (x.children = {}))[htmlId] = f;
            }
            else {
                this.onresize[htmlId] = f;
            }
            if (!no_exec)
                f();

            if (!apf.layout.$onresize) {
                var rsz = function(f) {
                    //@todo fix this
                    try{
                        var c = [];
                        for (var name in f)
                            if (f[name])
                                c.unshift(f[name]);
                        for (var i = 0; i < c.length; i++){
                            c[i]();
                            if (c[i].children) {
                                rsz(c[i].children);
                            }
                        }
                    }
                    catch (e) {
                        
                    }
                }
                
                apf.addListener(window, "resize", apf.layout.$onresize = function(){
                    if (apf.config.resize !== false) {
                        rsz(apf.layout.onresize);
                    }
                });
            }
        }
    },

    /**
     * Forces calling the resize rules for an HTML element
     * @param {HTMLElement} oHtml  The element for which the rules are executed.
     */
    forceResize: function(oHtml, force) {
        if (!force) return;
        
        if (apf.hasSingleRszEvent)
            return apf.layout.$onresize && apf.layout.$onresize();

        /* @todo this should be done recursive, old way for now
        apf.hasSingleRszEvent
            ? this.onresize[this.getHtmlId(oHtml)]
            :
        */

        var rsz = oHtml.onresize;
        if (rsz)
            rsz();

        var els = oHtml.getElementsByTagName("*");
        for (var i = 0, l = els.length; i < l; i++) {
            if (els[i] && els[i].onresize)
                els[i].onresize();
        }
    },

    paused: {},

    /**
     * Temporarily disables the resize rules for the HTML element.
     * @param {HTMLElement} oHtml  The element for which the rules are paused.
     * @param {Function}    func   The resize code that is used temporarily for resize of the HTML element.
     */
    pause: function(oHtml, replaceFunc) {
        if (apf.hasSingleRszEvent) {
            var htmlId = this.getHtmlId(oHtml);
            this.paused[htmlId] = this.onresize[htmlId] || true;

            if (replaceFunc) {
                this.onresize[htmlId] = replaceFunc;
                this.onresize[htmlId].children = this.paused[htmlId].children;
                replaceFunc();
            }
            else
                delete this.onresize[htmlId];
        }
        else {
            this.paused[this.getHtmlId(oHtml)] = oHtml.onresize || true;

            if (replaceFunc) {
                oHtml.onresize = replaceFunc;
                replaceFunc();
            }
            else
                oHtml.onresize = null;
        }
    },

    /**
     * Enables paused resize rules for the HTML element
     * @param {HTMLElement} oHtml  The element for which the rules were paused.
     */
    play: function(oHtml) {
        if (!this.paused[this.getHtmlId(oHtml)])
            return;

        if (apf.hasSingleRszEvent) {
            var htmlId = this.getHtmlId(oHtml);
            var oldFunc = this.paused[htmlId];
            if (typeof oldFunc == "function") {
                this.onresize[htmlId] = oldFunc;
                //oldFunc();
            }
            else
                delete this.onresize[htmlId];

            if (apf.layout.$onresize)
                apf.layout.$onresize();

            this.paused[this.getHtmlId(oHtml)] = null;
        }
        else {
            var oldFunc = this.paused[this.getHtmlId(oHtml)];
            if (typeof oldFunc == "function") {
                oHtml.onresize = oldFunc;
                oldFunc();
            }
            else
                oHtml.onresize = null;

            this.paused[this.getHtmlId(oHtml)] = null;
        }
    }
};


/**
 * @private
 */
apf.getWindowWidth = function(){
    return window.innerWidth;
};
/**
 * @private
 */
apf.getWindowHeight = function(){
    return window.innerHeight;
};








// Only add setZeroTimeout to the window object, and hide everything
// else in a closure.
apf.setZeroTimeout = !window.postMessage
  ? (function() {
        function setZeroTimeout() {
            return $setTimeout.apply(null, arguments);
        }
        setZeroTimeout.clearTimeout = function() {
             return clearTimeout.apply(null, arguments);
        };
        return setZeroTimeout;
    })()
  : (function() {
        var timeouts = [];
        var messageName = "zero-timeout-message";

        // Like setTimeout, but only takes a function argument.  There's
        // no time argument (always zero) and no arguments (you have to
        // use a closure).
        function setZeroTimeout(fn) {
            var id = timeouts.push(fn);
            window.postMessage(messageName, "*");
            return id;
        }
        
        setZeroTimeout.clearTimeout = function(id) {
            timeouts[id] = null;
        }

        function handleMessage(e) {
            if (!e) e = event;
            if (e.source == window && e.data == messageName) {
                apf.stopPropagation(e);
                if (timeouts.length > 0 && (t = timeouts.shift()))
                    t();
            }
        }

        apf.addListener(window, "message", handleMessage, true);

        // Add the one thing we want added to the window object.
        return setZeroTimeout;
    })();




/*
 *
 */
apf.queue = {
    //@todo apf3.0
    q: {},

    timer: null,
    add: function(id, f) {
        this.q[id] = f;
        if (!this.timer)
            
            this.timer = apf.setZeroTimeout(function(){
                apf.queue.empty();
            });
            
    },

    remove: function(id) {
        delete this.q[id];
    },

    empty: function(prop) {
        
        apf.setZeroTimeout.clearTimeout(this.timer);
        
        this.timer = null;

        
        if (apf.layout && apf.layout.$hasQueue)
            apf.layout.processQueue();
        
        

        var q = this.q;
        this.q = {};
        for (var prop in q) {
            var f = q[prop];
            if (f) {
                delete q[prop];
                f();
            }
        }
    }
};












function xmlToHtml(xmlNode, shallow) {
    if (xmlNode.nodeType == 1 && xmlNode.localName != "style") {
        var el = document.createElement(xmlNode.localName)
        var ch = xmlNode.childNodes;
        if (!shallow) {
            for (var i = 0; i < ch.length; i++) {
                var childEl = xmlToHtml(ch[i]);
                if (childEl)
                    el.appendChild(childEl);
            }
        }
        var attr = xmlNode.attributes;
        for (var i = 0; i < attr.length; i++) {
            el.setAttribute(attr[i].name, attr[i].nodeValue);
        }
        return el;
    } else  if (xmlNode.nodeType == 3) {
        var el = document.createTextNode(xmlNode.nodeValue);
        // el.nodeValue = ;
        return el;
    }
}
/**
 * 
 * Controls the skinning modifications for AML.
 *
 * @private
 */
apf.skins = {
    skins: {},
    css: [],
    // @TODO Doc these ?
    events: ["onmousemove", "onmousedown", "onmouseup", "onmouseout",
        "onclick", "ondragcopy", "ondragstart", "ondblclick"],

    /* ***********
     Init
     ************/
    Init: function(xmlNode, refNode, path) {
        /*
         get data from refNode || xmlNode
         - name
         - icon-path
         - media-path

         all paths of the xmlNode are relative to the src attribute of refNode
         all paths of the refNode are relative to the index.html
         images/ is replaced if there is a refNode to the relative path from index to the skin + /images/
         */
        var name = (refNode ? refNode.getAttribute("id") : null)
            || xmlNode.getAttribute("id");
        var base = (refNode ? (refNode.getAttribute("src") || "").match(/\//) || path : "")
            ? (path || refNode.getAttribute("src")).replace(/\/[^\/]*$/, "") + "/"
            : ""; //@todo make this absolute?

        var mediaPath = null, iconPath = null;
        mediaPath = xmlNode.getAttribute("media-path");
        if (mediaPath !== null)
            mediaPath = apf.getAbsolutePath(base || apf.hostPath, mediaPath);
        else if (refNode) {
            mediaPath = refNode.getAttribute("media-path");
            if (mediaPath !== null)
                mediaPath = apf.getAbsolutePath(apf.hostPath, mediaPath);
            else
                mediaPath = apf.getAbsolutePath(base || apf.hostPath, "images/");
        }
        
        iconPath = xmlNode.getAttribute("icon-path");
        if (iconPath !== null)
            iconPath = apf.getAbsolutePath(base || apf.hostPath, iconPath);
        else if (refNode) {
            iconPath = refNode.getAttribute("icon-path");
            if (iconPath !== null)
                iconPath = apf.getAbsolutePath(apf.hostPath, iconPath);
            else
                iconPath = apf.getAbsolutePath(base || apf.hostPath, "icons/");
        }
        
        if (!name)
            name = "default";

        if (xmlNode.getAttribute("id"))
            document.body.className += " " + xmlNode.getAttribute("id");

        var names = name.split("|");
        name = names[0];

        if (!this.skins[name] || name == "default") {
            this.skins[name] = {
                base: base,
                name: name,
                iconPath: iconPath,
                mediaPath: mediaPath,
                templates: {},
                originals: {},
                xml: xmlNode
            }
            
            if (names.length > 1) {
                for (var i = 0; i < names.length; i++)
                    this.skins[names[i]] = this.skins[name];
            }
        }
        
        if (!this.skins["default"] && this.$first == refNode)
            this.skins["default"] = this.skins[name];

        var nodes = xmlNode.childNodes;
        for (var i = nodes.length - 1; i >= 0; i--) {
            if (nodes[i].nodeType != 1)
                continue;

            //this.templates[nodes[i].tagName] = nodes[i];
            var htmlNode = xmlToHtml(nodes[i]);
            this.skins[name].templates[htmlNode.getAttribute("name")] = htmlNode;
            if (nodes[i].ownerDocument)
                this.importSkinDef(nodes[i], base, name, htmlNode);
        }

        this.purgeCss(mediaPath, iconPath);
    },

    /* ***********
     Import
     ************/
    importSkinDef: function(xmlNode, basepath, name, htmlNode) {
        var i, l, nodes = $xmlns(xmlNode, "style", apf.ns.aml), tnode, node;
        for (i = 0, l = nodes.length; i < l; i++) {
            node = nodes[i];

            var test = true;
            if (node.getAttribute("condition")) {
                try {
                    test = eval(node.getAttribute("condition"));
                }
                catch (e) {
                    test = false;
                }
            }

            if (test) {
                tnode = node.firstChild;
                while (tnode) {
                    this.css.push(tnode.nodeValue);
                    tnode = tnode.nextSibling;
                }
            }
            
            node.remove();
        }

        nodes = $xmlns(xmlNode, "alias", apf.ns.apf);
        var t = this.skins[name].templates;
        for (i = 0; i < nodes.length; i++) {
            if (!nodes[i].firstChild)
                continue;
            t[nodes[i].firstChild.nodeValue.toLowerCase()] = htmlNode || xmlNode;
        }
    },

    loadedCss: "",
    purgeCss: function(imagepath, iconpath) {
        if (!this.css.length)
            return;

        var cssString = this.css.join("\n").replace(/images\//g, imagepath).replace(/icons\//g, iconpath);
        apf.preProcessCSS(cssString);

        

        this.css = [];
    },

    /* ***********
     Retrieve
     ************/
    setSkinPaths: function(skinName, amlNode) {
        skinName = skinName.split(":");
        var name = skinName[0];
        var type = skinName[1];

        amlNode.iconPath = this.skins[name].iconPath;
        amlNode.mediaPath = this.skins[name].mediaPath;
    },

    getTemplate: function(skinName, noError) {
        skinName = skinName.split(":");
        var name = skinName[0];
        var type = skinName[1];

        if (!this.skins[name]) {
            if (noError)
                return false;
            
            
            
            return false;
        }

        if (!this.skins[name].templates[type])
            return false;

        var skin = this.skins[name].templates[type];
        var originals = this.skins[name].originals[type];
        if (!originals) {
            originals = this.skins[name].originals[type] = {};

            

            var nodes = $xmlns(skin, "presentation", apf.ns.aml)[0].childNodes;
            for (var i = 0; i < nodes.length; i++) {
                if (nodes[i].nodeType != 1) continue;
                originals[nodes[i].localName] = nodes[i];
            }
        }

        /*for (var item in originals) {
            pNodes[item] = originals[item];
        }*/

        return originals;
    },

    changeSkinset: function(value) {
        var node = apf.document.documentElement;
        while (node) {
            if (node && node.nodeFunc == apf.NODE_VISIBLE
              && node.hasFeature(apf.__PRESENTATION__) && !node.skinset) {
                node.$propHandlers["skinset"].call(node, value);//$forceSkinChange
                node.skinset = null;
            }

            //Walk tree
            if (node.firstChild || node.nextSibling) {
                node = node.firstChild || node.nextSibling;
            }
            else {
                do {
                    node = node.parentNode;
                } while (node && !node.nextSibling)

                if (node)
                    node = node.nextSibling;
            }
        }
    },
    
    setIcon: function(oHtml, strQuery, iconPath) {
        if (!strQuery) {
            oHtml.style.backgroundImage = "";
            return;
        }

        if (oHtml.tagName.toLowerCase() == "img") {
            oHtml.setAttribute("src", strQuery
                ? (iconPath || "") + strQuery
                : "");
            return;
        }

        //Assuming image url
        if (strQuery && typeof strQuery == "string" && !apf.isTrue(strQuery)) {
            var isQualified = strQuery.match(/^(https?|file):/);
            oHtml.style.backgroundImage = "url(" + (isQualified ? "" : iconPath || "")
                + strQuery + ")";
        }
    }
};






/**
 * The library that is used for the animations inside elements.
 *
 * @class apf.tween
 *
 * @default_private
 */
apf.tween = (function(apf) {

var modules = {
        //Animation Modules
    left: function(oHtml, value) {
        oHtml.style.left = value + PX;
    },
    right: function(oHtml, value) {
        oHtml.style.left = "";
        oHtml.style.right = value + PX;
    },
    top: function(oHtml, value) {
        oHtml.style.top = value + PX;
    },
    bottom: function(oHtml, value) {
        oHtml.style.top = "";
        oHtml.style.bottom = value + PX;
    },
    width: function(oHtml, value, center) {
        oHtml.style.width = value + PX;
    },
    height: function(oHtml, value, center) {
        oHtml.style.height = value + PX;
    },
    scrollTop: function(oHtml, value, center) {
        oHtml.scrollTop = value;
    },
    scrollLeft: function(oHtml, value, center) {
        oHtml.scrollLeft = value;
    },
    paddingTop: function(oHtml, value, center) {
        oHtml.style.paddingTop = value + "px";
    },
    boxFlex: function(oHtml, value, center) {
        oHtml.style[apf.CSS_FLEX_PROP] = value;
    },
    boxFlexGrow: function(oHtml, value, center) {
        oHtml.style[apf.CSS_FLEX_PROP + "-grow"] = value;
    },
    "height-rsz": function(oHtml, value, center) {
        oHtml.style.height = value + PX;
        if (apf.hasSingleResizeEvent && apf.layout.$onresize)
            apf.layout.$onresize();
    },
    mwidth: function(oHtml, value, info) {
        var diff = apf.getDiff(oHtml);
        oHtml.style.width = value + PX;
        oHtml.style.marginLeft = -1 * (value / 2 + (parseInt(apf.getStyle(oHtml,
            "borderLeftWidth")) || diff[0]/2) + (info.margin || 0)) + PX;
    },
    mheight: function(oHtml, value, info) {
        var diff = apf.getDiff(oHtml);
        oHtml.style.height = value + PX;
        oHtml.style.marginTop = (-1 * value / 2 - (parseInt(apf.getStyle(oHtml,
            "borderTopWidth")) || diff[1]/2) + (info.margin || 0)) + PX;
    },
    scrollwidth: function(oHtml, value) {
        oHtml.style.width = value + PX;
        oHtml.scrollLeft = oHtml.scrollWidth;
    },
    scrollheight_old: function(oHtml, value) {
        try {
            oHtml.style.height = value + PX;
            oHtml.scrollTop = oHtml.scrollHeight;
        }
        catch (e) {
            alert(value)
        }
    },
    scrollheight: function(oHtml, value, info) {
        var diff = apf.getHeightDiff(oHtml),
            oInt = info.$int || oHtml;

        oHtml.style.height = Math.max((value + (info.diff || 0)), 0) + PX;
        oInt.scrollTop = oInt.scrollHeight - oInt.offsetHeight - diff 
            + (info.diff || 0) - (apf.isGecko ? 16 : 0); //@todo where does this 16 come from??
    },
    scrolltop: function(oHtml, value) {
        oHtml.style.height = value + PX;
        oHtml.style.top = (-1 * value - 2) + PX;
        oHtml.scrollTop = 0;//oHtml.scrollHeight - oHtml.offsetHeight;
    },
    clipright: function(oHtml, value, center) {
        oHtml.style.clip = "rect(auto, auto, auto, " + value + "px)";
        oHtml.style.marginLeft = (-1 * value) + PX;
    },
    fade: function(oHtml, value) {
        oHtml.style.opacity = value;
    },
    bgcolor: function(oHtml, value) {
        oHtml.style.backgroundColor = value;
    },
    textcolor: function(oHtml, value) {
        oHtml.style.color = value;
    },
    htmlcss: function(oHtml, value, obj) {
        oHtml.style[obj.type] = value + (obj.needsPx ? PX : "");
    },
    transformscale: function(oHtml, value, obj) {
        oHtml.style[obj.type] = SCALEA + parseFloat(value) + SCALEB;
    },
    transformrotate: function(oHtml, value, obj) {
        oHtml.style[obj.type] = ROTATEA + parseFloat(value) + ROTATEB;
    },
    transformvalscale: function(value) {
        return SCALEA + parseFloat(value) + SCALEB;
    },
    transformvalrotate: function(value) {
        return ROTATEA + parseFloat(value) + ROTATEB;
    }
};

var ID = "id",
    PX = "px",
    NUM = "number",
    TRANSVAL = "transformval",
    TRANSFORM = "transform",
    SCALE = "scale",
    SCALEA = "scale(",
    ROTATEA = "rotate(",
    SCALEB = ")",
    ROTATEB = "deg)",
    CSSTIMING = ["linear", "ease-in", "ease-out", "ease", "ease-in-out", "cubic-bezier"],
    CSSPROPS = {
        "left"        : "left",
        "right"       : "right",
        "top"         : "top",
        "bottom"      : "bottom",
        "width"       : "width",
        "height"      : "height",
        "scrollTop"   : false,
        "scrollLeft"  : false,
        "mwidth"      : false,
        "mheight"     : false,
        "scrollwidth" : false,
        "scrollheight": false,
        "fade"        : "opacity",
        "opacity"     : "opacity",
        "bgcolor"     : "background-color",
        "textcolor"   : "color",
        "transform"   : "transform"
    },
    __pow = Math.pow,
    __round = Math.round,

    queue = {},

    current= null,

    setQueue = function(oHtml, stepFunction) {
        var id = oHtml.getAttribute(ID);
        if (!id) {
            apf.setUniqueHtmlId(oHtml);
            id = oHtml.getAttribute(ID);
        }

        if (!queue[id])
            queue[id] = [];

        queue[id].push(stepFunction);
        if (queue[id].length == 1)
            stepFunction(0);
    },

    nextQueue = function(oHtml) {
        var q = queue[oHtml.getAttribute(ID)];
        if (!q) return;

        q.shift(); //Remove current step function

        if (q.length)
            q[0](0);
    },

    clearQueue = function(oHtml, bStop) {
        var q = queue[oHtml.getAttribute(ID)];
        if (!q) return;

        if (bStop && current && current.control)
            current.control.stop = true;
        q.length = 0;
    },

    purgeQueue = function(oHtml) {
        var id = oHtml.getAttribute(ID);
        if (!id) {
            apf.setUniqueHtmlId(oHtml);
            id = oHtml.getAttribute(ID);
        }

        for (var i in queue) {
            if (i == id)
                queue[i] = [];
        }
    },

     // @TODO Doc
    /**
     * Calculates all the steps of an animation between a
     * begin and end value based on three tween strategies
     *
     * @method calcSteps
     * @param func {Function}
     * @param fromValue {String}
     * @param fromValue {String}
     * @param nrOfSteps {Number}
     */
    calcSteps = function(func, fromValue, toValue, nrOfSteps) {
        var i = 0,
            l = nrOfSteps - 1,
            steps = [fromValue];

        // backward compatibility...
        if (typeof func == NUM) {
            if (!func)
                func = apf.tween.linear;
            else if (func == 1)
                func = apf.tween.easeInCubic;
            else if (func == 2)
                func = apf.tween.easeOutCubic;
        }

        /*
        func should have the following signature:
        func(t, x_min, dx)
        where 0 <= t <= 1, dx = x_max - x_min

        easeInCubic: function(t, x_min, dx) {
            return dx * pow(t, 3) + x_min;
        }
        */
        for (i = 0; i < l; ++i)
            steps.push(func(i / nrOfSteps, fromValue, toValue - fromValue));
        steps.push(toValue);
        
        return steps;
    },

     // @TODO Doc
    /**
     * Calculates all the steps of an animation between a
     * begin and end value for colors
     *  
     * @method calcColorSteps   
     * @param animtype {Function}
     * @param fromValue {String}
     * @param fromValue {String}
     * @param nrOfSteps {Number}
     */
    calcColorSteps = function(animtype, fromValue, toValue, nrOfSteps) {
        var d2, d1,
            c = apf.color.colorshex,
            a = parseInt((c[fromValue] || fromValue).slice(1), 16),
            b = parseInt((c[toValue] || toValue).slice(1), 16),
            i = 0,
            out = [];

        for (; i < nrOfSteps; i++){
            d1 = i / (nrOfSteps - 1), d2 = 1 - d1;
            out[out.length] = "#" + ("000000" +
                ((__round((a & 0xff) * d2 + (b & 0xff) * d1) & 0xff) |
                (__round((a & 0xff00) * d2 + (b & 0xff00) * d1) & 0xff00) |
                (__round((a & 0xff0000) * d2 + (b & 0xff0000) * d1) & 0xff0000)).toString(16)).slice(-6);
        }

        return out;
    },

     // @TODO Doc wtf is stop ?
    /**
     * Tweens a single property of a single element or HTML element from a
     * start to an end value.
     * 
     * #### Example
     * 
     * ```javascript
     *  apf.tween.single(myDiv, {
     *      type : "left",
     *      from : 10,
     *      to   : 100,
     *      anim : apf.tween.EASEIN
     *  });
     * ```
     *
     * #### Example
     * 
     * Multiple animations can be run after each other
     * by calling this function multiple times.
     * 
     * ```javascript
     *  apf.tween.single(myDiv, options).single(myDiv2, options2);
     * ```
     *
     * @method single
     * @param {DOMNode}  oHtml The object to animate.
     * @param {Object}   info  The animation settings. The following properties are available:
     *   - type ([[String]]): The property to be animated. These are predefined
     *                          property handlers and can be added by adding a
     *                          method to `apf.tween` with the name of the property
     *                          modifier. There are several handlers available.
     *      - `"left"`:            Sets the left position
     *      - `"right"`:           Sets the right position
     *      - `"top"`:            Sets the top position
     *      - `"bottom"`:          Sets the bottom position
     *      - `"width"` :          Sets the horizontal size
     *      - `"height"`:          Sets the vertical size
     *      - `"scrollTop"`:       Sets the scoll position
     *      - `"mwidth"` :         Sets the width and the margin-left to width/2
     *      - `"mheight"` :        Sets the height ant the margin-top to height/2
     *      - `"scrollwidth"`:     Sets the width an sets the scroll to the maximum size
     *      - `"scrollheight"`:    Sets the height an sets the scroll to the maximum size
     *      - `"scrolltop"` :      Sets the height and the top as the negative height value
     *      - `"fade"` :           Sets the opacity property
     *      - `"bgcolor"`:         Sets the background color
     *      - `"textcolor"`:       Sets the text color
     *   - from ([[Number]] or [[String]]): The start value of the animation
     *   - to ([[Number]] or [[String]]): The end value of the animation
     *   - [steps] ([[Number]]): The number of steps to divide the tween in
     *   - [interval] ([[Number]]): The time between each step
     *   - [anim] ([[Number]]): The distribution of change between the step over the entire animation.             
     *   - [color] ([[Boolean]]): Specifies whether the specified values are colors
     *   - [userdata] (`Mixed`): Any data you would like to have available in your callback methods
     *   - [onfinish] ([[Function]]): A function that is called at the end of the animation
     *   - [oneach] ([[Function]]): A function that is called at each step of the animation
     *   - [control] ([[Object]]): An object that can stop the animation at any point
     *     Methods:
     *     stop                 set on the object passed .
     */
    single = function(oHtml, info) {
        info = apf.extend({steps: 10, interval: 5, anim: apf.tween.linear, control: {}}, info);
        info.steps = Math.ceil(info.steps * apf.animSteps);
        info.interval = Math.ceil(info.interval * apf.animInterval);

        if (oHtml.nodeFunc > 100) {
            info.$int = oHtml.$int;
            oHtml = oHtml.$ext;
        }
        try { //@TODO hack where currentStyle is still undefined
            if ("fixed|absolute|relative".indexOf(apf.getStyle(oHtml, "position")) == -1)
                oHtml.style.position = "relative";
        } catch (e) {}
        
        var useCSSAnim = (false && apf.supportCSSAnim && apf.supportCSSTransition && CSSPROPS[info.type]),
            isTransform = (info.type == TRANSFORM);

        info.method = useCSSAnim ? info.type : isTransform
            ? modules[TRANSFORM + (info.subType || SCALE)]
            : modules[info.type]
                ? modules[info.type]
                : (info.needsPx = needsPix[info.type] || false)
                    ? modules.htmlcss
                    : modules.htmlcss;

        

        if (useCSSAnim) {
            var type = CSSPROPS[info.type];
            if (type === false)
                return apf.tween;
            info.type = type || info.type;
            if (isTransform) {
                if (!info.subType)
                    info.subType = SCALE;
                info.type = apf.supportCSSAnim;
            }

            var transform = (isTransform)
                ? modules[TRANSVAL + (info.subType || SCALE)]
                : null;

            oHtml.style[info.type] = isTransform
                ? transform(info.from)
                : info.from + (needsPix[info.type] ? PX : "");
            $setTimeout(function() {
                oHtml.style[info.type] = isTransform
                    ? transform(info.to)
                    : info.to + (needsPix[info.type] ? PX : "");
                oHtml.offsetTop; //force style recalc
                oHtml.style[apf.cssPrefix + "Transition"] = info.type + " " + ((info.steps
                    * info.interval) / 1000) + "s "
                    + CSSTIMING[info.anim || 0];
                var f = function() {
                    if (info.onfinish)
                        info.onfinish(oHtml, info.userdata);
                    oHtml.style[apf.cssPrefix + "Transition"] = "";
                    oHtml.removeEventListener(apf.cssAnimEvent, f);
                };
                oHtml.addEventListener(apf.cssAnimEvent, f);
            });
            return apf.tween;
        }

        if (info.control) {
            info.control.state = apf.tween.RUNNING;
            info.control.stop = function(){
                info.control.state = apf.tween.STOPPING;
                clearQueue(oHtml);
                if (info.onstop)
                    info.onstop(oHtml, info.userdata);
            }
        }

        var steps = info.color
                ? calcColorSteps(info.anim, info.from, info.to, info.steps)
                : calcSteps(info.anim, parseFloat(info.from), parseFloat(info.to), info.steps),
            stepFunction = function(step) {
                if (info.control && info.control.state) {
                    info.control.state = apf.tween.STOPPED;
                    return;
                }
                
                current = info;

                if (info.onbeforeeach
                  && info.onbeforeeach(oHtml, info.userdata) === false)
                    return;

                try {
                   info.method(oHtml, steps[step], info);
                }
                catch (e) {}

                if (info.oneach)
                    info.oneach(oHtml, info.userdata);

                if (step < info.steps)
                    return $setTimeout(function(){stepFunction(step + 1)}, info.interval);

                current = null;
                if (info.control)
                    info.control.state = apf.tween.STOPPED;
                if (info.onfinish)
                    info.onfinish(oHtml, info.userdata);

                nextQueue(oHtml);
            };

        if (info.type.indexOf("scroll") > -1)
            purgeQueue(oHtml);
        setQueue(oHtml, stepFunction);

        return apf.tween;
    },

     // @TODO Doc wtf is stop
    /**
     * Tweens multiple properties of a single element or html element from a
     * start to an end value.
     * 
     * #### Example
     *
     * Here we are, animating both the left and width at the same time:
     *
     * ```javascript
     *  apf.tween.multi(myDiv, {
     *      anim   : apf.tween.EASEIN
     *      tweens : [{
     *          type : "left",
     *          from : 10,
     *          to   : 100,
     *      },
     *      {
     *          type : "width",
     *          from : 100,
     *          to   : 400,
     *      }]
     *  });
     * ````
     *
     * #### Example
     *
     * Multiple animations can be run after each other
     * by calling this function multiple times.
     *
     * ```javascript
     *  apf.tween.multi(myDiv, options).multi(myDiv2, options2);
     * ```
     *
     * @method multi
     * @param {DOMNode}  oHtml The object to animate.
     * @param {Object} info The settings of the animation. It contains the following properties:
     *   - [steps] ([[Number]]): The number of steps to divide the tween in
     *   - [interval] ([[Number]]): The time between each step
     *   - [anim] ([[Number]]): The distribution of change between the step over
     *                          the entire animation
     *   - [onfinish] ([[Function]]): A function that is called at the end of the animation
     *   - [oneach] ([[Function]]): A function that is called at each step of the animation
     *   - [oHtml] ([[HTMLElement]]): Another HTML element to animate.
     *   - [control] ([[Object]]): An object that can stop the animation at any point. It contains the following properties:
     *     - stop ([[Boolean]]): Specifies whether the animation should stop.
     *   - [tweens] ([[Array]]): A collection of simple objects specifying the single
     *                          value animations that are to be executed simultaneously.
     *                          (for the properties of these single tweens see the
     *                          [[apf.tween.single]] method).
     */
    multi = function(oHtml, info) { 
        info = apf.extend({steps: 10, interval: 5, anim: apf.tween.linear, control: {}}, info);
        info.steps = Math.ceil(info.steps * apf.animSteps);
        info.interval = Math.ceil(info.interval * apf.animInterval);

        if (oHtml.nodeFunc > 100) {
            info.$int = oHtml.$int;
            oHtml = oHtml.$ext;
        }

        var animCSS, isTransform,
            useCSSAnim = false && apf.supportCSSAnim && apf.supportCSSTransition,
            hasCSSAnims = false,
            cssDuration = ((info.steps * info.interval) / 1000),
            cssAnim = CSSTIMING[info.anim || 0],
            steps = [],
            stepsTo = [],
            i = 0,
            l = info.tweens.length;

        for (; i < l; i++) {
            var data = info.tweens[i];

            if (data.oHtml && data.oHtml.nodeFunc > 100) {
                data.$int = data.oHtml.$int;
                data.oHtml = data.oHtml.$ext;
            }

            animCSS = (useCSSAnim && CSSPROPS[data.type]);
            isTransform = (data.type == TRANSFORM);
            if (isTransform) {
                if (!data.subType)
                    data.subType = SCALE;
                data.type = apf.supportCSSAnim;
            }

            data.method = animCSS
                ? data.type
                : isTransform
                    ? modules[TRANSFORM + (data.subType)]
                    : modules[data.type]
                        ? modules[data.type]
                        : (data.needsPx = needsPix[data.type] || false)
                            ? modules.htmlcss
                            : modules.htmlcss;


            

            if (animCSS) {
                var type = isTransform ? data.type : CSSPROPS[data.type];
                data.type = type || data.type;
                var transform = modules[TRANSVAL + (data.subType)]

                oHtml.style[data.type] = isTransform
                    ? transform(data.from)
                    : data.from + (needsPix[data.type] ? PX : "");
                stepsTo.push([data.type, isTransform
                    ? transform(data.to)
                    : data.to + (needsPix[data.type] ? PX : "")]);
                steps.push(data.type + " " + cssDuration + "s " + cssAnim + " 0");

                hasCSSAnims = true;
            }
            else {
                steps.push(data.color
                    ? calcColorSteps(info.anim, data.from, data.to, info.steps)
                    : calcSteps(info.anim, parseFloat(data.from), parseFloat(data.to), info.steps));
            }
        }

        if (hasCSSAnims) {
            oHtml.style[apf.cssPrefix + "Transition"] = steps.join(",");
            oHtml.offsetTop; //force style recalc
            var count = 0,
                func = function() {
                    count++;
                    if (count == stepsTo.length) {
                        if (info.onfinish)
                            info.onfinish(oHtml, info.userdata);
                        oHtml.style[apf.cssPrefix + "Transition"] = "";
                        oHtml.removeEventListener(apf.cssAnimEvent, func);
                    }
                };
            oHtml.addEventListener(apf.cssAnimEvent, func, false);
            for (var k = 0, j = stepsTo.length; k < j; k++)
                oHtml.style[stepsTo[k][0]] = stepsTo[k][1];
            return apf.tween;
        }
        
        if (info.control) {
            info.control.state = apf.tween.RUNNING;
            info.control.stop = function(){
                if (info.control.state == apf.tween.STOPPED)
                    return;
                
                info.control.state = apf.tween.STOPPING;
                clearQueue(oHtml);
                if (info.onstop)
                    info.onstop(oHtml, info.userdata);
            }
        }

        var tweens = info.tweens,
            stepFunction = function(step) {
                if (info.control && info.control.state) {
                    info.control.state = apf.tween.STOPPED;
                    return;
                }
                
                current = info;

                try {
                    for (var i = 0; i < steps.length; i++) {
                        tweens[i].method(tweens[i].oHtml || oHtml,
                          steps[i][step], tweens[i]);
                    }
                } catch (e) {}

                if (info.oneach)
                    info.oneach(oHtml, info.userdata);

                if (step < info.steps)
                    return $setTimeout(function(){stepFunction(step + 1)}, info.interval);

                current = null;
                if (info.control)
                    info.control.state = apf.tween.STOPPED;
                if (info.onfinish)
                    info.onfinish(oHtml, info.userdata);

                nextQueue(oHtml);
            };

        setQueue(oHtml, stepFunction);

        return apf.tween;
    },

    /**
     * Tweens an element or HTML element from its current state to a CSS class.
     *
     * #### Example
     *
     * Multiple animations can be run after each other by calling this function
     * multiple times.
     * 
     * ```javascript
     *  apf.tween.css(myDiv, 'class1').multi(myDiv2, 'class2');
     * ```
     *
     * @method apf.tween.css
     * @param {DOMNode}  oHtml The object to animate.
     * @param {String} className The class name that defines the CSS properties to be set or removed.
     * @param {Object} info The settings of the animation. The following properties are available:
     *   Properties:
     *   - [steps] ([[Number]]): The number of steps to divide the tween in
     *   - [interval] ([[Number]]): The time between each step
     *   - [anim] ([[Number]]): The distribution of change between the step over the entire animation
     *   - [onfinish] ([[Function]]): A function that is called at the end of the animation
     *   - [oneach] ([[Function]]): A function that is called at each step of the animation
     *   - [control] ([[Object]]): An object that can stop the animation at any point. It contains the following property:
     *     - stop ([[Boolean]]): Specifies whether the animation should stop.
     * @param {Boolean} remove Specifies whether the class is set or removed from the element
     */
    css = function(oHtml, className, info, remove) {
        (info = info || {}).tweens = [];

        if (oHtml.nodeFunc > 100)
            oHtml = oHtml.$ext;

        if (remove)
            apf.setStyleClass(oHtml, "", [className]);

        var resetAnim = function(remove, callback) {
            if (remove)
                apf.setStyleClass(oHtml, "", [className]);
            else
                apf.setStyleClass(oHtml, className);

            //Reset CSS values
            for (var i = 0; i < info.tweens.length; i++){
                if (info.tweens[i].type == "filter")
                    continue;

                oHtml.style[info.tweens[i].type] = "";
            }

            if (callback)
                callback.apply(this, arguments);
        }

        var onfinish = info.onfinish,
            onstop = info.onstop;
        info.onfinish = function(){resetAnim(remove, onfinish);}
        info.onstop = function(){resetAnim(!remove, onstop);}

        var result, newvalue, curvalue, j, isColor, style, rules, i,
            tweens = {};
        for (i = 0; i < document.styleSheets.length; i++) {
            try { rules = document.styleSheets[i].cssRules; } 
            catch(e) { rules = false; }
            
            if (!rules || !rules.length)
                continue;
            for (j = rules.length - 1; j >= 0; j--) {
                var rule = rules[j];

                if (!rule.style || !(rule.selectorText || "").match("\." + className + "$"))
                    continue;

                for (style in rule.style) {
                    if (!rule.style[style] || cssProps.indexOf("|" + style + "|") == -1)
                        continue;

                    if (style == "filter") {
                        if (!rule.style[style].match(/opacity\=([\d\.]+)/))
                            continue;
                        newvalue = RegExp.$1;

                        result = (apf.getStyleRecur(oHtml, style) || "")
                            .match(/opacity\=([\d\.]+)/);
                        curvalue = result ? RegExp.$1 : 100;
                        isColor = false;

                        if (newvalue == curvalue) {
                            if (remove) curvalue = 100;
                            else newvalue = 100;
                        }
                    }
                    else {
                        newvalue = remove && oHtml.style[style] || rule.style[style];
                        if (remove) oHtml.style[style] = "";
                        curvalue = apf.getStyleRecur(oHtml, style);
                        isColor = style.match(/color/i) ? true : false;
                    }

                    tweens[style] = {
                        type: style,
                        from: (isColor ? String : parseFloat)(remove
                                    ? newvalue
                                    : curvalue),
                        to: (isColor ? String : parseFloat)(remove
                                    ? curvalue
                                    : newvalue),
                        color: isColor,
                        needsPx: needsPix[style.toLowerCase()] || false
                    };
                }
            }
        }

        for (var prop in tweens)
            info.tweens.push(tweens[prop]);

        if (remove)
            apf.setStyleClass(oHtml, className);

        return multi(oHtml, info);
    },

    cssRemove = function(oHtml, className, info) {
        css(oHtml, className, info, true);
    },

    needsPix = {
        "left"        : true,
        "top"         : true,
        "bottom"      : true,
        "right"       : true,
        "width"       : true,
        "height"      : true,
        "fontSize"    : true,
        "lineHeight"  : true,
        "textIndent"  : true,
        "marginLeft"  : true,
        "marginTop"   : true,
        "marginRight" : true,
        "marginBottom": true
    },

    cssProps = "|backgroundColor|backgroundPosition|color|width|filter"
             + "|height|left|top|bottom|right|fontSize"
             + "|letterSpacing|lineHeight|textIndent|opacity"
             + "|paddingLeft|paddingTop|paddingRight|paddingBottom"
             + "|borderLeftWidth|borderTopWidth|borderRightWidth|borderBottomWidth"
             + "|borderLeftColor|borderTopColor|borderRightColor|borderBottomColor"
             + "|marginLeft|marginTop|marginRight|marginBottom"
             + "|transform|", // transforms are special and get special treatment
    cssTransforms = "|scale|rotate|";

return {
    single: single,
    multi: multi,
    css: css,
    cssRemove: cssRemove,
    clearQueue: clearQueue,
    addModule: function(name, func, force) {
        if (typeof name != "string" || typeof func != "function" || (modules[name] && !force))
            return this;
        modules[name] = func;
        return this;
    },
    /** Linear tweening method */
    NORMAL: 0,
    /** Ease-in tweening method */
    EASEIN: 1,
    /** Ease-out tweening method */
    EASEOUT: 2,
    
    RUNNING: 0,
    STOPPING: 1,
    STOPPED: 2,
    
    calcColorSteps: calcColorSteps,

    linear: function(t, x_min, dx) {
        return dx * t + x_min;
    },
    easeInQuad: function(t, x_min, dx) {
        return dx * __pow(t, 2) + x_min;
    },
    easeOutQuad: function(t, x_min, dx) {
        return -dx * t * (t - 2) + x_min;
    },
    easeInOutQuad: function(t, x_min, dx) {
        if ((t /= .5) < 1)
            return dx / 2 * t * t + x_min;
        return -dx / 2 * ((--t) * (t - 2) - 1) + x_min;
    },
    easeInCubic: function(t, x_min, dx) {
        return dx * __pow(t, 3) + x_min;
    },
    easeOutCubic: function(t, x_min, dx) {
        return dx * (__pow(t - 1, 3) + 1) + x_min;
    },
    easeInOutCubic: function(t, x_min, dx) {
        if ((t /= .5) < 1)
            return dx / 2 * __pow(t, 3) + x_min;
        return dx / 2 * (__pow(t - 2, 3) + 2) + x_min;
    },
    easeInQuart: function(t, x_min, dx) {
        return dx * __pow(t, 4) + x_min;
    },
    easeOutQuart: function(t, x_min, dx) {
        return -dx * (__pow(t - 1, 4) - 1) + x_min;
    },
    easeInOutQuart: function(t, x_min, dx) {
        if ((t /= .5) < 1)
            return dx / 2 * __pow(t, 4) + x_min;
        return -dx / 2 * (__pow(t - 2, 4) - 2) + x_min;
    },
    easeInQuint: function(t, x_min, dx) {
        return dx * __pow(t, 5) + x_min;
    },
    easeOutQuint: function(t, x_min, dx) {
        return dx * (__pow(t - 1, 5) + 1) + x_min;
    },
    easeInOutQuint: function(t, x_min, dx) {
        if ((t /= .5) < 1)
            return dx / 2 * __pow(t, 5) + x_min;
        return dx / 2 * (__pow(t - 2, 5) + 2) + x_min;
    },
    easeInSine: function(t, x_min, dx) {
        return -dx * Math.cos(t * (Math.PI / 2)) + dx + x_min;
    },
    easeOutSine: function(t, x_min, dx) {
        return dx * Math.sin(t * (Math.PI / 2)) + x_min;
    },
    easeInOutSine: function(t, x_min, dx) {
        return -dx / 2 * (Math.cos(Math.PI * t) - 1) + x_min;
    },
    easeInExpo: function(t, x_min, dx) {
        return (t == 0) ? x_min : dx * __pow(2, 10 * (t - 1)) + x_min;
    },
    easeOutExpo: function(t, x_min, dx) {
        return (t == 1) ? x_min + dx : dx * (-__pow(2, -10 * t) + 1) + x_min;
    },
    easeInOutExpo: function(t, x_min, dx) {
        if (t == 0)
            return x_min;
        if (t == 1)
            return x_min + dx;
        if ((t /= .5) < 1)
            return dx / 2 * __pow(2, 10 * (t - 1)) + x_min;
        return dx / 2 * (-__pow(2, -10 * --t) + 2) + x_min;
    },
    easeInCirc: function(t, x_min, dx) {
        return -dx * (Math.sqrt(1 - t * t) - 1) + x_min;
    },
    easeOutCirc: function(t, x_min, dx) {
        return dx * Math.sqrt(1 - (t -= 1) * t) + x_min;
    },
    easeInOutCirc: function(t, x_min, dx) {
        if ((t /= .5) < 1)
            return -dx / 2 * (Math.sqrt(1 - t * t) - 1) + x_min;
        return dx / 2 * (Math.sqrt(1 - (t -= 2) * t) + 1) + x_min;
    },
    easeInElastic: function(t, x_min, dx) {
        var s = 1.70158,
            p = .3,
            a = dx;
        if (t == 0)
            return x_min;
        if (t == 1)
            return x_min + dx;
        if (!a || a < Math.abs(dx)) {
            a = dx;
            s = p / 4;
        }
        else
            s = p / (2 * Math.PI) * Math.asin (dx / a);
        return -(a * __pow(2, 10 * (t -= 1)) * Math.sin((t * 1 - s) * (2 * Math.PI) / p)) + x_min;
    },
    easeOutElastic: function(t, x_min, dx) {
        var s = 1.70158,
            p = .3,
            a = dx;
        if (t == 0)
            return x_min;
        if (t == 1)
            return x_min + dx;
        if (a < Math.abs(dx)) {
            a = dx;
            s = p / 4;
        }
        else {
            s = p / (2 * Math.PI) * Math.asin(dx / a);
        }
        return a * __pow(2, -10 * t) * Math.sin((t - s) * (2 * Math.PI) / p) + dx + x_min;
    },
    easeInOutElastic: function(t, x_min, dx) {
        var s = 1.70158,
            p = 0,
            a = dx;
        if (t == 0)
            return x_min;
        if ((t / 2) == 2)
            return x_min + dx;
        if (!p)
            p = .3 * 1.5;
        if (a < Math.abs(dx)) {
            a = dx;
            s = p / 4;
        }
        else {
            s = p / (2 * Math.PI) * Math.asin(dx / a);
        }
        if (t < 1)
            return -.5 * (a * __pow(2, 10 * (t -= 1)) * Math.sin((t - s) * (2 * Math.PI) / p)) + x_min;
        return a * __pow(2, -10 * (t -= 1)) * Math.sin((t - s) * (2 * Math.PI) / p) * .5 + dx + x_min;
    },
    easeInBack: function(t, x_min, dx) {
        var s = 1.70158;
        return dx * __pow(t, 2) * ((s + 1) * t - s) + x_min;
    },
    easeOutBack: function(t, x_min, dx) {
        var s = 1.70158;
        return dx * ((t -= 1) * t * ((s + 1) * t + s) + 1) + x_min;
    },
    easeInOutBack: function(t, x_min, dx) {
        var s = 1.70158;
        if ((t / 2) < 1)
            return dx / 2 * (t * t * (((s *= (1.525)) + 1) * t - s)) + x_min;
        return dx / 2 * ((t -= 2) * t * (((s *= (1.525)) + 1) * t + s) + 2) + x_min;
    },
    easeInBounce: function(t, x_min, dx) {
        return dx - apf.tween.easeOutBounce(1 - t, 0, dx) + x_min;
    },
    easeOutBounce: function(t, x_min, dx) {
        if (t < (1 / 2.75))
            return dx * (7.5625 * t * t) + x_min;
        else if (t < (2 / 2.75))
            return dx * (7.5625 * (t -= (1.5 / 2.75)) * t + .75) + x_min;
        else if (t < (2.5 / 2.75))
            return dx * (7.5625 * (t -= (2.25 / 2.75)) * t + .9375) + x_min;
        else
            return dx * (7.5625 * (t -= (2.625 / 2.75)) * t + .984375) + x_min;
    },
    easeInOutBounce: function(t, x_min, dx) {
        if (t < 1 / 2)
            return apf.tween.easeInBounce(t * 2, 0, dx) * .5 + x_min;
        return apf.tween.easeOutBounce(t * 2 - 1, 0, dx) * .5 + dx * .5 + x_min;
    }
};

})(apf);





/**
 *
 * @author      Ruben Daniels (ruben AT ajax DOT org)
 * @version     %I%, %G%
 * @since       0.8
 */
apf.AmlNamespace = function(){
    this.elements = {};
};

apf.AmlNamespace.prototype = {
    setElement: function(tagName, fConstr) {
        return this.elements[tagName] = fConstr;
    },
};








/**
 * The parser of the Ajax.org Markup Language. Besides aml this parser takes care
 * of distributing parsing tasks to other parsers like the native html parser and
 * the xsd parser.
 * @parser
 * @private
 *
 * @define include element that loads another aml files.
 * Example:
 * <code>
 *   <a:include src="bindings.aml" />
 * </code>
 * @attribute {String} src the location of the aml file to include in this application.
 *
 */
apf.aml = new apf.AmlNamespace();
apf.setNamespace("http://ajax.org/2005/aml", apf.aml);






apf.__AMLNODE__ = 1 << 14;


/**
 * All elements inheriting from this {@link term.baseclass baseclass} have Document Object Model (DOM) support. The DOM
 * is the primary method for accessing and manipulating an XML document. This
 * includes HTML documents and AML documents. Every element in the ajax.org
 * markup language can be manipulated using the W3C DOM. This means
 * that every element and attribute you can set in the XML format, can be
 * changed, set, removed, reparented, _e.t.c._ at runtime. This offers a great deal of
 * flexibility. 
 *
 * Well known methods
 * from this specification are: `appendChild`, `removeChild`, `setAttribute`, and
 * `insertBefore`--to name a few. The Ajax.org Platform aims to implement DOM1
 * completely and parts of DOM2. For more information see {@link http://www.w3.org/DOM/} 
 * or {@link http://www.w3schools.com/dom/default.asp}.
 * 
 * #### Example:
 *
 * Here's a basic window using the Ajax.org Markup Language (AML): 
 *
 * ```xml
 *  <a:window id="winExample" title="Example" visible="true">
 *      <a:button id="tstButton" />
 *  </a:window>
 * ```
 *
 * 
 * Using the Document Object Model in JavaScript:
 *
 * ```javascript
 *  //The following line is only there for completeness sake. In fact apf
 *  //automatically adds a reference in javascript called winExample based
 *  //on the id it has.
 *  var winExample = apf.document.getElementById("winExample");
 *  winExample.setAttribute("title", "Example");
 *  winExample.setAttribute("icon", "icoFolder.gif");
 *  winExample.setAttribute("left", "100");
 *
 *  var lblNew = apf.document.createElement("label");
 *  winExample.appendChild(lblNew);
 *  lblNew.setAttribute("caption", "Example");
 *
 *  tstButton.setAttribute("caption", "Click me");
 * ```
 *
 * That would be the same as having the following AML:
 * 
 * ```xml
 *  <a:window id="winExample"
 *    title = "Example"
 *    icon = "icoFolder.gif"
 *    left = "100"
 *    visible = "true">
 *      <a:button id="tstButton" caption="Click me"/>
 *      <a:label caption="Example" />
 *  </a:window>
 * ```
 *
 * #### Remarks
 * Because the W3C DOM is native to all modern browsers the internet is full
 * of tutorials and documentation for this API. If you need more information,
 * it's a good idea to search for tutorials online.
 *
 * @class apf.AmlNode
 * @baseclass
 * @inherits apf.Class
 * @author      Ruben Daniels (ruben AT ajax DOT org)
 * @version     %I%, %G%
 * @since       0.5
 */
/**
 * @event DOMNodeInserted Fires when a DOM node is inserted.
 */
/** 
 * @event DOMNodeInsertedIntoDocument Fires when a DOM node is inserted into the document.
 */
/** 
 * @event DOMNodeRemoved Fires when a DOM node is removed.
 */
/** 
 * @event DOMNodeRemovedFromDocument Fires when a DOM node is removed from a document.
 */

apf.AmlNode = function(){
    this.$init(function(){
        /**
         * Nodelist containing all the child nodes of this element.
         */
        this.childNodes = []; //@todo AmlNodeList
    });
};

(function() {
    
    /**
     * Number specifying the type of node within the document.
     * @type {Number}
     */
    this.$regbase = this.$regbase | apf.__AMLNODE__;
    
    /**
     * The constant for a DOM element node.
     * @type {Number}
     */
    this.NODE_ELEMENT = 1;
    /**
     * The constant for a DOM attribute node.
     * @type {Number}
     */
    this.NODE_ATTRIBUTE = 2;
    /**
     * The constant for a DOM text node.
     * @type {Number}
     */
    this.NODE_TEXT = 3;
    /**
     * The constant for a DOM cdata section node.
     * @type {Number}
     */
    this.NODE_CDATA_SECTION = 4;
    /**
     * The constant for a DOM entity reference node.
     * @type {Number}
     */
    this.NODE_ENTITY_REFERENCE = 5;
    /**
     * The constant for a DOM entity node.
     * @type {Number}
     */
    this.NODE_ENTITY = 6;
    /**
     * The constant for a DOM processing instruction node.
     * @type {Number}
     */
    this.NODE_PROCESSING_INSTRUCTION = 7;
    /**
     * The constant for a DOM comment node.
     * @type {Number}
     */
    this.NODE_COMMENT = 8;
    /**
     * The constant for a DOM document node.
     * @type {Number}
     */
    this.NODE_DOCUMENT = 9;
    /**
     * The constant for a DOM document type node.
     * @type {Number}
     */
    this.NODE_DOCUMENT_TYPE = 10;
    /**
     * The constant for a DOM document fragment node.
     * @type {Number}
     */
    this.NODE_DOCUMENT_FRAGMENT = 11;
    /**
     * The constant for a DOM notation node.
     * @type {Number}
     */
    this.NODE_NOTATION = 12;
    
    /**
     * The document node of this application
     * @type {apf.AmlDocument}
     */
    this.ownerDocument = null;

    /**
     * Returns the value of the current node. 
     * @type {apf.AmlNode}
     */
    this.nodeValue = "";
    
    /**
     * The namespace URI of the node, or `null` if it is unspecified (read-only). 
     *
     * When the node is a document, it returns the XML namespace for the current 
     * document.
     * @type {String}
     */
    this.namespaceURI = "";
    
    /*
     * @todo
     */
    //this.baseURI = alsdjlasdj
    
    /*
     * @todo
     */
    //this.prefix = asdkljahqsdkh
        
    /**
     * 
     * @inheritdoc apf.AmlNode.insertBefore
     * 
     */
    this.appendChild =

    /**
     * Inserts an element before another element in the list of children of this
     * element. If the element was already a child of another element it is
     * removed from that parent before adding it this element.
     *
     * @method insertBefore
     * @param  {apf.AmlNode}  amlNode     The element to insert as child of this element.
     * @param  {apf.AmlNode}  beforeNode  The element which determines the insertion position of the element.
     * @return  {apf.AmlNode}  The inserted node
     */
    this.insertBefore = function(amlNode, beforeNode, noHtmlDomEdit) {
        

        if (this.nodeType == this.NODE_DOCUMENT) {
            if (this.childNodes.length) {
                throw new Error(apf.formatErrorString(0, this,
                    "Insertbefore DOM operation",
                    "Only one top level element is allowed in an AML document."));
            }
            else this.documentElement = amlNode; //@todo apf3.0 removal
        }
        
        if (amlNode == beforeNode)
            return amlNode;
        
        if (this == amlNode) {
            throw new Error(apf.formatErrorString(0, this,
                "Insertbefore DOM operation",
                "Cannot append node as a child of itself."));
        }

        if (amlNode.nodeType == this.NODE_DOCUMENT_FRAGMENT) {
            var nodes = amlNode.childNodes.slice(0);
            for (var i = 0, l = nodes.length; i < l; i++) {
                this.insertBefore(nodes[i], beforeNode);
            }
            return amlNode;
        }
        
        var isMoveWithinParent = amlNode.parentNode == this,
            oldParentHtmlNode = amlNode.$pHtmlNode,
            oldParent = amlNode.parentNode,
            index = -1,
            _self = this;
        
        if (beforeNode) {
            index = this.childNodes.indexOf(beforeNode);
            if (index < 0) {
                

                return false;
            }
        }

        if (!amlNode.ownerDocument)
            amlNode.ownerDocument = this.ownerDocument || apf.ownerDocument;

        if (amlNode.parentNode)
            amlNode.removeNode(isMoveWithinParent, true);//noHtmlDomEdit);
        amlNode.parentNode = this;

        if (beforeNode)
            index = this.childNodes.indexOf(beforeNode);

        if (beforeNode) {
            amlNode.nextSibling = beforeNode;
            amlNode.previousSibling = beforeNode.previousSibling;
            beforeNode.previousSibling = amlNode;
            if (amlNode.previousSibling)
                amlNode.previousSibling.nextSibling = amlNode;
        }

        if (index >= 0) {
            this.childNodes = this.childNodes.slice(0, index).concat(amlNode,
                this.childNodes.slice(index));
        }
        else {
            index = this.childNodes.push(amlNode) - 1;

            amlNode.nextSibling = null;
            if (index > 0) {
                amlNode.previousSibling = this.childNodes[index - 1];
                amlNode.previousSibling.nextSibling = amlNode;
            }
            else {
                amlNode.previousSibling = null;
            }
        }

        this.firstChild = this.childNodes[0];
        this.lastChild = this.childNodes[this.childNodes.length - 1];

        //@todo fix event struture, fix tree events
        var initialAppend = !amlNode.$amlLoaded;
        function triggerUpdate(){
            amlNode.$pHtmlNode = _self.canHaveChildren ? _self.$int : document.body;

            var nextNode = beforeNode;
            if (!initialAppend && !noHtmlDomEdit && amlNode.$ext && !amlNode.$coreHtml) {
                nextNode = beforeNode;
                while (nextNode && !(nextNode.$altExt || nextNode.$ext)) {
                    nextNode = nextNode.nextSibling;
                }
                
                var htmlNode = amlNode.$altExt || amlNode.$ext;
                var nextHtmlNode = nextNode && (nextNode.$altExt || nextNode.$ext) || null;
                if (htmlNode.parentNode != amlNode.$pHtmlNode || amlNode.nextSibling != nextHtmlNode) {
                    
                    amlNode.$pHtmlNode.insertBefore(htmlNode, nextHtmlNode);
                }
            }
            
            //Signal node and all it's ancestors
            amlNode.dispatchEvent("DOMNodeInserted", {
                $beforeNode: beforeNode,
                relatedNode: _self,
                $isMoveWithinParent: isMoveWithinParent,
                $oldParentHtmlNode: oldParentHtmlNode,
                $oldParent: oldParent,
                bubbles: true
            });
            
            if (initialAppend && !noHtmlDomEdit && beforeNode && amlNode.$ext && !amlNode.$coreHtml) {
                nextNode = beforeNode;
                while (nextNode && !(nextNode.$altExt || nextNode.$ext)) {
                    nextNode = nextNode.nextSibling;
                }
                
                amlNode.$pHtmlNode.insertBefore(amlNode.$altExt || amlNode.$ext,
                    nextNode && (nextNode.$altExt || nextNode.$ext) || null);
                
            }
        }

        var doc = this.nodeType == this.NODE_DOCUMENT ? this : this.ownerDocument;
        if (!doc)
            return amlNode;

        // Don't update the tree if this is a doc fragment or if this element is not inited yet
        if (this.nodeType == this.NODE_DOCUMENT_FRAGMENT || !this.$amlLoaded)
            return amlNode; 

        //@todo review this...
        if (initialAppend && !amlNode.render) {
            this.$onInsertedIntoDocument();
        }

        triggerUpdate();
        return amlNode;
    };

    this.$onInsertedIntoDocument = function() {
        var amlNode = this
        if (!options.ignoreSelf && !amlNode.$amlLoaded)
            amlNode.dispatchEvent("DOMNodeInsertedIntoDocument");

        //Recursively signal non prio nodes
        (function _recur(nodes) {
            for (var i = 0, l = nodes.length; i < l; i++) {
                var node = nodes[i];
                if (!node.$amlLoaded)
                    node.dispatchEvent("DOMNodeInsertedIntoDocument");
                //Create children
                var nNodes = node.childNodes;
                if (!node.render && nNodes && nNodes.length)
                    _recur(nNodes);
            }
        })(amlNode.childNodes);
    }

    /**
     * Removes this element from the document hierarchy. Call-chaining is
     * supported.
     */
    this.removeNode = function(doOnlyAdmin, noHtmlDomEdit) {
        if (!this.parentNode || !this.parentNode.childNodes)
            return this;
        
        this.parentNode.childNodes.remove(this);

        //If we're not loaded yet, just remove us from the aml to be parsed
        if (this.$amlLoaded) {
            //this.parentNode.$aml.removeChild(this.$aml);

            this.dispatchEvent("DOMNodeRemoved", {
                relatedNode: this.parentNode,
                bubbles: true,
                $doOnlyAdmin: doOnlyAdmin
            });

            if (!noHtmlDomEdit && !doOnlyAdmin && this.$ext && this.$ext.parentNode) {
                this.$ext.parentNode.removeChild(this.$ext);
                //delete this.$ext; //WTF???
            }
        }

        if (this.parentNode.firstChild == this)
            this.parentNode.firstChild = this.nextSibling;
        if (this.parentNode.lastChild == this)
            this.parentNode.lastChild = this.previousSibling;

        if (this.nextSibling)
            this.nextSibling.previousSibling = this.previousSibling;
        if (this.previousSibling)
            this.previousSibling.nextSibling = this.nextSibling;

        this.$pHtmlNode = 
        this.parentNode = 
        this.previousSibling =
        this.nextSibling = null;

        return this;
    };


    this.remove = function() { this.removeNode(); }
    
    /**
     * Removes a child from the node list of this element. Call-chaining is
     * supported.
     * @param {apf.AmlNode} childNode The child node to remove
     */
    this.removeChild = function(childNode) {
        childNode.removeNode();
        return this;
    };
    
    //@todo
    this.replaceChild = function(node, oldNode) {
        if (node !== oldNode) {
            this.insertBefore(node, oldNode);
            this.removeChild(oldNode);
        }
        return node;
    };

    /**
     * Clones this element, creating an exact copy of it--but does not insert
     * it in the document hierarchy.
     *
     * @param {Boolean} deep Specifies whether the elements are cloned recursively.
     * @return {apf.AmlNode} The cloned element.
     */
    this.cloneNode = function(deep) {
        if (deep && this.nodeType == 1) {
            return this.ownerDocument.$domParser.parseFromXml(this, {
                doc: this.ownerDocument,
                delay: true
            }).childNodes[0];
        }
        else {
            return this.ownerDocument.$domParser.$createNode(
                this.ownerDocument, this.nodeType, this);
        }
    };
    
    //@todo
    this.canDispatch = function(namespaceURI, type) {};
    
    //@todo
    this.compareDocumentPosition = function(otherNode) {
        /*
            DOCUMENT_POSITION_DISCONNECTED = 0x01;
            DOCUMENT_POSITION_PRECEDING = 0x02;
            DOCUMENT_POSITION_FOLLOWING = 0x04;
            DOCUMENT_POSITION_CONTAINS = 0x08;
            DOCUMENT_POSITION_CONTAINED_BY = 0x10;
        */
    };
    
    this.hasAttributes = function(){
        return Object.keys(this.attributes).length;
    };
    
    this.hasChildNodes = function(){
        return this.childNodes && this.childNodes.length;
    };
    
    this.isDefaultNamespace = function(namespaceURI) {
        if (node.nodeType == 1) {
            if (!this.prefix)
                return this.namespaceURI == namespaceURI;
            
            //@todo Loop through attributes here
        }
        
        var node = this.parentNode || this.ownerElement;
        return node && node.isDefaultNamespace(namespaceURI);
    };
    
    this.lookupNamespaceURI = function(prefix) {
        if (node.nodeType == 1) {
            if (this.namespaceURI && prefix == this.prefix)
                return this.namespaceURI ;
                
            //@todo Loop through attributes here
        }
        
        var node = this.parentNode || this.ownerElement;
        return node && node.lookupNamespaceURI(prefix);
    };
    
    this.lookupPrefix = function(namespaceURI) {
        if (this.nodeType == 1) {
            if (namespaceURI == this.namespaceURI && this.prefix)
                return this.prefix;
            
            //@todo Loop through attributes here
        }
        
        var node = this.parentNode || this.ownerElement;
        return node && node.lookupPrefix(namespaceURI);    
    };
    
    this.normalize = function(){};
    
    // *** Xpath support *** //

    /**
     * Queries the AML DOM using the W3C xPath query language and returns a node
     * list. This is not an official API call, but can be useful in certain cases.
     *
     * @param {String}  sExpr          The xpath expression to query the AML DOM tree with.
     * @param {apf.AmlNode} [contextNode]  The element that serves as the starting point of the search. Defaults to this element.
     * @returns {NodeList} List of found nodes.
     */
    this.selectNodes = function(sExpr, contextNode) {
        if (!contextNode)
            contextNode = (this.nodeType == 9 ? this.documentElement : this)
    
        return findNodes(contextNode, sExpr);
    };

    /**
     * Queries the AML dom using the W3C xPath query language and returns a single
     * node. This is not an official API call, but can be useful in certain cases.
     * 
     * @param {String}  sExpr          The xpath expression to query the AML DOM tree with.
     * @param {apf.AmlNode} [contextNode]  The element that serves as the starting point of the search. Defaults to this element.
     * @returns {apf.AmlNode} The first node that matches the query.
     */
    this.selectSingleNode = function(sExpr, contextNode) {
        return  this.selectNodes(sExpr, contextNode)[0];
    };
    
    /*this.addEventListener("DOMNodeInsertedIntoDocument", function(e) {
        
    }, true);*/
}).call(apf.AmlNode.prototype = new apf.Class());







/**
 * Represents a single element within an AML node.
 *
 * @class apf.AmlElement
 * @baseclass
 * @inherits apf.AmlNode
 */


apf.AmlElement = function(struct, tagName) {
    var $init = this.$init;
    this.$init = function(tagName, nodeFunc, struct) {
        this.$supportedProperties = this.$supportedProperties.slice();
        
        var prop, p, q;
        p = this.$propHandlers;
        q = this.$propHandlers = {};
        for (prop in p)
            q[prop] = p[prop];
        
        p = this.$booleanProperties;
        q = this.$booleanProperties = {};
        for (prop in p)
            q[prop] = p[prop];
        
        return $init.call(this, tagName, nodeFunc, struct);
    };
    
    this.$init(function(tagName, nodeFunc, struct) {
        this.$events = {};
        this.$inheritProperties = {};
        
        this.attributes = {}; //@todo apf3.0 move to init?
        
        /**
         * Defines the purpose of this element. Possible values include:
         * - `apf.NODE_VISIBLE`:  This element has a GUI representation
         * - `apf.NODE_HIDDEN`:   This element does not display a GUI
         * @type {Number}
         */
        this.nodeFunc = nodeFunc;
        
        /**
         * The local name of this element
         * @type {String}
         */
        this.localName = tagName; //@todo
        
        //Parse struct to create attributes and child nodes
        if (struct) {
            var nodes, prop, i, l, attr;
            if (struct.childNodes) {
                nodes = struct.childNodes;
                delete struct.childNodes; //why delete?
            }
            
            //Attributes
            for (prop in struct) { 
                if (prop == "htmlNode") continue;
                
                attr = new apf.AmlAttr(this, prop, struct[prop]);
                
                //These exceptions should be generalized
                if (prop == "id")
                    this.$propHandlers["id"].call(this, this.id = struct.id);
                else if (prop.substr(0, 2) == "on")
                    attr.$triggerUpdate();

                this.attributes[attr.name] = attr;
            }
            
            if (!this.ownerDocument) {
                this.ownerDocument = apf.document;
                this.prefix = "a";
                this.namespaceURI = apf.ns.aml;
                this.tagName = tagName;
            }
            
            if (nodes) {
                this.childNodes = nodes;

                for (i = 0, l = nodes.length; i < l; i++) {
                    nodes[i].nextSibling = nodes[i + 1] || null;
                    nodes[i].previousSibling = nodes[i - 1] || null;
                    nodes[i].parentNode = this;
                }
                this.firstChild = nodes[0] || null;
                this.lastChild = nodes[nodes.length - 1] || null;
            }

            //Temp hack
            this.$aml = apf.$emptyNode || (apf.$emptyNode = apf.getXml("<empty />"));
        }
    });
    
    if (tagName) //of typeof is not function and not true
        $init.call(this, tagName, apf.NODE_HIDDEN, struct);
};

(function(){
    /**
     * A number specifying the type of node within the document.
     * @type {Number}
     */
    this.nodeType = this.NODE_ELEMENT;
    this.canHaveChildren = true;
    
    this.$propHandlers = {
        /**
         * @attribute {String} id The identifier of this element. When set, this
         * identifier is the name of the variable in JavaScript to access this
         * element directly. This identifier is also the way to get a reference to
         * this element using `apf.document.getElementById()`.
         * 
         * #### Example
         *
         * ```xml
         *  <a:bar id="barExample" />
         *  <a:script>
         *      alert(barExample);
         *  </a:script>
         * ```
         */
        "id": function(value) {
            if (this.name == value || !value)
                return;
            
            apf.nameserver.register(this.localName, value, this)
            apf.nameserver.register("all", value, this)
            
            
            this.name = value;
        }
    };
    
    this.$booleanProperties = {};
    this.$inheritProperties = {};
    this.$supportedProperties = [];
    
    /**
     * Returns a list of elements with the given tag name.
     *
     * The subtree below the specified element is searched, excluding the
     * element itself.
     *
     * @param  {String}  tagName  The tag name to look for. The special string "*" represents any tag name.
     * @param {Boolean} [norecur] If specified, defines whether or not to check recursively
     * @return  {NodeList}  Contains any nodes matching the search string
     */
    this.getElementsByTagName = function(tagName, norecur) {
        tagName = tagName.toLowerCase();
        var node, i, l,
            nodes = this.childNodes,
            result = [];
        for (i = 0, l = nodes.length; i < l; i++) {
            if ((node = nodes[i]).nodeType != 1)
                continue;
            
            if (node.tagName == tagName || tagName == "*")
                result.push(node);

            if (!norecur && node.nodeType == 1)
                result = result.concat(node.getElementsByTagName(tagName));
        }
        
        return result;
    };

    /**
     * Returns a list of elements with the given tag name and the specified namespace URI.
     *
     * The subtree below the specified element is searched, excluding the
     * element itself.
     *
     * @param  {String}  namespaceURI  The namespace URI name to look for.
     * @param  {String}  localName  The tag name to look for. The special string "*" represents any tag name.
     * @param {Boolean} [norecur] If specified, defines whether or not to check recursively
     * @return  {NodeList}  Contains any nodes matching the search string
     */    
    this.getElementsByTagNameNS = function(namespaceURI, localName, norecur) {
        localName = localName.toLowerCase();
        var node, i, l,
            nodes = this.childNodes,
            result = [];
        for (i = 0, l = nodes.length; i < l; i++) {
            if ((node = nodes[i]).nodeType != 1)
                continue;

            if (node.namespaceURI == namespaceURI && (node.localName == localName || localName == "*"))
                result.push(node);

            if (!norecur && !node.$amlDestroyed && node.nodeType == 1)
                result = result.concat(node.getElementsByTagNameNS(namespaceURI, localName));
        }
        
        return result;
    };

    /**
     * Sets an attribute on this element.
     * @chainable
     * @param {String} name The name of the attribute to which the value is set
     * @param {String} value The new value of the attribute.
     * @param {Boolean} [noTrigger] If specified, does not emit events 
     * [[apf.AmlNode@DOMNodeInsertedIntoDocument]] and [[apf.AmlNode@DOMNodeInserted]].
     */
    this.setAttribute = function(name, value, noTrigger) {
        name = name.toLowerCase();
        
        var a = this.attributes[name];
        if (!a) {
            this.attributes[name] = (a = new apf.AmlAttr(this, name, value));
        
            if (!this.$amlLoaded && name != "id" && name != "hotkey")
                return;
            
            if (noTrigger)
                a.$setValue(value);
            else {
                //@todo apf3.0 domattr
                a.dispatchEvent("DOMNodeInsertedIntoDocument", {
                    relatedNode: this
                });
                
                //@todo apf3.0 domattr
                a.dispatchEvent("DOMNodeInserted", {
                    relatedNode: this,
                    bubbles: true
                });
            }

            return;
        }

        var oldValue = a.nodeValue;
        a.$setValue(value);
        
        if (noTrigger || !this.$amlLoaded)
            return;
        
        //@todo apf3.0 domattr
        a.$triggerUpdate(null, oldValue);
    };
    
    //@todo apf3.0 domattr
    this.hasAttribute = function(name) {
        return this.attributes[name] ? true : false;
    };
    
    /**
     * Removes an attribute from this element. 
     * @chainable
     * @param {String} name The name of the attribute to remove.
     * @returns {apf.AmlElement} The modified element.
     */
    this.removeAttribute = function(name){ //@todo apf3.0 domattr
        var item = this.attributes[name];
        if (item) {
            //@todo hack!
            //this should be done properly
            var oldValue = item.nodeValue;
            item.nodeValue = item.value = "";
            item.$triggerUpdate(null, oldValue);
            item.ownerElement = null;
            item.nodeValue = item.value = oldValue;
        }
        delete this.attributes[name];
        return this;
    };
    
    /**
     * Retrieves the value of an attribute of this element.
     *
     * @param  {String}  name       The name of the attribute for which to return the value.
     * @param  {Boolean} [inherited] if specified, takes into consideration that the attribute is inherited
     * @return {String} The value of the attribute, or `null` if none was found with the name specified.
     */
    this.getAttribute = function(name, inherited) {
        var item = this.attributes[name];
        return item ? item.nodeValue : null;
    };
    
    this.getBoundingClientRect = function(){
        return new apf.AmlTextRectangle(this);
    };
    
    //@todo
    this.querySelector = function(){
        // here we should use: http://code.google.com/p/css2xpath/source/browse/trunk/src/css2xpath.js
    };
    
    //@todo
    this.querySelectorAll = function(){
        // here we should use: http://code.google.com/p/css2xpath/source/browse/trunk/src/css2xpath.js
    };
    
    //@todo
    this.scrollIntoView = function(){
        
    };
    
    
    function createAmlNode(node, parent) {
        if (node.nodeType == node.ELEMENT_NODE) {
            var el
            if (node.localName == "application") {
                el = parent;
            } else {
                var namespace = node.prefix == "a" ? apf.aml : apf.xhtml;
                var ElementType = namespace.elements[node.localName] || namespace.elements["@default"];
                var el = new ElementType({}, node.localName);
                var a = node.attributes;
                for (var i =0; i < a.length; i++) {
                    el.setAttribute(a[i].name, a[i].value);
                }
                el.$aml = node;
            }
            
            var list = node.childNodes;
            for (var i = 0; i < list.length; i++) {
                createAmlNode(list[i], el);
            }
            if (el != parent)
                parent.appendChild(el);
        } else if (node.nodeType == node.TEXT_NODE) {
            var text = node.data.trim();
            if (text) {
                var o = new apf.AmlText();
                o.nodeValue = text;
                parent.appendChild(o);
            }
        } else if (node.nodeType == node.DOCUMENT_NODE) {
            createAmlNode(node.documentElement, parent)
        }
    }
    
    /**
     * Inserts new AML into this element.
     * @param {Mixed}       amlDefNode  The AML to be loaded. This can be a string or a parsed piece of XML.
     * @param {Object}      options     Additional options to pass. It can include the following properties:
     *                                  - callback ([[Function]]): A function to call once the insertion completes.
     *                                  - clear ([[Boolean]]): If set, the AML has the attribute "clear" attached to it
     */
    this.insertMarkup = function(amlDefNode, options) {
        var xmlNode = apf.getXml(amlDefNode);
        createAmlNode(xmlNode, this);
    };
    
    this.$setInheritedAttribute = function(prop) {
        var value, node = this, isInherit = false;
        
        value = node.getAttribute(prop);
        if (!value) {
            node = node.parentNode;
            
            //Second argument fetches special inheritance value, if any
            while (node && node.nodeType == 1 && !(value = node.getAttribute(prop, true))) {
                node = node.parentNode;
            }
            
            isInherit = true;
        }
        
        if (!value && apf.config && prop)
            value = apf.config[prop];
        
        if (isInherit)
            this.$inheritProperties[prop] = 2;
        
        if (value) {
            this.setProperty(prop, value, false, false, 2);
        }
        
        return value;
    };
    
    //@todo in proper W3C implementation this needs to change
    //@todo this won't work with a combo of remove/append
    this.addEventListener("DOMNodeInserted", function(e) {
        if (e.currentTarget != this || e.$isMoveWithinParent || !e.$oldParent)
            return;

        //Check inherited attributes for reparenting
        /*
            States:
                    -1 Set
             undefined Pass through
                     2 Inherited
                     3 Semi-inherited
                    10 Dynamic property
        */
        var vOld, vNew;
        var aci = apf.config.$inheritProperties;
        for (var prop in aci) {
            vOld = apf.getInheritedAttribute(e.$oldParent, prop);
            vNew = apf.getInheritedAttribute(this.parentNode, prop);
            
            //Property has changed, lets recursively set it on inherited nodes
            if (vOld != vNew) {
                //@todo code duplication from class.js
                (function recur(nodes) {
                    var i, l, node, n;
                    for (i = 0, l = nodes.length; i < l; i++) {
                        node = nodes[i];
                        if (node.nodeType != 1 && node.nodeType != 7)
                            continue;

                        //Pass through
                        n = node.$inheritProperties[prop];
                        if (aci[prop] == 1 && !n)
                            recur(node.childNodes);
                        
                        //Set inherited property
                        //@todo why are dynamic properties overwritten??
                        else if (!(n < 0)) {//Will also pass through undefined - but why??? @todo seems inefficient
                            if (n == 3) {
                                var sameValue = node[prop];
                                node[prop] = null;
                            }
                            node.setProperty(prop, n != 3
                                ? vNew
                                : sameValue, false, false, n); //This is recursive already
                        }
                    }
                })([this]);
            }
        }
    });
    
    this.$handlePropSet = function(prop, value, force) {
        if (this.$booleanProperties[prop])
            value = apf.isTrue(value);

        

        this[prop] = value;

        var handler;
        return (handler = this.$propHandlers && this.$propHandlers[prop]
          || this.nodeFunc == apf.NODE_VISIBLE && apf.GuiElement && apf.GuiElement.propHandlers[prop] || null)
          && handler.call(this, value, prop, force);
    };
    
    this.addEventListener("DOMNodeInsertedIntoDocument", function(e) {
        var a, i, l, attr = this.attributes, keys = Object.keys(attr);
        //Set all attributes
        for (i = 0, l = keys.length; i < l; i++) {
            attr[keys[i]].dispatchEvent("DOMNodeInsertedIntoDocument");
        }
    }, true);
    
    this.addEventListener("DOMNodeInsertedIntoDocument", function(e) {
        this.$amlLoaded = true;
    });
}).call(apf.AmlElement.prototype = new apf.AmlNode());








//@todo apf3.0 The functions seem to not set nodeValue...
apf.AmlCharacterData = function(){
    this.data = "";
    this.length = 0;
    
    this.$init(true);
    
    this.appendData = function(sValue) {
        this.dispatchEvent("DOMCharacterDataModified", {
            value: sValue
        });
    };
    
    this.deleteData = function(nOffset, nCount) {
        this.dispatchEvent("DOMCharacterDataModified", {
            offset: nOffset,
            count: nCount
        });
    };
    
    this.insertData = function(nOffset, nCount) {
        this.dispatchEvent("DOMCharacterDataModified", {
            offset: nOffset,
            count: nCount
        });
    };
    
    this.replaceData = function(nOffset, nCount, sValue) {
        this.dispatchEvent("DOMCharacterDataModified", {
            offset: nOffset,
            count: nCount,
            value: sValue
        });
    };
    
    this.substringData = function(nOffset, nCount) {};
}
apf.AmlCharacterData.prototype = new apf.AmlNode();







apf.AmlText = function(isPrototype) {
    this.$init(isPrototype);
};

(function(){
    this.nodeType = this.NODE_TEXT;
    this.nodeName = "#text";
    
    this.serialize = function(){
        return apf.escapeXML(this.nodeValue);
    };
    
    
    
    //@todo think about using this.replaceData();
    this.$setValue = function(value) {
        //if (!this.$amlLoaded)
            //return;
        
        this.dispatchEvent("DOMCharacterDataModified", {
            bubbles: true,
            prevValue: this.nodeValue,
            newValue: this.nodeValue = value
        });
        
        if (this.$amlLoaded && this.$ext)
            this.$ext.nodeValue = value;
    }

    this.addEventListener("DOMNodeInsertedIntoDocument", function(e) {
        var pHtmlNode;
        if (this.parentNode.$childProperty)
            return this.parentNode.setAttribute(this.parentNode.$childProperty, this.nodeValue)
        if (!(pHtmlNode = this.parentNode.$int)) 
            return;

        this.$amlLoaded = true;
        
        var nodeValue = this.nodeValue;

        if (apf.hasTextNodeWhiteSpaceBug) {
            var nodeValue = nodeValue.replace(/[\t\n\r ]+/g, " ");

            if (nodeValue && nodeValue != " ")
                this.$ext = pHtmlNode.appendChild(
                  pHtmlNode.ownerDocument.createTextNode(nodeValue));
        }
        else
            this.$ext = pHtmlNode.appendChild(
              pHtmlNode.ownerDocument.createTextNode(nodeValue));
    }, true);
}).call(apf.AmlText.prototype = new apf.AmlCharacterData());








apf.AmlAttr = function(ownerElement, name, value) {
    this.$init();
    
    if (ownerElement) {
        this.ownerElement = ownerElement;
        this.ownerDocument = ownerElement.ownerDocument;
    }
    
    this.nodeName = this.name = name;
    this.nodeValue = this.value = value;
};

(function(){
    this.nodeType = this.NODE_ATTRIBUTE;
    
    this.MODIFICATION = 1;
    this.ADDITION = 2;
    this.REMOVAL = 3;
    
    this.serialize = 
    this.toString = function(){
        return this.name + "=\"" + apf.escapeXML(String(this.value)) + "\"";
    };
    
    
    
    this.$setValue = function(value) {
        this.nodeValue = this.value = value;
        this.specified = true;

        //@todo apf3.0 domattr
        this.ownerElement.dispatchEvent("DOMAttrModified", {
            relatedNode: this,
            attrChange: this.MODIFICATION,
            attrName: this.name,
            newValue: value,
            prevValue: this.$lastValue || "",
            bubbles: true
        });
        
        this.$lastValue = value;
    };
    
    this.$triggerUpdate = function(e, oldValue) {
        var name = this.name,
            value = this.value || this.nodeValue,
            host = this.ownerElement,
            isEvent = name.substr(0, 2) == "on";

        if (!this.specified) {
            //@todo This should be generalized
            if (isEvent && this.$lastValue == value
              || name == "id" && host.id) {
                this.specified = true;
                return;
            }
        }

        if (isEvent) {
            if (host.$events[name])
                host.removeEventListener(name.substr(2), host.$events[name]);
            if (value)
                host.addEventListener(name, (host.$events[name] = 
                  (typeof value == "string"
                    ? 
                      new Function('event', value)
                      
                    : value)));
            return;
        }
        
        host.setProperty(name, value); //@todo apf3.0 is this a lot slower?

        if (this.specified) {
            //@todo apf3.0 domattr - slow?
            host.dispatchEvent("DOMAttrModified", { //@todo this is not good, node might not be specified at init
                relatedNode: this,
                attrChange: this.MODIFICATION,
                attrName: name,
                newValue: value,
                prevValue: this.$lastValue || "",
                bubbles: true
            });
        }
        else this.specified = true;
            
        this.$lastValue = value;
    };
    
    //@todo apf3.0 domattr
    this.addEventListener("DOMNodeInsertedIntoDocument", this.$triggerUpdate);
}).call(apf.AmlAttr.prototype = new apf.AmlNode());







apf.AmlCDATASection = function(isPrototype) {
    this.nodeType = this.NODE_CDATA_SECTION;
    this.nodeName = "#cdata-section";
    
    this.$init(isPrototype);
};

apf.AmlCDATASection.prototype = new apf.AmlText(true);
apf.AmlCDATASection.prototype.serialize = function(){
    return "<![CDATA[" + this.nodeValue + "]]>";
};







apf.AmlComment = function(isPrototype) {
    this.nodeType = this.NODE_COMMENT;
    this.nodeName = "#comment";
    
    this.$init(isPrototype);
};

(function(){
    this.serialize = function(){
        return "<!--" + this.nodeValue + "-->";
    };
    
    this.$setValue = function(value) {
        this.dispatchEvent("DOMCharacterDataModified", {
            bubbles: true,
            newValue: value,
            prevValue: this.nodeValue
        });
    }
}).call(apf.AmlComment.prototype = new apf.AmlCharacterData());







apf.AmlConfiguration = function(isPrototype) {
    this.parameterNames = [];

    this.$init(isPrototype);
};

(function(){
    this.setParameter = this.setProperty;
    
    this.getParameter = this.getProperty;
    
    this.canSetParameter = function(name, value){ //@todo for value
        return this.parameterNames.indexOf(name) > -1;
    };
}).call(apf.AmlConfiguration.prototype = new apf.Class());








/**
 * The AML document. This is the root of the DOM tree and has a nodeType with 
 * value 9 (`apf.NODE_DOCUMENT`). 
 *
 * @class apf.AmlDocument
 * @inherits apf.AmlNode
 * @inherits apf.Class
 * @default_private 
 * @see apf.AmlDom
 *
 * @author      Ruben Daniels (ruben AT ajax DOT org)
 * @version     %I%, %G%
 * @since       0.8
 */
apf.AmlDocument = function(){
    this.$prefixes = {};
    this.$namespaceURIs = {};
    
    this.domConfig = new apf.AmlConfiguration();
    
    
    this.$init();
};

(function() {
    /**
     * The type of node within the document.
     * @type {Number}
     */
    this.nodeType = this.NODE_DOCUMENT;
    this.nodeFunc = apf.NODE_HIDDEN;
    this.nodeName = "#document";
    
    this.$amlLoaded = true;
    
    this.activeElement = null; //@todo alias of window.foccussed;
    this.doctype = null;
    this.domConfig = null;
    this.implementation = null;
    
    /**
     * The root element node of the AML application. This is an element with
     * the tagName `'application'`. This is similar to the `'html'` element for regular HTML.
     * @type {apf.AmlNode}
     */
    this.documentElement = null;
    
    /**
     * Gets a AML element based on its id.
     * @param {String} id The id of the AML element to return.
     * @return {apf.AmlElement} The AML element with the id specified.
     */
    this.getElementById = function(id) {
        return self[id];
    };

    /**
     * Returns a list of elements with the given tag name.
     *
     * The subtree below the [[apf.AmlDocument.documentElement]] is searched, excluding the
     * element itself.
     *
     * @param  {String}  tagName  The tag name to look for. The special string "*" represents any tag name.
     * @return  {NodeList}  Contains any nodes matching the search string
     */ 
    this.getElementsByTagName = function(tagName) {
        var docEl, res = (docEl = this.documentElement)
            .getElementsByTagName(tagName);

        if (tagName == "*" || docEl.tagName == tagName)
            res.unshift(docEl);
        return res;
    };

    /**
     * Returns a list of elements with the given tag name and the specified namespace URI.
     *
     * The subtree below the [[apf.AmlDocument.documentElement]] is searched, excluding the
     * element itself.
     *
     * @param  {String}  namespaceURI  The namespace URI name to look for.
     * @param  {String}  tagName  The tag name to look for. The special string "*" represents any tag name.
     * @return  {NodeList}  Contains any nodes matching the search string
     */ 
    this.getElementsByTagNameNS = function(nameSpaceURI, tagName) {
        var docEl,
            res = (docEl = this.documentElement)
                .getElementsByTagNameNS(nameSpaceURI, tagName);

        if (tagName == "*" || docEl.tagName == tagName && docEl.namespaceURI == nameSpaceURI)
            res.unshift(docEl);
        return res;
    };

    /**
     * Creates a new AML element.
     *
     * @param {Mixed} qualifiedName Information about the new node to create. Possible values include:
     *                              - [[String]]:     The tag name of the new element to create
     *                              - [[String]]:    The AML definition for a single or multiple elemnts
     *                              - [[XMLElement]]: The AML definition for a single or multiple elements
     * @return {apf.AmlElement} The created AML element
     */
    this.createElement = function(qualifiedName) {
        var parts = qualifiedName.split(":");
        var prefix = parts.length == 1 ? "" : parts[0];
        var name = parts.length == 1 ? parts[0]: parts[1];
        var namespace = prefix == "a" ? apf.aml : apf.xhtml;
        var ElementType = namespace.elements[name] || namespace.elements["@default"];
        return new ElementType({}, qualifiedName);
    };

    /**
     * Creates a new AML element within the given namespace.
     *
     * @param  {String}  namespaceURI  The namespace URI name to use
     * @param {Mixed} qualifiedName Information about the new node to create. Possible values include:
     *                              - [[String]]:     The tag name of the new element to create
     *                              - [[String]]:     The AML definition for a single or multiple elemnts
     *                              - [[XMLElement]]: The AML definition for a single or multiple elements
     * @return {apf.AmlElement} The created AML element
     */        
    this.createElementNS = function(namespaceURI, qualifiedName) {
        var ElementType = apf.aml.elements[qualifiedName] || apf.aml.elements["@default"];
        return new ElementType({});
    };
    
    /**
     * Creates and returns a new [[apf.AmlEvent]] .
     */     
    this.createEvent = function(){
        return new apf.AmlEvent();
    };

    /**
     * Creates and returns a new Text node.
     * @param {String} nodeValue The data to be added to the text node
     * @return {apf.AmlNode} The Text node
     */      
    this.createTextNode = function(nodeValue) {
        var o = new apf.AmlText();
        o.nodeValue = nodeValue || "";
        return o;
    };

    // @todo
    this.querySelector = function(){};
 
     // @todo   
    this.querySelectorAll = function(){};

    

    // @todo
    this.hasFocus = function(){
        
    }

    
}).call(apf.AmlDocument.prototype = new apf.AmlNode());








apf.AmlDocumentFragment = function(isPrototype) {
    this.$init(isPrototype);
};

apf.AmlDocumentFragment.prototype = new apf.AmlNode();
apf.AmlDocumentFragment.prototype.nodeName = "#document-fragment";
apf.AmlDocumentFragment.prototype.nodeType = 
    apf.AmlDocumentFragment.prototype.NODE_DOCUMENT_FRAGMENT;






apf.AmlTextRectangle = function(host) {
    var _self = this;
    function handler(){
        var pos = _self.getAbsolutePosition(_self.$ext);
        _self.setProperty("left", pos[0]);
        _self.setProperty("top", pos[1]);
        _self.setProperty("right", document.documentElement.offsetWidth - pos[0]);
        _self.setProperty("bottom", document.documentElement.offsetWidth - pos[1]);
    }
    
    host.addEventListener("prop.width", handler);
    host.addEventListener("prop.height", handler);
    host.addEventListener("prop.left", handler);
    host.addEventListener("prop.top", handler);

    handler.call(host);
};
apf.AmlTextRectangle.prototype = new apf.Class();








/*
 * An object creating the XHTML namespace for the aml parser.
 *
 * @constructor
 * @parser
 *
 * @author      Ruben Daniels (ruben AT ajax DOT org)
 * @version     %I%, %G%
 * @since       0.8
 */
apf.xhtml = new apf.AmlNamespace();
apf.setNamespace("http://www.w3.org/1999/xhtml", apf.xhtml);


/*
if (apf.getTextNode(x)) {
    var data = {
        amlNode: x,
        htmlNode: o
    }

    
}

*/







apf.XhtmlElement = function(struct, tagName) {
    this.$init(tagName || true, apf.NODE_VISIBLE, struct);
    
    this.$xoe = this.addEventListener;
    this.addEventListener = this.$xae;
    this.removeEventListener = this.$xre;
    
    var _self = this;
    this.$de = function(e) {
        _self.dispatchEvent(e.type, null, e);
    }
};

(function(){
    var excludedEvents = {
        "contextmenu": 1,
        "keydown": 1,
        "keypress": 1,
        "keyup": 1,
        "DOMNodeInserted": 2,
        "DOMNodeInsertedIntoDocument": 2,
        "DOMNodeRemoved": 2,
        "DOMNodeRemovedFromDocument": 2
    };
    
    this.$xae = function(type, fn) {
        this.$xoe.apply(this, arguments);
        
        if (excludedEvents[type] > (this.editable ? 0 : 1)
          || type.substr(0, 5) == "prop.")
            return;
        
        if (this.$ext) {
            if (type.substr(0,2) == "on")
                type = type.substr(2);
            apf.addListener(this.$ext, type, this.$de);
        }
    };
    
    this.$xre = function(type, fn) {
        apf.AmlElement.prototype.removeEventListener.apply(this, arguments);
        
        
        
        if (this.$ext)
            apf.removeListener(this.$ext, type, this.$de);
    }
    
    this.$handlePropSet = function(name, value, force, inherit) {
        if (this.$booleanProperties[name])
            value = apf.isTrue(value);

        this[name] = value;
        var handler = this.$propHandlers && this.$propHandlers[name]
          || apf.GuiElement.propHandlers[name];

        if (handler)
            handler.call(this, value, null, name);
        else if (this.$int && (force || this.$amlLoaded)) {
            this.$int.setAttribute(name, value);
        }
    };
    
    this.addEventListener("DOMNodeInsertedIntoDocument", function(e) {
        var pHtmlNode;
        if (!(pHtmlNode = this.$pHtmlNode = this.parentNode.$int)) 
            return;

        var str, aml = this.$aml;
        if (aml) {
            this.$ext = 
            this.$int = pHtmlNode.appendChild(xmlToHtml(aml, true));
        }
        else {
            this.$ext = this.$int = 
              pHtmlNode.appendChild(document.createElement(this.localName));
        }
        
        if (this.localName != "a")
            this.$ext.host = this;

        this.style = this.$ext.style;
    }, true);
    
    
    this.addEventListener("DOMNodeInsertedIntoDocument", function(e) {
        this.$amlLoaded = true;
        
        if (this.$setLayout)
            this.$setLayout();
    });
    
}).call(apf.XhtmlElement.prototype = new apf.AmlElement());


apf.xhtml.setElement("@default", apf.XhtmlElement);














apf.XhtmlIgnoreElement = function(struct, tagName) {
    this.$init(tagName, apf.NODE_VISIBLE, struct);
};

apf.XhtmlIgnoreElement.prototype = new apf.AmlElement();

apf.xhtml.setElement("script",   apf.XhtmlIgnoreElement);
apf.xhtml.setElement("noscript", apf.XhtmlIgnoreElement);
apf.xhtml.setElement("head",     apf.XhtmlIgnoreElement);
apf.xhtml.setElement("meta",     apf.XhtmlIgnoreElement);







apf.XhtmlInputElement = function(struct, tagName) {
    this.$init(tagName || "input", apf.NODE_VISIBLE, struct);
};

(function(){
    this.$xae = apf.XhtmlElement.prototype.$xae;
    this.$xre = apf.XhtmlElement.prototype.$xre;
    this.$handlePropSet = function(name, value, force) {
        if (name == "type")
            return;

        return apf.XhtmlElement.prototype.$handlePropSet.call(this, name, value, force);
    };

    this.addEventListener("DOMNodeInsertedIntoDocument", function(e) {
        var pHtmlNode;
        if (!(pHtmlNode = this.parentNode.$int))
            return;

        if (this.$aml) {
            this.$ext =
            this.$int = pHtmlNode.appendChild(xmlToHtml(this.$aml, true));
        }
        else {
            this.$ext = this.$int = document.createElement(this.localName);
            if (this.getAttribute("type"))
                this.$int.setAttribute("type", this.getAttribute("type"));
            pHtmlNode.appendChild(this.$int);
        }
    }, true);
}).call(apf.XhtmlInputElement.prototype = new apf.AmlElement());

apf.xhtml.setElement("input", apf.XhtmlInputElement);








apf.XhtmlOptionElement = function(struct, tagName) {
    this.$init(tagName || "option", apf.NODE_VISIBLE, struct);
};

(function(){
    this.addEventListener("DOMNodeInsertedIntoDocument", function(e) {
        this.$ext = 
        this.$int = this.parentNode.$int.appendChild(
          this.parentNode.$int.ownerDocument.createElement("option"));

        if (this.value)
            this.$int.setAttribute("value", this.value);
    }, true);
}).call(apf.XhtmlOptionElement.prototype = new apf.AmlElement());

apf.xhtml.setElement("option", apf.XhtmlOptionElement);







apf.XhtmlSkipChildrenElement = function(struct, tagName) {
    this.$init(tagName, apf.NODE_VISIBLE, struct);
};

(function(){
    this.canHaveChildren = false;
    
    this.$redraw = function(){
        var _self = this;
        apf.queue.add("redraw" + this.$uniqueId, function(){
            var pHtmlNode = _self.$ext.parentNode;
            var beforeNode = _self.$ext.nextSibling;
            pHtmlNode.removeChild(_self.$ext);
            
            _self.$ext = apf.insertHtmlNode(null, pHtmlNode, beforeNode, _self.$aml 
                ? (_self.$aml.serialize ? _self.$aml.serialize() : _self.$aml.xml)
                : _self.serialize());
        });
    }
    
    this.addEventListener("DOMNodeInsertedIntoDocument", function(e) {
        var pHtmlNode;
        if (!(pHtmlNode = this.parentNode.$int)) 
            return;

        this.$ext = apf.insertHtmlNode(null, pHtmlNode, null, this.$aml 
            ? (this.$aml.serialize ? this.$aml.serialize() : this.$aml.xml)
            : this.serialize());
    }, true);
}).call(apf.XhtmlSkipChildrenElement.prototype = new apf.AmlElement());

apf.xhtml.setElement("object", apf.XhtmlSkipChildrenElement);
apf.xhtml.setElement("embed", apf.XhtmlSkipChildrenElement);
apf.xhtml.setElement("table", apf.XhtmlSkipChildrenElement);

apf.xhtml.setElement("pre", apf.XhtmlSkipChildrenElement);






apf.__ANCHORING__ = 1 << 13;



/**
 * All elements inheriting from this {@link term.baseclass baseclass} have anchoring features. Each side of the
 * element can be attached at a certain distance to its parent's rectangle.
 *
 * When the parent is resized, the anchored side of the element stays
 * at the specified distance at all times. If both sides are anchored, the
 * element size is changed to make sure the specified distance is maintained.
 *
 * #### Example
 *
 * This example shows a bar that has a 10% margin around it, and contains a
 * frame that is displayed using different calculations and settings.
 *
 * ```xml
 *  <a:bar width="80%" height="80%" top="10%" left="10%">
 *      <a:frame 
 *        caption = "Example" 
 *        left = "50%+10"
 *        top = "100"
 *        right = "10%"
 *        bottom = "Math.round(0.232*100)" />
 *  </a:bar>
 * ```
 *
 * ### Remarks
 *
 * This is one of three positioning methods. The other two are Alignment and Grid.
 *
 * @author      Ruben Daniels (ruben AT ajax DOT org)
 * @version     %I%, %G%
 * @since       0.3
 * @baseclass
 * @layout
 */
apf.Anchoring = function(){
    this.$regbase = this.$regbase | apf.__ANCHORING__;
    this.$anchors = [];

    var VERTICAL = 1;
    var HORIZONTAL = 2;

    this.$updateQueue = 0;
    this.$inited = 
    this.$parsed = 
    this.$anchoringEnabled = false;
    this.$hordiff = 
    this.$verdiff = 0;
    this.$rule_v = 
    this.$rule_h = 
    this.$rule_header = "";

    var l = apf.layout;
    
    this.$supportedProperties.push("anchors");
    
    var propHandlers = {
        "right" : function(value, prop) {
            if (!this.$anchoringEnabled && !this.$setLayout("anchoring"))
                return;
            
            if (!value && value !== 0)
                this.$ext.style[prop] = "";

            //@note Removed apf.isParsing here to activate general queuing
            if (!this.$updateQueue)
                l.queue(this.$pHtmlNode, this);
            this.$updateQueue = this.$updateQueue | HORIZONTAL;
        },

        "bottom" : function(value, prop) {
            if (!this.$anchoringEnabled && !this.$setLayout("anchoring"))
                return;

            if (!value && value !== 0)
                this.$ext.style[prop] = "";

            //@note Removed apf.isParsing here to activate general queuing            
            if (!this.$updateQueue)
                l.queue(this.$pHtmlNode, this);
            this.$updateQueue = this.$updateQueue | VERTICAL;
        }
    };
    propHandlers.left = propHandlers.width = propHandlers.right;
    propHandlers.top = propHandlers.height = propHandlers.bottom;
    
    this.$propHandlers["anchors"] = function(value) {
        this.$anchors = value ? value.splitSafe("(?:, *| )") : [];

        if (!this.$anchoringEnabled && !this.$setLayout("anchoring"))
            return;

        if (!this.$updateQueue)
            l.queue(this.$pHtmlNode, this);
        this.$updateQueue = this.$updateQueue | HORIZONTAL | VERTICAL;
    };

    /**
     * Turns anchoring off.
     *
     */
    this.$disableAnchoring = function(activate) {
        //!this.$parsed || 
        if (!this.$inited || !this.$anchoringEnabled || !this.$pHtmlNode)
            return;

        l.removeRule(this.$pHtmlNode, this.$uniqueId + "_anchors");
        if (l.queue)
            l.queue(this.$pHtmlNode);

        for (var prop in propHandlers) {
            delete this.$propHandlers[prop];
        }

        this.removeEventListener("DOMNodeRemoved", remove); 
        this.removeEventListener("DOMNodeInserted", reparent); 

        if (this.$ext) {
            this.$ext.style.left = 
            this.$ext.style.right = 
            this.$ext.style.top = 
            this.$ext.style.bottom = 
            this.$ext.style.width = 
            this.$ext.style.height = 
            this.$ext.style.position = "";
        }
        
        /*if (this.right)
            this.$ext.style.left = apf.getHtmlLeft(this.$ext) + "px";

        if (this.bottom)
            this.$ext.style.top = apf.getHtmlTop(this.$ext) + "px";*/

        this.removeEventListener("prop.visible", visibleHandler);

        this.$inited = false;
        this.$anchoringEnabled = false; //isn't this redundant?
    };


    /**
     * @attribute {Number | String} [left]   Sets or gets a way to determine the amount of pixels from the left border of this element to the left edge of it's parent's border. This attribute can also contain percentages, arithmetic and even full expressions.
     * 
     * #### Example
     *
     * ```xml
     * <a:bar left="(20% + 10) * SOME_JS_VAR" />
     * ```
     */
    /**
     * @attribute {Number | String} [right]  Sets or gets a way to determine the amount of pixels from the right border of this element to the right edge of its parent's border.
     *                                      This attribute can also contain percentages, arithmetic and even full expressions.
     * 
     * #### Example
     *
     * ```xml
     * <a:bar right="(20% + 10) * SOME_JS_VAR" />
     * ```
     */
    /** 
     * @attribute {Number | String} [width]  Sets or gets a way to determine the amount of pixels from the left border to the right border of this element.
     *                                      This attribute can also contain percentages, arithmetic and even full expressions.
     * 
     * #### Example
     *
     * ```xml
     * <a:bar width="(20% + 10) * SOME_JS_VAR" />
     * ```
     */
    /** 
     * @attribute {Number | String} [top]    Sets or gets a way to determine the amount of pixels from the top border of this element to the top edge of its parent's border.
     *                                      This attribute can also contain percentages, arithmetic and even full expressions.
     * 
     * #### Example
     *
     * ```xml
     * <a:bar top="(20% + 10) * SOME_JS_VAR" />
     * ```
     */
    /** 
     * @attribute {Number | String} [bottom] Sets or gets a way to determine the amount of pixels from the bottom border of this element to the bottom edge of its parent's border.
     *                                      This attribute can also contain percentages, arithmetic and even full expressions.
     * 
     * #### Example
     *
     * ```xml
     * <a:bar bottom="(20% + 10) * SOME_JS_VAR" />
     * ```
     */
    /** 
     * @attribute {Number | String} [height] Sets or gets a way to determine the amount of pixels from the top border to the bottom border of this element.
     *                                      This attribute can also contain percentages, arithmetic and even full expressions.
     * 
     * #### Example
     *
     * ```xml
     * <a:bar height="(20% + 10) * SOME_JS_VAR" />
     * ```
     */
    /*
     * Enables anchoring based on attributes set in the AML of this element
     */
    this.$enableAnchoring = function(){
        if (this.$inited) //@todo add code to reenable anchoring rules (when showing)
            return;

        // *** Properties and Attributes *** //
        apf.extend(this.$propHandlers, propHandlers);

        // *** Event handlers *** //
        this.addEventListener("DOMNodeRemoved", remove); 
        this.addEventListener("DOMNodeInserted", reparent); 
        this.addEventListener("prop.visible", visibleHandler);

        this.$updateQueue = 0 
            | ((this.left || this.width || this.right || this.anchors) && HORIZONTAL) 
            | ((this.top || this.height || this.bottom || this.anchors) && VERTICAL) ;

        if (this.$updateQueue)
            l.queue(this.$pHtmlNode, this);

        this.$inited = true;
        this.$anchoringEnabled = true;
    };
    
    function visibleHandler(e) {
        if (!(this.$rule_header || this.$rule_v || this.$rule_h) || !this.parentNode)
            return;

        if (e.value) {
            if (this.$rule_v || this.$rule_h) {
                var rules = this.$rule_header + "\n" + this.$rule_v + "\n" + this.$rule_h;
                l.setRules(this.$pHtmlNode, this.$uniqueId + "_anchors", rules);
                l.queue(this.$pHtmlNode, this);
            }
            l.processQueue();
        }
        else {
            l.removeRule(this.$pHtmlNode, this.$uniqueId + "_anchors");
            l.queue(this.$pHtmlNode)
        }
    }
    
    function remove(e) {
        if (e && (e.$doOnlyAdmin || e.currentTarget != this))
            return;

        if (l.queue && this.$pHtmlNode) {
            l.removeRule(this.$pHtmlNode, this.$uniqueId + "_anchors");
            l.queue(this.$pHtmlNode)
        }
    }

    function reparent(e) {
        if (!this.$amlLoaded || e.currentTarget != this)
            return;

        if (!e.$isMoveWithinParent && this.$parsed) //@todo hmm weird state check
            this.$moveAnchoringRules(e.$oldParentHtmlNode);
    }

    this.$moveAnchoringRules = function(oldParent, updateNow) {
        var rules = oldParent && l.removeRule(oldParent, this.$uniqueId + "_anchors");
        if (rules)
            l.queue(oldParent);

        if (!this.$rule_v && !this.$rule_h && !this.$rule_header)
            return;

        this.$rule_header = getRuleHeader.call(this);
        rules = this.$rule_header + "\n" + this.$rule_v + "\n" + this.$rule_h;

        l.setRules(this.$pHtmlNode, this.$uniqueId + "_anchors", rules);
        l.queue(this.$pHtmlNode, this);
    };

    this.$hasAnchorRules = function(){
        return this.$rule_v || this.$rule_h ? true : false;
    };

    function getRuleHeader(){
        if (!this.$pHtmlDoc) return "";
        return "try{\n\
            var oHtml = document.getElementById('" + this.$ext.getAttribute("id") + "');\n\
            \n\
            var pWidth = " + (this.$pHtmlNode == this.$pHtmlDoc.body
                ? "apf.getWindowWidth()" //@todo only needed for debug?
                : "apf.getHtmlInnerWidth(oHtml.parentNode)") + ";\n\
            \n\
            var pHeight = " + (this.$pHtmlNode == this.$pHtmlDoc.body
                ? "apf.getWindowHeight()" //@todo only needed for debug?
                : "apf.getHtmlInnerHeight(oHtml.parentNode)") + ";\n\
            }catch(e){\n\
            }".replace(/^\s*/gm, "");
    }

    /**
     * Sets the anchoring percentage.
     * @param {String} expr An expression that's converted to a string
     * @param {Number} An integer value that's used to convert to a percentage; for example, 50 becomes .5
     * @returns {String} The anchor percentage
     */
    function setPercentage(expr, value) {
        return String(expr).replace(apf.percentageMatch, "((" + value + " * $1)/100)");
    }

     
    this.$recalcAnchoring = function(queueDelay) {
        this.$updateQueue = this.$updateQueue | HORIZONTAL | VERTICAL;
        this.$updateLayout();
        l.queue(this.$pHtmlNode, this);
        
        if (!queueDelay)
            l.processQueue();
    };
    

    function visCheck(){
        if (this.$updateQueue) {
            this.$updateLayout();
            apf.layout.activateRules(this.$ext.parentNode);
        }
    }

    this.$updateLayout = function(){
        if (!this.$anchoringEnabled)
            return;

        if (!apf.window.vManager.check(this, "anchoring", visCheck))
            return;

        if (!this.$parsed) {
            if (!this.$ext.getAttribute("id"))
                apf.setUniqueHtmlId(this.$ext);

            this.$rule_header = getRuleHeader.call(this);
            this.$parsed = true;
        }

        if (!this.$updateQueue) {
            if (this.visible && this.$ext.style.display == "none")
                this.$ext.style.display = "";
            return;
        }

        if (this.draggable == "relative") {
            if ("absolute|fixed|relative".indexOf(apf.getStyle(this.$ext, "position")) == -1) //@todo apf3.1 the IDE doesn't like this
                this.$ext.style.position = "absolute";
        }
        else if (this.left || this.left ===  0 || this.top || this.top === 0 
          || this.right || this.right === 0 || this.bottom || this.bottom === 0 
          || this.$anchors.length) {
            if ("absolute|fixed".indexOf(apf.getStyle(this.$ext, "position")) == -1)
                this.$ext.style.position = "absolute";
        }
        else if (!this.center) {
            if ("absolute|fixed|relative".indexOf(apf.getStyle(this.$ext, "position")) == -1)
                this.$ext.style.position = "relative";
            if (!this.width)
                this.$ext.style.width = "";
            if (!this.height)
                this.$ext.style.height = "";
        }

        var rules;
        if (this.$updateQueue & HORIZONTAL) {
            rules = [];
            
            this.$hordiff = apf.getWidthDiff(this.$ext);

            var left = this.$anchors[3] || this.left,
                right = this.$anchors[1] || this.right,
                width = this.width, hasLeft = left || left === 0,
                hasRight = right || right === 0, 
                hasWidth = width || width === 0;

            if (right && typeof right == "string")
                right = setPercentage(right, "pWidth");

            if (hasLeft) {
                if (parseInt(left) != left) {
                    left = setPercentage(left,  "pWidth");
                    rules.push("oHtml.style.left = (" + left + ") + 'px'");
                }
                else
                    this.$ext.style.left = left + "px";
            }
            
            if (hasRight) {
                if (parseInt(right) != right) {
                    right = setPercentage(right, "pWidth");
                    rules.push("oHtml.style.right = (" + right + ") + 'px'");
                }
                else
                    this.$ext.style.right = right + "px";
            }

            if (hasLeft && hasRight) { //right != null && left != null) {
                this.$ext.style.width = "";
            }
            else if (hasWidth && typeof this.maxwidth == "number" && typeof this.minwidth == "number") {
                if (parseInt(width) != width) {
                    this.width = width = (this.width || "").replace(/--(\d+)/, "-(-$1)");
                    width = setPercentage(width, "pWidth");
                    rules.push("oHtml.style.width = Math.max(" 
                        + (this.minwidth - this.$hordiff)
                        + ", Math.min(" + (this.maxwidth - this.$hordiff) + ", "
                        + width + " - " + this.$hordiff + ")) + 'px'");
                }
                else {
                    this.$ext.style.width = ((width > this.minwidth
                        ? (width < this.maxwidth
                            ? width
                            : this.maxwidth)
                        : this.minwidth) - this.$hordiff) + "px";
                }
            }

            this.$rule_h = (rules.length
                ? "try{" + rules.join(";}catch(e) {};try{") + ";}catch(e){};"
                : "");
        }

        if (this.$updateQueue & VERTICAL) {
            rules = [];

            this.$verdiff = apf.getHeightDiff(this.$ext);

            var top = this.$anchors[0] || this.top,
                bottom = this.$anchors[2] || this.bottom,
                height = this.height, hasTop = top || top === 0,
                hasBottom = bottom || bottom === 0, 
                hasHeight = height || height === 0;

            if (bottom && typeof bottom == "string")
                bottom = setPercentage(bottom, "pHeight");

            if (hasTop) {
                if (parseInt(top) != top) {
                    top = setPercentage(top, "pHeight");
                    rules.push("oHtml.style.top = (" + top + ") + 'px'");
                }
                else
                    this.$ext.style.top = top + "px";
            }
            if (hasBottom) {
                if (parseInt(bottom) != bottom) {
                    rules.push("oHtml.style.bottom = (" + bottom + ") + 'px'");
                }
                else
                    this.$ext.style.bottom = bottom + "px";
            }
            if (hasTop && hasBottom) { //bottom != null && top != null) {
                this.$ext.style.height = "";
            }
            else if (hasHeight && typeof this.minheight == "number") {
                if (parseInt(height) != height) {
                    height = setPercentage(height, "pHeight");
                    rules.push("oHtml.style.height = Math.max(" 
                        + (this.minheight - this.$verdiff)
                        + ", Math.min(" + (this.maxheight - this.$verdiff) + ", "
                        + height + " - " + this.$verdiff + ")) + 'px'");
                }
                else {
                    this.$ext.style.height = Math.max(0, (height > this.minheight
                        ? (height < this.maxheight
                            ? height
                            : this.maxheight)
                        : this.minheight) - this.$verdiff) + "px";
                }
            }

            this.$rule_v = (rules.length
                ? "try{" + rules.join(";}catch(e) {};try{") + ";}catch(e){};"
                : "");
        }

        if (this.$rule_v || this.$rule_h) {
            l.setRules(this.$pHtmlNode, this.$uniqueId + "_anchors",
                this.$rule_header + "\n" + this.$rule_v + "\n" + this.$rule_h, true);
        }
        else {
            l.removeRule(this.$pHtmlNode, this.$uniqueId + "_anchors");
        }

        this.$updateQueue = 0;
        
        if (this.$box && !apf.hasFlexibleBox) //temporary fix
            apf.layout.forceResize(this.$ext);
    };

    this.addEventListener("DOMNodeRemovedFromDocument", function(e) {
        this.$disableAnchoring();
    });
};







apf.__GUIELEMENT__ = 1 << 15;



/**
 * All elements inheriting from this {@link term.baseclass baseclass} are an AML component.
 *
 * @class apf.GuiElement
 * @author      Ruben Daniels (ruben AT ajax DOT org)
 * @version     %I%, %G%
 * @since       0.4
 *
 * @baseclass
 * @inherits apf.AmlElement
 * @inherits apf.Anchoring
 * @inherits apf.DelayedRender
 * @inherits apf.DragDrop
 * @inherits apf.Focussable
 * @inherits apf.Interactive
 * @inherits apf.Validation
 *
 */
/**
 * @attribute {String} span     Sets or gets the number of columns that this element spans. Only used inside a table element.
 */
/**
 * @attribute {String | Number} margin  Sets or gets margin values. 
 *
 * Set these sizes as a quarter of strings, in the usual top, right, bottom, left sequence, or pass an empty string to turn off margins.
 */
/**
 * @attribute {String} align Sets or gets the edge of the parent to which this
 *                                  element aligns. 
 *
 * The possible values are a combination of "left", "middle", "right", "top", "bottom" and "slider" ,and optionally a size. 
 * Combinations are combined with the pipe (`"|"`) character.
 * 
 */
/**
 * @attribute {Mixed} left Sets or gets the left position of this element. Depending
 * on the choosen layout method the unit can be pixels, a percentage or an
 * expression.
 */
/**
 * @attribute {Mixed} top Sets or gets the top position of this element. Depending
 * on the choosen layout method the unit can be pixels, a percentage or an
 * expression.
 */
/**
 * @attribute {Mixed} right Sets or gets the right position of this element. Depending
 * on the choosen layout method the unit can be pixels, a percentage or an
 * expression.
 */
/**
 * @attribute {Mixed} bottom Sets or gets the bottom position of this element. Depending
 * on the choosen layout method the unit can be pixels, a percentage or an
 * expression.
 */
/**
 * @attribute {Mixed} width Sets or gets the different between the left edge and the
 * right edge of this element. Depending on the choosen layout method the
 * unit can be pixels, a percentage or an expression.
 * 
 * #### Remarks
 *
 * When used as a child of a grid element the width can also be set as '*'. 
 * This will fill the rest space.
 */
/**
 * @attribute {Mixed} height Sets or gets the different between the top edge and the
 * bottom edge of this element. Depending on the choosen layout method the
 * unit can be pixels, a percentage or an expression.
 * 
 * #### Remarks
 *
 * When used as a child of a grid element the height can also be set as '*'. 
 * This will fill the rest space.
 */
/**
 * @event resize Fires when the element changes width or height. 
 */
/** 
 * @event contextmenu Fires when the user requests a context menu, either
 * using the keyboard or mouse.
 * @bubbles
 * @cancelable Prevents the default context menu from appearing.
 * @param {Object} e The standard event object. Contains the following properties:
 *                   - x ([[Number]]): The x coordinate where the contextmenu is requested on
 *                   - y ([[Number]]): The y coordinate where the contextmenu is requested on
 *                   - htmlEvent ([[Event]]): The HTML event object that triggered this event from being called
 */
/**  
 * @event focus       Fires when this element receives focus.
 */
/** 
 * @event blur        Fires when this element loses focus.
 */
/**  
 * @event keydown     Fires when this element has focus and the user presses a key on the keyboard.
 * @bubbles
 * @cancelable Prevents the default key action.
 * @param {Object} e The standard event object. Contains the following properties:
 *                   - ctrlKey ([[Boolean]]): Specifies whether the [[keys: Ctrl]] key was pressed
 *                   - shiftKey ([[Boolean]]): Specifies whether the [[keys: Shift]] key was pressed
 *                   - altKey ([[Boolean]]): Specifies whether the [[keys: Alt ]] key was pressed
 *                   - keyCode ([[Number]]): Indicates which key was pressed. This is an ascii number
 *                   - htmlEvent ([[Event]]): the HTML event object that triggered this event from being called
 * 
 */
apf.GuiElement = function(){
    this.$init(true);
};

(function(){
    this.$regbase = this.$regbase | apf.__GUIELEMENT__;
    
    this.$focussable = apf.KEYBOARD_MOUSE; // Each GUINODE can get the focus by default
    this.visible = 2; //default value;
    
    this.minwidth = 0;
    this.minheight = 0;
    
    this.$booleanProperties["disable-keyboard"] = true;
    
    this.$booleanProperties["visible"] = true;
    
    /**
     * @attribute {Boolean} draggable If true, the element can be dragged around the screen.
     */    
    /**
     * @attribute {Boolean} resizable If true, the element can by resized by the user.
     * 
     */
    
    this.$supportedProperties.push("draggable", "resizable");
    
    this.$supportedProperties.push(
        "focussable", "zindex", "disabled", "tabindex",
        "disable-keyboard", "contextmenu", "visible", "autosize", 
        "loadaml", "alias",
        "width", "left", "top", "height", "tooltip"
    );

    this.$setLayout = function(type, insert) {
        if (!this.$drawn || !this.$pHtmlNode)
            return false;

        if (this.parentNode) {
            if (this.parentNode.$box) {
                if (this.$layoutType != this.parentNode) {
                    if (this.$disableCurrentLayout)
                        this.$disableCurrentLayout();
                    this.parentNode.register(this, insert);
                    this.$disableCurrentLayout = null;
                    this.$layoutType = this.parentNode;
                }
                return type == this.parentNode.localName;
            }
        }
        
        
        if (!this.$anchoringEnabled) {
            if (this.$disableCurrentLayout)
                this.$disableCurrentLayout();
            this.$enableAnchoring();
            this.$disableCurrentLayout = this.$disableAnchoring;
            this.$layoutType = null;
        }
        return type == "anchoring";
        
    }
    
    this.addEventListener("DOMNodeInserted", function(e) {
       if (e.currentTarget == this
         && (this.parentNode.$box || "table" == this.parentNode.localName)) {
            if (!e.$oldParent) this.$layoutType = null;
            this.$setLayout(!e.$oldParent);
       }
    }); 

    this.implement(apf.Anchoring);
    
    // **** Convenience functions for gui nodes **** //

    

    // *** Geometry *** //

    /**
     * Sets the difference between the left edge and the right edge of this
     * element. 
     *
     * Depending on the choosen layout method, the unit can be
     * pixels, a percentage, or an expression. 
     *
     * @chainable
     * @param {Number | String} value The new width of this element.
     */
    this.setWidth = function(value) {
        this.setProperty("width", value, false, true);
        return this;
    };

    /**
     * Sets the different between the top edge and the bottom edge of this
     * element. 
     *
     * Depending on the choosen layout method the unit can be
     * pixels, a percentage or an expression.
     *
     * @chainable
     * @param {Number | String} value the new height of this element.
     */
    this.setHeight = function(value) {
        this.setProperty("height", value, false, true);
        return this;
    };

    /**
     * Sets the left position of this element. 
     *
     * Depending on the choosen layout method the unit can be pixels, 
     * a percentage or an expression.
     *
     * @chainable
     * @param {Number | String} value The new left position of this element.
     */
    this.setLeft = function(value) {
        this.setProperty("left", value, false, true);
        return this;
    };

    /**
     * Sets the top position of this element. 
     *
     * Depending on the choosen layout method the unit can be pixels, 
     * a percentage or an expression.
     *
     * @chainable
     * @param {Number | String} value The new top position of this element.
     */
    this.setTop = function(value) {
        this.setProperty("top", value, false, true);
        return this;
    };

    if (!this.show) {
        /**
         * Makes the elements visible. 
         * @chainable
         */
        this.show = function(){
            this.setProperty("visible", true, false, true);
            return this;
        };
    }

    if (!this.hide) {
        /**
         * Makes the elements invisible. 
         * @chainable
         */
        this.hide = function(){
            this.setProperty("visible", false, false, true);
            return this;
        };
    }

    /**
     * Retrieves the calculated width in pixels for this element.
     */
    this.getWidth = function(){
        return (this.$ext || {}).offsetWidth;
    };

    /**
     * Retrieves the calculated height in pixels for this element.
     */
    this.getHeight = function(){
        return (this.$ext || {}).offsetHeight;
    };

    /**
     * Retrieves the calculated left position in pixels for this element,
     * relative to the offsetParent.
     */
    this.getLeft = function(){
        return (this.$ext || {}).offsetLeft;
    };

    /**
     * Retrieves the calculated top position in pixels for this element,
     * relative to the offsetParent.
     */
    this.getTop = function(){
        return (this.$ext || {}).offsetTop;
    };

    // *** Disabling *** //

    /**
     * Activates the functions of this element. 
     * @chainable
     */
    this.enable = function(){
        this.setProperty("disabled", false, false, true);
        return this;
    };

    /**
     * Deactivates the functions of this element.
     * @chainable
     */
    this.disable = function(){
        this.setProperty("disabled", true, false, true);
        return this;
    };

    // *** z-Index *** //

    /**
     * Moves this element to the lowest z ordered level.
     * @chainable
     */
    this.sendToBack = function(){
        this.setProperty("zindex", 0, false, true);
        return this;
    };

    /**
     * Moves this element to the highest z ordered level.
     * @chainable
     */
    this.bringToFront = function(){
        this.setProperty("zindex", apf.all.length + 1, false, true);
        return this;
    };

    /**
     * Moves this element one z order level deeper.
     * @chainable
     */
    this.sendBackwards = function(){
        this.setProperty("zindex", this.zindex - 1, false, true);
        return this;
    };

    /**
     * Moves this element one z order level higher.
     * @chainable
     */
    this.bringForward = function(){
        this.setProperty("zindex", this.zindex + 1, false, true);
        return this;
    };

    
    
    this.hasFocus = function(){}

    this.addEventListener("DOMNodeInsertedIntoDocument", function(e) {
        var x = this.$aml;

        if (this.parentNode)
            this.$pHtmlNode = this.parentNode.$int;

        if (!this.$pHtmlNode) //@todo apf3.0 retry on DOMNodeInserted
            return;
        
        this.$pHtmlDoc = this.$pHtmlNode.ownerDocument || document;

        if (this.$initSkin)
            this.$initSkin(x);

        if (this.$draw)
            this.$draw();

        if (e.id)
            this.$ext.setAttribute("id", e.id);

        if (typeof this.visible == "undefined")
            this.visible = true;

        

        this.$drawn = true;
    }, true);
    
    var f = function(e) {
        if (!this.$pHtmlNode) //@todo apf3.0 retry on DOMInsert or whatever its called
            return;
        
        this.$setLayout(); //@todo apf3.0 moving an element minwidth/height should be recalced
        
        //@todo apf3.0 set this also for skin change
        if (this.$ext) {
            var hasPres = (this.hasFeature(apf.__PRESENTATION__)) || false;
            var type = this.$isLeechingSkin ? this.localName : "main";
            this.minwidth = Math.max(this.minwidth || 0, apf.getCoord(hasPres && parseInt(this.$getOption(type, "minwidth")), 0));
            this.minheight = Math.max(this.minheight || 0, apf.getCoord(hasPres && parseInt(this.$getOption(type, "minheight")), 0));
            if (this.maxwidth == undefined)
                this.maxwidth = apf.getCoord(hasPres && parseInt(this.$getOption(type, "maxwidth")), 10000);
            if (this.maxheight == undefined)
                this.maxheight = apf.getCoord(hasPres && parseInt(this.$getOption(type, "maxheight")), 10000);
        }
        
        if (this.$loadAml)
            this.$loadAml(this.$aml); //@todo replace by event
        
        
        if (this.$focussable && typeof this.focussable == "undefined")
            apf.GuiElement.propHandlers.focussable.call(this, true);
        
        
        
        if (setResizeEvent)
            f2();
        
    };
    
    this.addEventListener("DOMNodeInsertedIntoDocument", f);
    this.addEventListener("$skinchange", f);
    
    
    var f2, setResizeEvent;
    this.addEventListener("$event.resize", f2 = function(c) {
        if (!this.$ext) {
            setResizeEvent = true;
            return;
        }
        
        apf.layout.setRules(this.$ext, "resize", "var o = apf.all[" + this.$uniqueId + "];\
            if (o) o.dispatchEvent('resize');", true);

        apf.layout.queue(this.$ext);
        this.removeEventListener("$event.resize", f2);
    });
    

    
    this.addEventListener("contextmenu", function(e) {
        
        
        if (!this.contextmenus) return;
        

            var menu;
            if (typeof this.contextmenus[0] == "string")
                menu = self[this.contextmenus[0]];
            if (this.contextmenus[0].localName == "menu")
                menu = this.contextmenus[0];
            else
                menu = self[this.contextmenus[0].getAttribute("menu")];

            if (!menu) {
                
                
                return;
            }

            menu.display(e.x + 1, e.y + 1, null, this);

            e.returnValue = false;//htmlEvent.
            e.cancelBubble = true;
    });
    
}).call(apf.GuiElement.prototype = new apf.AmlElement());

/*
 * @for apf.amlNode
 * @private
 */
apf.GuiElement.propHandlers = {
    /**
     * @attribute {Number} minwidth Sets or gets the minimum width for this element.
     */
    /**
     * @attribute {Number} maxwidth Sets or gets the maximum width for this element.
     */
    /**
     * @attribute {Number} minheight Sets or gets the minimum height for this element.
     */
    /**
     * @attribute {Number} maxheight Sets or gets the maximum height for this element.
     */
    "minwidth": function(value){ this.$ext.style.minWidth = Math.max(0, value - apf.getWidthDiff(this.$ext)) + "px"; },
    "minheight": function(value){ this.$ext.style.minHeight = Math.max(0, value - apf.getHeightDiff(this.$ext)) + "px"; },
    "maxwidth": function(value){ this.$ext.style.maxWidth = Math.max(0, value - apf.getWidthDiff(this.$ext)) + "px"; },
    "maxheight": function(value){ this.$ext.style.maxHeight = Math.max(0, value - apf.getHeightDiff(this.$ext)) + "px"; },
    
    
    /**
     * @attribute {Boolean} focussable Sets or gets whether this element can receive the focus.
     * The focused element receives keyboard event.
     */
    "focussable": function(value) {
        this.focussable = typeof value == "undefined" || value;

        if (value == "container") {
            this.$isWindowContainer = true;
            this.focussable = true;
        }
        else
            this.focussable = apf.isTrue(value);

        if (!this.hasFeature(apf.__FOCUSSABLE__)) //@todo should this be on the prototype
            this.implement(apf.Focussable);

        if (this.focussable) {
            apf.window.$addFocus(this, this.tabindex);
            
            if (value == "container")
                this.$tabList.remove(this);
        }
        else {
            apf.window.$removeFocus(this);
        }
    },

    /**
     * @attribute {Number} tabindex Sets or gets the tab index for this element.
     */    
    "tabindex": function(value) {
        if (!this.hasFeature(apf.__FOCUSSABLE__)) 
            return;
        
        this.setTabIndex(parseInt(value) || null);
    },
    

    /**
     * @attribute {Number} zindex Sets or gets the z ordered layer in which this element is
     * drawn.
     */
    "zindex": function(value) {
        this.$ext.style.zIndex = value;
    },

    /**
     * @attribute {Boolean} visible Sets or gets whether this element is shown.
     */
    "visible": function(value) {
        if (apf.isFalse(value) || typeof value == "undefined") {
            if (this.$ext)
                this.$ext.style.display = "none";
            
            if (apf.document.activeElement == this || this.canHaveChildren == 2
              && apf.isChildOf(this, apf.document.activeElement, false)) {
                if (apf.config.allowBlur && this.hasFeature(apf.__FOCUSSABLE__))
                    this.blur();
                else
                    apf.window.moveNext();
            }
            
            this.visible = false;
        }
        else { //if (apf.isTrue(value)) default
            if (this.$ext) {
                this.$ext.style.display = ""; //Some form of inheritance detection
                if (getComputedStyle(this.$ext).display == "none")
                    this.$ext.style.display = this.$display || "block";
            }
            
            this.visible = true;
        }
    },

    /**
     * @attribute {Boolean} disabled Sets or gets whether this element's functions are active.
     * For elements that can contain other `apf.NODE_VISIBLE` elements, this
     * attribute applies to all its children.
     */
    "disabled": function(value) {
        if (!this.$drawn) {
            var _self = this;
            //this.disabled = false;

            this.addEventListener("DOMNodeInsertedIntoDocument", 
                this.$updateDisabled || (this.$updateDisabled = function(e) {
                    apf.GuiElement.propHandlers.disabled.call(_self, _self.disabled);
                }));
            return;
        }
        else
            apf.queue.remove("disable" + this.$uniqueId);

        //For child containers we only disable its children
        if (this.canHaveChildren) {
            //@todo Fix focus here first.. else it will jump whilst looping
            if (value != -1)
                value = this.disabled = apf.isTrue(value);

            var nodes = this.childNodes;
            for (var node, i = 0, l = nodes.length; i < l; i++) {
                node = nodes[i];
                if (node.nodeFunc == apf.NODE_VISIBLE) {
                    if (value && node.disabled != -1)
                        node.$disabled = node.disabled || false;
                    node.setProperty("disabled", value ? -1 : false);
                }
            }

            //this.disabled = undefined;
            if (this.$isWindowContainer)
                return;
        }

        if (value == -1 || value == false) {
            //value = true;
        }
        else if (typeof this.$disabled == "boolean") {
            if (value === null) {
                value = this.$disabled;
                this.$disabled = null;
            }
            else {
                this.$disabled = value || false;
                return;
            }
        }

        if (apf.isTrue(value) || value == -1) {
            this.disabled = false;
            if (apf.document.activeElement == this) {
                apf.window.moveNext(true); //@todo should not include window
                if (apf.document.activeElement == this)
                    this.$blur();
            }

            if (this.hasFeature(apf.__PRESENTATION__))
                this.$setStyleClass(this.$ext, this.$baseCSSname + "Disabled");

            if (this.$disable)
                this.$disable();

            

            this.disabled = value;
        }
        else {
            this.disabled = false;

            if (apf.document.activeElement == this)
                this.$focus();

            if (this.hasFeature(apf.__PRESENTATION__))
                this.$setStyleClass(this.$ext, null, [this.$baseCSSname + "Disabled"]);

            if (this.$enable)
                this.$enable();

            
        }
    },

    /**
     * @attribute {Boolean} enables Sets or gets whether this element's functions are active.
     * For elements that can contain other `apf.NODE_VISIBLE` elements, this
     * attribute applies to all its children.
     */
    "enabled" : function(value) {
       this.setProperty("disabled", !value);
    },

    /**
     * @attribute {Boolean} disable-keyboard Sets or gets whether this element receives
     * keyboard input. This allows you to disable keyboard independently from
     * focus handling.
     */
    "disable-keyboard": function(value) {
        this.disableKeyboard = apf.isTrue(value);
    },
    
    /**
     * @attribute {String}  tooltip  Sets or gets the text displayed when a user hovers with 
     * the mouse over the element.
     */
    "tooltip" : function(value) {
        this.$ext.setAttribute("title", (value || "") + (this.hotkey ? " ("
            + (apf.isMac ? apf.hotkeys.toMacNotation(this.hotkey) : this.hotkey) + ")" : ""));
    },
    
    
    /**
     * @attribute {String} contextmenu Sets or gets the name of the menu element that will
     * be shown when the user right clicks or uses the context menu keyboard
     * shortcut.
     *
     * #### Example
     * 
     * ```xml
     *  <a:menu id="mnuExample">
     *      <a:item>test</a:item>
     *      <a:item>test2</a:item>
     *  </a:menu>
     *   
     *  <a:list 
     *    contextmenu = "mnuExample" 
     *    width = "200" 
     *    height = "150" />
     *  <a:bar 
     *    contextmenu = "mnuExample" 
     *    width = "200" 
     *    height = "150" />
     * ```
     */
    "contextmenu": function(value) {
        this.contextmenus = [value];
    },
};



// crazy stuff!
!function(){
    var prot = apf.XhtmlElement.prototype;

    prot.implement(
        apf.Anchoring
    );
    
    prot.$drawn = true;
    prot.$setLayout = apf.GuiElement.prototype.$setLayout;
    
    prot.addEventListener("DOMNodeInserted", function(e) {
        if (e.currentTarget == this 
          && "vbox|hbox|table".indexOf(this.parentNode.localName) == -1) {
            this.$setLayout();
        }
    }); 
    
}()



apf.__PRESENTATION__ = 1 << 9;


/**
 * All elements inheriting from this {@link term.baseclass baseclass} have skinning features. A skin is a description
 * of how the element is rendered. In the web browser, this is done using HTML
 * elements and CSS.
 *
 * #### Remarks
 *
 * The skin is set using the `skin` attribute. The skin of each element can be
 * changed at run time. Other than just changing the look of an element, a skin
 * change can help the user to perceive information in a different way. For 
 * example, a list element has a default skin, but can also use the thumbnail 
 * skin to display thumbnails of the {@link term.datanode data nodes}.
 *
 * #### Example
 *
 * A skin for an element is always built up out of a standard set of parts:
 *
 * ```xml
 *   <a:textbox name="textbox">
 *      <a:alias>
 *          ...
 *      </a:alias>
 *      <a:style><![CDATA[
 *          ...
 *      ]]></a:style>
 *  
 *      <a:presentation>
 *          <a:main>
 *              ...
 *          </a:main>
 *          ...
 *      </a:presentation>
 *   </a:textbox>
 * ```
 *
 * The alias contains a name that contains alternative names for the skin. The
 * style tags contain the CSS. The main tag contains the HTML elements that are
 * created when the component is created. Any other skin items are used to render
 * other elements of the widget. In this reference guide you will find these
 * skin items described on the pages of each widget.
 *
 * @class apf.Presentation
 * @define presentation
 * @inherits apf.GuiElement
 * @baseclass
 * @author      Ruben Daniels (ruben AT ajax DOT org)
 * @version     %I%, %G%
 * @since       0.5
 */
apf.Presentation = function(){
    this.$init(true);
};

(function(){
    this.$regbase = this.$regbase | apf.__PRESENTATION__;
    
    // *** Properties and Attributes *** //

    this.$supportedProperties.push("skin");
    
    /**
     * @attribute {String} skinset Sets or gets the skinset for
     * this element. If none are specified ,the `skinset` attribute
     * of the app settings is used. When that's not defined, the default skinset
     * is used.
     * 
     * #### Example
     *
     * ```xml
     *  <a:list skinset="perspex" />
     * ```
     */
    this.$propHandlers["skinset"] =

    
    /**
     * @attribute {String} skin Sets or gets the name of the skin in the skinset that defines 
     * how this element is rendered. When a skin is changed, the full state of the
     * element is kept, including its selection, all the
     * AML attributes, loaded data, and focus and disabled states.
     *
     * #### Example
     *
     * In XML:
     *
     * ```xml
     *  <a:list id="lstExample" skin="thumbnails" />
     * ```
     * 
     * Or, in JavaScript:
     *
     * ```javascript
     *  lstExample.setAttribute("skin", "list");
     * ```
     */
    this.$propHandlers["skin"] = function(value) {
        if (!this.$amlLoaded) //If we didn't load a skin yet, this will be done when we attach to a parent
            return;

        if (!this.$skinTimer) {
            var _self = this;
            clearTimeout(this.$skinTimer);
            this.$skinTimer = $setTimeout(function(){
                changeSkin.call(_self, _self.skin);
                delete _self.$skinTimer;
            });
        }
    }
    

    /**
     * @attribute {String} style Sets or gets the CSS style applied to the this element. This can be a string containing one or more CSS rules.
     */
    this.$propHandlers["style"] = function(value) {
        if (!this.styleAttrIsObj && this.$amlLoaded)
            this.$ext.setAttribute("style", value);
    }
    
    /**
     * @attribute {String} border Sets or gets border values. Set these sizes as a quarter of strings, in the usual top, right, bottom, left sequence, or pass an empty string to turn off borders.
     */
    this.$propHandlers["border"] = function(value) {
        if (!value)
            this.$ext.style.borderWidth = "";
        else
            this.$ext.style.borderWidth = apf.getBox(value).join("px ") + "px";
    }
    
    /**
     * @attribute {String | Number} margin Sets or gets margin values. Set these sizes as a quarter of strings, in the usual top, right, bottom, left sequence, or pass an empty string to turn off margins.
     */
    this.$propHandlers["margin"] = function(value) {
        if (!value)
            this.$ext.style.margin = "";
        else
            this.$ext.style.margin = apf.getBox(value).join("px ") + "px";
    }

    /**
     * @attribute {String} class Sets or gets the name of the CSS style class applied to this element.
     */
    this.$propHandlers["class"] = function(value) {
        this.$setStyleClass(this.$ext, value, this.$lastClassValue ? [this.$lastClassValue] : null);
        this.$lastClassValue = value;
    }

    
    this.$forceSkinChange = function(skin, skinset) {
        changeSkin.call(this, skin, skinset);
    }

    //@todo objects don't always have an $int anymore.. test this
    function changeSkin(skin, skinset) {
        clearTimeout(this.$skinTimer);

        //var skinName = (skinset || this.skinset || apf.config.skinset)
        //    + ":" + (skin || this.skin || this.localName);

        
        //Store selection
        if (this.selectable)
            var valueList = this.getSelection();//valueList;
        

        //Store needed state information
        var oExt = this.$ext,
            oInt = this.$int,
            pNode = this.$ext ? this.$ext.parentNode : this.$pHtmlNode,
            beforeNode = oExt && oExt.nextSibling,
            idExt = this.$ext && this.$ext.getAttribute("id"),
            idInt = this.$int && this.$int.getAttribute("id"),
            oldBase = this.$baseCSSname;

        if (oExt && oExt.parentNode)
            oExt.parentNode.removeChild(oExt);

        //@todo changing skin will leak A LOT, should call $destroy here, with some extra magic
        if (this.$destroy)
            this.$destroy(true);

        //Load the new skin
        this.skin = skin;
        this.$loadSkin(skinset ? skinset + ":" + skin : null);

        //Draw
        if (this.$draw)
            this.$draw(true);

        if (idExt)
            this.$ext.setAttribute("id", idExt);

        if (beforeNode || this.$ext && pNode != this.$ext.parentNode)
            pNode.insertBefore(this.$ext, beforeNode);

        //Style
        
        //Border
        
        //Margin

        if (this.$ext) {
            //Classes
            var i, l, newclasses = [],
                   classes = (oExt.className || "").splitSafe("\\s+");
            for (i = 0; i < classes.length; i++) {
                if (classes[i] && classes[i].indexOf(oldBase) != 0)
                    newclasses.push(classes[i].replace(oldBase, this.$baseCSSname));
            }
            apf.setStyleClass(this.$ext, newclasses.join(" "));
            
            //Copy events
            var en, ev = apf.skins.events;
            for (i = 0, l = ev.length; i < l; i++) {
                en = ev[i];
                if (typeof oExt[en] == "function" && !this.$ext[en])
                    this.$ext[en] = oExt[en];
            }
        
            //Copy css state (dunno if this is best)
            this.$ext.style.left = oExt.style.left;
            this.$ext.style.top = oExt.style.top;
            this.$ext.style.width = oExt.style.width;
            this.$ext.style.height = oExt.style.height;
            this.$ext.style.right = oExt.style.right;
            this.$ext.style.bottom = oExt.style.bottom;
            this.$ext.style.zIndex = oExt.style.zIndex;
            this.$ext.style.position = oExt.style.position;
            this.$ext.style.display = oExt.style.display;
        }
        
        //Widget specific
        //if (this.$loadAml)
            //this.$loadAml(this.$aml);
        
        if (idInt)
            this.$int.setAttribute("id", idInt);
        
        if (this.$int && this.$int != oInt) {
            var node, newNode = this.$int, nodes = oInt.childNodes;
            for (var i = nodes.length - 1; i >= 0; i--) {
                if ((node = nodes[i]).host) {
                    node.host.$pHtmlNode = newNode;
                    if (node.host.$isLeechingSkin)
                        setLeechedSkin.call(node.host);
                }
                newNode.insertBefore(node, newNode.firstChild);
            }
            //this.$int.onresize = oInt.onresize;
        }
        
        //Check disabled state
        if (this.disabled)
            this.$disable(); //@todo apf3.0 test

        //Check focussed state
        if (this.$focussable && apf.document.activeElement == this)
            this.$focus(); //@todo apf3.0 test

        //Dispatch event
        this.dispatchEvent("$skinchange", {
            ext: oExt,
            "int": oInt
        });

        
        if (this.value)
            this.$propHandlers["value"].call(this, this.value);

        
        //Set Selection
        if (this.hasFeature(apf.__MULTISELECT__)) {
            if (this.selectable)
                this.selectList(valueList, true);
        }
        

        //Move layout rules
        if (!apf.hasSingleRszEvent) {
            apf.layout.activateRules(this.$ext);
            if (this.$int)
                apf.layout.activateRules(this.$int);
        }

        
        if (this.draggable && this.$propHandlers["draggable"]) //@todo move these to the event below apf3.0)
            this.$propHandlers["draggable"].call(this, this.draggable);
        if (this.resizable && this.$propHandlers["resizable"])
            this.$propHandlers["resizable"].call(this, this.resizable);
        

        
        apf.layout.forceResize(this.$ext);
        
    };
    

    // *** Private methods *** //

    this.$setStyleClass = apf.setStyleClass;

    function setLeechedSkin(e) {
        if (!this.$amlLoaded || e && (e.$isMoveWithinParent 
          || e.currentTarget != this || !e.$oldParent))
            return;

        if (this.attributes["skin"])
            return;

        //e.relatedNode
        var skinName, pNode = this.parentNode, skinNode;
        if ((skinName = this.$canLeechSkin.dataType 
          == apf.STRING ? this.$canLeechSkin : this.localName)
          && pNode.$originalNodes 
          && (skinNode = pNode.$originalNodes[skinName])
          && skinNode.getAttribute("inherit")) {
            var link = skinNode.getAttribute("link");
            this.$isLeechingSkin = true;
            if (link) {
                this.$forceSkinChange(link);
            }
            else {
                var skin = pNode.skinName.split(":");
                this.$forceSkinChange(skin[1], skin[0]);
            }
        }
        else if (this.$isLeechingSkin) {
            delete this.skin;
            this.$isLeechingSkin = false;
            this.$forceSkinChange();
        }
    }

    //Skin Inheritance
    //@todo Probably requires some cleanup
    this.$initSkin = function(x) {
        if (this.$canLeechSkin) {
            this.addEventListener("DOMNodeInserted", setLeechedSkin);
        }
        
        if (!this.skin)
            this.skin = this.getAttribute("skin");
        
        var skinName, pNode = this.parentNode, skinNode;
        if (this.$canLeechSkin && !this.skin 
          && (skinName = this.$canLeechSkin.dataType == apf.STRING 
            ? this.$canLeechSkin 
            : this.localName)
          && pNode && pNode.$originalNodes 
          && (skinNode = pNode.$originalNodes[skinName])
          && skinNode.getAttribute("inherit")) {
            var link = skinNode.getAttribute("link");
            this.$isLeechingSkin = true;
            if (link) {
                this.skin = link;
                this.$loadSkin();
            }
            else {
                this.$loadSkin(pNode.skinName);
            }
        }
        else {
            if (!this.skinset)
                this.skinset = this.getAttribute("skinset");
            
            this.$loadSkin(null, this.$canLeechSkin);
        }
    }

    /*
     * Initializes the skin for this element when none has been set up.
     *
     * @param  {String}  skinName   Identifier for the new skin (for example: 'default:List' or 'win').
     * @param  {Boolean} [noError]
     */
    this.$loadSkin = function(skinName, noError) {
        //this.skinName || //where should this go and why?
        this.baseSkin = skinName || (this.skinset 
            || this.$setInheritedAttribute("skinset")) 
            + ":" + (this.skin || this.localName);

        clearTimeout(this.$skinTimer);

        if (this.skinName) {
            this.$blur();
            this.$baseCSSname = null;
        }

        this.skinName = this.baseSkin; //Why??
        //this.skinset = this.skinName.split(":")[0];

        this.$pNodes = {}; //reset the this.$pNodes collection
        this.$originalNodes = apf.skins.getTemplate(this.skinName, true);

        if (!this.$originalNodes) {
            // console.warn("Possible missing skin: ", this.baseSkin);
            
            var skin = this.skin;
            if (skin) {
                var skinset = this.skinName.split(":")[0];
                this.baseName = this.skinName = "default:" + skin;
                this.$originalNodes = apf.skins.getTemplate(this.skinName);
                
                if (!this.$originalNodes && skinset != "default") {
                    this.baseName = this.skinName = skinset + ":" + this.localName;
                    this.$originalNodes = apf.skins.getTemplate(this.skinName, true);
                }
            }
            
            if (!this.$originalNodes) {
                this.baseName = this.skinName = "default:" + this.localName;
                this.$originalNodes = apf.skins.getTemplate(this.skinName);
            }

            if (!this.$originalNodes) {
                if (noError) {
                    return (this.baseName = this.skinName = 
                        this.originalNode = null);
                }
                
                throw new Error(apf.formatErrorString(1077, this,
                    "Presentation",
                    "Could not load skin: " + this.baseSkin));
            }
            
            //this.skinset = this.skinName.split(":")[0];
        }

        if (this.$originalNodes)
            apf.skins.setSkinPaths(this.skinName, this);
    };

    this.$getNewContext = function(type, amlNode) {
        

        this.$pNodes[type] = this.$originalNodes[type].cloneNode(true);
    };

    this.$hasLayoutNode = function(type) {
        

        return this.$originalNodes[type] ? true : false;
    };

    this.$getLayoutNode = function(type, section, htmlNode) {
        

        var node = this.$pNodes[type] || this.$originalNodes[type];
        if (!node) {
            
            return false;
        }

        if (!section)
            return htmlNode || apf.getFirstElement(node);

        var textNode = node.getAttribute(section);
        if (!textNode)
            return null;

        return findNode(htmlNode || apf.getFirstElement(node), textNode);
    };

    this.$getOption = function(type, section) {
        type = type.toLowerCase(); //HACK: lowercasing should be solved in the comps.

        var node = this.$pNodes[type] || this.$originalNodes[type];
        if (!section || !node)
            return node;
        var attr = node.getAttribute(section) || ""
        
        return attr;
    };

    this.$getExternal = function(tag, pNode, func, aml) {
        if (!pNode)
            pNode = this.$pHtmlNode;
        if (!tag)
            tag = "main";

        this.$getNewContext(tag);
        var oExt = this.$getLayoutNode(tag);
        
        var node;
        if (node = (aml || this).getAttribute("style"))
            oExt.setAttribute("style", node);

        if (func)
            func.call(this, oExt);

        oExt = apf.insertHtmlNode(oExt, pNode);
        oExt.host = this;
        if (node = (aml || this).getAttribute("bgimage"))
            oExt.style.backgroundImage = "url(" + apf.getAbsolutePath(
                this.mediaPath, node) + ")";

        if (!this.$baseCSSname)
            this.$baseCSSname = oExt.className.trim().split(" ")[0];

        return oExt;
    };

    // *** Focus *** //
    this.$focus = function(){
        if (!this.$ext)
            return;

        this.$setStyleClass(this.oFocus || this.$ext, this.$baseCSSname + "Focus");
    };

    this.$blur = function(){
        
        if (this.renaming)
            this.stopRename(null, true);
        

        if (!this.$ext)
            return;

        this.$setStyleClass(this.oFocus || this.$ext, "", [this.$baseCSSname + "Focus"]);
    };

}).call(apf.Presentation.prototype = new apf.GuiElement());

apf.config.$inheritProperties["skinset"] = 1;







require("./lib/dropdown")(apf);


require("./lib/splitbox")(apf);

require("./lib/crypto")(apf);








/**
 * Baseclass of an element that has one or two states and can be clicked on to
 * trigger an action (_i.e._ {@link apf.button} or {@link apf.checkbox}).
 *
 * @class apf.BaseButton
 * @baseclass
 * @author      Abe Ginner
 * @version     %I%, %G%
 * @since       0.8
 * @inherits apf.StandardBinding
 */
/**
 * @event click Fires when the user presses a mouse button while over this element...and then lets the mousebutton go. 
 */
apf.BaseButton = function(){
    this.$init(true);
};

(function() {
    
    this.$refKeyDown = // Number of keys pressed.
    this.$refMouseDown = 0;     // Mouse button down?
    this.$mouseOver = // Mouse hovering over the button?
    this.$mouseLeft = false; // Has the mouse left the control since pressing the button.

    // *** Properties and Attributes *** //

    /**
     * @attribute {String} background Sets or gets a multistate background. The arguments
     * are seperated by pipes (`'|'`) and are in the order of:'imagefilename|mapdirection|nrofstates|imagesize'
     *
     * - The `mapdirection` argument may have the value of `'vertical'` or `'horizontal'`.
     * - The `nrofstates` argument specifies the number of states the iconfile contains:
     *     - 1: normal
     *     - 2: normal, hover
     *     - 3: normal, hover, down
     *     - 4: normal, hover, down, disabled
     * - The `imagesize` argument specifies how high or wide each icon is inside the
     * map, depending on the `mapdirection` argument.
     * {: #multiStateDoc}
     * 
     * #### Example
     * 
     * Here's a three state picture where each state is 16px high, vertically spaced:
     * 
     * ```xml
     * background="threestates.gif|vertical|3|16"
     * ```
     */
    this.$propHandlers["background"] = function(value) {
        var oNode = this.$getLayoutNode("main", "background", this.$ext);
        
        if (!oNode) return;
        

        if (value) {
            var b = value.split("|");
            this.$background = b.concat(["vertical", 2, 16].slice(b.length - 1));

            oNode.style.backgroundImage = "url(" + this.mediaPath + b[0] + ")";
            oNode.style.backgroundRepeat = "no-repeat";
        }
        else {
            oNode.style.backgroundImage = "";
            oNode.style.backgroundRepeat = "";
            this.$background = null;
        }
    };

    // *** Keyboard Support *** //

    
    this.addEventListener("keydown", function(e) {
        var key = e.keyCode;
        //var ctrlKey = e.ctrlKey;  << UNUSED
        //var shiftKey = e.shiftKey; << UNUSED

        switch (key) {
            case 13:
                if (this.localName != "checkbox")
                    this.$ext.onmouseup(e.htmlEvent, true);
                break;
            case 32:
                if (!e.htmlEvent.repeat) { // Only when first pressed, not on autorepeat.
                    this.$refKeyDown++;
                    this.$updateState(e.htmlEvent);
                }
                return false;
        }
    }, true);

    this.addEventListener("keyup", function(e) {
        var key = e.keyCode;

        switch (key) {
            case 32:
                this.$refKeyDown--;

                if (this.$refKeyDown < 0) {
                    this.$refKeyDown = 0;
                    return false;
                }

                if (this.$refKeyDown + this.$refMouseDown == 0 && !this.disabled)
                    this.$ext.onmouseup(e, true);

                this.$updateState(e);
                return false;
        }
    }, true);
    

    // *** Private state handling methods *** //

    this.states = {
        "Out"   : 1,
        "Over"  : 2,
        "Down"  : 3
    };

    this.$updateState = function(e, strEvent) {
        if (e.reset) { //this.disabled || 
            this.$refKeyDown = 0;
            this.$refMouseDown = 0;
            this.$mouseOver = false;
            return false;
        }

        if (this.$refKeyDown > 0
          || (this.$refMouseDown > 0 && (this.$mouseOver || (this.$ext === e.currentTarget)))
          || (this.isBoolean && this.value)) {
            this.$setState("Down", e, strEvent);
        }
        else if (this.$mouseOver) {
            this.$setState("Over", e, strEvent);
        }
        else
            this.$setState("Out", e, strEvent);
    };

    this.$setupEvents = function() {
        if (this.editable)
            return;
        
        var _self = this;

        this.$ext.onmousedown = function(e) {
            e = e || window.event;

            if (_self.$notfromext && (e.srcElement || e.target) == this)
                return;

            _self.$refMouseDown = 1;
            _self.$mouseLeft = false;
            
            if (_self.disabled)
                return;

            if (_self.value)
                apf.stopEvent(e);
            else
                apf.cancelBubble(e);
            
            _self.$updateState(e, "mousedown");
        };
        
        this.$ext.onmouseup = function(e, force) {
            e = e || window.event;
            //if (e)  e.cancelBubble = true;
            if (_self.disabled || !force && ((!_self.$mouseOver && (this !== e.currentTarget)) || !_self.$refMouseDown))
                return;

            _self.$refMouseDown = 0;
            _self.$updateState(e, "mouseup");

            // If this is coming from a mouse click, we shouldn't have left the button.
            if (_self.disabled || (e && e.type == "click" && _self.$mouseLeft == true))
                return false;

            // If there are still buttons down, this is not a real click.
            if (_self.$refMouseDown + _self.$refKeyDown)
                return false;

            if (_self.$clickHandler && _self.$clickHandler())
                _self.$updateState (e || event, "click");
            else
                _self.dispatchEvent("click", {htmlEvent : e});

            return false;
        };

        this.$ext.onmousemove = function(e) {
            if ((!_self.$mouseOver || _self.$mouseOver == 2)) {
                e = e || window.event;

                if (_self.$notfromext && (e.srcElement || e.target) == this)
                    return;

                _self.$mouseOver = true;
                
                if (!_self.disabled)
                    _self.$updateState(e, "mouseover");
            }
        };

        this.$ext.onmouseout = function(e) {
            e = e || window.event;

            //Check if the mouse out is meant for us
            var tEl = e.explicitOriginalTarget || e.toElement;
            if (apf.isChildOf(this, tEl)) //this == tEl ||
                return;

            _self.$mouseOver = false;
            _self.$refMouseDown = 0;
            _self.$mouseLeft = true;
            
            if (!_self.disabled)
                _self.$updateState(e, "mouseout");
        };
    };

    this.$doBgSwitch = function(nr) {
        if (this.background && (this.$background[2] >= nr || nr == 4)) {
            if (nr == 4)
                nr = this.$background[2] + 1;

            var strBG = this.$background[1] == "vertical"
                ? "0 -" + (parseInt(this.$background[3]) * (nr - 1)) + "px"
                : "-"   + (parseInt(this.$background[3]) * (nr - 1)) + "px 0";

            this.$getLayoutNode("main", "background",
                this.$ext).style.backgroundPosition = strBG;
        }
    };

    // *** Focus Handling *** //

    this.$focus = function(){
        if (!this.$ext)
            return;

        this.$setStyleClass(this.$ext, this.$baseCSSname + "Focus");
    };

    this.$blur = function(e) {
        if (!this.$ext)
            return; //FIREFOX BUG!

        this.$setStyleClass(this.$ext, "", [this.$baseCSSname + "Focus"]);
        /*this.$refKeyDown = 0;
        this.$refMouseDown = 0;
        this.$mouseLeft = true;*/

        
        /*if (this.submenu) {
            if (this.value) {
                this.$setState("Down", {}, "mousedown");
                this.$hideMenu();
            }
        }*/
        

        if (e)
            this.$updateState({});//, "onblur"
    };
    
    this.addEventListener("prop.disabled", function(e) {
        this.$refKeyDown = 
        this.$refMouseDown = 0;
        //this.$mouseOver = 
        //this.$mouseLeft = false;
    });

    /*** Clearing potential memory leaks ****/

    this.$destroy = function(skinChange) {
        if (!skinChange && this.$ext) {
            this.$ext.onmousedown = this.$ext.onmouseup = this.$ext.onmouseover =
            this.$ext.onmouseout = this.$ext.onclick = this.$ext.ondblclick = null;
        }
    };

}).call(apf.BaseButton.prototype = new apf.StandardBinding());








/**
 * Baseclass of a simple element. These are usually displaying elements 
 * (_i.e._ {@link apf.label}, {@link apf.img})
 *
 * @class apf.BaseSimple
 * @baseclass
 *
 * @inherits apf.StandardBinding
 *
 * @author      Ruben Daniels (ruben AT ajax DOT org)
 * @version     %I%, %G%
 * @since       0.8
 */
apf.BaseSimple = function(){
    this.$init(true);
};

(function() {
    
    this.getValue = function(){
        return this.value;
    };

}).call(apf.BaseSimple.prototype = new apf.StandardBinding());








/**
 * The base class for state buttons.
 *
 * @class apf.BaseStateButtons
 * @baseclass
 *
 * @author      Ruben Daniels (ruben AT ajax DOT org)
 * @version     %I%, %G%
 * @since       0.8
 */
apf.BaseStateButtons = function(){
    this.state = "normal";
    this.edit = false;
    
    var actions = {
        "min"   : ["minimized", "minimize", "restore"],
        "max"   : ["maximized", "maximize", "restore"],
        "edit"  : ["edit", "edit", "closeedit"],
        "close" : ["closed", "close", "show"]
    };
    this.$lastheight = null;
    this.$lastpos = null;

    this.$lastState = {"normal":true};    
    this.$booleanProperties["animate"] = true;
    this.$supportedProperties.push("buttons", "animate", "state");
    
    /**
     * Close the window. It can be reopened by using {@link apf.GuiElement.show}
     * @chainable
     */
    this.close = function(){ // @todo show should unset closed
        this.setProperty("state", this.state.split("|")
            .pushUnique("closed").join("|"), false, true);
        return this;
    };

    /**
     * Minimize the window. The window will become the height of the title of
     * the parent window.
     * @chainable
     */
    this.minimize = function(){
        this.setProperty("state", this.state.split("|")
            .remove("maximized")
            .remove("normal")
            .pushUnique("minimized").join("|"), false, true);
        return this;
    };

    /**
     * Maximize the window. The window will become the width and height of the
     * browser window.
     * @chainable
     */
    this.maximize = function(){
        this.setProperty("state", this.state.split("|")
            .remove("minimized")
            .remove("normal")
            .pushUnique("maximized").join("|"), false, true);
        return this;
    };

    /**
     * Restore the size of the window. The window will become the width and
     * height it had before it was minimized or maximized.
     * @chainable
     */
    this.restore = function(){
        this.setProperty("state", this.state.split("|")
            .remove("minimized")
            .remove("maximized")
            .pushUnique("normal").join("|"), false, true);
        return this;
    };
    
     /**
     * Set the window into edit state. The configuration panel is shown.
     * @chainable
     */
    this.edit = function(value) {
        this.setProperty("state", this.state.split("|")
            .pushUnique("edit").join("|"), false, true);
        return this;
    };

    /**
     * Removes the edit state of this window. The configuration panel is hidden.
     * @chainable
     */
    this.closeedit = function(value) {
        this.setProperty("state", this.state.split("|")
            .remove("edit").join("|"), false, true);
        return this;
    };
    
    this.$toggle = function(type) {
        var c = actions[type][0];
        this[actions[type][this.state.indexOf(c) > -1 ? 2 : 1]]();
    };
    
    this.$propHandlers["refparent"] = function(value) {
        if (typeof value == "string")
            this.$refParent = self[value] && self[value].$ext || document.getElementById(value);
        else this.$refParent = value;
    }
    
    this.$propHandlers["maxconf"] = function(value) {
        this.$maxconf = value.splitSafe(",");
    }
    
    /**
     * @attribute {String} state Sets or gets the state of the window. The state can be a
     * combination of multiple states, seperated by a pipe (`'|'`) character.
     *   
     * The possible values include:
     *
     *   `"normal"`:     The window has its normal size and position. This is the default value.
     *   `"minimized"`:  The window is minimized.
     *   `"maximized"`:  The window is maximized.
     *   `"edit"`:       The window is in the edit state.
     *   `"closed"`:     The window is closed.
     */
    this.$propHandlers["state"] = function(value, prop, force, reenter, noanim) {
        var _self = this;
        if (!this.$amlLoaded) { //@todo I still think this is weird and should not be needed
            apf.queue.add("state" + this.$uniqueId, function(){
                _self.$propHandlers["state"].call(_self, value, prop, force, reenter, noanim);
            });
            return;
        }

        if (value == 0)
            value = "normal";

        var i, pNode, position, l, t,
            o = {},
            s = value.split("|"),
            lastState = this.$lastState,
            styleClass = [];

        for (i = 0; i < s.length; i++)
            o[s[i]] = true;
        o.value = value;

        if (!o.maximized && !o.minimized)
            o.normal = true;

        if (!reenter && this.dispatchEvent("beforestatechange", {
          from: lastState, 
          to: o}) === false) {
            this.state = lastState.value;
            return false;
        }

        //Closed state
        if (o.closed == this.visible) {//change detected
            this.setProperty("visible", !o["closed"], false, true);
            //@todo difference is, we're not clearing the other states, check the docking example
        }

        //Restore state
        if (o.normal != lastState.normal
          || !o.normal && (o.minimized != lastState.minimized
            || o.maximized != lastState.maximized)) {

            if (this.$lastheight != null) // this.aData && this.aData.hidden == 3 ??
                this.$ext.style.height = this.$lastheight;//(this.$lastheight - apf.getHeightDiff(this.$ext)) + "px";

            if (this.$lastpos) {
                apf.plane.hide(this.$uniqueId);
                
                if (this.animate && !noanim) {
                    var htmlNode = this.$ext;
                    position = apf.getStyle(htmlNode, "position");
                    if (position != "absolute") {
                        l = parseInt(apf.getStyle(htmlNode, "left")) || 0;
                        t = parseInt(apf.getStyle(htmlNode, "top")) || 0;
                    }
                    else {
                        l = htmlNode.offsetLeft;
                        t = htmlNode.offsetTop;
                    }

                    this.animstate = 1;
                    apf.tween.multi(htmlNode, {
                        steps: 15,
                        anim: apf.tween.easeInOutCubic,
                        interval: 10,
                        tweens: [
                            {type: "left",   from: l,    to: this.$lastpos.px[0]},
                            {type: "top",    from: t,    to: this.$lastpos.px[1]},
                            {type: "width",  from: this.$ext.offsetWidth,
                                to: this.$lastpos.px[2]},
                            {type: "height", from: this.$ext.offsetHeight,
                                to: this.$lastpos.px[3]}
                        ],
                        oneach: function(){
                            
                            if (apf.hasSingleRszEvent)
                                apf.layout.forceResize(_self.$int);
                            
                        },
                        onfinish: function(){
                            _self.$lastpos.parentNode.insertBefore(_self.$ext, _self.$lastpos.beforeNode);
                            
                            if (_self.$placeHolder)
                                _self.$placeHolder.parentNode.removeChild(_self.$placeHolder);
                            
                            _self.$propHandlers["state"].call(_self, value, null,
                                null, true, true);
                        }
                    });

                    return;
                }
                else if (!this.animate) {
                    apf.plane.hide(this.$uniqueId, true);
                    
                    _self.$lastpos.parentNode.insertBefore(_self.$ext, _self.$lastpos.beforeNode);
                            
                    if (_self.$placeHolder)
                        _self.$placeHolder.parentNode.removeChild(_self.$placeHolder);
                }

                this.$ext.style.position = this.$lastpos.pos;
                this.$ext.style.left = this.$lastpos.css[0];
                this.$ext.style.top = this.$lastpos.css[1];
                this.$ext.style.width = this.$lastpos.css[2];
                this.$ext.style.height = this.$lastpos.css[3];
                
                pNode = this.$lastpos.parentNode;
                pNode.style.width = this.$lastpos.parent[0];
                pNode.style.height = this.$lastpos.parent[1];
                pNode.style.overflow = this.$lastpos.parent[2];
            }

            
            if (this.aData && this.aData.restore)
                this.aData.restore();
            

            
            if (apf.layout)
                apf.layout.play(this.$pHtmlNode);
            

            this.$lastheight = this.$lastpos = null;

            if (o.normal)
                styleClass.push("",
                    this.$baseCSSname + "Max",
                    this.$baseCSSname + "Min");
        }

        if (o.minimized != lastState.minimized) {
            if (o.minimized) {
                styleClass.unshift(
                    this.$baseCSSname + "Min",
                    this.$baseCSSname + "Max",
                    this.$baseCSSname + "Edit");

                
                if (this.aData && this.aData.minimize)
                    this.aData.minimize(this.collapsedHeight);
                

                if (!this.aData || !this.aData.minimize) {
                    this.$lastheight = this.$ext.style.height; //apf.getStyle(this.$ext, "height");//this.$ext.offsetHeight;

                    this.$ext.style.height = Math.max(0, this.collapsedHeight
                        - apf.getHeightDiff(this.$ext)) + "px";
                }

                if (this.hasFocus())
                    apf.window.moveNext(null, this, true);
                //else if(apf.document.activeElement)
                    //apf.document.activeElement.$focus({mouse: true});
            }
            else {
                styleClass.push(this.$baseCSSname + "Min");

                $setTimeout(function(){
                    apf.window.$focusLast(_self);
                });
            }
        }

        if (o.maximized != lastState.maximized) {
            if (o.maximized) {
                styleClass.unshift(
                    this.$baseCSSname + "Max",
                    this.$baseCSSname + "Min",
                    this.$baseCSSname + "Edit");

                pNode = this.$refParent;
                if (!pNode)
                    pNode = (this.$ext.offsetParent == document.body
                      ? document.documentElement
                      : this.$ext.parentNode);

                this.animstate = 0;
                var hasAnimated = false, htmlNode = this.$ext;
                
                var position = apf.getStyle(htmlNode, "position");
                if (position == "absolute") {
                    pNode.style.overflow = "hidden";
                    l = htmlNode.offsetLeft;
                    t = htmlNode.offsetTop;
                }
                else {
                    var pos = apf.getAbsolutePosition(htmlNode); //pNode
                    l = pos[0];//parseInt(apf.getStyle(htmlNode, "left")) || 0;
                    t = pos[1];//parseInt(apf.getStyle(htmlNode, "top")) || 0;
                }
                
                this.$lastpos = {
                    css: [this.$ext.style.left, this.$ext.style.top,
                              this.$ext.style.width, this.$ext.style.height,
                              this.$ext.style.margin, this.$ext.style.zIndex],
                    px: [l, t, this.$ext.offsetWidth, 
                              this.$ext.offsetHeight],
                    parent: [pNode.style.width, pNode.style.height, 
                              pNode.style.overflow],
                    pos: htmlNode.style.position,
                    parentNode: pNode,
                    beforeNode: this.$ext.nextSibling
                };
                
                if (this.parentNode.$layout) {
                    if (!this.$placeHolder)
                        this.$placeHolder = document.createElement("div");
                    this.$placeHolder.style.position = this.$lastpos.pos;
                    this.$placeHolder.style.left = this.$lastpos.css[0];
                    this.$placeHolder.style.top = this.$lastpos.css[1];
                    this.$placeHolder.style.width = this.$lastpos.px[2] + "px";
                    this.$placeHolder.style.height = this.$lastpos.px[3] + "px";
                    this.$placeHolder.style.margin = this.$lastpos.css[4];
                    this.$placeHolder.style.zIndex = this.$lastpos.css[5];
                    this.$pHtmlNode.insertBefore(this.$placeHolder, this.$ext);
                    
                    htmlNode.style.position = "absolute";
                }
                
                document.body.appendChild(htmlNode);
                htmlNode.style.left = l + "px";
                htmlNode.style.top = t + "px";
                
                function setMax(){
                    //While animating dont execute this function
                    if (_self.animstate)
                        return;
                    
                    var w, h, pos, box, pDiff;
                    if (_self.maxconf) {
                        w = _self.$maxconf[0];
                        h = _self.$maxconf[1];
                        
                        pos = [_self.$maxconf[2] == "center" 
                            ? (apf.getWindowWidth() - w)/2
                            : _self.$maxconf[2], 
                               _self.$maxconf[3] == "center" 
                            ? (apf.getWindowHeight() - h)/3
                            : _self.$maxconf[3]];
                    }
                    else {
                        w = pNode == document.documentElement
                            ? window.innerWidth
                            : pNode.offsetWidth,
                        h = pNode == document.documentElement
                            ? window.innerHeight
                            : pNode.offsetHeight;
                    }
                    
                    if (!pos) {
                        pos = pNode != htmlNode.offsetParent
                            ? apf.getAbsolutePosition(pNode, htmlNode.offsetParent)
                            : [0, 0];
                    }

                    if (position != "absolute") {
                        var diff = apf.getDiff(pNode);
                        w -= diff[0];
                        h -= diff[0];
                    }
                    
                    box = _self.$refParent ? [0,0,0,0] : marginBox;
                    pDiff = apf.getDiff(pNode);

                    pNode.style.width = (pNode.offsetWidth - pDiff[0]) + "px";
                    pNode.style.height = (pNode.offsetHeight - pDiff[1]) + "px";
                    
                    if (!hasAnimated && _self.$maxconf && _self.$maxconf[4])
                        apf.plane.show(htmlNode, {
                            color: _self.$maxconf[4], 
                            opacity: _self.$maxconf[5],
                            animate: _self.animate,
                            protect: _self.$uniqueId
                        });
                    
                    if (_self.animate && !hasAnimated) {
                        _self.animstate = 1;
                        hasAnimated = true;
                        apf.tween.multi(htmlNode, {
                            steps: 15,
                            anim: apf.tween.easeInOutCubic,
                            interval: 10,
                            tweens: [
                                {type: "left",   from: l, to: pos[0] - box[3]},
                                {type: "top",    from: t, to: pos[1] - box[0]},
                                {type: "width",  from: _self.$lastpos.px[2],
                                    to: (w + box[1] + box[3] - apf.getWidthDiff(_self.$ext))},
                                {type: "height", from: _self.$lastpos.px[3],
                                    to: (h + box[0] + box[2] - apf.getHeightDiff(_self.$ext))}
                            ],
                            oneach: function(){
                                
                                if (apf.hasSingleRszEvent)
                                    apf.layout.forceResize(_self.$int);
                                
                            },
                            onfinish: function(){
                                _self.animstate = 0;
                                
                                _self.dispatchEvent("afterstatechange", {
                                  from: lastState, 
                                  to: o
                                });
                                
                                
                                if (apf.hasSingleRszEvent)
                                    apf.layout.forceResize(_self.$int);
                                
                            }
                        });
                    }
                    else if (!_self.animstate) {
                        htmlNode.style.left = (pos[0] - box[3]) + "px";
                        htmlNode.style.top = (pos[1] - box[0]) + "px";

                        var diff = apf.getDiff(_self.$ext);
                        htmlNode.style.width = (w
                            - diff[0] + box[1] + box[3]) + "px";
                        htmlNode.style.height = (h
                            - diff[1] + box[0] + box[2]) + "px";
                    }
                }

                
                if (apf.layout)
                    apf.layout.pause(this.$pHtmlNode, setMax);
                
            }
            else {
                styleClass.push(this.$baseCSSname + "Max");
            }
        }

        if (o.edit != lastState.edit) {
            if (o.edit) {
                styleClass.unshift(
                    this.$baseCSSname + "Edit",
                    this.$baseCSSname + "Max",
                    this.$baseCSSname + "Min");

                if (this.btnedit)
                    oButtons.edit.textContent = "close"; //hack

                this.dispatchEvent('editstart');
            }
            else {
                if (this.dispatchEvent('editstop') === false)
                    return false;

                styleClass.push(this.$baseCSSname + "Edit");
                if (styleClass.length == 1)
                    styleClass.unshift("");

                if (this.btnedit)
                    oButtons.edit.textContent = "edit"; //hack
            }
        }

        if (styleClass.length || o.closed != lastState.closed) {
            if (styleClass.length)
                this.$setStyleClass(this.$ext, styleClass.shift(), styleClass);
                
            if (o.edit) { //@todo apf3.0
                this.dispatchEvent("prop.visible", {value:true});
                
                if (_self.oSettings)
                    apf.layout.forceResize(_self.oSettings);
                
            }

            //@todo research why this is not symmetrical
            if (!o.maximized || !this.animate || lastState.maximized && _self.animate) {
                _self.dispatchEvent("afterstatechange", {
                  from: lastState, 
                  to: o});
            }
            
            this.$lastState = o;

            
            if (this.aData && !o.maximized) { //@todo is this the most optimal position?
                this.$purgeAlignment();
            }
            

            
            if (!this.animate && apf.hasSingleRszEvent && apf.layout)
                apf.layout.forceResize(_self.$int);
            
        }
    };

    var marginBox, hordiff, verdiff, oButtons = {}
    /**
     * @attribute {String} buttons Sets or gets the buttons that the window displays. This
     * can be multiple values seperated by a pipe (`'|'`) character.
     *   
     * The possible values include:
     *
     *   `"min"`:    The button that minimizes the window.
     *   `"max"`:    The button that maximizes the window.
     *   `"close"`:  The button that closes the window.
     *   `"edit"`:   The button that puts the window into the edit state.
     */
    this.$propHandlers["buttons"] = function(value) {
        
        if (!this.$hasLayoutNode("button"))
            return;

        var buttons = value && (value = value.replace(/(\|)\||\|$/, "$1")).split("|") || [],
            nodes = this.$buttons.childNodes,
            re = value && new RegExp("(" + value + ")"),
            found = {},
            idleNodes = [];

        //Check if we can 'remove' buttons
        for (var i = 0; i < nodes.length; i++) {
            if (nodes[i].nodeType != 1 || nodes[i].tagName != "DIV") //@todo temp hack
                continue;

            if (nodes[i].getAttribute("button") && (!value 
              || !nodes[i].className || !nodes[i].className.match(re))) {
                nodes[i].style.display = "none";
                this.$setStyleClass(nodes[i], "", ["min", "max", "close", "edit"]);
                idleNodes.push(nodes[i]);
            }
            else {
                found[RegExp.$1] = nodes[i];
            }
        }

        //Create new buttons if needed
        for (i = 0; i < buttons.length; i++) {
            if (!buttons[i])
                continue;
            
            if (found[buttons[i]]) {
                this.$buttons.insertBefore(found[buttons[i]], this.$buttons.firstChild);
                continue;
            }

            var btn = idleNodes.pop();
            if (!btn) {
                this.$getNewContext("button");
                btn = this.$getLayoutNode("button");
                btn.setAttribute("button", "button");
                setButtonEvents.call(this, btn);
                btn = apf.insertHtmlNode(btn, this.$buttons);
            }

            this.$setStyleClass(btn, buttons[i], ["min", "max", "close", "edit"]);
            btn.onclick = new Function("apf.lookup(" + this.$uniqueId + ").$toggle('"
                                       + buttons[i] + "')");
            btn.style.display = "block";
            oButtons[buttons[i]] = btn;
            this.$buttons.insertBefore(btn, this.$buttons.firstChild);
        }
        
        marginBox = apf.getBox(apf.getStyle(this.$ext, "borderWidth"));
    };
    
    function setButtonEvents(btn) {
        //@todo can this cancelBubble just go?
        //event.cancelBubble = true; \
        btn.setAttribute("onmousedown",
            "var o = apf.all[" + this.$uniqueId + "];\
             o.$setStyleClass(this, 'down', null, true);\
             apf.cancelBubble(event, o); \
             var o = apf.findHost(this).$ext;\
             if (o.onmousedown) o.onmousedown(event);\
             apf.cancelBubble(event, o);\
             apf.window.$mousedown(event);");
        btn.setAttribute("onmouseup",
            "var o = apf.all[" + this.$uniqueId + "];\
             o.$setStyleClass(this, '', ['down'], true);");
        btn.setAttribute("onmouseover",
            "var o = apf.all[" + this.$uniqueId + "];\
             o.$setStyleClass(this, 'hover', null, true);");
        btn.setAttribute("onmouseout",
            "var o = apf.all[" + this.$uniqueId + "];\
             o.$setStyleClass(this, '', ['hover', 'down'], true);");
        btn.setAttribute("ondblclick", "apf.stopPropagation(event);");
    }
    
    this.$initButtons = function(oExt) {
        this.animate = apf.enableAnim;
        
        this.collapsedHeight = this.$getOption("Main", "collapsed-height");

        var oButtons = this.$getLayoutNode("main", "buttons", oExt);
        if (!oButtons || apf.isIphone || !this.getAttribute("buttons") 
          || !this.$hasLayoutNode("button"))
            return;

        var len = (this.getAttribute("buttons") || "").split("|").length;
        for (var btn, i = 0; i < len; i++) {
            this.$getNewContext("button");
            btn = oButtons.appendChild(this.$getLayoutNode("button"));
            btn.setAttribute("button", "button");
            setButtonEvents.call(this, btn);
        }
    };
    
    this.addEventListener("DOMNodeRemovedFromDocument", function(e) {
        for (var name in oButtons) {
            oButtons[name].onclick = null;
        }
    });
};







apf.__DELAYEDRENDER__ = 1 << 11



/**
 * All elements inheriting from this {@link term.baseclass baseclass} have delayed
 * rendering features. 
 *
 * Any element that is (partially) hidden at startup has the
 * possibility to delay rendering its childNodes by setting `render="runtime"` on
 * the element. These elements include `window`, `tab`, `pages`, `form` and c`ontainer`.
 * For instance, a tab page in a container is initally hidden and does not
 * need to be rendered. When the tab button is pressed to activate the page,
 * the page is rendered and then displayed. This can dramatically decrease
 * the startup time of the application.
 * 
 * #### Example
 *
 * In this example the button isn't rendered until the advanced tab becomes active.
 * 
 * ```xml
 *  <a:tab width="200" height="150">
 *      <a:page caption="General">
 *      ...
 *      </a:page>
 *      <a:page caption="Advanced" render="runtime">
 *         <a:button>OK</a:button>
 *      </a:page>
 *  </a:tab>
 * ```
 * @class apf.DelayedRender
 * @baseclass
 * @author      Ruben Daniels (ruben AT ajax DOT org)
 * @version     %I%, %G%
 * @since       0.8.9
 */
/**
 * @event beforerender  Fires before elements are rendered. Use this event to display a loader.
 * @cancelable Prevents rendering of the childNodes
 */
/**
 *  @event afterrender   Fires after elements are rendered. Use this event to hide a loader.
 *
 */
/**
 *  @attribute {String}  render   Sets or gets when the contents of this element is rendered.
 *   
 * Possible values include:
 *   
 *   - init:     elements are rendered during the initialization of the application.
 *   - runtime:  elements are rendered when the user requests them.
 */
/**
 *  @attribute {Boolean} use-render-delay Sets or gets whether there's a short delay between showing this element and rendering its contents.
 *  
 * If `true`, the elements are rendered immediately. Otherwise, there is a delay between showing this element and the actual rendering,
 * allowing the browsers' render engine to draw (for instance, a loader).
 *
 */
apf.DelayedRender = function(){
    this.$regbase = this.$regbase | apf.__DELAYEDRENDER__;
    this.$rendered = false;
    
    /*
     * Renders the children of this element.
     *
     * @param {Boolean} [usedelay] Specifies whether a delay is added between calling 
     * this function and the actual rendering. This allows the browsers' 
     * render engine to draw (for instance a loader).
     */
    this.$render = function(usedelay) {
        if (this.$rendered)
            return;

        if (this.dispatchEvent("beforerender") === false)
            return;

        if (this["render-delay"] || usedelay)
            $setTimeout("apf.lookup(" + this.$uniqueId + ").$renderparse()", 10);
        else
            this.$renderparse();
    };

    this.$renderparse = function(){
        if (this.$rendered)
            return;

        // Hide render pass from sight for inner callstack 
        // redrawing browsers like firefox
        this.$ext.style.visibility = "hidden";

        this.childNodes.forEach(function(i) { i.$onInsertedIntoDocument(); })

        this.$rendered = true;

        this.dispatchEvent("afterrender");
        this.addEventListener("$event.afterrender", function(cb) {
            cb.call(this);
        });

        this.$ext.style.visibility = "";
    };
    
    var f;
    this.addEventListener("prop.visible", f = function(){
        if (arguments[0].value) {
            
            this.$render();
            
            
            this.removeEventListener("prop.visible", f);
        }
    });
};

apf.GuiElement.propHandlers["render"] = function(value) {
    if (!this.hasFeature(apf.__DELAYEDRENDER__) && value == "runtime") {
        this.implement(apf.DelayedRender);
    
        if (this.localName != "page") {
            this.visible = false;
            this.$ext.style.display = "none";
        }
        
        if (typeof this["render-delay"] == "undefined")
            this.$setInheritedAttribute("render-delay");
    }
};

apf.config.$inheritProperties["render-delay"] = 1;










apf.__FOCUSSABLE__ = 1 << 26;

/**
 * All elements inheriting from this {@link term.baseclass baseclass} have focussable
 * features
 * 
 * @class apf.Focussable
 * @baseclass
 * 
 */

apf.Focussable = function(){
    this.$regbase = this.$regbase | apf.__FOCUSSABLE__;
    if (this.disabled == undefined)
        this.disabled = false;
    
    /**
     * Sets the position in the list that determines the sequence
     * of elements when using the tab key to move between them.
     * @chainable
     * @param {Number} tabindex The position in the list
     */
    this.setTabIndex = function(tabindex) {
        apf.window.$removeFocus(this);
        apf.window.$addFocus(this, tabindex);
        return this;
    };

    /**
     * Gives this element the focus. This means that keyboard events
     * are sent to this element.
     * @chainable
     */
    this.focus = function(noset, e, nofix) {
        if (!noset) {
            if (this.$isWindowContainer > -1) {
                apf.window.$focusLast(this, e, true);
            }
            else {
                apf.window.$focus(this, e);

                
            }

            return this;
        }

        if (this.$focus && !this.editable && (!e || !e.mouse || this.$focussable == apf.KEYBOARD_MOUSE))
            this.$focus(e);

        this.dispatchEvent("focus", apf.extend({
            bubbles: true
        }, e));
        return this;
    };

    /**
     * Removes the focus from this element.
     * @chainable
     */
    this.blur = function(noset, e) {
        
        if ((e && !apf.isChildOf(e.fromElement, e.toElement)) && apf.popup.isShowing(this.$uniqueId) && e.toElement.localName != "menu")
            apf.popup.forceHide(); //This should be put in a more general position
        
        
        if (this.$blur)
            this.$blur(e);

        if (!noset)
            apf.window.$blur(this);

        this.dispatchEvent("blur", apf.extend({
            bubbles: !e || !e.cancelBubble
        }, e));
        return this;
    };

    /**
     * Determines whether this element has the focus
     * @returns {Boolean} Indicates whether this element has the focus
     */
    this.hasFocus = function(){
        return apf.document.activeElement == this || this.$isWindowContainer
            && (apf.document.activeElement || {}).$focusParent == this;
    };
};






/**
 * All elements inheriting from this {@link term.baseclass baseclass} have interactive features, making an
 * element draggable and resizable.
 * 
 * #### Example
 *
 * ```xml
 *  <a:textarea draggable="true" resizable="true" />
 * ```
 * 
 * @class apf.Interactive
 * @baseclass
 *
 * @author      Ruben Daniels (ruben AT ajax DOT org)
 * @version     %I%, %G%
 * @since       1.0
 *
 * @see apf.appsettings.outline
 * @see apf.appsettings.resize-outline
 * @see apf.appsettings.drag-outline
 */
/**
 * @attribute {Boolean} draggable Sets or gets whether an element is draggable. The user will
 * able to move the element around while holding the mouse button down on the 
 * element.
 * 
 * #### Example
 *
 * ```xml
 *  <a:bar 
 *    draggable = "true" 
 *    width = "200" 
 *    height = "200" 
 *    left = "10" 
 *    top = "10" />
 * ```
 */
/**
 * @attribute {Boolean} resizable Sets or gets whether an element is resizable. 
 * 
 * The user will able
 * to resize the element by grabbing one of the four edges of the element and 
 * pulling it in either direction. Grabbing the corners allows users to 
 * resize horizontally and vertically at the same time. The right bottom corner 
 * is special, because it offers an especially big grab area. The size of this
 * area can be configured in the skin of the element.
 * 
 * #### Example
 *
 * ```xml
 *  <a:window 
 *    resizable = "true"
 *    visible = "true" 
 *    width = "400" 
 *    height = "200" />
 * ```
 */
/**
 * @attribute {Number} minwidth  Sets or gets the minimum horizontal size the element can get when resizing.
 */
/**
 * @attribute {Number} minheight Sets or gets the minimum vertical size the element can get when resizing.
 */
/**
 * @attribute {Number} maxwidth  Sets or gets the maximum horizontal size the element can get when resizing.
 */
/**
 * @attribute {Number} maxheight Sets or gets the maximum vertical size the element can get when resizing.
 *
 */
/**
 * @event drag          Fires when the widget has been dragged.
 */
/**
 * @event resizestart   Fires before the widget is resized.
 * @cancelable Prevents this resize action to start.
 * @param {Object} e The standard event object. It contains the following property:
 *   - type ([[String]]): the type of resize. This is a combination of the four directions--`"n"`, `"s"`, `"e"`, `"w"`.
 */
/**
 * @event resize        Fires when the widget has been resized.
 *
 */
apf.Interactive = function(){
    var nX, nY, rX, rY, startPos, lastCursor = null, l, t, r, b, lMax, tMax, lMin,
        tMin, w, h, we, no, ea, so, rszborder, rszcorner, marginBox,
        verdiff, hordiff, _self = this, posAbs, oX, oY, overThreshold,
        dragOutline, resizeOutline, myPos, startGeo;

    this.$dragStart = function(e, reparent) {
        var nativeEvent = e || event;
        if (!reparent && nativeEvent.button == 2)
            return;

        
        {
            dragStart.apply(nativeEvent.srcElement || this, arguments);
        }
    }

    this.$propHandlers["draggable"] = function(value) {
        if (apf.isFalse(value))
            this.draggable = value = false;
        else if (apf.isTrue(value))
            this.draggable = value = true;

        var o = this.editable ? this.$ext : this.oDrag || this.$ext;
        if (value)
            apf.addListener(o, "mousedown", this.$dragStart);
        else
            apf.removeListener(o, "mousedown", this.$dragStart);
        
        //deprecated??
        if (o.interactive & 1) 
            return;
        o.interactive = (o.interactive||0)+1;
        
        //this.$ext.style.position = "absolute";
    };

    this.$propHandlers["resizable"] = function(value) {
        if (apf.isFalse(value))
            this.resizable = false;
        else if (apf.isTrue(value))
            this.resizable = "true";
        
        this.$ext.style.cursor = "";
        
        var o = this.oResize || this.$ext;
        if (o.interactive & 2) 
            return;

        if (!_self.editable) {        
            apf.addListener(o, "mousedown", function(){
                resizeStart.apply(o, arguments);
            });
    
            apf.addListener(o, "mousemove", function(){
                resizeIndicate.apply(o, arguments);
            });
        }
        
        o.interactive = (o.interactive||0)+2;
        
        //this.$ext.style.position = "absolute";
        
        rszborder = this.$getOption && parseInt(this.$getOption("Main", "resize-border")) || 3;
        rszcorner = this.$getOption && parseInt(this.$getOption("Main", "resize-corner")) || 12;
        marginBox = apf.getBox(apf.getStyle(this.$ext, "borderWidth"));
    };
    
    /*
    this.$propHandlers["minwidth"] = 
    this.$propHandlers["maxwidth"] = 
    this.$propHandlers["minheight"] = 
    this.$propHandlers["maxheight"] = function(value, prop) {
        if (this.aData)
            this.aData[prop] = parseInt(value);
    }
    if (this.aData) {
        this.aData.minwidth = this.minwidth;
        this.aData.minheight = this.minheight;
    }*/
    
    this.$cancelInteractive = function(){
        document.onmouseup(null, true);
    }
    
    function dragStart(e, reparent) {
        if (!e) e = event;

        if (!reparent && (!_self.draggable || apf.dragMode))//_self.editable || 
            return;
        
        
        dragOutline = false;        
        
        var host = apf.findHost(e.target)
        if (host && host.textselect)
            return;
        
        if (_self.dispatchEvent("beforedragstart", {htmlEvent: e}) === false)
            return;
        
        apf.dragMode = true;
        if (reparent) {
            _self.dispatchEvent("beforedrag")
            overThreshold = true;
        }
        else
            overThreshold = false;
        
        
        apf.popup.forceHide();
        
        
        posAbs = "absolute|fixed".indexOf(apf.getStyle(_self.$ext, "position")) > -1;
        if (!posAbs) {
            _self.$ext.style.position = posAbs //(posAbs = _self.dragSelection) 
                ? "absolute" : "relative";
        }
        if (_self.editable)
            posAbs = true;

        //@todo not for docking
        
        if (posAbs && !_self.aData) {
            apf.plane.setCursor("default");
        }
        

        var ext = (reparent || (oOutline && oOutline.self)) && dragOutline //little dirty hack to detect outline set by visualselect
            ? oOutline 
            : _self.$ext;
        var pos = posAbs
            ? apf.getAbsolutePosition(ext, ext.offsetParent, true) 
            : [parseInt(apf.getStyle(ext, "left")) || 0, 
               parseInt(apf.getStyle(ext, "top")) || 0];

        
        startGeo = [ext.style.left, ext.style.top, ext.style.right, 
                    ext.style.bottom, ext.style.width, ext.style.height];
        

        nX = pos[0] - (oX = e.clientX);
        nY = pos[1] - (oY = e.clientY);
        
        //if (_self.hasFeature && _self.hasFeature(apf.__ANCHORING__))
            //_self.$disableAnchoring();

        if (!(reparent || (oOutline && oOutline.self))) {
            
            {
                if (_self.$ext.style.right) {
                    _self.$ext.style.left = pos[0] + "px";
                    _self.$ext.style.right = "";
                }
                if (_self.$ext.style.bottom) {
                    _self.$ext.style.top = pos[1] + "px";
                    _self.$ext.style.bottom = "";
                }
            }
        }

        document.onmousemove = dragMove;
        document.onmouseup = function(e, cancel) {
            document.onmousemove = document.onmouseup = null;

            
            if (posAbs && !_self.aData)
                apf.plane.unsetCursor();
            
            
            var htmlNode = dragOutline
                ? oOutline
                : _self.$ext;

            if (overThreshold && !_self.$multidrag) {
                
                if (cancel) {
                    var ext = _self.$ext;
                    ext.style.left = startGeo[0];
                    ext.style.top = startGeo[1];
                    ext.style.right = startGeo[2];
                    ext.style.bottom = startGeo[3];
                    ext.style.width = startGeo[4];
                    ext.style.height = startGeo[5];
                    
                    if (_self.dispatchEvent)
                        _self.dispatchEvent("dragcancel", {
                            htmlNode: htmlNode,
                            htmlEvent: e
                        });
                }
                else
                
                
                if (_self.setProperty) {
                    updateProperties();
                }
                else if (dragOutline) {
                    _self.$ext.style.left = l + "px";
                    _self.$ext.style.top = t + "px";
                }
            }
            
            l = t = w = h = null;
            
            if (!posAbs)
                _self.$ext.style.position = "relative";
            
            if (_self.showdragging)
                apf.setStyleClass(_self.$ext, "", ["dragging"]);
            
            if (posAbs && dragOutline && !oOutline.self) //little dirty hack to detect outline set by visualselect
                oOutline.style.display = "none";
            
            apf.dragMode = false;

            if (!cancel && _self.dispatchEvent && overThreshold)
                _self.dispatchEvent("afterdrag", {
                    htmlNode: htmlNode,
                    htmlEvent: e
                });
        };
        
        if (reparent)
            document.onmousemove(e);

        return false;
    };
    
    function dragMove(e) {
        if (!e) e = event;
        
        //if (_self.dragSelection)
            //overThreshold = true;
        
        if (!overThreshold && _self.showdragging)
            apf.setStyleClass(_self.$ext, "dragging");
        
        // usability rule: start dragging ONLY when mouse pointer has moved delta x pixels
        var dx = e.clientX - oX,
            dy = e.clientY - oY,
            distance; 

        if (!overThreshold 
          && (distance = dx*dx > dy*dy ? dx : dy) * distance < 2)
            return;

        //Drag outline support
        else if (!overThreshold) {
            if (dragOutline 
              && oOutline.style.display != "block")
                oOutline.style.display = "block";

            if (_self.dispatchEvent && _self.dispatchEvent("beforedrag", {htmlEvent: e}) === false) {
                document.onmouseup();
                return;
            }
        }

        var oHtml = dragOutline
            ? oOutline
            : _self.$ext;

        oHtml.style.left = (l = e.clientX + nX) + "px";
        oHtml.style.top = (t = e.clientY + nY) + "px";

        if (_self.realtime) {
            var change = _self.$stick = {};
            _self.$showDrag(l, t, oHtml, e, change);
            
            if (typeof change.l != "undefined") 
                l = change.l, oHtml.style.left = l + "px";
            if (typeof change.t != "undefined") 
                t = change.t, oHtml.style.top = t + "px";
        }

        overThreshold = true;
    };
    
    this.$resizeStart = resizeStart;
    function resizeStart(e, options) {
        if (!e) e = event;

        //|| _self.editable 
        if (!_self.resizable 
          || String(_self.height).indexOf("%") > -1 && _self.parentNode.localName == "vbox" //can't resize percentage based for now
          || String(_self.width).indexOf("%") > -1 && _self.parentNode.localName == "hbox") //can't resize percentage based for now
            return;

        
        resizeOutline = false;        
        
        
        var ext = _self.$ext;
        if (!resizeOutline) {
            var diff = apf.getDiff(ext);
            hordiff = diff[0];
            verdiff = diff[1];
        }
        
        //@todo This is probably not gen purpose
        startPos = apf.getAbsolutePosition(ext);//, ext.offsetParent);
        startPos.push(ext.offsetWidth);
        startPos.push(ext.offsetHeight);
        myPos = apf.getAbsolutePosition(ext, ext.offsetParent, true);

        
        startGeo = [ext.style.left, ext.style.top, ext.style.right, 
                    ext.style.bottom, ext.style.width, ext.style.height];
        

        var sLeft = 0,
            sTop = 0,
            x = (oX = e.clientX) - startPos[0] + sLeft + document.documentElement.scrollLeft,
            y = (oY = e.clientY) - startPos[1] + sTop + document.documentElement.scrollTop,
            resizeType;

        if (options && options.resizeType) {
            posAbs = "absolute|fixed".indexOf(apf.getStyle(ext, "position")) > -1;
            resizeType = options.resizeType;
        }
        else {
            resizeType = getResizeType.call(ext, x, y);
        }
        rX = x;
        rY = y;

        if (!resizeType)
            return;

        if (_self.dispatchEvent && _self.dispatchEvent("beforeresize", {
            type: resizeType,
            setType: function(type) {
                resizeType = type;
            }
          }) === false) {
            return;
        }
        
        
        apf.popup.forceHide();
        

        //if (_self.hasFeature && _self.hasFeature(apf.__ANCHORING__))
            //_self.$disableAnchoring();
        
        apf.dragMode = true;
        overThreshold = false;

        we = resizeType.indexOf("w") > -1;
        no = resizeType.indexOf("n") > -1;
        ea = resizeType.indexOf("e") > -1;
        so = resizeType.indexOf("s") > -1;
        
        if (!_self.minwidth)  _self.minwidth = 0;
        if (!_self.minheight) _self.minheight = 0;
        if (!_self.maxwidth)  _self.maxwidth = 10000;
        if (!_self.maxheight) _self.maxheight = 10000;

        if (posAbs) {
            lMax = myPos[0] + startPos[2];
            tMax = myPos[1] + startPos[3];
            lMin = myPos[0] + startPos[2];
            tMin = myPos[1] + startPos[3];
        }

        
        if (posAbs) {
            apf.plane.setCursor(getCssCursor(resizeType) + "-resize");
        }
        
        
        var iMarginLeft;
        
        if (ext.style.right)
            ext.style.left = myPos[0] + "px";
        if (ext.style.bottom)
            ext.style.top = myPos[1] + "px";
        
        document.onmousemove = resizeMove;
        document.onmouseup = function(e, cancel) {
            document.onmousemove = document.onmouseup = null;
            
            
            if (posAbs)
                apf.plane.unsetCursor();
            
            
            clearTimeout(timer);
            
            if (resizeOutline) {
                var diff = apf.getDiff(_self.$ext);
                hordiff = diff[0];
                verdiff = diff[1];
            }

            
            if (cancel) {
                var ext = _self.$ext;
                ext.style.left = startGeo[0];
                ext.style.top = startGeo[1];
                ext.style.right = startGeo[2];
                ext.style.bottom = startGeo[3];
                ext.style.width = startGeo[4];
                ext.style.height = startGeo[5];
                
                if (_self.dispatchEvent)
                    _self.dispatchEvent("resizecancel");
            }
            else
            
                doResize(e || event, true);

            if (_self.setProperty)
                updateProperties();
                
            document.body.style.cursor = lastCursor || "";
            lastCursor = null;
            
            if (resizeOutline)
                oOutline.style.display = "none";
            
            apf.dragMode = false;

            if (!cancel && _self.dispatchEvent)
                _self.dispatchEvent("afterresize", {
                    l: l, t: t, w: w+hordiff, h: h+verdiff
                });
            
            l = t = w = h = null;
        };
        
        return false;
    }
    
    function updateProperties(left, top, width, height, hdiff, vdiff, right, bottom) {
        if (typeof left == "undefined") {
            left = l, top = t, width = w, height = h, 
                vdiff = verdiff, hdiff = hordiff;
        }
        else posAbs = true;

        var hasLeft = _self.left || _self.left === 0;
        var hasRight = _self.right || _self.right === 0;
        var hasBottom = _self.bottom || _self.bottom === 0;
        var hasTop = _self.top || _self.top === 0;

        if (posAbs) {
            var htmlNode = (oOutline && oOutline.style.display == "block")
                ? oOutline
                : _self.$ext;

            if (hasRight && !(right || right === 0))
                right = apf.getHtmlRight(htmlNode);

            if (hasBottom && !(bottom || bottom === 0))
                bottom = apf.getHtmlBottom(htmlNode);

            if (hasRight) {
                _self.setProperty("right", right, 0, _self.editable);
                if (!_self.left)
                    htmlNode.style.left = "";
            }
            
            if (hasBottom) {
                _self.setProperty("bottom", bottom, 0, _self.editable);
                if (!_self.top)
                    htmlNode.style.top = "";
            }

            if ((left || left === 0) && (!hasRight || hasLeft)) 
                _self.setProperty("left", left, 0, _self.editable);
            if ((top || top === 0) && (!hasBottom || hasTop)) 
                _self.setProperty("top", top, 0, _self.editable);
        }

        if (hdiff != undefined && width && (!hasLeft || !hasRight)) 
            _self.setProperty("width", width + hdiff, 0, _self.editable) 
        if (vdiff != undefined && height && (!hasTop || !hasBottom)) 
            _self.setProperty("height", height + vdiff, 0, _self.editable); 
    }
    this.$updateProperties = updateProperties;
    
    var min = Math.min, max = Math.max, lastTime, timer;
    function resizeMove(e) {
        if (!e) e = event;
        
        //if (!e.button)
            //return this.onmouseup();
        
        // usability rule: start dragging ONLY when mouse pointer has moved delta x pixels
        /*var dx = e.clientX - oX,
            dy = e.clientY - oY,
            distance; 
        
        if (!overThreshold 
          && (distance = dx*dx > dy*dy ? dx : dy) * distance < 4)
            return;*/
        
        clearTimeout(timer);
        if (lastTime && new Date().getTime() 
          - lastTime < (resizeOutline ? 6 : apf.mouseEventBuffer)) {
            var z = {
                clientX: e.clientX,
                clientY: e.clientY
            }
            timer = $setTimeout(function(){
                doResize(z);
            }, 10);
            return;
        }
        lastTime = new Date().getTime();
        
        doResize(e);
        
        if (_self.dispatchEvent)
            _self.dispatchEvent("resize");
        
        //overThreshold = true;
    }
    
    function doResize(e, force) {
        var oHtml = resizeOutline && !force
            ? oOutline
            : _self.$ext;

        var sLeft = document.documentElement.scrollLeft,
            sTop = document.documentElement.scrollTop;
        
        if (we) {
            if (posAbs)
                oHtml.style.left = (l = max((lMin - _self.maxwidth), 
                    min((lMax - _self.minwidth), 
                    myPos[0] + e.clientX - oX + sLeft))) + "px";
            oHtml.style.width = (w = min(_self.maxwidth - hordiff, 
                max(hordiff, _self.minwidth, 
                    startPos[2] - (e.clientX - oX) + sLeft
                    ) - hordiff)) + "px"; //@todo
        }
        
        if (no) {
            if (posAbs)
                oHtml.style.top = (t = max((tMin - _self.maxheight), 
                    min((tMax - _self.minheight), 
                    myPos[1] + e.clientY - oY + sTop))) + "px";
            oHtml.style.height = (h = min(_self.maxheight - verdiff, 
                max(verdiff, _self.minheight, 
                    startPos[3] - (e.clientY - oY) + sTop
                    ) - verdiff)) + "px"; //@todo
        }

        if (ea)
            oHtml.style.width = (w = min(_self.maxwidth - hordiff, 
                max(hordiff, _self.minwidth, 
                    e.clientX - startPos[0] + (startPos[2] - rX) + sLeft)
                    - hordiff)) + "px";

        if (so)
            oHtml.style.height = (h = min(_self.maxheight - verdiff, 
                max(verdiff, _self.minheight, 
                    e.clientY - startPos[1] + (startPos[3] - rY) + sTop)
                    - verdiff)) + "px";

        //@todo apf3.0 this is execution wise inefficient
        if (_self.parentNode && _self.parentNode.localName == "table") {
            updateProperties();
            apf.layout.processQueue();
        }
        
        if (_self.realtime) {
            var change = _self.$stick = {};
            
            //@todo calc l and t once at start of resize (subtract borders)
            _self.$showResize(l || apf.getHtmlLeft(oHtml), t || apf.getHtmlTop(oHtml), 
                w && w + hordiff || oHtml.offsetWidth, 
                h && h + verdiff || oHtml.offsetHeight, e, change, we, no, ea, so);

            if (posAbs && we && typeof change.l != "undefined")
                oHtml.style.left = (l = max((lMin - _self.maxwidth), min((lMax - _self.minwidth), change.l))) + "px";
            
            if (posAbs && no && typeof change.t != "undefined")
                oHtml.style.top = (t = max((tMin - _self.maxheight), min((tMax - _self.minheight), change.t))) + "px";
            
            if (typeof change.w != "undefined") 
                oHtml.style.width = (w = min(_self.maxwidth - hordiff, 
                    max(hordiff, _self.minwidth, 
                        change.w) - hordiff)) + "px";
            if (typeof change.h != "undefined") 
                oHtml.style.height = (h = min(_self.maxheight - verdiff, 
                    max(verdiff, _self.minheight, 
                        change.h) - verdiff)) + "px";
        }

        
        if (apf.hasSingleRszEvent)
            apf.layout.forceResize(_self.$int);
        
    }
    
    function getResizeType(x, y) {
        var cursor = "", 
            tcursor = "";
        posAbs = "absolute|fixed".indexOf(apf.getStyle(_self.$ext, "position")) > -1;
        if (_self.resizable == "true" || _self.resizable == "vertical" || _self.resizable.indexOf('top') > -1 || _self.resizable.indexOf('bottom') > -1) {
            if (y < rszborder + marginBox[0] && _self.resizable.indexOf('bottom') == -1)
                cursor = posAbs ? "n" : "";
            else if (y > this.offsetHeight - (rszcorner || rszborder) && _self.resizable.indexOf('top') == -1) //marginBox[0] - marginBox[2] - 
                cursor = "s";
        }
        
        if (_self.resizable == "true" || _self.resizable == "horizontal" || _self.resizable.indexOf('left') > -1 || _self.resizable.indexOf('right') > -1) {
            if (x < (cursor ? rszcorner : rszborder) + marginBox[0] && _self.resizable.indexOf('right') == -1)
                cursor += tcursor + (posAbs ? "w" : "");
            else if (x > this.offsetWidth - (cursor || tcursor ? rszcorner : rszborder) && _self.resizable.indexOf('left') == -1) //marginBox[1] - marginBox[3] - 
                cursor += tcursor + "e";
        }

        return cursor;
    }
    
    var originalCursor;
    function resizeIndicate(e) {
        if (!e) e = event;
        
        if (!_self.resizable || _self.editable || document.onmousemove)
            return;

        //@todo This is probably not gen purpose
        var pos = apf.getAbsolutePosition(_self.$ext),//, _self.$ext.offsetParent
            sLeft = 0,
            sTop = 0,
            x = e.clientX - pos[0] + sLeft + document.documentElement.scrollLeft,
            y = e.clientY - pos[1] + sTop + document.documentElement.scrollTop;
        
        if (!originalCursor)
            originalCursor = apf.getStyle(this, "cursor");

        var cursor = getResizeType.call(_self.$ext, x, y);
        
        this.style.cursor = cursor 
            ? getCssCursor(cursor) + "-resize" 
            : originalCursor || "default";
    };
    
    function getCssCursor(cursor) {
        var cssCursor = cursor;
        if (apf.isWebkit) {
            if (cursor == "se" || cursor == "nw")
                cssCursor = "nwse";
            else if (cursor == "sw" || cursor == "ne")
                cssCursor = "nesw";
            else if (cursor == "s" || cursor == "n")
                cssCursor = "ns";
            else if (cursor == "e" || cursor == "w")
                cssCursor = "ew";
        }
        
        return cssCursor;
    }

    var oOutline;
    
    
    /*this.addEventListener("DOMNodeRemovedFromDocument", function(e) {
        oOutline.refCount--;
        
        if (!oOutline.refCount) {
            //destroy
        }
    });*/
};

apf.GuiElement.propHandlers["resizable"] = function(value) {
    this.implement(apf.Interactive);
    this.$propHandlers["resizable"].apply(this, arguments);
}

apf.GuiElement.propHandlers["draggable"] = function(value) {
    this.implement(apf.Interactive);
    this.$propHandlers["draggable"].apply(this, arguments);
};





/**
 * Object representing the window of the AML application. The semantic is
 * similar to that of a window in the browser, except that this window is not
 * the same as the JavaScript global object. It handles the focussing within
 * the document and several other events such as exit and the keyboard events.
 *
 * @class apf.window
 * @inherits apf.Class
 * @default_private
 *
 * @author      Ruben Daniels (ruben AT ajax DOT org)
 * @version     %I%, %G%
 * @since       0.8
 */
/**
 * @event blur              Fires when the browser window loses focus.
 */
/**
 * @event focus             Fires when the browser window receives focus.
 *
 *
 */
apf.window = function(){
    this.$uniqueId = apf.all.push(this);
    this.apf = apf;

    /**
     * Returns a string representation of this object.
     */
    this.toString = function(){
        return "[apf.window]";
    };
    
    /**
     * Show the browser window.
     */
    this.show = function(){
        if (apf.isDeskrun)
            jdwin.Show();
    };

    /**
     * Hide the browser window.
     */
    this.hide = function(){
        if (apf.isDeskrun) {
            jdwin.Hide();
        }
        else {
            if (this.win)
                this.win.close();
        }
    };

    /**
     * Focus the browser window.
     */
    this.focus = function(){
        if (apf.isDeskrun)
            jdwin.SetFocus();
        else
            window.focus();
    };

    /**
     * Set the icon of the browser window.
     * @param {String} url The location of the _.ico_ file.
     */
    this.setIcon = function(url) {
        if (apf.isDeskrun)
            jdwin.icon = parseInt(url) == url ? parseInt(url) : url;
    };

    /**
     * Set the title of the browser window.
     * @param {String} value The new title of the window.
     */
    this.setTitle = function(value) {
        this.title = value || "";

        if (apf.isDeskrun)
            jdwin.caption = value;
        else
            document.title = (value || "");
    };

    /*
     * @private
     */
    this.loadAml = function(x) {
        if (x.localName == "deskrun")
            this.loadDeskRun(x);
        /*else {

        }*/
    };

    

    // *** Focus Internals *** //

    
    this.vManager = new apf.visibilitymanager();
    

    
    this.zManager = new apf.zmanager();
    

    

    this.$tabList = [];

    this.$addFocus = function(amlNode, tabindex, isAdmin) {
        if (!isAdmin) {
            amlNode.addEventListener("DOMNodeInserted", moveFocus);
            amlNode.addEventListener("DOMNodeRemoved", removeFocus);

            if (amlNode.$isWindowContainer > -2) {
                amlNode.addEventListener("focus", trackChildFocus);
                amlNode.addEventListener("blur", trackChildFocus);

                amlNode.$focusParent = amlNode;

                if (amlNode.$isWindowContainer > -1) {
                    if (!amlNode.$tabList)
                        amlNode.$tabList = [amlNode];
                    
                    this.$tabList.push(amlNode);
                    return;
                }
                else {
                    amlNode.$tabList = [amlNode];
                }
            }
        }

        var fParent = findFocusParent(amlNode),
            list = fParent.$tabList;

        

        if (!amlNode.$isWindowContainer)
            amlNode.$focusParent = fParent;
        else
            amlNode.$focusParent2 = fParent;

        if (list[tabindex])
            list.insertIndex(amlNode, tabindex);
        else if (tabindex || parseInt(tabindex) === 0)
            list[tabindex] = amlNode;
        else
            list.push(amlNode);
    };

    this.$removeFocus = function(amlNode) {
        if (!amlNode.$focusParent)
            return;

        amlNode.$focusParent.$tabList.remove(amlNode);

        if (!amlNode.$isWindowContainer) {
            amlNode.removeEventListener("DOMNodeInserted", moveFocus);
            amlNode.removeEventListener("DOMNodeRemoved", removeFocus);
        }

        if (amlNode.$isWindowContainer > -2) {
            amlNode.removeEventListener("focus", trackChildFocus); 
            amlNode.removeEventListener("blur", trackChildFocus);
        }
    };

    var focusLoopDetect;
    this.$focus = function(amlNode, e, force) {
        var aEl = this.activeElement;
        if (aEl == amlNode && !force)
            return; //or maybe when force do $focus

        

        this.$settingFocus = amlNode;

        if (!e)
            e = {};

        e.toElement = amlNode;
        e.fromElement = aEl;

        if (aEl && aEl != amlNode && focusLoopDetect != aEl) {
            focusLoopDetect = aEl;

            aEl.blur(true, e);

            
            
            if (focusLoopDetect != aEl)
                return false;
        }

        if (amlNode.$focussable != apf.MENU || !apf.activeElement) {
            apf.activeElement = 
            this.document.activeElement = 
            this.document.documentElement.$lastFocussed = amlNode;
        }

        (apf.window.activeElement = amlNode).focus(true, e);

        this.$settingFocus = null;
        

        apf.dispatchEvent("movefocus", e);
    };

    this.$blur = function(amlNode) {
        var aEl = this.activeElement;
        if (aEl != amlNode)
            return false;

        

        aEl.$focusParent.$lastFocussed = null;
        
        if (aEl.$focussable != apf.MENU) {
            apf.activeElement = 
            this.document.activeElement = null;
        }

        apf.window.activeElement = null;
        
        apf.dispatchEvent("movefocus", {
            fromElement: amlNode
        });

        
    };
    
    var lastFocusParent;

    this.$focusDefault = function(amlNode, e) {
        var fParent = findFocusParent(amlNode);
        this.$focusLast(fParent, e);
    };

    this.$focusRoot = function(e) {
        var docEl = apf.document.documentElement;
        if (this.$focusLast(docEl, e) === false) {
            //docEl.$lastFocussed = null;
            //this.moveNext(null, apf.document.documentElement, true, e);
        }
    };

    this.$focusLast = function(amlNode, e, ignoreVisible) {
        var lf = amlNode.$lastFocussed;

        if (lf && lf.parentNode && lf.$focussable === true
          && (ignoreVisible || lf.$ext.offsetHeight)) {
            this.$focus(lf, e, true);
        }
        else { //Let's find the object to focus first
            var next, node = amlNode, skip;
            while (node) {
                if (!skip && node.focussable !== false && node.$focussable === true && !node.$tabList
                  && (ignoreVisible || node.$ext && node.$ext.offsetHeight) && node.disabled < 1) {
                    this.$focus(node, e, true);
                    break;
                }
                
                //Walk sub tree
                if ((next = !skip && node.firstChild || !(skip = false) && node.nextSibling)) {
                    node = next;
                    if (node.$isWindowContainer > 0)
                        skip = true;
                }
                else if (node == amlNode) {
                    if (node.$isWindowContainer)
                        this.$focus(node, e, true);
                    return;
                }
                else {
                    do {
                        node = node.parentNode;
                    } while (node && !node.nextSibling && node != amlNode 
                      && !node.$isWindowContainer)
                    
                    if (node == amlNode) {
                        if (node.$isWindowContainer)
                            this.$focus(node, e, true);
                        return; //do nothing
                    }
                    
                    if (node) {
                        if (node.$isWindowContainer) {
                            this.$focus(node, e, true);
                            break;
                        }
                        
                        node = node.nextSibling;
                    }
                }
            }

            if (!node)
                this.$focus(apf.document.documentElement);
        }
    };

    function trackChildFocus(e) {
        if (e.name == "blur") {
            if (e.srcElement != this && this.$blur)
                this.$blur();
            return;
        }
        
        if (e.srcElement != this && this.$focus && (!e || !e.mouse || this.$focussable == apf.KEYBOARD_MOUSE))
            this.$focus();
        
        if (e.srcElement == this || e.trackedChild) {
            e.trackedChild = true;
            return;
        }

        this.$lastFocussed = e.srcElement;

        if (this.localName && this.localName.indexOf("window") > -1)
            e.trackedChild = true;
    }

    function findFocusParent(amlNode) {
        var node = amlNode;
        do {
            node = node.parentNode;
        } while (node && !node.$isWindowContainer);

        return node || apf.document.documentElement;
    }

    //Dom handler
    //@todo make this look at the dom tree insertion point to determine tabindex
    function moveFocus(e) {
        if (e && e.currentTarget != this)
            return;
        
        if (this.$isWindowContainer)
            apf.window.$tabList.pushUnique(this);
        else
            apf.window.$addFocus(this, this.tabindex, true)
    }

    //Dom handler
    function removeFocus(e) {
        if (e && (e.currentTarget != this || e.$doOnlyAdmin))
            return;

        //@todo apf3.0 this should be fixed by adding domremovenode events to all children
        var list = this.$focusParent.$tabList;
        var nodes = this.childNodes;
        if (nodes) {
            for (var i = 0, l = nodes.length; i < l; i++) {
                list.remove(nodes[i]); //@todo assuming no windows here
            }
        }

        if (apf.window.activeElement == this)
            apf.window.moveNext();
        
        if (this.$isWindowContainer) {
            apf.window.$tabList.remove(this); //@todo this can't be right
            return;
        }

        if (!this.$focusParent)
            return;

        list.remove(this);
        //this.$focusParent = null; //@experimental to not execute this
    }

    // *** Focus API *** //

    /**
     * Determines whether a given AML element has the focus.
     * @param {apf.AmlElement} The element to check
     * @returns {Boolean} Indicates whether the element has focus.
     */
    this.hasFocus = function(amlNode) {
        return this.activeElement == amlNode;
    };

    /*
     * @private
     */
    this.moveNext = function(shiftKey, relObject, switchWindows, e) {
        if (switchWindows && apf.window.activeElement) {
            var p = apf.window.activeElement.$focusParent;
            if (p.visible && p.modal)
                return false;
        }

        var dir, start, next,
            amlNode = relObject || apf.window.activeElement,
            fParent = amlNode
                ? (switchWindows && amlNode.$isWindowContainer 
                  && amlNode.$isWindowContainer != -1
                    ? apf.window
                    : e && e.innerList ? amlNode.$focusParent : amlNode.$focusParent2 || amlNode.$focusParent)
                : apf.document.documentElement,
            list = fParent.$tabList;

        if (amlNode && (switchWindows || amlNode != apf.document.documentElement)) {
            start = (list || []).indexOf(amlNode);
            if (start == -1) {
                

                return;
            }
        }
        else {
            start = -1;
        }

        if (this.activeElement == amlNode
          && list.length == 1 || list.length == 0)
            return false;

        dir = (shiftKey ? -1 : 1);
        next = start;
        if (start < 0)
            start = 0;
        do {
            next += dir;

            if (next >= list.length)
                next = 0;
            else if (next < 0)
                next = list.length - 1;

            if (start == next && amlNode) {
                if (list[0].$isWindowContainer)
                    this.$focus(list[0], e);
                
                return false; //No visible enabled element was found
            }

            amlNode = list[next];
        }
        while (amlNode && (
               amlNode.disabled > 0
            || amlNode == apf.window.activeElement
            || (switchWindows ? !amlNode.visible : amlNode.$ext && !amlNode.$ext.offsetHeight)
            || amlNode.focussable === false
            || switchWindows && !amlNode.$tabList.length
        ));
        
        if (!amlNode)
            return;

        if (fParent == apf.window && amlNode.$isWindowContainer != -2) {
            this.$focusLast(amlNode, {mouse:true}, switchWindows);
        }
        else {
            (e || (e = {})).shiftKey = shiftKey;
            this.$focus(amlNode, e);
        }

        
    };

    /*
     * @private
     */
    this.focusDefault = function(){
        

        if (this.moveNext() === false)
            this.moveNext(null, apf.document.documentElement, true)
    };

    

    // *** Set Window Events *** //

    apf.addListener(window, "beforeunload", function(){
        return apf.dispatchEvent("exit");
    });

    //@todo apf3.x why is this loaded twice
    apf.addListener(window, "unload", function(){
        if (!apf)
            return;
        
        apf.window.isExiting = true;
    });

    

    // *** Keyboard and Focus Handling *** //

    apf.addListener(document, "contextmenu", function(e) {
        if (!e)
            e = event;

        
        var pos, ev,
            amlNode = apf.findHost(e.srcElement || e.target)
              || apf.window.activeElement
              || apf.document && apf.document.documentElement;

        if (amlNode && amlNode.localName == "menu") //The menu is already visible
            return false;


        //if (amlNode && amlNode.localName == "menu")
            //amlNode = amlNode.parentNode;

        if (apf.contextMenuKeyboard) {
            if (amlNode) {
                pos = amlNode.selected
                    ? apf.getAbsolutePosition(amlNode.$selected)
                    : apf.getAbsolutePosition(amlNode.$ext || amlNode.$pHtmlNode);
            }
            else {
                pos = [0, 0];
            }

            ev = {
                x: pos[0] + 10 + document.documentElement.scrollLeft,
                y: pos[1] + 10 + document.documentElement.scrollTop,
                amlNode: amlNode,
                htmlEvent: e
            }
        }
        else {
            if (e.htmlEvent) {
                ev = e;
            }
            else {
                ev = { //@todo probably have to deduct the border of the window
                    x: e.clientX + document.documentElement.scrollLeft,
                    y: e.clientY + document.documentElement.scrollTop,
                    htmlEvent: e
                }
            }
        }

        ev.bubbles = true; //@todo discuss this, are we ok with bubbling?

        apf.contextMenuKeyboard = null;

        if ((amlNode || apf).dispatchEvent("contextmenu", ev) === false
          || ev.returnValue === false) {
            if (e.preventDefault)
                e.preventDefault();
            return false;
        }
        

        if (apf.config.disableRightClick) {
            if (e.preventDefault)
                e.preventDefault();
            return false;
        }
    });
    
    apf.addListener(document, "mouseup", function(e) {
        if (!e) e = event;
        
        apf.dispatchEvent("mouseup", {
            htmlEvent: e
        });
    });

    var ta = {"INPUT":1, "TEXTAREA":1, "SELECT":1, "EMBED":1, "OBJECT":1, "PRE": 1};
    apf.addListener(document, "mousedown", this.$mousedown = function(e) {

        if (!e) e = event;
        var p,
            amlNode = apf.findHost(e.srcElement || e.target);
            /*cEditable = amlNode && amlNode.liveedit
              
            ;*/
        
        apf.popup.$mousedownHandler(amlNode, e);
        
        if (amlNode === false) 
            amlNode = apf.window.activeElement;
        
        var eventTarget = amlNode;
        
        while (amlNode && !amlNode.focussable) 
            amlNode = amlNode.parentNode;
        
        //Make sure the user cannot leave a modal window
        if ((!amlNode || ((!amlNode.$focussable || amlNode.focussable === false)
          && amlNode.canHaveChildren != 2 && !amlNode.$focusParent))
          && apf.config.allowBlur) {
            lastFocusParent = null;
            if (apf.window.activeElement)
                apf.window.activeElement.blur();
        }
        else if (amlNode) { //@todo check this for documentElement apf3.0
            if ((p = apf.window.activeElement
              && apf.window.activeElement.$focusParent || lastFocusParent)
              && p.visible && p.modal && amlNode.$focusParent != p
              && amlNode.$isWindowContainer != -1) {
                apf.window.$focusLast(p, {mouse: true, ctrlKey: e.ctrlKey});
            }
            else if (!amlNode && apf.window.activeElement) {
                apf.window.$focusRoot();
            }
            else if (amlNode.$isWindowContainer == -1) {
                if (amlNode.$tabList.length)
                    apf.window.moveNext(null, amlNode.$tabList[0], null, {mouse: true, innerList: true});
                else
                    apf.window.$focus(amlNode);
            }
            else if ((amlNode.disabled == undefined || amlNode.disabled < 1) 
              && amlNode.focussable !== false) {
                if (amlNode.$focussable) { // === apf.KEYBOARD_MOUSE
                    apf.window.$focus(amlNode, {mouse: true, ctrlKey: e.ctrlKey});
                }
                else if (amlNode.canHaveChildren == 2) {
                    if (!apf.config.allowBlur || !apf.window.activeElement 
                      || apf.window.activeElement.$focusParent != amlNode)
                        apf.window.$focusLast(amlNode, {mouse: true, ctrlKey: e.ctrlKey});
                }
            }
    
            
        }
        
        amlNode = eventTarget;
        
        
        apf.dispatchEvent("mousedown", {
            htmlEvent: e,
            amlNode: amlNode || apf.document.documentElement
        });

        var canSelect = !((!apf.document
          && (!apf.isParsingPartial || amlNode)
          || apf.dragMode) && !ta[e.target && e.target.tagName]);

        if (canSelect && amlNode) {
            if (!e.target && e.srcElement)
                e.target = {};
            var isTextInput = (ta[e.target.tagName]
                || e.target.contentEditable == "true") && !e.target.disabled  //@todo apf3.0 need to loop here?
                || amlNode.$isTextInput
                && amlNode.$isTextInput(e) && amlNode.disabled < 1;

            if (!apf.config.allowSelect && !isTextInput
              && amlNode.nodeType != amlNode.NODE_PROCESSING_INSTRUCTION 
              && !amlNode.textselect)
                canSelect = false;
        }
        
        if (amlNode && (amlNode.name === "editor::ace" || amlNode.class == "c9terminalcontainer")) {
            canSelect = true;
        }
        
        if (!canSelect && e.button != 2) { // && !cEditable
            if (e.preventDefault)
                e.preventDefault();
           
            try{  
                if (document.activeElement && document.activeElement.contentEditable == "true") //@todo apf3.0 need to loop here?
                    document.activeElement.blur();
            }catch(e) {}
        }
    });

    //IE selection handling
    apf.addListener(document, "selectstart", function(e) {
        if (!apf.isIE)
            return;
        
        if (!e) e = event;

        var amlNode = apf.findHost(e.srcElement);
        var canSelect = !(!apf.document
          && (!apf.isParsingPartial || amlNode)
          || apf.dragMode);
        
        if (canSelect) {
            //(!amlNode.canHaveChildren || !apf.isChildOf(amlNode.$int, e.srcElement))
            if (!apf.config.allowSelect 
              && (amlNode && amlNode.nodeType != amlNode.NODE_PROCESSING_INSTRUCTION 
              && !amlNode.textselect))
                canSelect = false;
        }

        if (!canSelect) {
            e.returnValue = false;
            return false;
        }
    });

    // Keyboard forwarding to focussed object
    apf.addListener(document, "keyup", this.$keyup = function(e) {
        if (!e) e = event;

        
        var ev = {
            keyCode: e.keyCode,
            ctrlKey: e.ctrlKey,
            shiftKey: e.shiftKey,
            metaKey: e.metaKey,
            altKey: e.altkey,
            htmlEvent: e,
            bubbles: true //@todo is this much slower?
        };
        
        var aEl = apf.document && apf.window.activeElement;
        if ((aEl && !aEl.disableKeyboard
          ? aEl.dispatchEvent("keyup", ev)
          : apf.dispatchEvent("keyup", ev)) === false) {
            apf.preventDefault(e);
            return false;
        }
        
    });

    
    var wheel = this.$mousewheel = function wheel(e) {
        if (!e)
            e = event;

        var delta = null;
        if (e.wheelDelta) {
            delta = e.wheelDelta / 120;
            if (apf.isOpera)
                delta *= -1;
        }
        else if (e.detail) {
            delta = -e.detail / 3;
        }

        if (delta !== null) {
            
            var ev = {
                delta: delta, 
                target: e.target || e.srcElement, 
                button: e.button, 
                ctrlKey: e.ctrlKey, 
                shiftKey: e.shiftKey, 
                metaKey: e.metaKey,
                altKey: e.altKey,
                bubbles: true,
                htmlEvent: e
            };
            
            var amlNode = apf.findHost(e.srcElement || e.target);
            var res = (amlNode || apf).dispatchEvent("mousescroll", ev);
            if (res === false || ev.returnValue === false) {
                if (e.preventDefault)
                    e.preventDefault();

                e.returnValue = false;
            }
        }
    }

    if (document.addEventListener)
        document.addEventListener('DOMMouseScroll', wheel, false);

    window.onmousewheel = 
    document.onmousewheel = wheel; //@todo 2 keer events??
    

    //var browserNavKeys = {32:1,33:1,34:1,35:1,36:1,37:1,38:1,39:1,40:1}
    var keyPressed = false;
    apf.addListener(window, "blur", function(e) {
        keyPressed = false;

    })
    apf.addListener(document, "keyup", function(e) {
        e = e || event;

        if (!keyPressed)
            return;
        keyPressed = false;

        if (e.ctrlKey && e.keyCode == 9 && apf.window.activeElement) {
            var w = apf.window.activeElement.$focusParent;
            if (w.modal) {
                if (e.preventDefault)
                    e.preventDefault();
                return false;
            }
            
            // todo is there better way to prevent blur on ctrl-tab?
            if (apf.activeElement && apf.activeElement.editor)
                return;

            apf.window.moveNext(e.shiftKey,
                apf.window.activeElement.$focusParent, true);

            w = apf.window.activeElement.$focusParent;
            if (w && w.bringToFront)
                w.bringToFront();
            
            if (e.preventDefault)
                e.preventDefault();
            return false;    
        }
    });
    
    //@todo optimize this function
    apf.addListener(document, "keydown", this.$keydown = function(e) {
        e = e || event;

        keyPressed = true;
        
        if (e.keyCode == 93)
            apf.contextMenuKeyboard = true;
        

        var amlNode = apf.window.activeElement, //apf.findHost(e.srcElement || e.target),
            htmlNode = (e.explicitOriginalTarget || e.srcElement || e.target),
            isTextInput = (ta[htmlNode.tagName]
              || htmlNode.contentEditable == "true" || htmlNode.contentEditable == "plaintext-only")
              && !htmlNode.disabled
              || amlNode && amlNode.$isTextInput
              && amlNode.$isTextInput(e) && amlNode.disabled < 1;

        

        var eInfo = {
            ctrlKey: e.ctrlKey,
            metaKey: e.metaKey,
            shiftKey: e.shiftKey,
            altKey: e.altKey,
            keyCode: e.keyCode,
            htmlEvent: e,
            isTextInput: isTextInput,
            bubbles: true
        };
        
        delete eInfo.currentTarget;
        
        //Keyboard forwarding to focussed object
        var aEl = amlNode; //isTextInput ? amlNode :
        if ((aEl && !aEl.disableKeyboard && !aEl.editable
          ? aEl.dispatchEvent("keydown", eInfo) 
          : apf.dispatchEvent("keydown", eInfo)) === false) {
            apf.stopEvent(e);
            return false;
        }
        
        //Focus handling
        else if ((!apf.config.disableTabbing || apf.window.activeElement) && e.keyCode == 9) {
            //Window focus handling
            if (e.ctrlKey && apf.window.activeElement) {
                var w = apf.window.activeElement.$focusParent;
                if (w.modal) {
                    if (e.preventDefault)
                        e.preventDefault();
                    return false;
                }

                apf.window.moveNext(e.shiftKey,
                    apf.window.activeElement.$focusParent, true);

                w = apf.window.activeElement.$focusParent;
                if (w && w.bringToFront)
                    w.bringToFront();
            }
            //Element focus handling
            else if (!apf.window.activeElement || apf.window.activeElement.tagName != "menu") {
                apf.window.moveNext(e.shiftKey);
            }

            if (e.preventDefault)
                e.preventDefault();
            return false;
        }
        

        //Disable backspace behaviour triggering the backbutton behaviour
        var altKey = apf.isMac ? e.metaKey : e.altKey;
        if (apf.config.disableBackspace
          && e.keyCode == 8// || (altKey && (e.keyCode == 37 || e.keyCode == 39)))
          && !isTextInput) {
            e.returnValue = false;
        }

        //Disable space behaviour of scrolling down the page
        /*if(Application.disableSpace && e.keyCode == 32 && e.srcElement.tagName.toLowerCase() != "input"){
            e.keyCode = 0;
            e.returnValue = false;
        }*/

        //Disable F5 refresh behaviour
        if (apf.config.disableF5 && (e.keyCode == 116 || e.keyCode == 117)) {
            e.preventDefault();
            e.stopPropagation();
            //return false;
        }
        
        
        /*if (browserNavKeys[e.keyCode] && apf.window.activeElement 
          && apf.config.autoDisableNavKeys)
            e.returnValue = false;*/

        if (e.keyCode == 27)
            e.returnValue = false;

        if (!apf.config.allowSelect
          && e.shiftKey && (e.keyCode > 32 && e.keyCode < 41)
          && !isTextInput) {
            e.returnValue = false;
        }

        //apf.dispatchEvent("keydown", null, eInfo);

        if (e.returnValue === false && e.preventDefault)
            e.preventDefault();

        return e.returnValue;
        
    });
    
    apf.document = {};
    this.init = function(strAml) {
        apf.document = this.document = new apf.AmlDocument();
        this.document.documentElement = new apf.application();
        this.document.documentElement.ownerDocument = this.document;
        this.document.appendChild(this.document.documentElement);
    };
    
    

    /*
     * @private
     */
    this.destroy = function(){
        
    };
};
apf.window.prototype = new apf.Class().$init();
apf.window = new apf.window();








/**
 * Compatibility layer for Gecko based browsers.
 * @private
 */
apf.runGecko = function(){
    apf.getHtmlLeft = function(oHtml) {
        return (oHtml.offsetLeft
            + (parseInt(apf.getStyle(oHtml.parentNode, "borderLeftWidth")) || 0));
    };

    apf.getHtmlRight = function(oHtml) {
        var p;
        return (((p = oHtml.offsetParent).tagName == "BODY" 
          ? apf.getWindowWidth()
          : p.offsetWidth)
            - oHtml.offsetLeft - oHtml.offsetWidth
            - (2 * (parseInt(apf.getStyle(p, "borderLeftWidth")) || 0))
            - (parseInt(apf.getStyle(p, "borderRightWidth")) || 0));
    };

    apf.getHtmlTop = function(oHtml) {
        return (oHtml.offsetTop
            + (parseInt(apf.getStyle(oHtml.parentNode, "borderTopWidth")) || 0));
    };
    
    apf.getHtmlBottom = function(oHtml) {
        var p;
        return (((p = oHtml.offsetParent).tagName == "BODY" 
          ? apf.getWindowHeight()
          : p.offsetHeight)
            - oHtml.offsetTop - oHtml.offsetHeight
            - (2 * (parseInt(apf.getStyle(p, "borderTopWidth")) || 0))
            - (parseInt(apf.getStyle(p, "borderBottomWidth")) || 0));
    };
};





apf.insertHtmlNodes = function(nodeList, htmlNode, beforeNode, s) {
    var frag, l, node, i;
    if (nodeList) {
        frag = document.createDocumentFragment();
        for (i = nodeList.length - 1; i >= 0; i--) {
            node = nodeList[i];
            frag.insertBefore(node, frag.firstChild);
        }
    }
    
    if (beforeNode)
        htmlNode.insertBefore(frag, beforeNode);
    else
        htmlNode.appendChild(frag);
};

apf.insertHtmlNode = function(xmlNode, htmlNode, beforeNode, s) {
    xmlNode = xmlNode.cloneNode(true);
    if (beforeNode)
        htmlNode.insertBefore(xmlNode, beforeNode);
    else
        htmlNode.appendChild(xmlNode);

    return xmlNode;
};



/**
 * Compatibility layer for Internet Explorer browsers.
 * @private
 */
apf.runIE = function() { apf.runWebkit() };


    
//XMLDocument.selectNodes
HTMLDocument.prototype.selectNodes = XMLDocument.prototype.selectNodes = function(sExpr, contextNode) {
    return findNodes(contextNode, sExpr);
};

//Element.selectNodes
Text.prototype.selectNodes =
Attr.prototype.selectNodes =
Element.prototype.selectNodes = function(sExpr) {
   return findNodes(this, sExpr);
};

//XMLDocument.selectSingleNode
HTMLDocument.prototype.selectSingleNode = 
XMLDocument.prototype.selectSingleNode = function(sExpr, contextNode) {
    return findNode(contextNode, sExpr);
};

//Element.selectSingleNode
Text.prototype.selectSingleNode =
Attr.prototype.selectSingleNode =
Element.prototype.selectSingleNode = function(sExpr) {
    return findNode(this, sExpr);
};


function findNode(htmlNode, textNode, parts, maxRecur) {
    if (!parts)
        parts = textNode.split("/")
    textNode = parts.shift()
        
    if (textNode == ".") {
        return htmlNode
    }
    if (textNode == "text()") {
        var ch = htmlNode.childNodes;
        for (var i = 0; i < ch.length; i++) {
            if (ch[i].nodeType == 3 || ch[i].nodeType == 4)
                return ch[i];
        }
        throw new Error("can't find node " + textNode);
    } else if (textNode[0] == "@") {
        var name = textNode.substr(1);
        if (htmlNode.getAttributeNode)
            return htmlNode.getAttributeNode(name);
        
        var value = htmlNode.getAttribute(name);
        return {
            name: name,
            value: value,
            nodeValue: value,
            nodeType:2
        };
    } else {
        var index = 0;
        textNode = textNode.replace(/\[\d+\]/, function(x){
            index = parseInt(x.slice(1, -1)) - 1;
            return "";
        });
        // allows to emulate xpath features like vbox|hbox
        var re = new RegExp("^(" + textNode + ")$", "i");
        
        var ch = htmlNode.childNodes;
        for (var i = 0; i < ch.length; i++) {
            if (ch[i].localName && re.test(ch[i].localName)) {
                if (index) index--;
                else if (parts.length) return findNode(ch[i], "", parts);
                else return ch[i];
            }
        }
    }
}

function findNodes(htmlNode, textNode, result, re) {
    var recursive = true;
    if (!result) {
        result = [];
        if (textNode[0] == ".")
            textNode = textNode.substr(1);
        if (textNode.startsWith("//"))
            textNode = textNode.substr(2);
        else
            recursive = false;
        re = new RegExp("^(" + textNode.replace(/a:/g, "") + ")$", "i");
    }
    var ch = htmlNode.childNodes;
    for (var i = 0; i < ch.length; i++) {
        if (ch[i].localName && re.test(ch[i].localName))
            result.push(ch[i]);
        if (recursive)
            findNodes(ch[i], textNode, result, re)
    }
    return result;
}





// *** XML Serialization *** //
if (XMLDocument.prototype.__defineGetter__) {
    //XMLDocument.xml
    XMLDocument.prototype.__defineGetter__("xml", function(){
        return (new XMLSerializer()).serializeToString(this);
    });
    XMLDocument.prototype.__defineSetter__("xml", function(){
        throw new Error(apf.formatErrorString(1042, null, "XML serializer", "Invalid assignment on read-only property 'xml'."));
    });
    
    //Node.xml
    Node.prototype.__defineGetter__("xml", function(){
        if (this.nodeType == 3 || this.nodeType == 4 || this.nodeType == 2) 
            return this.nodeValue;
        return (new XMLSerializer()).serializeToString(this);
    });
    
    //Node.xml
    Element.prototype.__defineGetter__("xml", function(){
        return (new XMLSerializer()).serializeToString(this);
    });
}

if (typeof HTMLElement!="undefined") {
    //HTMLElement.removeNode
    HTMLElement.prototype.removeNode = function(){
        if (!this.parentNode) return;
        this.parentNode.removeChild(this);
    };
}

//Document.prototype.onreadystatechange = null;
Document.prototype.parseError = 0;

defineProp(Array.prototype, "item", function(i){return this[i];});
defineProp(Array.prototype, "expr", "");

Node.prototype.getElementById = function(id) {};


/**
 * This method retrieves the current value of a property on a HTML element
 * @param {HTMLElement} el    the element to read the property from
 * @param {String}      prop  the property to read
 * @returns {String}
 */
var getStyle = apf.getStyle = function(el, prop) {
    try{
        return (window.getComputedStyle(el, "") || {})[prop] || "";
    }catch(e) {}
};

//XMLDocument.setProperty
HTMLDocument.prototype.setProperty = 
XMLDocument.prototype.setProperty = function(x,y) {};

/* ******** XML Compatibility ************************************************
****************************************************************************/
apf.getXmlDom = function(message, noError, preserveWhiteSpaces) {
    var xmlParser;
    if (message) {
        if (preserveWhiteSpaces === false)
            message = message.replace(/>[\s\n\r]*</g, "><");
        
        xmlParser = new DOMParser();
        xmlParser = xmlParser.parseFromString(message, "text/xml");

        
        if (!noError)
            this.xmlParseError(xmlParser);
    }
    else {
        xmlParser = document.implementation.createDocument("", "", null);
    }
    
    return xmlParser;
};

apf.xmlParseError = function(xml) {
    //if (xml.documentElement.tagName == "parsererror") {
    if (xml.getElementsByTagName("parsererror").length) { 
        var nodeValue = xml.documentElement.firstChild.nodeValue;

        if (nodeValue != null) {
            var str = nodeValue.split("\n"),
                linenr = str[2].match(/\w+ (\d+)/)[1],
                message = str[0].replace(/\w+ \w+ \w+: (.*)/, "$1");
        } else {
            if (nodeValue = xml.documentElement.firstChild.getElementsByTagName('div')[0].firstChild.nodeValue) {
                var linenr = nodeValue.match(/line\s(\d*)/)[1] || "N/A",
                    message = nodeValue.match(/column\s\d*:(.*)/)[1] || "N/A";
            }
            else {
                var linenr = "N/A",
                    message = "N/A";
            }
        }

        var srcText = xml.documentElement.lastChild.firstChild,//.split("\n")[0];
            srcMsg = "";
        if (srcText && srcText.nodeValue) {
            srcMsg = "\nSource Text : " + srcText.nodeValue.replace(/\t/gi, " ")
        }
        throw new Error(apf.formatErrorString(1050, null, 
            "XML Parse Error on line " +  linenr, message + srcMsg));
    }
    
    return xml;
};






/**
 * Compatibility layer for Webkit based browsers.
 * @private
 */
apf.runWebkit = function(){
    apf.getHtmlLeft = function(oHtml) {
        return oHtml.offsetLeft;
    };

    apf.getHtmlRight = function(oHtml) {
        var p;
        return (((p = oHtml.offsetParent).tagName == "BODY" 
          ? apf.getWindowWidth()
          : p.offsetWidth)
            - oHtml.offsetLeft - oHtml.offsetWidth
            - (parseInt(apf.getStyle(p, "borderLeftWidth")) || 0)
            - (parseInt(apf.getStyle(p, "borderRightWidth")) || 0));
    };

    apf.getHtmlTop = function(oHtml) {
        return oHtml.offsetTop
    };

    apf.getHtmlBottom = function(oHtml) {
        var p;
        return (((p = oHtml.offsetParent).tagName == "BODY" 
          ? apf.getWindowHeight()
          : p.offsetHeight)
            - oHtml.offsetTop - oHtml.offsetHeight
            - (parseInt(apf.getStyle(p, "borderTopWidth")) || 0)
            - (parseInt(apf.getStyle(p, "borderBottomWidth")) || 0));
    };
};






/*
 * @todo description
 *
 * @author      Ruben Daniels (ruben AT ajax DOT org)
 * @version     %I%, %G%
 * @since       0.4
 */
apf.application = function(){
    this.$init("application", apf.NODE_HIDDEN);
    
    this.$int = document.body;
    this.$tabList = []; //Prevents documentElement from being focussed
    // this.$focussable = apf.KEYBOARD;
    // this.focussable = true;
    this.visible = true;
    this.$isWindowContainer = true;
    this.focus = function(){ this.dispatchEvent("focus"); };
    this.blur = function(){ this.dispatchEvent("blur"); };
    
    apf.window.$addFocus(this);
};
apf.application.prototype = new apf.AmlElement();
apf.aml.setElement("application", apf.application);







/**
 * This element displays a skinnable rectangle which can contain other 
 * AML elements. Often, it's also used in place of a regular HTML `<div>`.
 *
 *
 * #### Example
 *
 * ```xml, demo
 * <a:application xmlns:a="http://ajax.org/2005/aml">
 *     <!-- startcontent -->
 *     <a:bar id="winGoToFile"
 *       width = "500" 
 *       skin = "winGoToFile"
 *       minheight = "35"
 *       maxheight = "400"
 *       >
 *         <a:vbox id="vboxGoToFile" edge="5 5 5 5" padding="5" anchors2="0 0 0 0">
 *             <a:textbox id="txtGoToFile" realtime="true" skin="searchbox_textbox" focusselect="true" />
 *             <a:list id="dgGoToFile"
 *               class = "searchresults noscrollbar"
 *               skin = "lineselect"
 *               maxheight = "350"
 *               scrollbar = "sbShared 32 7 7"
 *               viewport = "virtual"
 *               multiselect = "true"
 *               empty-message = "A filelist would go here.">
 *             </a:list>
 *         </a:vbox>
 *     </a:bar>
 *     <!-- endcontent -->
 * </a:application>
 * ```
 * 
 * #### Remarks
 *
 * This component is used in the accordion element to create its sections. In
 * the `apf.statusbar`, the panel element is an alias of [[apf.bar]].
 *
 * @class apf.bar
 * @inherits apf.Presentation
 * @author      Ruben Daniels (ruben AT ajax DOT org)
 * @version     %I%, %G%
 * @since       0.4
 *
 * @define bar
 * @container
 * @allowchild button
 * @allowchild {elements}, {anyaml}
 *
 */
/**
 * @attribute {String} icon Sets or gets the URL pointing to the icon image.
 */
/**
 *  @attribute {Boolean} [collapsed=false]  Sets or gets the collapse panel on load
 * 
 */
/**
 * @attribute {String} title  Sets or gets the title string
 */
apf.section = function(struct, tagName) {
    this.$init(tagName || "section", apf.NODE_VISIBLE, struct);
};

apf.menubar = function(struct, tagName) {
    this.$init(tagName || "menubar", apf.NODE_VISIBLE, struct);
};

apf.bar = function(struct, tagName) {
    this.$init(tagName || "bar", apf.NODE_VISIBLE, struct);
};

(function(){
    this.$focussable = false;
    this.$canLeechSkin = true;
    this.$isLeechingSkin = false;
    
    this.$propHandlers["caption"] = function(value) {
        this.$int.textContent = value;
    }
    
    //@todo apf3.0 refactor
    this.addEventListener("AMLReparent", 
        function(beforeNode, pNode, withinParent) {
            if (!this.$amlLoaded)
                return;

            if (this.$isLeechingSkin && !withinParent
              && this.skinName != pNode.skinName
              || !this.$isLeechingSkin
              && this.parentNode.$hasLayoutNode 
              && this.parentNode.$hasLayoutNode(this.localName)) {
                this.$isLeechingSkin = true;
                this.$forceSkinChange(this.parentNode.skinName.split(":")[0] + ":" + skinName);
            }
        });

    this.$draw = function(){
        //Build Main Skin
        this.$ext = this.$getExternal(this.$isLeechingSkin
            ? this.localName 
            : "main");

        //Draggable area support, mostly for a:toolbar
        if (this.oDrag) //Remove if already exist (skin change)
            this.oDrag.parentNode.removeChild(this.oDrag);
        
        this.oDrag = this.$getLayoutNode(this.$isLeechingSkin
            ? this.localName 
            : "main", "dragger", this.$ext);
            
        this.$int = this.$getLayoutNode(this.$isLeechingSkin
            ? this.localName 
            : "main", "container", this.$ext);
    };

    this.$loadAml = function(x) {
        
    };
    
    
    this.$skinchange = function(){
        
    }
    
}).call(apf.bar.prototype = new apf.Presentation());

apf.menubar.prototype = 
apf.section.prototype = apf.bar.prototype;

apf.aml.setElement("bar", apf.bar);
apf.aml.setElement("menubar", apf.menubar);
apf.aml.setElement("section", apf.section);

apf.list = apf.bar;
apf.aml.setElement("list", apf.list);







/**
 * Element displaying a clickable rectangle that visually confirms to the
 * user when the area is clicked and then executes a command.
 *
 *
 * #### Example: Working with Events
 * 
 * ```xml, demo
 * <a:application xmlns:a="http://ajax.org/2005/aml">
 *  <a:table columns="100, 100" cellheight="24">
 *      <a:label>Onclick event</a:label>
 *      <a:button
 *        skin = "btn-default-css3"
 *        class = "btn-green"
 *        width = "120"
 *        onclick = "alert('Button has been clicked')">
 *          Example button</a:button>
 *      <a:label>Onmouseover event</a:label>
 *      <a:button 
 *        skin = "btn-default-css3"
 *        class = "btn-red"
 *        width = "120"
 *        onmouseover = "alert('Button has been hovered')">
 *          Example button</a:button>
 *      <a:label>Onmouseout event</a:label>
 *      <a:button 
 *        width = "120"
 *        onmouseout = "alert('Mouse hover out button')">
 *          Example button</a:button>
 *  </a:table>
 * </a:application>
 * ```
 * 
 * #### Example: Interactions and Colors
 * 
 * ```xml, demo
 * <a:application xmlns:a="http://ajax.org/2005/aml">
 *  <a:table columns="250" cellheight="24">
 *  <!-- startcontent -->
 *  <a:button
 *    onclick = "b1.setAttribute('width', '200')" 
 *    width = "250">
 *      Click me to resize Test button to 200px</a:button>
 *  <a:button 
 *    onclick = "b1.setAttribute('width', '50')" 
 *    width = "250">
 *      Click me to resize Test button to 50px</a:button>
 *  <a:button id="b1" color="#FF8203">Test</a:button>
 *  <!-- endcontent -->
 *  </a:table>
 * </a:application>
 * ```
 * 
 * @class apf.button
 * @inherits apf.BaseButton
 * @define button
 *
 *
 * @author      Ruben Daniels (ruben AT ajax DOT org)
 * @version     %I%, %G%
 * @since       0.4
 * @form
 * @inherits apf.BaseButton
 */
apf.submit = function(struct, tagName) {
    this.$init(tagName || "submit", apf.NODE_VISIBLE, struct);
};


apf.trigger = function(struct, tagName) {
    this.$init(tagName || "trigger", apf.NODE_VISIBLE, struct);
};

apf.reset = function(struct, tagName) {
    this.$init(tagName || "reset", apf.NODE_VISIBLE, struct);
};

apf.button = function(struct, tagName) {
    this.$init(tagName || "button", apf.NODE_VISIBLE, struct);
};

(function() {
    this.$useExtraDiv;
    this.$childProperty = "caption";
    this.$inited = false;
    this.$isLeechingSkin = false;
    this.$canLeechSkin = true;

    // *** Properties and Attributes *** //

    this.$focussable = apf.KEYBOARD; // This object can get the focus
    this.value = null;
    
    this.$init(function(){
        //@todo reparenting
        var forceFocus, _self = this, lastDefaultParent;
        this.$propHandlers["default"] = function(value) {
            if (parseInt(value) != value)
                value = apf.isTrue(value) ? 1 : 0;

            this["default"] = parseInt(value);
            
            if (!this.focussable && value || forceFocus)
                this.setAttribute("focussable", forceFocus = value);

            if (lastDefaultParent) {
                lastDefaultParent.removeEventListener("focus", setDefault);
                lastDefaultParent.removeEventListener("blur", removeDefault);
            }
            
            if (!value)
                return;

            var pNode = this.parentNode;
            while (pNode && !pNode.focussable && --value)
                pNode = pNode.parentNode;
                
            //Currrently only support for parentNode, this might need to be expanded
            if (pNode) {
                pNode.addEventListener("focus", setDefault);
                pNode.addEventListener("blur", removeDefault);
            }
        };
    
        function setDefault(e) {
            if (e.defaultButtonSet || e.returnValue === false)
                return;
    
            e.defaultButtonSet = true;
    
            if (this.$useExtraDiv)
                _self.$ext.appendChild(apf.button.$extradiv);
    
            _self.$setStyleClass(_self.$ext, _self.$baseCSSname + "Default");
    
            if (e.toElement != _self && e.toElement) {
                // _self.$focusParent
                e.toElement.addEventListener("keydown", btnKeyDown);
            }
        }
    
        function removeDefault(e) {
            if (this.$useExtraDiv && apf.button.$extradiv.parentNode == _self.$ext)
                _self.$ext.removeChild(apf.button.$extradiv);
    
            _self.$setStyleClass(_self.$ext, "", [_self.$baseCSSname + "Default"]);
    
            if (e.fromElement != _self && e.fromElement) {
                //_self.$focusParent
                e.fromElement.removeEventListener("keydown", btnKeyDown);
            }
        }
    
        function btnKeyDown(e) {
            var ml;
    
            var f = apf.document.activeElement;
            if (f) {
                if (f.hasFeature(apf.__MULTISELECT__))
                    return;
    
                ml = f.multiline;
            }
    
            if (!_self.$ext.onmouseup)
                return;
    
            if (ml && ml != "optional" && e.keyCode == 13
              && e.ctrlKey || (!ml || ml == "optional")
              && e.keyCode == 13 && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                apf.preventDefault(e.htmlEvent);
                _self.$ext.onmouseup(e.htmlEvent, true);
            }
        }
    
        this.addEventListener("focus", setDefault);
        this.addEventListener("blur", removeDefault);
        
        this.$enable = function(){
            if (this["default"]) {
                setDefault({});
                if (apf.document.activeElement)
                    apf.document.activeElement.focus(true);
            }
            
            if (this.state && this.value)
                this.$setState("Down", {});
            else if (this.$mouseOver)
                this.$updateState({}, "mouseover");
            else
                this.$doBgSwitch(1);
        };
    
        this.$disable = function(){
            if (this["default"])
                removeDefault({});
    
            this.$doBgSwitch(4);
            this.$setStyleClass(this.$ext, "",
                [this.$baseCSSname + "Over", this.$baseCSSname + "Down"]);
        };
    });

    /**
     * @attribute {String}  icon     Sets or gets the url from which the icon image is loaded.
     */
    /**
     * @attribute {Boolean} state    Sets or gets whether this boolean is a multi state button.
     */
    /**
     * @attribute {String}  value    Sets or gets the initial value of a state button.
     */
    /**
     * @attribute {String}  color    Sets or gets the text color of the caption of this element.
     */
    /**
     * @attribute {String}  caption  Sets or gets the text displayed on this element indicating the action when the button is pressed.
     */
    /**
     *  @attribute {String}  action   Sets or gets one of the default actions this button can perform when pressed.
     *   
     * The possible values include:
     *
     *   - `undo`:     Executes undo on the action tracker of the target element.
     *   - `redo`:     Executes redo on the action tracker of the target element.
     *   - `remove`:   Removes the selected node(s) of the target element.
     *   - `add`:      Adds a node to the target element.
     *   - `rename`:   Starts the rename function on the target element.
     *   - `login`:    Calls log in on the auth element with the values of the textboxes of type username and password.
     *   - `logout`:   Calls lot out on the auth element.
     *   - `submit`:   Submits the data of a model specified as the target.
     *   - `ok`:       Executes a `commitTransaction()` on the target element, and closes or hides that element.
     *   - `cancel`:   Executes a `rollbackTransaction()` on the target element, and closes or hides that element.
     *   - `apply`:    Executes a `commitTransaction()` on the target element.
     *   - `close`:    Closes the target element.
     */
    /**
     * @attribute {String}  target   Sets or gets the id of the element to apply the action to. Defaults to the parent container.
     */
    /**
     * @attribute {Number}  default  Sets or gets the search depth for which this button is the default action. `1` specifies the direct parent, `2` specifies the parent of this parent, _.e.t.c._
     */
    /**
     * @attribute {String}  submenu  Sets or gets the name of the contextmenu to display when the button is pressed.
     */
    //this.$booleanProperties["default"] = true;
    this.$booleanProperties["state"] = true;
    this.$supportedProperties.push("icon", "value", "tooltip", "state", 
        "color", "caption", "action", "target", "default", "submenu", "hotkey");

    this.$propHandlers["iconsize"] = function(value) {
        if (!this.oIcon) return;

        this.oIcon.style.backgroundSize = value;
    }

    this.$propHandlers["icon"] = function(value) {
        
        if (!this.oIcon) return;
        

        if (value)
            this.$setStyleClass(this.$ext, this.$baseCSSname + "Icon");
        else
            this.$setStyleClass(this.$ext, "", [this.$baseCSSname + "Icon"]);

        apf.skins.setIcon(this.oIcon, value, this.iconPath);
    };

    this.$propHandlers["value"] = function(value) {
        if (!this.state && !this.submenu)
            return;
        
        if (value === undefined)
            value = !this.value;
        this.value = value;

        if (this.value) {
            this.$setState("Down", {});
            this.$setStyleClass(this.$ext, this.$baseCSSname + "Checked")
        }
        else {
            this.$setState("Out", {});
            this.$setStyleClass(this.$ext, "", [this.$baseCSSname + "Checked"])
        }
    };

    this.$propHandlers["state"] = function(value) {
        if (value)
            this.$setStateBehaviour(this.value);
        else 
            this.$setNormalBehaviour();
    };

    this.$propHandlers["color"] = function(value) {
        if (this.oCaption)
            this.oCaption.parentNode.style.color = value;
    };

    this.$propHandlers["caption"] = function(value) {
        // if (!this.oCaption)
        //     return;

        if (value)
            this.$setStyleClass(this.$ext, "", [this.$baseCSSname + "Empty"]);
        else
            this.$setStyleClass(this.$ext, this.$baseCSSname + "Empty");

        if (this.oCaption.nodeType == 1)
            this.oCaption.textContent = String(value || "").trim();
        else
            this.oCaption.nodeValue = String(value || "").trim();
    };

    

    //@todo move this to menu.js
    function menuKeyHandler(e) {
        return;
        var key = e.keyCode;

        var next, nr = apf.getChildNumber(this);
        if (key == 37) { //left
            next = nr == 0
                ? this.parentNode.childNodes.length - 1
                : nr - 1;
            this.parentNode.childNodes[next].dispatchEvent("mouseover");
        }
        else if (key == 39) { //right
            next = (nr >= this.parentNode.childNodes.length - 1)
                ? 0
                : nr + 1;
            this.parentNode.childNodes[next].dispatchEvent("mouseover");
        }
    }

    function menuDown(e) {
        var menu = self[this.submenu] || this.submenu,
            $button1;

        this.value = !this.value;

        if (this.value)
            this.$setState("Down", {});

        

        var menuPressed = this.parentNode.menuIsPressed;
        if (menuPressed && menuPressed != this) {
            menuPressed.setValue(false);
            var oldMenu = self[menuPressed.submenu] || menuPressed.submenu;
            if (oldMenu != (self[this.submenu] || this.submenu))
                oldMenu.$propHandlers["visible"].call(oldMenu, false, true);
        }
        
        if (!this.value) {
            menu.hide();
            this.$setState("Over", {}, "toolbarover");

            if ($button1 = this.parentNode.$button1)
                $button1.$setState("Over", {}, "toolbarover");

            this.parentNode.menuIsPressed = false;
            if (this.parentNode.hasMoved)
                this.value = false;

            return false;
        }

        this.parentNode.menuIsPressed = this;

        apf.setStyleClass(this.$ext, 'submenu');

        menu.display(null, null, false, this,
            null, null, this.$ext.offsetWidth - 2);
        
        menu.addEventListener("prop.visible", function listen(e) {
            apf.setStyleClass(this.$ext, '', ['submenu']);
            menu.removeEventListener("prop.visible", listen);
        });

        this.parentNode.hasMoved = false;

        if (e && e.htmlEvent)
            apf.stopPropagation(e.htmlEvent);

        return false;
    }

    function menuOver(){
        var menuPressed = this.parentNode.menubar && this.parentNode.menuIsPressed;

        if (!menuPressed || menuPressed == this)
            return;

        var menu = self[this.submenu] || this.submenu;
        if (menu.pinned)
            return;

        menuPressed.setValue(false);
        var oldMenu = self[menuPressed.submenu] || menuPressed.submenu;
        oldMenu.$propHandlers["visible"].call(oldMenu, false, true);//.hide();

        this.setValue(true);
        this.parentNode.menuIsPressed = this;

        

        //var pos = apf.getAbsolutePosition(this.$ext, menu.$ext.offsetParent);

//        menu.display(pos[0],
//            pos[1] + this.$ext.offsetHeight, true, this,
//            null, null, this.$ext.offsetWidth - 2);
        
        apf.setStyleClass(this.$ext, 'submenu');
        
        menu.display(null, null, true, this,
            null, null, this.$ext.offsetWidth - 2);

        //apf.window.$focus(this);
        this.$focus();

        this.parentNode.hasMoved = true;

        return false;
    }

    this.$propHandlers["submenu"] = function(value) {
        if (!value) {
            if (this.value && this.parentNode) {
                
                menuDown.call(this);
                
            }

            this.$focussable = true;
            this.$setNormalBehaviour();
            this.removeEventListener("mousedown", menuDown);
            this.removeEventListener("mouseover", menuOver);
            this.removeEventListener("keydown", menuKeyHandler, true);
            return;
        }

        this.$focussable = false;
        this.$setStateBehaviour();

        this.addEventListener("mouseover", menuOver);
        this.addEventListener("mousedown", menuDown);
        this.addEventListener("keydown", menuKeyHandler, true);
    };
    

    // *** Public Methods *** //

    

    /**
     * Sets the value of this element. This should be one of the values
     * specified in the `values` attribute.
     * @param {String} value the new value of this element
     */
    this.change = 
    this.setValue = function(value) {
        this.setProperty("value", value, false, true);
        this.dispatchEvent("afterchange", { value: value });
    };

    /**
     * If this button is a submenu, this method shows it.
     */    
    this.showMenu = function(){
        if (this.submenu && !this.value)
            menuDown.call(this);
    };
    /**
     * If this button is a submenu, this method hides it.
     */     
    this.hideMenu = function(){
        if (this.submenu && this.value)
            menuDown.call(this);
    };

    /**
     * Sets the text displayed as a caption of this element.
     *
     * @param  {String}  value   The string to display.
     * @see    apf.Validation
     */
    this.setCaption = function(value) {
        this.setProperty("caption", value, false, true);
    };

    /**
     * Sets the URL of the icon displayed on this element.
     *
     * @param  {String}  value   The URL to the location of the icon.
     */
    this.setIcon = function(url) {
        this.setProperty("icon", url, false, true);
    };
    
    

    // *** Private state methods *** //

    this.$setStateBehaviour = function(value) {
        this.value = value || false;
        this.isBoolean = true;
        this.$setStyleClass(this.$ext, this.$baseCSSname + "Bool");

        if (this.value) {
            this.$setStyleClass(this.$ext, this.$baseCSSname + "Down");
            this.$doBgSwitch(this.states["Down"]);
        }
    };

    this.$setNormalBehaviour = function(){
        this.value = null;
        this.isBoolean = false;
        this.$setStyleClass(this.$ext, "", [this.$baseCSSname + "Bool"]);
    };

    this.$setState = function(state, e, strEvent) {
        var parentNode = this.parentNode;
        //if (this.disabled)
            //return;

        if (strEvent && this.dispatchEvent(strEvent, {htmlEvent: e}) === false)
            return;
        
        if (parentNode && parentNode.$button2 && parentNode.$button2.value && !this.submenu)
            return;

        this.$doBgSwitch(this.states[state]);
        var bs = this.$baseCSSname;
        this.$setStyleClass(this.$ext, (state != "Out" ? bs + state : ""),
            [(this.value ? "" : bs + "Down"), bs + "Over"]);

        if (this.submenu) {
            bs = this.$baseCSSname + "menu";
            this.$setStyleClass(this.$ext, (state != "Out" ? bs + state : ""),
            [(this.value ? "" : bs + "Down"), bs + "Over"]);
        }

        //if (state != "Down")
            //e.cancelBubble = true;
    };

    this.$clickHandler = function(){
        // This handles the actual OnClick action. Return true to redraw the button.
        if (this.isBoolean && !this.submenu && this.auto !== false) {
            this.setProperty("value", !this.value);
            return true;
        }
    };

    
    this.$submenu = function(hide, force) {
        if (hide && this.submenu) {
            this.setValue(false);
            this.$setState("Out", {}, "mouseout");
            if (this.parentNode)
                this.parentNode.menuIsPressed = false;
        }
    };
    

    // *** Init *** //

    this.addEventListener("$skinchange", function(e) {
        if (this.tooltip)
            apf.GuiElement.propHandlers.tooltip.call(this, this.tooltip);
    });

    this.$draw = function(){
        var pNode, isToolbarButton = (pNode = this.parentNode) 
            && pNode.parentNode && pNode.parentNode.localName == "toolbar";
        
        if (isToolbarButton) {
            if (typeof this.focussable == "undefined")
                this.focussable = false;
            
            this.$focussable = apf.KEYBOARD;
        }

        //Build Main Skin
        this.$ext = this.$getExternal();
        this.oIcon = this.$getLayoutNode("main", "icon", this.$ext);
        this.oCaption = this.$getLayoutNode("main", "caption", this.$ext);
        
        if (this.oCaption.nodeValue && !this.caption)
            this.$propHandlers["caption"].call(this, "");

        this.$useExtraDiv = apf.isTrue(this.$getOption("main", "extradiv"));
        if (!apf.button.$extradiv && this.$useExtraDiv) {
            (apf.button.$extradiv = document.createElement("div"))
                .className = "extradiv"
        }

        if (this.localName == "submit")
            this.action = "submit";
        else if (this.localName == "reset")
            this.action = "reset";

        this.$setupEvents();
    };

    
    this.addEventListener("$skinchange", function(){
        if (this.caption)
            this.$propHandlers["caption"].call(this, this.caption);

        if (this.icon)
            this.$propHandlers["icon"].call(this, this.icon);

        this.$updateState({reset:1});
        //this.$blur();

        //if (this.$focussable !== true && this.hasFocus())
            //apf.window.$focusLast(this.$focusParent);
    });
    

    

    
}).call(apf.button.prototype = new apf.BaseButton());

// submit, trigger, reset, button
apf.submit.prototype = 
apf.trigger.prototype =
apf.reset.prototype = apf.button.prototype;

apf.aml.setElement("submit",  apf.submit);
apf.aml.setElement("trigger", apf.trigger);
apf.aml.setElement("reset",   apf.reset);
apf.aml.setElement("button",  apf.button);








/**
 * This element displays a clickable rectangle with two states that
 * can be toggled by user interaction.
 * 
 * #### Example: Setting and Retrieving Values
 *
 * ```xml, demo
 * <a:application xmlns:a="http://ajax.org/2005/aml">
 *   <!-- startcontent -->
 *   <a:checkbox 
 *   id = "ch1" 
 *   values = "full|empty" 
 *   checked = "true">Full</a:checkbox>
 *   <a:textbox value="the glass is {ch1.value}"></a:textbox>
 *   <!-- endcontent -->
 * </a:application>
 * ```
 *
 * #### Example: Disabled Values
 *
 * ```xml, demo
 * <a:application xmlns:a="http://ajax.org/2005/aml">
 *   <!-- startcontent -->
 *   <a:checkbox checked="true">Option 1</a:checkbox>
 *   <a:checkbox>Option 2</a:checkbox>
 *   <a:checkbox checked="true" disabled="true">Option 3</a:checkbox>
 *   <a:checkbox disabled="true">Option 4</a:checkbox>
 *   <a:checkbox label="Option 5" />
 *   <a:checkbox label="Option 6" />
 *   <!-- endcontent -->
 * </a:application>
 * ```
 * 
 * @class apf.checkbox
 *
 * @define checkbox
 *
 *
 * @author      Ruben Daniels (ruben AT ajax DOT org)
 * @version     %I%, %G%
 * @since       0.4
 * @form
 * @inherits apf.BaseButton
 * @inheritsElsewhere apf.XForms
 *
 */
/**
 * @binding value  Determines the way the value for the element is retrieved 
 * from the bound data.
 * 
 * #### Example
 *
 * Sets the value of the checkbox based on data loaded into this component.
 * ```xml
 *  <a:model id="mdlCheckbox">
 *      <data answer="Something"></data>
 *  </a:model>
 *  <a:checkbox 
 *    model = "mdlCheckbox" 
 *    value = "[@answer]">Caption</a:checkbox>
 * ```
 *
 * A shorter way to write this is:
 * 
 * ```xml
 *  <a:model id="mdlCheckbox">
 *      <data answer="Something"></data>
 *  </a:model>
 *  <a:checkbox value="[mdlCheckbox::@answer]">Caption</a:checkbox>
 * ```
 */
apf.checkbox = function(struct, tagName) {
    this.$init(tagName || "checkbox", apf.NODE_VISIBLE, struct);
};

(function() {

    //Options
    this.$focussable = apf.KEYBOARD; // This object can get the focus
    this.checked = false;

    // *** Properties and Attributes *** //

    this.$booleanProperties["checked"] = true;
    this.$supportedProperties.push("value", "checked", "label", "values");

    /**
     * @attribute {String}  value   Sets or gets the value of this element.
     */
    this.$propHandlers["value"] = function(value) {
        value = (typeof value == "string" ? value.trim() : value);

        if (value == "" && this["default"])
            value = this.value = apf.isTrue(this["default"]);

        if (this.$values) {
            this.checked = (typeof value != "undefined" && value !== null
                && value.toString() == this.$values[0].toString());
        }
        else {
            this.checked = apf.isTrue(value);
        }
        
        if (this.checked)
            apf.setStyleClass(this.$ext, this.$baseCSSname + "Checked");
        else
            apf.setStyleClass(this.$ext, "", [this.$baseCSSname + "Checked"]);
    };

    /**
     * @attribute {Boolean} checked  Sets or gets whether the element is in the checked state.
     */
    this.$propHandlers["checked"] = function(value) {
        if (!this.$values) {
            if (this.getAttribute("values"))
                this.$propHandler["values"].call(this, this.getAttribute("values"));
            //else
                //this.$values = [true, false];
        }
        this.setProperty("value", this.$values ? this.$values[value ? 0 : 1] : true);
    };

    /**
     * @attribute {String}  label Sets or gets the caption of the label explaining what
     * the meaning of the checked state of this element is.
     */
    this.$propHandlers["label"] = function(value) {
        if (!this.$ext)
            return;

        var lbl = this.$getLayoutNode("main", "label", this.$ext);
        if (!lbl)
            return;
        
        if (lbl.nodeType == 1)
            lbl.textContent = value;
        else
            lbl.nodeValue = value;
    };

    /**
     * @attribute {String}  values Sets or gets a pipe seperated list of two values which
     * correspond to the two states of the checkbox. The first for the checked
     * state, the second for the unchecked state.
     */
    this.$propHandlers["values"] = function(value) {
        this.$values = typeof value == "string"
            ? value.split("\|")
            : (value || [1, 0]);

        this.$propHandlers["value"].call(this, this.value);
    };

    // *** Public Methods *** //

    

    /**
     * Sets the value of this element. This should be one of the values
     * specified in the [[apf.checkbox.values]] attribute.
     * @param {String} value The new value of this element
     */
    this.change = 
    this.setValue = function(value) {
        this.setProperty("value", value, false, true);
        this.dispatchEvent("afterchange", { value: value });
    };

    /**
     * Returns the current value.
     */
    this.getValue = function(){
        return this.xmlRoot ? (this.$values 
            ? this.$values[this.checked ? 0 : 1]
            : this.checked) : this.value;
    };

    /**
     * Sets the checked state (and related value).
     */
    this.check = function(){
        this.setProperty("value", this.$values
            ? this.$values[0]
            : true, false, true);
    };

    /**
     * Sets the unchecked state (and related value).
     */
    this.uncheck = function(){
        this.setProperty("value", this.$values
            ? this.$values[1]
            : false, false, true);
    };
    
    

    // *** Private state handling methods *** //

    this.addEventListener("$clear", function(){
        this.setProperty("value", this.$values ? this.$values[1] : false);
    });

    this.$enable = function(){
        if (this.$input) this.$input.disabled = false;
        this.$doBgSwitch(1);
    };

    this.$disable = function(){
        if (this.$input) this.$input.disabled = true;
        this.$doBgSwitch(4);
    };

    this.$setState = function(state, e, strEvent) {
        this.$doBgSwitch(this.states[state]);
        this.$setStyleClass(this.$ext, (state != "Out" ? this.$baseCSSname + state : ""),
            [this.$baseCSSname + "Down", this.$baseCSSname + "Over"]);
        this.state = state; // Store the current state so we can check on it coming here again.

        if (strEvent)
            this.dispatchEvent(strEvent, {htmlEvent: e});
    };

    this.$clickHandler = function(){
        this.change(this.$values
            ? this.$values[(!this.checked) ? 0 : 1]
            : !this.checked);

        
        if (this.validate) //@todo rewrite button
            this.validate(true);
        

        return true;
    };

    // *** Init *** //

    this.$draw = function(){
        //Build Main Skin
        this.$ext = this.$getExternal();
        this.$input = this.$getLayoutNode("main", "input", this.$ext);
        this.$notfromext = this.$input && this.$input != this.$ext;

        this.$setupEvents();
    };

    this.$childProperty = "label";

    
    this.addEventListener("$skinchange", function(){
        if (this.label)
            this.$propHandlers["label"].call(this, this.label);
    })
    
    
    
}).call(apf.checkbox.prototype = new apf.BaseButton());

apf.aml.setElement("checkbox", apf.checkbox);









/**
 * All elements within the comment tag are ignored by the parser.
 *
 * @class apf.comment
 * @define comment
 * @author      Ruben Daniels (ruben AT ajax DOT org)
 * @version     %I%, %G%
 * @since       0.4
 */
apf.comment = function(){
    this.$init("comment", apf.NODE_HIDDEN);
};

apf.comment.prototype = new apf.AmlComment();
apf.aml.setElement("comment", apf.comment);








/**
 * This element specifies which menu is shown when a
 * contextmenu is requested by a user for a AML node.
 * 
 * #### Example
 *
 * This example shows a list that shows the mnuRoot menu when the user
 * right clicks on the root {@link term.datanode data node}. Otherwise the `mnuItem` menu is
 * shown.
 *
 * ```xml, demo
 *  <a:application xmlns:a="http://ajax.org/2005/aml">
 *   <!-- startcontent -->
 *   <a:menu id="ctxMenu">
 *       <a:item>Choice 1!</a:item>
 *       <a:item>Choice 2!</a:item>
 *   </a:menu>
 *   <a:list width="300" id="list1">
 *       <a:contextmenu menu="ctxMenu" />
 *       <a:item>The Netherlands</a:item>
 *       <a:item>United States of America</a:item>
 *       <a:item>Poland</a:item>
 *   </a:list>
 *   <!-- endcontent -->
 *   Right-click on the list to reveal the context menu!
 *  </a:application>
 * ```
 *
 * @class apf.contextmenu
 * @define contextmenu
 * @inherits apf.AmlElement
 * @selection
 * @author      Ruben Daniels (ruben AT ajax DOT org)
 * @version     %I%, %G%
 * @since       0.4
 */
/**
 * @attribute {String} menu  Sets or gets the id of the menu element.
 */
/**
 * @attribute {String} select Sets or gets the XPath executed on the selected element of the databound element which determines whether this context menu is shown.
 *
 * 
 */
apf.contextmenu = function(){
    this.$init("contextmenu", apf.NODE_HIDDEN);
};

(function(){
    this.$amlNodes = [];
    
    this.register = function(amlParent) {
        if (!amlParent.contextmenus)
            amlParent.contextmenus = [];
        amlParent.contextmenus.push(this);
    };
    
    this.unregister = function(amlParent) {
        amlParent.contextmenus.remove(this);
    };
    
    this.addEventListener("DOMNodeInsertedIntoDocument", function(e) {
        this.register(this.parentNode);
    });
}).call(apf.contextmenu.prototype = new apf.AmlElement());

apf.aml.setElement("contextmenu", apf.contextmenu);









/**
 * Displays a popup element with a message with optionally an icon at the
 * position specified by the position attribute. After the timeout has passed
 * the popup will dissapear automatically. When the mouse hovers over the popup
 * it doesn't dissapear.
 * 
 * @class apf.event
 * @define event
 * @inherits apf.AmlElement
 *
 */
/**
 * @event click Fires when the user clicks on the representation of this event.
 */
apf.event = function(struct, tagName) {
    this.$init(tagName || "event", apf.NODE_HIDDEN, struct);
};

(function() {
    this.$hasInitedWhen = false;

    this.$booleanProperties["repeat"] = true;
    this.$supportedProperties.push("when", "message", "icon", "repeat");

    this.$propHandlers["when"] = function(value) {
        if (this.$hasInitedWhen && value && this.parentNode && this.parentNode.popup) {
            var _self = this;
            $setTimeout(function() {
                _self.parentNode.popup(_self.message, _self.icon, _self);
            });
        }
        this.$hasInitedWhen = true;

        if (this.repeat)
            delete this.when;
    };

    this.$loadAml = function(x) {};
}).call(apf.event.prototype = new apf.AmlElement());

apf.aml.setElement("event", apf.event);







apf.filler = function(struct, tagName) {
    this.$init(tagName || "filler", apf.NODE_VISIBLE, struct);
};

(function() {
    this.$focussable = false;
    this.flex = 1;

    this.$draw = function() {
        this.$ext = this.$pHtmlNode.appendChild(this.$pHtmlNode.ownerDocument.createElement("div"));
    };
}).call(apf.filler.prototype = new apf.GuiElement());

apf.aml.setElement("filler", apf.filler);








/**
 * This element displays a frame with a caption that can contain other elements. It's
 * element is analogous to the `<fieldset>` in HTML.
 * 
 * #### Example
 * 
 * ```xml, demo
 * <a:application xmlns:a="http://ajax.org/2005/aml">
 *    <!-- startcontent -->
 *    <a:frame caption="Options">
 *      <a:radiobutton value="1">Option 1</a:radiobutton>
 *      <a:radiobutton value="2">Option 2</a:radiobutton>
 *      <a:radiobutton value="3">Option 3</a:radiobutton>
 *      <a:radiobutton value="4">Option 4</a:radiobutton>
 *    </a:frame>
 *    <!-- endcontent -->
 * </a:application>
 * ```
 *
 * @class apf.frame
 * @define frame
 * @container
 * @allowchild {elements}, {anyaml}
 *
 *
 * @author      Ruben Daniels (ruben AT ajax DOT org)
 * @version     %I%, %G%
 * @since       0.9
 *
 * @inherits apf.Presentation
 */
apf.panel = function(struct, tagName) {
    this.$init(tagName || "panel", apf.NODE_VISIBLE, struct);
};

apf.fieldset = function(struct, tagName) {
    this.$init(tagName || "fieldset", apf.NODE_VISIBLE, struct);
};

apf.frame = function(struct, tagName) {
    this.$init(tagName || "frame", apf.NODE_VISIBLE, struct);
};

(function(){
    this.implement(apf.BaseStateButtons);

    this.$focussable = false;
    
    
    
    // *** Properties and Attributes *** //
    
    /**
     * @attribute {String} caption Sets or gets the caption text. 
     */
    this.$supportedProperties.push("caption", "url");
    this.$propHandlers["caption"] = function(value) {
        if (!this.oCaption) return;
        
        if (this.oCaption.nodeType == 1)
            this.oCaption.textContent = value;
        else
            this.oCaption.nodeValue = value;
    };
    
    /**
     * @attribute {String} icon Sets or gets the location of the image.
     */
    this.$propHandlers["icon"] = function(value) {
        var oIcon = this.$getLayoutNode("main", "icon", this.$ext);
        if (!oIcon) return;

        if (oIcon.nodeType == 1)
            oIcon.style.display = value ? "block" : "none";
        apf.skins.setIcon(oIcon, value, this.iconPath);
    };

    this.$propHandlers["activetitle"] = function(value) {
        var node = this.oCaption.parentNode;
        // if (node.nodeType != 1) node = node.parentNode;
        var _self = this;
        node.addEventListener("click", function(e) {
            if (e.target == node || e.target == _self.oCaption)
                _self.$toggle(value);
        }, false);
    };
    
    /** 
     * Sets the text of the title of this element.
     * @param {String} value The text of the title.
     */
    this.setTitle = function(value) {
        this.setProperty("title", value);
    };
    
    // *** Init *** //
    
    this.$draw = function(){
        //Build Main Skin
        this.$ext = this.$getExternal(null, null, function(oExt) {
            this.$initButtons(oExt);
        });
        this.oCaption = this.$getLayoutNode("main", "caption", this.$ext);
        this.$int = this.$getLayoutNode("main", "container", this.$ext);
        this.$buttons = this.$getLayoutNode("main", "buttons",  this.$ext);

        /*if (this.oCaption) {
            this.oCaption = this.oCaption.nodeType == 1 
                ? this.oCaption 
                : this.oCaption.parentNode;
        }*/
    };
    
    this.$loadAml = function(x) {
        // not implement now.
    };
    
        
}).call(apf.frame.prototype = new apf.Presentation());

apf.panel.prototype = 
apf.fieldset.prototype = apf.frame.prototype;

apf.aml.setElement("panel", apf.panel);
apf.aml.setElement("fieldset", apf.fieldset);
apf.aml.setElement("frame", apf.frame);









/**
 * @event click Fires when a user presses a mouse button while over this element.
 *
 */
/**
 *  @binding value  Determines the way the value for the element is retrieved 
 * from the bound data.
 * 
 * #### Example
 * 
 * Sets the image source based on data loaded into this component.
 * 
 * ```xml
 *  <a:model id="mdlPictures"> 
 *      <data src="path/to/image.jpg" /> 
 *  </a:model>
 *  <a:img 
 *    model = "mdlPictures" 
 *    value = "[@src]" 
 *    width = "300" 
 *    height = "300" />
 * ```
 */
apf.img = function(struct, tagName) {
    this.$init(tagName || "img", apf.NODE_VISIBLE, struct);
};

(function(){
    
    
    /**
     * Sets the value of this element. This should be one of the values
     * specified in the `values` attribute.
     * @param {String} value The new value of this element
     */
    this.change = 
    this.setValue = function(value) {
        this.setProperty("value", value, false, true);
    };
    
    /**
     * Returns the current value of this element.
     * @return {String} The current image
     */
    this.getValue = function(value) {
        return this.value;
    };
    
    
    
    this.$supportedProperties.push("value", "src");
    /**
     * @attribute {String} value Sets or gets the url location of the image displayed.
     */
    this.$propHandlers["src"] = 
    this.$propHandlers["value"] = function(value) {
        if (this.oImage.nodeType == 1)
            this.oImage.style.backgroundImage = "url(" + value + ")";
        else
            this.oImage.nodeValue = value;
        
        //@todo resize should become a generic thing
        if (this.oImage.nodeType == 2 && !this.$resize.done) {
            if (this.oImg) {
                
                //@todo add this to $destroy
                var pNode = apf.hasSingleRszEvent ? this.$pHtmlNode : this.$ext;
                apf.layout.setRules(pNode, this.$uniqueId + "_image",
                    "var o = apf.all[" + this.$uniqueId + "];\
                     if (o) o.$resize()");
                apf.layout.queue(pNode);
                
                this.oImg.onload = function(){
                    apf.layout.forceResize(pNode);
                }
                
            }
            
            this.$resize.done = true;
        }

        if (this.oImg) {
            this.oImg.style.display = value ? "block" : "none";
            
            //RLD: disabled lines below for the preview element. the image is probably not loaded yet.
            //if (value)
                //this.$resize();
        }
    };

    this.refetch = function(){
        this.$propHandlers["value"].call(this, "")
        this.$propHandlers["value"].call(this, this.value || this.src)
    }
    
    this.addEventListener("$clear", function(){
        this.value = "";
        
        if (this.oImg)
            this.oImg.style.display = "none";
    });
    
    // *** Init *** //
    
    this.$draw = function(){
        //Build Main Skin
        this.$ext = this.$getExternal();
        this.$ext.onclick = function(e) {
            this.host.dispatchEvent("click", {htmlEvent: e || event});
        };
        this.oImage = this.$getLayoutNode("main", "image", this.$ext);
        if (this.oImage.nodeType == 1)
            this.oImg = this.oImage.getElementsByTagName("img")[0];

        var _self = this;
        apf.addListener(this.$ext, "mouseover", function(e) {
            if (!_self.disabled)
                _self.dispatchEvent("mouseover", {htmlEvent: e});
        });
        
        apf.addListener(this.$ext, "mouseout", function(e) {
            if (!_self.disabled)
                _self.dispatchEvent("mouseout", {htmlEvent: e});
        });
    };

    this.addEventListener("DOMNodeInsertedIntoDocument", function() {
        var node,
            val = "",
            i = this.childNodes.length;

        for (; i >= 0; --i) {
            if ((node = this.childNodes[i]) && node.nodeName
              && node.nodeName == "#cdata-section") {
                val = node.nodeValue;
                node.removeNode();
            }
        }

        this.sPreview = val;
    });
    
    this.$resize = function(){
        var diff = apf.getDiff(this.$ext);
        var wratio = 1, hratio = 1;

        this.oImg.style.width = "";
        this.oImg.style.height = "";
        
        if (this.oImg.offsetWidth > this.$ext.offsetWidth)
            wratio = this.oImg.offsetWidth / (this.$ext.offsetWidth - diff[0]);
        if (this.oImg.offsetHeight > this.$ext.offsetHeight)
            hratio = this.oImg.offsetHeight / (this.$ext.offsetHeight - diff[1]);

        if (wratio > hratio && wratio > 1)
            this.oImg.style.width = "100%";
        else if (hratio > wratio && hratio > 1)
            this.oImg.style.height = "100%";
        
        this.oImg.style.top = ((this.$ext.offsetHeight - apf.getHeightDiff(this.$ext) 
            - this.oImg.offsetHeight) / 2) + "px";
    }
}).call(apf.img.prototype = new apf.BaseSimple());


apf.aml.setElement("img", apf.img);







/**
 * An element displaying a text in the user interface, usually specifying
 * a description of another element. When the user clicks on the label, it 
 * can set the focus to the connected AML element.
 * 
 * #### Example: Connecting with "For"
 * 
 * ```xml, demo
 * <a:application xmlns:a="http://ajax.org/2005/aml">
 *   <!-- startcontent -->
 *   <a:label 
 *     for = "txtAddress"
 *     disabled = "true" 
 *     caption = "Disabled label"></a:label>
 *   <a:textbox id="txtAddress" />
 *   <a:label 
 *     for = "txtAddress2">Not Disabled</a:label>
 *   <a:textbox id="txtAddress2" />
 *   <!-- endcontent -->
 * </a:application>
 * ```
 *
 * @class apf.label
 * @define label
 * @allowchild {smartbinding}
 *
 * @form 
 * @inherits apf.BaseSimple
 *
 * @author      Ruben Daniels (ruben AT ajax DOT org)
 * @version     %I%, %G%
 * @since       0.4
 */
/**
 * @binding value  Determines the way the value for the element is retrieved 
 * from the bound data.
 * 
 * #### Example
 * 
 * Sets the label text based on data loaded into this component.
 * 
 * ```xml
 *  <a:model id="mdlLabel">
 *      <data text="Some text"></data>
 *  </a:model>
 *  <a:label model="mdlLabel" value="[@text]" />
 * ```
 * 
 * A shorter way to write this is:
 * 
 * ```xml
 *  <a:model id="mdlLabel">
 *      <data text="Some text"></data>
 *  </a:model>
 *  <a:label value="[mdlLabel::@text]" />
 * ```
 */
apf.label = function(struct, tagName) {
    this.$init(tagName || "label", apf.NODE_VISIBLE, struct);
};

(function(){
    var _self = this;
    
    this.$focussable = false;
    var forElement;
    
    
    
    /**
     * Sets the value of this element. This should be one of the values
     * specified in the values attribute.
     * @param {String} value The new value of this element
     */
    this.change = 
    this.setValue = function(value) {
        this.setProperty("value", value, false, true);
    };
    
    /**
     * Returns the current value of this element.
     * @return {String} The current value
     */
    this.getValue = function(){
        return this.value;
    }
    
    
    
    /** 
     * @attribute {String} caption Sets or gets the text displayed in the area defined by this 
     * element. Using the value attribute provides an alternative to using
     * the text using a text node.
     *
     */
    /**
     * @attribute {String} for Sets or gets the id of the element that receives the focus 
     * when the label is clicked on.
     */
    /**
     * @attribute {String} textalign Sets or gets the text alignment value for the label.
     */
    this.$supportedProperties.push("caption", "for", "textalign");
    this.$propHandlers["caption"] = function(value) {
        if (typeof value == "string")
            this.$caption.textContent = value;
        else if (Array.isArray(value)) {
            this.$caption.textContent = "";
            apf.buildDom(value, this.$caption);
        }
    };
    this.$propHandlers["for"] = function(value) {
        forElement = typeof value == "string" ? self[value] : value;
    };
    this.$propHandlers["textalign"] = function(value) {
        this.$caption.style.textAlign = value || "";
    };

    this.$draw = function(){
        //Build Main Skin
        this.$ext = this.$getExternal();
        this.$caption = this.$getLayoutNode("main", "caption", this.$ext);
        if (this.$caption.nodeType != 1) 
            this.$caption = this.$caption.parentNode;
        
        this.$ext.onmousedown = function(){
            if (forElement && forElement.$focussable && forElement.focussable)
                forElement.focus();
        }
        
        var _self = this;
        apf.addListener(this.$ext, "click", function(e) {
            if (!_self.disabled)
                _self.dispatchEvent("click", {htmlEvent: e});
        });
        
        apf.addListener(this.$ext, "mouseover", function(e) {
            if (!_self.disabled)
                _self.dispatchEvent("mouseover", {htmlEvent: e});
        });
        
        apf.addListener(this.$ext, "mouseout", function(e) {
            if (!_self.disabled)
                _self.dispatchEvent("mouseout", {htmlEvent: e});
        });
    };
    
    this.$childProperty = "caption";
    
}).call(apf.label.prototype = new apf.BaseSimple());

apf.aml.setElement("label", apf.label);


apf.colorbox = function(struct, tagName) {
    this.$init(tagName || "colorbox", apf.NODE_VISIBLE, struct);
};

(function(){
    var _self = this;
    
    this.$focussable = false;
    var forElement;
    
    
    
    /**
     * Sets the value of this element. This should be one of the values
     * specified in the values attribute.
     * @param {String} value The new value of this element
     */
    this.change = 
    this.setValue = function(value) {
        this.setProperty("value", value, false, true);
        this.dispatchEvent("afterchange", { value: value });
    };
    
    /**
     * Returns the current value of this element.
     * @return {String} The current value
     */
    this.getValue = function(){
        return this.value;
    }
    
    
    
    /** 
     * @attribute {String} caption Sets or gets the text displayed in the area defined by this 
     * element. Using the value attribute provides an alternative to using
     * the text using a text node.
     *
     */
    /**
     * @attribute {String} for Sets or gets the id of the element that receives the focus 
     * when the colorbox is clicked on.
     */
    /**
     * @attribute {String} textalign Sets or gets the text alignment value for the colorbox.
     */
    this.$supportedProperties.push("value");
    this.$propHandlers["value"] = function(value) {
        this.$input.value = value;
    };

    this.$draw = function(){
        //Build Main Skin
        this.$ext = this.$getExternal();
        this.$input = this.$getLayoutNode("main", "input", this.$ext);
        
        var _self = this;
        this.$input.onchange = function(){
            _self.change(this.value);
        }
    };
    
    this.$childProperty = "value";
    
}).call(apf.colorbox.prototype = new apf.BaseSimple());

apf.aml.setElement("colorbox", apf.colorbox);








/*
 * @private
 */
apf.WinServer = {
    count: 150000,
    wins: [],

    setTop: function(win, norecur) {
        if (win.zindex || win.modal) 
            return;
        
        if (win.$opened) {
            if (win.$opened.visible)
                return;
            else 
                delete win.$opened;
        }
        
        var topmost;
        if (!norecur && this.wins.length) {
            var topmost = this.wins[this.wins.length - 1];
            if (topmost == win)
                return;
            
            if (!topmost.modal || !topmost.visible)
                topmost = null;
            else if (topmost && win.modal) {
                win.$opener = topmost;
                topmost.$opened = win;
                topmost = null;
            }
        }
        
        this.count += 2;

        win.setProperty("zindex", this.count);
        this.wins.remove(win);
        this.wins.push(win);

        if (topmost)
            this.setTop(topmost, true);

        return win;
    },

    setNext: function(){
        if (this.wins.length < 2) return;
        var nwin, start = this.wins.shift();
        do {
            if (this.setTop(nwin || start).visible)
                break;
            nwin = this.wins.shift();
        } while (start != nwin);
    },

    setPrevious: function(){
        if (this.wins.length < 2) return;
        this.wins.unshift(this.wins.pop());
        var nwin, start = this.wins.pop();
        do {
            if (this.setTop(nwin || start).visible)
                break;
            nwin = this.wins.pop();
        } while (start != nwin);
    },

    remove: function(win) {
        this.wins.remove(win);
    }
}

/**
 * This element displays a skinnable, draggable window. It can be given
 * a minimum and miximum width and height, as well as keybindings and various buttons. 
 * 
 * 
 * #### Example
 * 
 * ```xml, demo
 * <a:application xmlns:a="http://ajax.org/2005/aml">
 *   <!-- startcontent -->
 *     <a:window 
 *       id = "winMail"
 *       buttons = "min|max|close"
 *       title = "Mail Message"
 *       visible = "true"
 *       resizable = "true"
 *       width = "500"
 *       modal = "true"
 *       height = "400"
 *       skin = "bk-window2">
 *       <a:vbox>
 *           <a:hbox margin="5px">
 *               <a:label for="to" caption="To:"/>
 *               <a:textbox id="to" margin="0 0 0 5" width="140" />
 *           </a:hbox>
 *           <a:hbox margin="5">
 *               <a:label for="subject" caption="Subject:" />
 *               <a:textbox id="subject" width="140" />
 *           </a:hbox>
 *           <a:textarea height="200" width="400"/>
 *       </a:vbox>
 *     </a:window>
 *   <!-- endcontent -->
 * </a:application> 
 * ```
 *
 * @class apf.window 
 * @define window
 * @container
 * @allowchild {elements}, {smartbinding}, {anyaml}
 *
 *
 * @author      Ruben Daniels (ruben AT ajax DOT org)
 * @version     %I%, %G%
 * @since       0.4
 *
 * @inherits apf.Presentation
 * @inheritsElsewhere apf.Transaction
 *
 */
 /**
 * @event show          Fires when the window is opened.
 */
 /**
 * @event close         Fires when the window is closed.
 */
 /**
 * 
 * @event editstart     Fires before the user edits the properties of this window. Used mostly for when this window is part of the portal.
 */
 /** 
  * @event editstop      Fires after the user edited the properties of this window. Used mostly for when this window is part of the portal.
 *  @cancelable   Prevents the edit panel from being closed.
 */
/**
 * @event statechange   Fires after the state of this window changed.
 * @param e {Object} The standard event object. The following properties are available:
 * 
 *   - `minimized` ([[Boolean]]):   Specifies whether the window is minimized.
 *   - `maximized` ([[Boolean]]):   Specifies whether the window is maximized.
 *   - `normal` ([[Boolean]]):      Specifies whether the window has it's normal size and position.
 *   - `edit` ([[Boolean]]):        Specifies whether the window is in the edit state.
 *   - `closed` ([[Boolean]]):      Specifies whether the window is closed.
 */
apf.toolwindow = function(struct, tagName) {
    this.$init(tagName || "toolwindow", apf.NODE_VISIBLE, struct);
};

apf.modalwindow = function(struct, tagName) {
    this.$init(tagName || "modalwindow", apf.NODE_VISIBLE, struct);
};

apf.AmlWindow = function(struct, tagName) {
    this.$init(tagName || "window", apf.NODE_VISIBLE, struct);
};

(function(){
    this.implement(
        apf.BaseStateButtons
    );

    this.$isWindowContainer = true;
    this.collapsedHeight = 30;
    this.canHaveChildren = 2;
    this.visible = false;
    this.showdragging = false;
    this.kbclose = false;
    this.$focussable = apf.KEYBOARD;
    this.$editableCaption = ["title"];

    // *** Public Methods *** //

    

    /**
     * Sets the title of the window.
     * @chainable
     * @param {String} caption The text of the title.
     */
    this.setTitle = function(caption) {
        this.setProperty("title", caption, false, true);
        return this;
    };

    /**
     * Sets the icon of the window.
     * @chainable
     * @param {String} icon The location of the image.
     */
    this.setIcon = function(icon) {
        this.setProperty("icon", icon, false, true);
        return this;
    };
    
    //For modal elements
    this.show = function(callback) {
        this.execAction = callback; //@todo Proper error handling??
        this.setProperty("visible", true, false, true);
        return this;
    }
    
    
    

    this.bringToFront = function(){
        apf.WinServer.setTop(this);
        return this;
    };

    // *** Properties and Attributes *** //

    this.$booleanProperties["modal"] = true;
    this.$booleanProperties["center"] = true;
    this.$booleanProperties["transaction"] = true;
    this.$booleanProperties["hideselects"] = true;
    this.$booleanProperties["showdragging"] = true;
    this.$booleanProperties["kbclose"] = true;
    this.$supportedProperties.push("title", "icon", "modal", "minwidth",
        "minheight", "hideselects", "center", "kbclose",
        "maxwidth", "maxheight", "showdragging", "transaction");

    /**
     * @attribute {Boolean} modal Specifies whether the window prevents access to the
     * layout below it.
     */
    this.$propHandlers["modal"] = function(value) {
        if (value) {
            if (this.visible)
                apf.plane.show(this.$ext, {
                    color: "black", 
                    opacity: this.cover && this.cover.getAttribute("opacity") || 0.5,
                    protect: this.$uniqueId,
                    customCover: this.cover || "",
                    zIndex: true,
                    zClass: "popup+"
                });
            this.$setStyleClass(this.$ext, "", ["relative"]);
        }
        else { 
            apf.plane.hide(this.$uniqueId);
            this.$setStyleClass(this.$ext, "relative");
        }
    };

    /**
     * @attribute {Boolean} center Centers the window relative to its parent's
     * containing rect when shown.
     */
    this.$propHandlers["center"] = function(value) {
        this.$ext.style.position = "absolute"; //@todo no unset
    };

    /**
     * @attribute {String} title Specifies the text of the title.
     */
    this.$propHandlers["title"] = function(value) {
        if (this.oTitle)
            this.oTitle.nodeValue = value;
    };

    /**
     * @attribute {String} icon Specifies the location of the image.
     */
    this.$propHandlers["icon"] = function(value) {
        if (!this.oIcon) return;

        this.oIcon.style.display = value ? "" : "none";
        apf.skins.setIcon(this.oIcon, value, this.iconPath);
    };
    
    this.$afterRender = function(){
        if (this.center && !this.left && !this.top && !this.right && !this.bottom && !this.anchors) {
            
            apf.layout.processQueue();
            
    
            var size = !this.$ext.offsetParent || this.$ext.offsetParent.tagName == "BODY"
                ? [apf.getWindowWidth(), apf.getWindowHeight()]
                : [this.$ext.offsetParent.offsetWidth, this.$ext.offsetParent.offsetHeight, 0, 0];
    
            if (size.length == 2) {
                size.push(document.documentElement.scrollLeft, 
                  document.documentElement.scrollTop);
            }
            
            //@todo it's better to add this to the layout queue
            this.$ext.style.left = (Math.max(0, ((
                size[0] - parseInt((this.width || this.$ext.offsetWidth) || 0))/2)) + size[2]) + "px";
            this.$ext.style.top = (Math.max(0, ((
                size[1] - parseInt(this.$ext.offsetHeight || 0))/3)) + size[3]) + "px";
        }            
        
        
        //@todo make widget a tagname and alias
        if (this.$amlLoaded && (this.model 
          || (!this.dockable || !this.aData) && !this.$isWidget 
          && this.localName != "toolwindow"))
            this.focus(false, {mouse:true});
        
        
        this.dispatchEvent("show");
    }
 
    var hEls = [], wasVisible;
    this.$propHandlers["visible"] = function(value) {
        if (apf.isTrue(value)){
            if (this.dispatchEvent("beforeshow") === false)
                return (this.visible = false);
            
            if (this.modal) {
                apf.plane.show(this.$ext, {
                    color: "black", 
                    opacity: this.cover && this.cover.getAttribute("opacity") || 0.5,
                    protect: this.$uniqueId,
                    customCover: this.cover || "",
                    zIndex: true,
                    zClass: "popup+"
                });
            }

            this.state = this.state.split("|").remove("closed").join("|");

            this.$ext.style.display = ""; //Some form of inheritance detection
            
            if (this.$rendered === false)
                this.addEventListener("afterrender", this.$afterRender);
            else
                this.$afterRender();
        }
        else { 
            if (this.modal)
                apf.plane.hide(this.$uniqueId);

            this.$ext.style.display = "none";

            if (this.hasFocus())
                apf.window.moveNext(true, this, true);//go backward to detect modals

            this.visible = false;
            
            this.dispatchEvent("hide");
        }
        
        
        if (apf.layout && this.$int)
            apf.layout.forceResize(this.$int); //@todo this should be recursive down
        

        wasVisible = value;
    };

    this.$propHandlers["zindex"] = function(value) {
        this.$ext.style.zIndex = value + 1;
    };

    // *** Keyboard *** //

    
    
    this.addEventListener("keydown", function(e) {
        var key = e.keyCode;
        var ctrlKey = e.ctrlKey;
        var shiftKey = e.shiftKey;

        /*if (key > 36 && key < 41) {
            if (this.hasFeature && this.hasFeature(apf.__ANCHORING__))
                this.$disableAnchoring();
        }*/

        var retValue = false;
        switch (key) {
            /*case 9:
                break;
            case 13:
                break;
            case 32:
                break;*/
            case 38:
            //UP
                if (shiftKey && this.resizable)
                    this.setProperty("height", Math.max(this.minheight || 0,
                        this.$ext.offsetHeight - (ctrlKey ? 50 : 10)));
                else if (this.draggable)
                    this.setProperty("top",
                        this.$ext.offsetTop - (ctrlKey ? 50 : 10));
                break;
            case 37:
            //LEFT
                if (shiftKey && this.resizable)
                    this.setProperty("width", Math.max(this.minwidth || 0,
                        this.$ext.offsetWidth - (ctrlKey ? 50 : 10)));
                else if (this.draggable)
                    this.setProperty("left",
                        this.$ext.offsetLeft - (ctrlKey ? 50 : 10));
                break;
            case 39:
            //RIGHT
                if (shiftKey && this.resizable)
                    this.setProperty("width", Math.min(this.maxwidth || 10000,
                        this.$ext.offsetWidth + (ctrlKey ? 50 : 10)));
                else if (this.draggable)
                    this.setProperty("left",
                        this.$ext.offsetLeft + (ctrlKey ? 50 : 10));
                break;
            case 40:
            //DOWN
                if (shiftKey && this.resizable)
                    this.setProperty("height", Math.min(this.maxheight || 10000,
                        this.$ext.offsetHeight + (ctrlKey ? 50 : 10)));
                else if (this.draggable)
                    this.setProperty("top",
                        this.$ext.offsetTop + (ctrlKey ? 50 : 10));
                break;
            default:
                retValue = null;
                return;
        }
        
        if (apf.hasSingleRszEvent)
            apf.layout.forceResize(this.$int);
        
        return retValue;
    }, true);
    
    this.addEventListener("keydown", function(e) {
        if (e.keyCode == 27 && this.buttons.indexOf("close") > -1 
          && (!this.dockable || !this.aData) && this.kbclose)
            this.close();
    });
    

    

    // *** Init *** //

    this.$draw = function(){
        this.popout = apf.isTrue(this.getAttribute("popout"));
        if (this.popout)
            this.$pHtmlNode = document.body;

        this.$ext = this.$getExternal(null, null, function(oExt) {
            this.$initButtons(oExt);
        });
        this.oTitle = this.$getLayoutNode("main", "title", this.$ext);
        this.oIcon = this.$getLayoutNode("main", "icon",  this.$ext);
        this.oDrag = this.$getLayoutNode("main", "drag",  this.$ext);
        this.$buttons = this.$getLayoutNode("main", "buttons",  this.$ext);
        this.cover = this.$getLayoutNode("cover");

        if (this.popout)
            this.$ext.style.position = "absolute";

        if (this.oIcon)
            this.oIcon.style.display = "none";

        
        
        var _self = this;
        if (this.oDrag) {
            this.oDrag.host = this;
            this.oDrag.onmousedown = function(e) {
                if (!e) e = event;
    
                //because of some issue I don't understand oExt.onmousedown is not called
                if (!_self.$isWidget && (!_self.aData || !_self.dockable || _self.aData.hidden == 3))
                    apf.WinServer.setTop(_self);
    
                if (_self.$lastState.maximized)
                    return false;
    
                
                if (_self.aData && _self.dockable) {
                    if (_self.$lastState.normal) //@todo
                        _self.startDocking(e);
                    return false;
                }
                
            };
        }

        this.$ext.onmousedown = function(){
            
            var p = apf.document.activeElement;
            if (p && p.$focusParent != _self && p.$focusParent.modal)
                return false;
            
            
            //Set ZIndex on oExt mousedown
            if (!_self.$isWidget && (!_self.aData || !_self.dockable || _self.aData.hidden == 3))
                apf.WinServer.setTop(_self);

            if (!_self.$lastState.normal)
                return false;
        }
        this.$ext.onmousemove = function(){
            if (!_self.$lastState.normal)
                return false;
        }
    };

    this.$loadAml = function(x) {
        apf.WinServer.setTop(this);

        this.$int = this.$getLayoutNode("main", "container", this.$ext);

        
            if (this.oTitle) {
                var _self = this;
                (this.oTitle.nodeType != 1
                  ? this.oTitle.parentNode
                  : this.oTitle).ondblclick = function(e) {
                    if (_self.state.indexOf("normal") == -1)
                        _self.restore();
                    else if (_self.buttons.indexOf("max") > -1)
                        _self.maximize();
                    else if (_self.buttons.indexOf("min") > -1)
                        _self.minimize();
                }
            }
    
            if (typeof this.draggable == "undefined") {
                (this.$propHandlers.draggable
                    || apf.GuiElement.propHandlers.draggable).call(this, true);
                this.draggable = true;
            }

            if (typeof this.buttons == "undefined")
                this.buttons = "";
                //this.setProperty("buttons", "min|max|close");
        

        if (this.modal === undefined) { 
            this.$propHandlers.modal.call(this, true);
            this.modal = true;
        }

        //Set default visible hidden
        if (!this.visible) {
            this.$ext.style.display = "none";
        }
        
        else if (this.modal) {
            var _self = this;
            apf.queue.add("focus", function(){
                _self.focus(false, {mouse:true});
            });
        }
        

        if (this.minwidth === undefined)
            this.minwidth = this.$getOption("Main", "min-width");
        if (this.minheight === undefined)
            this.minheight = this.$getOption("Main", "min-height");
        if (this.maxwidth === undefined)
            this.maxwidth = this.$getOption("Main", "max-width");
        if (this.maxheight === undefined)
            this.maxheight = this.$getOption("Main", "max-height");

        if (this.center && this.visible) {
            this.visible = false;
            this.$ext.style.display = "none"; /* @todo temp done for project */
            
            var _self = this;
            $setTimeout(function(){
                _self.setProperty("visible", true);
            });
        }
    };
    
    

    
    this.addEventListener("$skinchange", function(){
        if (this.title)
            this.$propHandlers["title"].call(this, this.title);

        if (this.icon)
            this.$propHandlers["icon"].call(this, this.icon);
    });
    

    this.$destroy = function(skinChange) {
        if (this.oDrag) {
            this.oDrag.host = null;
            this.oDrag.onmousedown = null;
            apf.destroyHtmlNode(this.oDrag);
            this.oDrag = null;
        }

        this.oTitle =  this.oIcon = null;

        if (this.$ext && !skinChange) {
            this.$ext.onmousedown = null;
            this.$ext.onmousemove = null;
        }
    };
}).call(apf.modalwindow.prototype = new apf.Presentation());

apf.AmlWindow.prototype = apf.toolwindow.prototype = apf.modalwindow.prototype;

apf.aml.setElement("toolwindow",  apf.toolwindow);
apf.aml.setElement("modalwindow", apf.modalwindow);
apf.aml.setElement("window",      apf.modalwindow);








/**
 * 
 * A notification element, which shows popups when events occur. Similar in concept
 * to [growl](http://growl.info/) on the OSX platform.
 * 
 * @class apf.notifier
 * @define notifier
 * @media
 * @inherits apf.Presentation
 * 
 * @version     %I%, %G% 
 * 
 * @allowchild event
 *
 */
/**
 * @attribute   {String}   position     Sets or gets the vertical and horizontal element's start
 *                                      position. The possible values include:
 *     - `"top-right"`:       the element is placed in top-right corner of browser window (this is the default)
 *     - `"top-left"`:        the element is placed in top-left corner of browser window
 *     - `"bottom-right"`:    the element is placed in bottom-right corner of browser window
 *     - `"bottom-left"`:     the element is placed in bottom-left corner of browser window
 *     - `"center-center"`:   the element is placed in the middle of browser window
 *     - `"right-top"`:       the element is placed in top-right corner of browser window
 *     - `"left-top"`:        the element is placed in top-left corner of browser window
 *     - `"right-bottom"`:    the element is placed in bottom-right corner of browser window
 *     - `"left-bottom"`:     the element is placed in bottom-left corner of browser window
 *     - `"center-center"`:   the element is placed in the middle of browser window
 */
/**
 * @attribute   {String}   margin       Defines the free space around a popup element.
 *                                      Defaults to '10 10 10 10' pixels
 */
/**
 * @attribute   {String|Number}   columnsize   Specifies the element's width and col width, where the
 *                                      element will be displayed. Defaults to 300px.
 */
/**
 * @attribute   {String}   [arrange="vertical"]      Sets or gets the how the popup elements are displayed, either rows (`"vertical"`)
 *                                      or columns (`"horizontal"`).
 */
/**
 * @attribute   {String}   [timeout=2]     After the timeout has passed, the popup
 *                                      disappears automatically. When the
 *                                      mouse is hovering over the popup, it doesn't
 *                                      disappears.
 */
/**
 * @attribute   {String}   onclick      An action executed after a user clicks
 *                                      on the notifier.
 * 
 */
apf.notifier = function(struct, tagName) {
    this.$init(tagName || "notifier", apf.NODE_VISIBLE, struct);
};

(function() {
    var _self = this;
    this.timeout = 2000;
    this.position = "top-right";
    this.columnsize = 300;
    this.arrange = "vertical";
    this.margin = "10 10 10 10";
    this.startPadding = 0;
    
    this.lastPos = null;
    this.showing = 0;
    this.sign = 1;

    this.$supportedProperties.push("margin", "position", "timeout",
        "columnsize", "arrange", "start-padding");

    this.$propHandlers["position"] = function(value) {
        this.lastPos = null;
    };
    
    this.$propHandlers["margin"] = function(value) {
        this.margin = value;
    };
    
    this.$propHandlers["start-padding"] = function(value) {
        this.startPadding = parseInt(value);
    };
    
    this.$propHandlers["timeout"] = function(value) {
        this.timeout = parseInt(value) * 1000;
    };
    
    function getPageScroll() {
        return [
            document.documentElement.scrollTop || document.body.scrollTop,
            document.documentElement.scrollLeft || document.body.scrollLeft
        ];
    }

    function getStartPosition(x, wh, ww, nh, nw, margin, startPadding) {
        var scrolled = getPageScroll();

        return [
             (x[0] == "top"
                 ? margin[0]
                 : (x[0] == "bottom"
                     ? wh - nh - margin[2]
                     : wh / 2 - nh / 2)) + scrolled[0] + startPadding,
             (x[1] == "left"
                 ? margin[3]
                 : (x[1] == "right"
                     ? ww - nw - margin[1]
                     : ww / 2 - nw / 2)) + scrolled[1]
        ];
    }

    /**
     * Creates a new notification popup.
     * 
     * @param {String}  [message=""]  The message content displayed in the popup element
     * @param {String}  [icon]     The path to the icon file ,relative to "icon-path" which
     *                           is set in the skin declaration
     * 
     */
    this.popup = function(message, icon, ev, persistent, callback) {
        if (!this.$ext)
            return;

        this.$ext.style.width = this.columnsize + "px";

        var _self = this,
            oNoti = this.$pHtmlNode.appendChild(this.$ext.cloneNode(true)),
            ww = window.innerWidth,
            wh = window.innerHeight,
        
            removed = false,

            oIcon = this.$getLayoutNode("notification", "icon", oNoti),
            oBody = this.$getLayoutNode("notification", "body", oNoti);
            oClose = this.$getLayoutNode("notification", "close", oNoti);

        this.showing++;

        if (oIcon && icon) {
            if (oIcon.nodeType == 1) {
                oIcon.style.backgroundImage = "url("
                + this.iconPath + icon + ")";
            }
            else {
                oIcon.nodeValue = this.iconPath + icon;
            }

            this.$setStyleClass(oNoti, this.$baseCSSname + "ShowIcon");
        }

        apf.buildDom(message || "[No message]", oBody);
        oNoti.style.display = "block";

        oClose.addEventListener("click", function(){
            hideWindow(null, true);
        });

        var margin = apf.getBox(this.margin || "0"),
            nh = oNoti.offsetHeight,
            nw = oNoti.offsetWidth,
            /* It's possible to set for example: position: top-right or right-top */
            x = this.position.split("-"),
            _reset = false;

        if (x[1] == "top" || x[1] == "bottom" || x[0] == "left" || x[0] == "right")
            x = [x[1], x[0]];
        /* center-X and X-center are disabled */
        if ((x[0] == "center" && x[1] !== "center") || (x[0] !== "center" && x[1] == "center"))
            x = ["top", "right"];

        /* start positions */
        if (!this.lastPos) {
            this.lastPos = getStartPosition(x, wh, ww, nh, nw, margin, this.startPadding);
            this.sign = 1;
            _reset = true;
        }

        if ((!_reset && x[0] == "bottom" && this.sign == 1) ||
           (x[0] == "top" && this.sign == -1)) {
            if (this.arrange == "vertical") {
                this.lastPos[0] += x[1] == "center"
                    ? 0
                    : this.sign * (x[0] == "top"
                        ? margin[0] + nh
                        : (x[0] == "bottom"
                            ? - margin[2] - nh
                            : 0));
            }
            else {
                this.lastPos[1] += x[0] == "center"
                    ? 0
                    : this.sign * (x[1] == "left"
                        ? margin[3] + nw
                        : (x[1] == "right"
                            ? - margin[1] - nw
                            : 0));
            }
        }

        /* reset to next line, first for vertical, second horizontal */
        var scrolled = getPageScroll();
        
        if (this.lastPos[0] > wh + scrolled[0] - nh || this.lastPos[0] < scrolled[0]) {
            this.lastPos[1] += (x[1] == "left"
                ? nw + margin[3]
                : (x[1] == "right"
                    ? - nw - margin[3]
                    : 0));
            this.sign *= -1;
            this.lastPos[0] += this.sign*(x[0] == "top"
                ? margin[0] + nh
                : (x[0] == "bottom"
                    ? - margin[2] - nh
                    : 0));
        }
        else if (this.lastPos[1] > ww + scrolled[1] - nw || this.lastPos[1] < scrolled[1]) {
            this.lastPos[0] += (x[0] == "top"
                ? nh + margin[0]
                : (x[0] == "bottom"
                    ? - nh - margin[0]
                    : 0));
            this.sign *= -1;
            this.lastPos[1] += x[0] == "center"
                ? 0
                : this.sign * (x[1] == "left"
                    ? margin[3] + nw
                    : (x[1] == "right"
                        ? - margin[1] - nw
                        : 0));
        }

        /* Start from begining if entire screen is filled */
        if (this.lastPos) {
            if ((this.lastPos[0] > wh + scrolled[0] - nh || this.lastPos[0] < scrolled[1])
              && this.arrange == "horizontal") {
                this.lastPos = getStartPosition(x, wh, ww, nh, nw, margin, this.startPadding);
                this.sign = 1;
            }
            if ((this.lastPos[1] > ww + scrolled[1] - nw || this.lastPos[1] < scrolled[1])
              && this.arrange == "vertical") {
                this.lastPos = getStartPosition(x, wh, ww, nh, nw, margin, this.startPadding);
                this.sign = 1;
            }
        }  

        oNoti.style.left = this.lastPos[1] + "px";
        oNoti.style.top = this.lastPos[0] + "px";

        if ((x[0] == "top" && this.sign == 1) || (x[0] == "bottom" && this.sign == -1)) {
            if (this.arrange == "vertical") {
                this.lastPos[0] += x[1] == "center"
                    ? 0
                    : this.sign * (x[0] == "top"
                        ? margin[0] + nh
                        : (x[0] == "bottom"
                            ? - margin[2] - nh
                            : 0));
            }
            else {
                this.lastPos[1] += x[0] == "center"
                    ? 0
                    : this.sign * (x[1] == "left"
                        ? margin[3] + nw
                        : (x[1] == "right"
                            ? - margin[1] - nw
                            : 0));
            }
        };

        var isMouseOver = false;

        apf.tween.css(oNoti, "fade", {
            anim: apf.tween.NORMAL,
            steps: 10,
            interval: 10,
            onfinish: function(container) {
                oNoti.style.filter = "";
                if (!persistent)
                    $setTimeout(hideWindow, _self.timeout)
            }
        });

        function hideWindow(e, force) {
            if (isMouseOver && !force)
                return;

            apf.tween.css(oNoti, "notifier_hidden", {
                anim: apf.tween.NORMAL,
                steps: 10,
                interval: 20,
                onfinish: function(container) {
                    if (callback) callback();
                    
                    _self.dispatchEvent("closed", {html: oNoti});

                    apf.setStyleClass(oNoti, "", ["notifier_hover"]);
                    if (isMouseOver && !force)
                        return;

                    if (oNoti.parentNode) {
                        if (oNoti.parentNode.removeChild(oNoti) && !removed) {
                            _self.showing--;
                            removed = true;
                        }
                    }

                    if (_self.showing == 0)
                        _self.lastPos = null;
                }
            });
        }

        /* Events */
        oNoti.onmouseover = function(e) {
            e = (e || event);
            var tEl = e.explicitOriginalTarget || e.toElement;
            if (isMouseOver)
                return;
            if (tEl == oNoti || apf.isChildOf(oNoti, tEl)) {
                apf.tween.css(oNoti, "notifier_hover", {
                    anim: apf.tween.NORMAL,
                    steps: 10,
                    interval: 20,
                    onfinish: function(container) {
                        apf.setStyleClass(oNoti, "", ["notifier_shown"]);
                    }
                });
                
                isMouseOver = true;
            }
        };

        oNoti.onmouseout = function(e) {
            e = (e || event);
            var tEl = e.explicitOriginalTarget || e.toElement;

            if (!isMouseOver || persistent)
                return;

            if (apf.isChildOf(tEl, oNoti) ||
               (!apf.isChildOf(oNoti, tEl) && oNoti !== tEl )) {
                isMouseOver = false;
                hideWindow();
            }
        };

        if (ev) {
            oNoti.onclick = function() {
                ev.dispatchEvent("click");
            };
        }
        
        oNoti.hideWindow = hideWindow;

        return oNoti;
    };

    // *** Init *** //

    this.$draw = function() {
        //Build Main Skin
        this.$pHtmlNode = document.body;
        
        this.$ext = this.$getExternal("notification");
        this.$ext.style.display = "none";
        this.$ext.style.position = "absolute";
        apf.window.zManager.set("notifier", this.$ext);
    };
}).call(apf.notifier.prototype = new apf.Presentation());

apf.aml.setElement("notifier", apf.notifier);
apf.aml.setElement("event", apf.event);









/**
 * This element graphically represents a percentage value which increases
 * automatically with time. 
 *
 * This element is most often used to show the progress
 * of a process. The progress can be either indicative or exact.
 * 
 * #### Example: A Simple Progressbar
 * 
 * ```xml, demo
 * <a:application xmlns:a="http://ajax.org/2005/aml">
 *   <!-- startcontent -->
 *   <a:progressbar 
 *     min = "0" 
 *     max = "100" 
 *     value = "40" 
 *     width = "300" />
 *   <!-- endcontent -->
 * </a:application>
 * ```
 *
 * #### Example: Progressbars with Varying Speeds
 * 
 * ```xml, demo
 * <a:application xmlns:a="http://ajax.org/2005/aml">
 *   <!-- startcontent -->
 *   <a:progressbar 
 *     id = "pb1"
 *     min = "0" 
 *     max = "100" 
 *     value = "40" 
 *     width = "300"><a:script>//<!--
 *     pb1.start();
 *   //--></a:script>
 *   </a:progressbar>
 * 
 *   <a:progressbar 
 *     id = "pb2"
 *     min = "0" 
 *     max = "100" 
 *     value = "40" 
 *     width = "300"><a:script>//<!--
 *     pb2.start(50);
 *   //--></a:script>
 *   </a:progressbar>
 * </a:application>
 * ```
 * 
 * #### Example: Dynmically Controlling the Progressbar
 * 
 * ```xml, demo
 * <a:application xmlns:a="http://ajax.org/2005/aml">
 *   <!-- startcontent -->
 *   <a:progressbar
 *     id = "pb3"
 *     min = "0"
 *     max = "100"
 *     value = "0"
 *     width = "300" />
 *   <a:table 
 *     columns = "80, 80, 80, 80"
 *     cellheight = "24" 
 *     margin = "15 0">
 *       <a:button onclick="pb3.start()">Start</a:button>
 *       <a:button onclick="pb3.pause()">Pause</a:button>
 *       <a:button onclick="pb3.stop()">Stop</a:button>
 *       <a:button onclick="pb3.clear()">Clear</a:button>
 *       <a:button onclick="pb3.enable()">Enable</a:button>
 *       <a:button onclick="pb3.disable()">Disable</a:button>
 *   </a:table>
 * </a:application>
 * ```
 * 
 * @class apf.progressbar
 * @define progressbar
 * @allowchild {smartbinding}
 *
 * @form
 * 
 * @author      Ruben Daniels (ruben AT ajax DOT org)
 * @version     %I%, %G%
 * @since       0.9
 */
/**
 * @binding value  Determines the way the value for the element is retrieved 
 * from the bound data.
 * 
 * #### Example
 * 
 * Sets the progress position based on data loaded into this component.
 * 
 * ```xml
 *  <a:model>
 *      <data progress="50"></data>
 *  </a:model>
 *  <a:progressbar min="0" max="100" value="[@progress]" />
 * ```
 *
 * A shorter way to write this is:
 * 
 * ```xml
 *  <a:model id="mdlProgress">
 *      <data progress="50"></data>
 *  </a:model>
 *  <a:progressbar value="[mdlProgress::@progress]" />
 * ```
 */
apf.progress = function(struct, tagName) {
    this.$init(tagName || "progress", apf.NODE_VISIBLE, struct);
};
apf.progressbar = function(struct, tagName) {
    this.$init(tagName || "progressbar", apf.NODE_VISIBLE, struct);
};

(function(){
    
    this.$focussable = false; // This object can get the focus

    // *** Properties and Attributes *** //

    this.value = 0;
    this.min = 0;
    this.max = 100;
    
    this.$running = false;
    this.$timer;

    /**
     * @attribute {Boolean} autostart Sets or gets whether the progressbar starts automatically.
     */
    /**
     * @attribute {Boolean} autohide  Sets or gets whether the progressbar hides when the progress is at 100%. Setting this to `true` hides the progressbar at start when autostart is not set to `true`.
     */
    this.$booleanProperties["autostart"] = true;
    this.$booleanProperties["autohide"] = true;

    this.$supportedProperties.push("value", "min", "max", "autostart", "autohide");
    
    /**
     * @attribute {String} value Sets or gets the position of the progressbar stated between 
     * the min and max value.
     */
    this.$propHandlers["value"] = function(value) {
        this.value = parseInt(value) || this.min;

        if (this.value >= this.max)
            apf.setStyleClass(this.$ext, this.$baseCSSname + "Complete", [this.$baseCSSname + "Running", this.$baseCSSname + "Half"]);
        else
            apf.setStyleClass(this.$ext, this.$baseCSSname + "Running", [this.$baseCSSname + "Complete"]);
            
        if (this.value >= this.max / 2)
            apf.setStyleClass(this.$ext, this.$baseCSSname + "Half", []);

        this.oSlider.style.width = (this.value * 100 / (this.max - this.min)) + "%"
        
        /*Math.max(0,
            Math.round((this.$ext.offsetWidth - 5)
            * (this.value / (this.max - this.min)))) + "px";*/

        this.oCaption.nodeValue =
            Math.round((this.value / (this.max - this.min)) * 100) + "%";
    };

    /**
     * @attribute {Number} min Sets or gets the minimum value the progressbar may have. This is
     * the value that the progressbar has when it is at its start position.
     */
    this.$propHandlers["min"] = function(value) {
        this.min = parseFloat(value);
    };

    /**
     * @attribute {Number} max Sets or gets the maximum value the progressbar may have. This is
     * the value that the progressbar has when it is at its end position.
     */
    this.$propHandlers["max"] = function(value) {
        this.max = parseFloat(value);
    };

    // *** Public Methods *** //

    

    /**
     * Sets the value of this element. This should be one of the values
     * specified in the `values` attribute.
     * @param {String} value The new value of this element
     */
    this.change = 
    this.setValue = function(value) {
        this.setProperty("value", value, false, true);
        this.dispatchEvent("afterchange", { value: value });
    };

    /**
     * Returns the current value of this element.
     * @return {String} The current value.
     */
    this.getValue = function(){
        return this.value;
    };
    
    

    /**
     * Resets the progress indicator.
     */
    this.clear = function(){
        this.$clear();
    };

    this.$clear = function(restart, restart_time) {
        clearInterval(this.$timer);
        this.setValue(this.min);
        //this.oSlider.style.display = "none";
        apf.setStyleClass(this.$ext, "", [this.$baseCSSname + "Running", this.$baseCSSname + "Complete"]);

        if (restart) {
            var _self = this;
            this.$timer = setInterval(function(){
                _self.start(restart_time);
            });
        }
        
        if (this.autohide)
            this.hide();
        
        this.$running = false;
    };

    /**
     * Starts the progress indicator.
     * @param {Number} start Sets or gets the time between each step in milliseconds.
     */
    this.start = function(time) {
        if (this.autohide)
            this.show();

        clearInterval(this.$timer);
        
        //if (this.value == this.max)
            //this.setValue(this.min + (this.max - this.min) * 0.5);
        
        //this.oSlider.style.display = "block";
        var _self = this;
        this.$timer = setInterval(function(){
            if (_self.$amlDestroyed)
                clearInterval(_self.$timer);
            else
                _self.$step();
        }, time || 1000);
        this.$setStyleClass(this.$ext, this.$baseCSSname + "Running");
    };

    /**
     * Pauses the progress indicator.
     */
    this.pause = function(){
        clearInterval(this.$timer);
    };

    /**
     * Stops the progress indicator from moving.
     * @param {Boolean} restart Specifies whether a `this.$timer` should start with a new indicative progress indicator.
     * @param {Number} [time=500] The internal (in milliseconds)
     * @param {Number} [restart_time] The time for the next restart to occur
     */
    this.stop = function(restart, time, restart_time) {
        clearInterval(this.$timer);
        this.setValue(this.max);
        
        var _self = this;
        this.$timer = setInterval(function(){
            _self.$clear(restart, (restart_time || 0));
        }, time || 500);
    };

    // *** Private methods *** //

    this.$step = function(){
        if (this.value == this.max) 
            return;
        
        this.setValue(this.value + 1);
    };

    // *** Init *** //

    this.$draw = function(clear, parentNode, Node, transform) {
        //Build Main Skin
        this.$ext = this.$getExternal();
        this.oSlider = this.$getLayoutNode("main", "progress", this.$ext);
        this.oCaption = this.$getLayoutNode("main", "caption", this.$ext);
    };

    this.$loadAml = function(x) {
        if (this.autostart)
           this.start();

        if (this.autohide)
            this.hide();
    };

}).call(apf.progressbar.prototype = new apf.StandardBinding());


apf.progress.prototype = apf.progressbar.prototype;

apf.aml.setElement("progress",    apf.progress);
apf.aml.setElement("progressbar", apf.progressbar);








/**
 * This element displays a two state button which is one of a grouped set.
 * Only one of these buttons in the set can be selected at the same time.
 * 
 * #### Example: Settings Groups
 *
 * ```xml, demo
 * <a:application xmlns:a="http://ajax.org/2005/aml">
 *  <a:table columns="100, 150" cellheight="20">
 *   <!-- startcontent -->
 *     <a:label>Options</a:label> 
 *     <a:label>Choices</a:label> 
 *     <a:radiobutton group="g2">Option 1</a:radiobutton> 
 *     <a:radiobutton group="g3">Choice 1</a:radiobutton> 
 *     <a:radiobutton group="g2">Option 2</a:radiobutton>
 *     <a:radiobutton group="g3">Choice 2</a:radiobutton>
 *   <!-- endcontent -->
 *  </a:table>
 * </a:application>
 * ```
 *
 * @class apf.radiobutton
 * @define radiobutton
 * @allowchild {smartbinding}
 *
 * @form
 * @inherits apf.Presentation
 *
 * @author      Ruben Daniels (ruben AT ajax DOT org)
 * @version     %I%, %G%
 * @since       0.4
 *
 */
/**
 * @binding value  Determines the way the value for the element is retrieved 
 * from the bound data.
 * 
 * #### Example
 *
 * Sets the selection based on data loaded into this component.
 * 
 * ```xml
 *  <a:radiobutton group="g2" bindings="bndExample" value="1">Choice 1</a:radiobutton>
 *  <a:radiobutton group="g2" value="2">Choice 2</a:radiobutton>
 *
 *  <a:bindings id="bndExample">
 *      <a:value match="[@value]" />
 *  </a:bindings>
 * ```
 *
 * A shorter way to write this is:
 *
 * ```xml
 *  <a:radiobutton group="g2" value="[@value]" value="1">Choice 1</a:radiobutton>
 *  <a:radiobutton group="g2" value="2">Choice 2</a:radiobutton>
 * ```
 *
 */
/**
 * @event click Fires when the user presses a mousebutton while over this element and then lets the mousebutton go. 
 * @see apf.AmlNode@afterchange
 */
apf.radiobutton = function(struct, tagName) {
    this.$init(tagName || "radiobutton", apf.NODE_VISIBLE, struct);
    
    /*this.$constructor = apf.radiobutton;
    var fEl = apf.aml.setElement("radiobutton", function(){
        this.$init(tagName || "radiobutton", apf.NODE_VISIBLE, struct);
    });
    fEl.prototype = apf.radiobutton.prototype;
    apf.radiobutton = fEl;*/
};

(function(){
    this.$childProperty = "label";
    
    this.$focussable = apf.KEYBOARD; // This object can get the focus
    
    // *** Properties and Attributes *** //

    this.$booleanProperties["selected"] = true;
    this.$supportedProperties.push("value", "background", "group",
        "label", "selected", "tooltip", "icon");

    /**
     * @attribute {String} group Sets or gets the name of the group to which this radio
     * button belongs. Only one item in the group can be selected at the same
     * time. 
     * When no group is specified the parent container functions as the
     * group; only one radiobutton within that parent can be selected.
     */
    this.$propHandlers["group"] = function(value) {
        if (!this.$ext)
            return;
        
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
        
        if (this.oInput)
            this.oInput.setAttribute("name", value);
        
        this.$group.$addRadio(this);
    };
    
    /**
     * @attribute {String} tooltip Sets or gets the tooltip of this radio button.
     */
    this.$propHandlers["tooltip"] = function(value) {
        this.$ext.setAttribute("title", value);
    };

    /**
     * @attribute {String} icon Sets or gets the icon for this radiobutton
     */
    this.$propHandlers["icon"] = function(value) {
        
        if (!this.oIcon) return;
        

        if (value)
            this.$setStyleClass(this.$ext, this.$baseCSSname + "Icon");
        else
            this.$setStyleClass(this.$ext, "", [this.$baseCSSname + "Icon"]);

        apf.skins.setIcon(this.oIcon, value, this.iconPath);
    };

    /**
     * @attribute {String} label Sets or gets the label for this radiobutton
     */
    this.$propHandlers["label"] = function(value) {
        if (value)
            this.$setStyleClass(this.$ext, "", [this.$baseCSSname + "Empty"]);
        else
            this.$setStyleClass(this.$ext, this.$baseCSSname + "Empty");
        
        if (this.oLabel)
            this.oLabel.textContent = value;
    };

    /**
     * @attribute {Boolean} selected Sets or gets  whether this radiobutton is the selected one in the group it belongs to.
     */
    this.$propHandlers["selected"] = function(value) {
        if (!this.$group)
            return;

        if (value)
            this.$group.setProperty("value", this.value);
        //else if (this.$group.value == this.value)
            //this.$group.setProperty("value", "");
    };
    
    this.addEventListener("prop.model", function(e) {
        if (this.$group)
            this.$group.setProperty("model", e.value);
    });

    /**
     * @attribute {String} background Sets a multistate background. The arguments
     * are seperated by pipes (`'|'`) and are in the order of: `'imagefilename|mapdirection|nrofstates|imagesize'`
     * 
     * {:multiStateDoc}
     *
     * 
     * #### Example
     * 
     * Here's a three state picture where each state is 16px high, vertically spaced:
     * 
     * ```xml
     * background="threestates.gif|vertical|3|16"
     * ```
     * @see apf.BaseButton
     */
    this.$propHandlers["background"] = function(value) {
        var oNode = this.$getLayoutNode("main", "background", this.$ext);
        if (value) {
            var b = value.split("|");
            this.$background = b.concat(["vertical", 2, 16].slice(b.length - 1));

            oNode.style.backgroundImage = "url(" + this.mediaPath + b[0] + ")";
            oNode.style.backgroundRepeat = "no-repeat";
        }
        else {
            oNode.style.backgroundImage = "";
            oNode.style.backgroundRepeat = "";
            this.$background = null;
        }
    };

    // *** Public methods *** //

    

    /**
     * Sets the value of this element. This should be one of the values
     * specified in the `values` attribute.
     * @param {String} value The new value of this element
     */
    this.change = 
    this.setValue = function(value) {
        this.setProperty("value", value, false, true);
        this.dispatchEvent("afterchange", { value: value });
    };

    /**
     * Returns the current value of this element.
     * @return {String} The current value
     */
    this.getValue = function(){
        return this.value;
    };
    
    this.select = function(){
        this.setProperty("selected", true, false, true);
    };
    
    /*this.uncheck = function(){
        this.setProperty("selected", false, false, true);
    }*/
    
    this.getGroup = function(){
        return this.$group;
    };
    
    

    /*
     * Sets the selected state and related value
     */
    this.$check = function(visually) {
        this.$setStyleClass(this.$ext, this.$baseCSSname + "Selected");
        this.selected = true;
        if (this.oInput)
            this.oInput.selected = true;
        this.doBgSwitch(2);
    };

    this.$uncheck = function(){
        this.$setStyleClass(this.$ext, "", [this.$baseCSSname + "Selected"]);
        this.selected = false;
        if (this.oInput)
            this.oInput.selected = false;
        this.doBgSwitch(1);
    };

    // *** Private methods *** //

    this.$enable = function(){
        if (this.oInput)
            this.oInput.disabled = false;

        var _self = this;
        this.$ext.onclick = function(e) {
            if (!e) e = event;
            if ((e.srcElement || e.target) == this)
                return;

            _self.dispatchEvent("click", {
                htmlEvent: e
            });
            _self.$group.change(_self.value);
        }

        this.$ext.onmousedown = function(e) {
            if (!e) e = event;
            if ((e.srcElement || e.target) == this)
                return;

            apf.setStyleClass(this, _self.$baseCSSname + "Down");
        }

        this.$ext.onmouseover = function(e) {
            if (!e) e = event;
            if ((e.srcElement || e.target) == this)
                return;

            apf.setStyleClass(this, _self.$baseCSSname + "Over");
        }

        this.$ext.onmouseout =
        this.$ext.onmouseup = function(){
            apf.setStyleClass(this, "", [_self.$baseCSSname + "Down", _self.$baseCSSname + "Over"]);
        }
    };

    this.$disable = function(){
        if (this.oInput)
            this.oInput.disabled = true;

        this.$ext.onclick = 
        this.$ext.onmousedown =
        this.$ext.onmouseover =
        this.$ext.onmouseout = 
        this.$ext.onmouseup = null;
    };

    /**
     * @private
     */
    this.doBgSwitch = function(nr) {
        if (this.bgswitch && (this.bgoptions[1] >= nr || nr == 4)) {
            if (nr == 4)
                nr = this.bgoptions[1] + 1;

            var strBG = this.bgoptions[0] == "vertical"
                ? "0 -" + (parseInt(this.bgoptions[2]) * (nr - 1)) + "px"
                : "-"   + (parseInt(this.bgoptions[2]) * (nr - 1)) + "px 0";

            this.$getLayoutNode("main", "background", this.$ext)
                .style.backgroundPosition = strBG;
        }
    };

    this.$focus = function(){
        if (!this.$ext)
            return;
        if (this.oInput && this.oInput.disabled)
            return false;

        this.$setStyleClass(this.$ext, this.$baseCSSname + "Focus");
    };

    this.$blur = function(){
        if (!this.$ext)
            return;
        this.$setStyleClass(this.$ext, "", [this.$baseCSSname + "Focus"]);
    };

    // *** Keyboard support *** //

    
    this.addEventListener("keydown", function(e) {
        var key = e.keyCode;

        if (key == 13 || key == 32) {
            //this.check();
            //this.$group.current = this;
            this.$group.change(this.value);
            return false;
        }
        //Up
        else if (key == 38) {
            var node = this;
            while (node && node.previousSibling) {
                node = node.previousSibling;
                if (node.localName == "radiobutton" && !node.disabled
                  && node.$group == this.$group) {
                    node.check();
                    node.focus();
                    return;
                }
            }
        }
        //Down
        else if (key == 40) {
            var node = this;
            while (node && node.nextSibling) {
                node = node.nextSibling;
                if (node.localName == "radiobutton" && !node.disabled
                  && node.$group == this.$group) {
                    node.check();
                    node.focus();
                    return;
                }
            }
        }
    }, true);
    

    // *** Init *** //

    this.$draw = function(){
        //Build Main Skin
        this.$ext = this.$getExternal();
        this.oInput = this.$getLayoutNode("main", "input", this.$ext);
        this.oLabel = this.$getLayoutNode("main", "label", this.$ext);
        this.oIcon = this.$getLayoutNode("main", "icon", this.$ext);

        if (this.oLabel && this.oLabel.nodeType != 1)
            this.oLabel = this.oLabel.parentNode;

        //Set events
        this.$enable();
    };

    this.$childProperty = "label";
    this.$loadAml = function(x) {
        if (this.group)
            this.$propHandlers["group"].call(this, this.group);
        
        else if (this.parentNode.localName == "group")
            this.$propHandlers["group"].call(this, this.parentNode);

        if (!this.$group) {
            this.$propHandlers["group"].call(this,
                "group" + this.parentNode.$uniqueId);
        }
    };
    
    this.$destroy = function(){
        if (this.$group)
            this.$group.$removeRadio(this);
    };
    
    
}).call(apf.radiobutton.prototype = new apf.Presentation());

apf.aml.setElement("radiobutton", apf.radiobutton);

/**
 * An element that defines groups for radio buttons.
 * 
 * #### Example
 *
 * This example shows radio buttons with an explicit group set:
 *
 * ```xml
 *  <a:label>Options</a:label>
 *  <a:radiobutton group="g1">Option 1</a:radiobutton>
 *  <a:radiobutton group="g1">Option 2</a:radiobutton>
 *
 *  <a:label>Choices</a:label>
 *  <a:group id="g2" value="[mdlForm::choice]">
 *      <a:radiobutton value="c1">Choice 1</a:radiobutton>
 *      <a:radiobutton value="c2">Choice 2</a:radiobutton>
 *  </a:group>
 * ```
 *
 * @class apf.group
 * @define group
 */
apf.$group = apf.group = function(struct, tagName) {
    this.$init(tagName || "group", apf.NODE_VISIBLE, struct);
    
    this.implement(
        apf.StandardBinding
    );

    var radiobuttons = [];

    this.$supportedProperties.push("value", "selectedItem");
    this.$propHandlers["value"] = function(value) {
        for (var i = 0; i < radiobuttons.length; i++) {
            if (radiobuttons[i].value == value) {
                return this.setProperty("selectedItem", radiobuttons[i]);
            }
        }
        return this.setProperty("selectedItem", null);
    };
    
    var lastSelected;
    this.$propHandlers["selectedItem"] = function(rb) {
        if (lastSelected)
            lastSelected.$uncheck();
        if (!rb)
            return;
            
        rb.$check();
        lastSelected = rb;
        
        for (var i = 0; i < radiobuttons.length; i++)
            radiobuttons[i].setProperty("selectedItem", rb);
    };

    this.$addRadio = function(rb) {
        var id = radiobuttons.push(rb) - 1;
        
        if (!rb.value)
            rb.setProperty("value", id);
        
        var _self = this;
        rb.addEventListener("prop.value", function(e) {
            if (this.selected)
                _self.setProperty("value", e.value);
            else if (_self.value == e.value)
                this.select();
        });
        
        if (this.value && rb.value == this.value)
            this.setProperty("selectedItem", rb);
        else if (rb.selected)
            this.setProperty("value", rb.value);
    };

    this.$removeRadio = function(rb) {
        radiobuttons.remove(rb);
        
        if (rb.value === rb.id)
            rb.setProperty("value", "");
        
        if (rb.selectedItem == rb)
            this.setProperty("value", null);
    };

    /**
     * Sets the current value of this element.
     */
    this.change = 
    this.setValue = function(value) {
        this.setProperty("value", value);
        this.dispatchEvent("afterchange", { value: value });
    };
    
    /**
     * Returns the current value of this element.
     * @return {String} The current value.
     */
    this.getValue = function(){
        return this.value;
    };

    this.$draw = function(){
        this.$ext = this.$int = this.$pHtmlNode;
    };
};
apf.$group.prototype = new apf.GuiElement();

apf.aml.setElement("group", apf.$group);













/**
 * This element specifies the skin of an application.
 *
 * For Cloud9, the skin is provided for you, and thus, you generally won't need
 * to provide a new skin for a piece of AML.
 * 
 * #### Example
 * 
 * ```xml
 * <a:skin src="perspex.xml"
 *  name = "perspex"
 *  media-path = "http://example.com/images"
 *  icon-path = "http://icons.example.com" />
 * ```
 *  
 * @class apf.skin
 * @inherits apf.AmlElement
 * @define skin
 * @layout
 * @allowchild  style, presentation
 *
 *
 * @author      Ruben Daniels (ruben AT ajax DOT org)
 * @version     %I%, %G%
 * @since  0.4
 */
/**
 * @attribute {String} name       Sets or gets the name of the skinset.
 */
/**
 * @attribute {String} src        Sets or gets the location of the skin definition.
 */
/**
 * @attribute {String} media-path Sets or gets the basepath for the images of the skin.
 */
/**
 * @attribute {String} icon-path  Sets or gets the basepath for the icons used in the elements using this skinset.
 */
apf.skin = function(struct, tagName) {
    this.$init(tagName || "skin", apf.NODE_HIDDEN, struct);
};
apf.aml.setElement("skin", apf.skin);

(function(){
    this.$includesRemaining = 0;
    
    this.$propHandlers["src"] = function(value) {
        apf.skins.Init(apf.getXml(value), this, this.$path);
    }
    
    //@todo use mutation events to update
    this.addEventListener("DOMNodeInsertedIntoDocument", function(e) {
        if (this.src || this.name)
            return;
        
        apf.skins.Init(this.$aml || this);
    });
}).call(apf.skin.prototype = new apf.AmlElement());









/** 
 * This element is used to choose a number via plus/minus buttons.
 *
 * When the plus button is clicked/held longer, the number increments faster. The same
 * situation occurs for the minus button. It's also possible to increment and decrement
 * value by moving mouse cursor up or down with clicked input. 
 * 
 * Max and min attributes define the range of allowed values.
 * 
 * #### Example: Setting Maximum and Minimum Ranges
 *
 * ```xml, demo
 * <a:application xmlns:a="http://ajax.org/2005/aml">
 *  <!-- startcontent -->
 *    <a:spinner value="6" min="-6" max="12" width="200"></a:spinner>
 *  <!-- endcontent -->
 * </a:application>
 * ```
 * 
 * #### Example: Loading Data
 * 
 * ```xml, demo
 * <a:application xmlns:a="http://ajax.org/2005/aml">
 *   <!-- startcontent -->
 *   <a:model id="mdlSpinner">
 *       <data value="56"></data>
 *   </a:model>
 *   <a:spinner value="[@value]" model="mdlSpinner" />
 *   <!-- endcontent -->
 * </a:application>
 * ```
 * 
 * #### Example: Connecting to a Textbox
 *
 * 
 * ```xml, demo
 * <a:application xmlns:a="http://ajax.org/2005/aml">
 *   <!-- startcontent -->
 *   <a:model id="mdlTest">
 *     <overview page="1" pages="10" />
 *   </a:model>
 *   <a:spinner 
 *     id = "spinner" 
 *     min = "0" 
 *     max = "[@pages]" 
 *     model = "mdlTest" 
 *     value = "[@page]" 
 *     caption = "[@page] of [@pages]">
 *   </a:spinner>
 *   <a:textbox value="{spinner.caption}"></a:textbox>
 *   <!-- endcontent -->
 * </a:application>
 * ```
 *
 * @class apf.spinner
 * @define spinner
 * @form
 * @version     %I%, %G%
 * 
 * @inherits apf.StandardBinding
 * @inheritsElsewhere apf.XForms
 *
 */
/**
 * @attribute {Number}   [max=64000]       Sets or gets the maximum allowed value
 */
/**
 * @attribute {Number}   [min=-64000]      Sets or gets the minimal allowed value
 */
/**
 *  @attribute {Number}   value     Sets or gets the actual value displayed in component
 * 
 */
/**
 * @binding value  Determines the way the value for the element is retrieved 
 * from the bound data.
 */
apf.spinner = function(struct, tagName) {
    this.$init(tagName || "spinner", apf.NODE_VISIBLE, struct);
    
    this.max = 64000;
    this.min = -64000;
    this.focused = false;
    this.value = 0;
    
    this.realtime = false;
};

(function() {
    this.$supportedProperties.push("width", "value", "max", "min", "caption", "realtime");

    this.$booleanProperties["realtime"] = true;

    this.$propHandlers["value"] = function(value) {
        value = parseInt(value) || 0;
        
        this.value = this.oInput.value = (value > this.max
            ? this.max
            : (value < this.min
                ? this.min
                : value));
    };

    this.$propHandlers["min"] = function(value) {
        if (!(value = parseInt(value))) return;
        this.min = value;
        if (value > this.value)
            this.change(value);
    };

    this.$propHandlers["max"] = function(value) {
        if (!(value = parseInt(value))) return;
        this.max = value;

        if (value < this.value)
            this.change(value);
    };

    /* ********************************************************************
     PUBLIC METHODS
     *********************************************************************/

    

    /**
     * Sets the value of this element. This should be one of the values
     * specified in the `values` attribute.
     * @param {String} value The new value of this element
     */
    this.change = 
    this.setValue = function(value) {
       this.setProperty("value", value, false, true); 
       this.dispatchEvent("afterchange", { value: value });
    };

    /**
     * Returns the current value of this element.
     * @return {String} The current element value
     */
    this.getValue = function() {
        return this.value;
    };

    /**
     * Increments the spinner by one.
     */
    this.increment = function() {
        this.change(parseInt(this.oInput.value) + 1);
    };

    /**
     * Decrements the spinner by one.
     */    
    this.decrement = function() {
        this.change(parseInt(this.oInput.value) - 1);
    };
    
    

    this.$enable = function() {
        this.oInput.disabled = false;
        this.$setStyleClass(this.oInput, "", ["inputDisabled"]);
    };

    this.$disable = function() {
        this.oInput.disabled = true;
        this.$setStyleClass(this.oInput, "inputDisabled");
    };

    this.$focus = function(e) {
        if (!this.$ext || this.focused) //this.disabled || 
            return;

        

        this.focused = true;
        this.$setStyleClass(this.$ext, this.$baseCSSname + "Focus");
        
        if (this.oLeft)
            this.$setStyleClass(this.oLeft, "leftFocus");
    };

    this.$blur = function(e) {
        if (!this.$ext && !this.focused)
            return;

        this.$setStyleClass(this.$ext, "", [this.$baseCSSname + "Focus"]);
        
        if (this.oLeft)
            this.$setStyleClass(this.oLeft, "" ["leftFocus"]);
        
        this.setProperty("value", this.oInput.value, false, false);
        
        this.focused = false;
    };

    /* ***********************
     Keyboard Support
     ************************/
    
    this.addEventListener("keydown", function(e) {
        var key = e.keyCode,

        keyAccess = (key < 8 || (key > 9 && key < 37 && key !== 12)
            || (key > 40 && key < 46) || (key > 46 && key < 48)
            || (key > 57 && key < 96) || (key > 105 && key < 109 && key !== 107)
            || (key > 109 && key !== 189));

        if (keyAccess)
            return false;
           
        switch(key) {
            case 38://Arrow up
                this.increment();
                break;
            case 40://Arrow down
                this.decrement();
                break;
        }
    }, true);

    this.addEventListener("keyup", function(e) {
        if (this.realtime)
            this.change(parseInt(this.oInput.value));
    }, true);
    
    /**
     * @event click     Fires when the user presses a mousebutton while over this element and then lets the mousebutton go. 
     */
    /**
     * @event mouseup   Fires when the user lets go of a mousebutton while over this element. 
     */
    /**
     * @event mousedown Fires when the user presses a mousebutton while over this element. 
     */
    this.$draw = function() {
        var _self = this;

        //Build Main Skin
        this.$ext = this.$getExternal(null, null, function(oExt) {
            oExt.setAttribute("onmousedown",
                'if (!this.host.disabled) \
                    this.host.dispatchEvent("mousedown", {htmlEvent : event});');
            oExt.setAttribute("onmouseup",
                'if (!this.host.disabled) \
                    this.host.dispatchEvent("mouseup", {htmlEvent : event});');
            oExt.setAttribute("onclick",
                'if (!this.host.disabled) \
                    this.host.dispatchEvent("click", {htmlEvent : event});');
        });

        this.$int = this.$getLayoutNode("main", "container",   this.$ext);
        this.oInput = this.$getLayoutNode("main", "input",       this.$ext);
        this.$buttonPlus = this.$getLayoutNode("main", "buttonplus",  this.$ext);
        this.$buttonMinus = this.$getLayoutNode("main", "buttonminus", this.$ext);
        this.oLeft = this.$getLayoutNode("main", "left", this.$ext);

        

        var timer,
            doc = (!document.compatMode || document.compatMode == 'CSS1Compat')
                ? document.html : document.body,
            z = 0;

        /* Setting start value */
        this.oInput.value = this.value;

        this.oInput.onmousedown = function(e) {
            if (_self.disabled)
                return;
            
            e = e || window.event;

            clearTimeout(timer);

            var newval,
                value = parseInt(this.value) || 0,
                step = 0,
                cy = e.clientY,
                ot = _self.$int.offsetTop, ol = _self.$int.offsetLeft,
                ow = _self.$int.offsetWidth, oh = _self.$int.offsetHeight,
                func = function() {
                    clearTimeout(timer);
                    timer = $setTimeout(func, 10);
                    if (!step)
                        return;

                    newval = value + step;
                    if (newval <= _self.max && newval >= _self.min) {
                        value += step;
                        value = Math.round(value);
                        _self.oInput.value = value;
                        
                        if (_self.realtime)
                            _self.change(value);
                    }
                    else {
                        _self.oInput.value = step < 0
                            ? _self.min
                            : _self.max;
                    }
                };
            func();

            function calcStep(e) {
                e = e || window.event;
                var x = e.pageX || e.clientX + (doc ? doc.scrollLeft : 0),
                    y = e.pageY || e.clientY + (doc ? doc.scrollTop  : 0),
                    nrOfPixels = cy - y;

                if ((y > ot && x > ol) && (y < ot + oh && x < ol + ow)) {
                    step = 0;
                    return;
                }

                step = Math.pow(Math.min(200, Math.abs(nrOfPixels)) / 10, 2) / 10;
                if (nrOfPixels < 0)
                    step = -1 * step;
            }
            
            document.onmousemove = calcStep;

            document.onmouseup = function(e) {
                clearTimeout(timer);

                var value = parseInt(_self.oInput.value);

                if (value != _self.value)
                    _self.change(value);
                document.onmousemove = document.onmouseup = null;
            };
        };

        /* Fix for mousedown for IE */
        var buttonDown = false;
        this.$buttonPlus.onmousedown = function(e) {
            if (_self.disabled)
                return;
            
            e = e || window.event;
            buttonDown = true;

            var value = (parseInt(_self.oInput.value) || 0) + 1,
                func = function() {
                    clearTimeout(timer);
                    timer = $setTimeout(func, 50);
                    z++;
                    value += Math.pow(Math.min(200, z) / 10, 2) / 10;
                    value = Math.round(value);

                    _self.oInput.value = value <= _self.max
                        ? value
                        : _self.max;
                    
                    if (_self.realtime)
                       _self.change(value <= _self.max ? value : _self.max);
                };

            apf.setStyleClass(this, "plusDown", ["plusHover"]);

            func();
        };

        this.$buttonMinus.onmousedown = function(e) {
            if (_self.disabled)
                return;
            
            e = e || window.event;
            buttonDown = true;

            var value = (parseInt(_self.oInput.value) || 0) - 1,
                func = function() {
                    clearTimeout(timer);
                    timer = $setTimeout(func, 50);
                    z++;
                    value -= Math.pow(Math.min(200, z) / 10, 2) / 10;
                    value = Math.round(value);

                    _self.oInput.value = value >= _self.min
                        ? value
                        : _self.min;
                    
                    if (_self.realtime)
                       _self.change(value >= _self.min ? value : _self.min);
                };

            apf.setStyleClass(this, "minusDown", ["minusHover"]);

            func();
        };

        this.$buttonMinus.onmouseout = function(e) {
            if (_self.disabled)
                return;
            
            clearTimeout(timer);
            z = 0;

            var value = parseInt(_self.oInput.value);

            if (value != _self.value)
                _self.change(value);

            apf.setStyleClass(this, "", ["minusHover"]);

            if (!_self.focused)
               _self.$blur(e);
        };

        this.$buttonPlus.onmouseout = function(e) {
            if (_self.disabled)
                return;
            
            clearTimeout(timer);
            z = 0;

            var value = parseInt(_self.oInput.value);

            if (value != _self.value)
                _self.change(value);

            apf.setStyleClass(this, "", ["plusHover"]);

            if (!_self.focused)
               _self.$blur(e);
        };

        this.$buttonMinus.onmouseover = function(e) {
            if (_self.disabled)
                return;
                
            apf.setStyleClass(this, "minusHover");
        };

        this.$buttonPlus.onmouseover = function(e) {
            if (_self.disabled)
                return;
                
            apf.setStyleClass(this, "plusHover");
        };

        this.$buttonPlus.onmouseup = function(e) {
            if (_self.disabled)
                return;
            
            e = e || event;
            //e.cancelBubble = true;
            apf.cancelBubble(e, this);

            apf.setStyleClass(this, "plusHover", ["plusDown"]);

            clearTimeout(timer);
            z = 0;

            var value = parseInt(_self.oInput.value);

            if (!buttonDown) {
                value++;
                _self.oInput.value = value;
            }
            else {
                buttonDown = false;
            }

            if (value != _self.value)
                _self.change(value);
        };

        this.$buttonMinus.onmouseup = function(e) {
            if (_self.disabled)
                return;
            
            e = e || event;
            //e.cancelBubble = true;
            apf.cancelBubble(e, this);

            apf.setStyleClass(this, "minusHover", ["minusDown"]);

            clearTimeout(timer);
            z = 0;

            var value = parseInt(_self.oInput.value);

            if (!buttonDown) {
                value--;
                _self.oInput.value = value;
            }
            else {
                buttonDown = false;
            }


            if (value != _self.value)
                _self.change(value);
        };

        this.oInput.onselectstart = function(e) {
            e = e || event;
            e.cancelBubble = true;
        };

        this.oInput.host = this;
    };

    this.$destroy = function() {
        this.oInput.onkeypress =
        this.oInput.onmousedown =
        this.oInput.onkeydown =
        this.oInput.onkeyup =
        this.oInput.onselectstart =
        this.$buttonPlus.onmouseover =
        this.$buttonPlus.onmouseout =
        this.$buttonPlus.onmousedown =
        this.$buttonPlus.onmouseup =
        this.$buttonMinus.onmouseover =
        this.$buttonMinus.onmouseout =
        this.$buttonMinus.onmousedown =
        this.$buttonMinus.onmouseup = null;
    };
    
    


}).call(apf.spinner.prototype = new apf.StandardBinding());


apf.aml.setElement("spinner", apf.spinner);









/**
 * This element displays a skinnable rectangle that can contain other
 * AML elements. 
 * 
 * It's used by other elements, such as the
 * toolbar and statusbar elements, to specify sections.
 *
 * ```xml, demo
 * <a:application xmlns:a="http://ajax.org/2005/aml">
 *  <a:window 
 *    visible = "true" 
 *    width = "400" 
 *    height = "150" 
 *    title = "Simple Tab" >
 *  <!-- startcontent -->
 *    <a:splitbutton id="btnTestRun" caption = "Run tests"/>
 *  <!-- endcontent -->
 *  </a:window>
 * </a:application>
 * ```
 * 
 * #### Remarks
 *
 * This component is used in the accordian element to create its sections. In
 * the statusbar, the panel element is an alias of `bar`.
 *
 * @class apf.splitbutton
 * @define splitbutton
 * @container
 * @allowchild button
 * @allowchild {elements}, {anyaml}
 *
 * @inherits apf.GuiElement
 *
 * @author      Ruben Daniels (ruben AT ajax DOT org)
 * @version     %I%, %G%
 * @since       0.4
 */
/**
 * @attribute {String} icon Sets or gets the url pointing to the icon image.
 */
/**
 * @attribute {Boolean} [collapsed=false]  Sets or gets collapse panel on load.
 */
/**
 * @attribute {String} title   Describes the content in a panel
 */
apf.splitbutton = function(struct, tagName) {
    this.$init(tagName || "splitbutton", apf.NODE_VISIBLE, struct);
};

(function(){
    this.$focussable = false;

    this.$booleanProperties["disabled-split"] = 1;
    //this.$supportedProperties.push("disabled-split", "button-skin");

    this.$propHandlers["caption"] = function(value) {
        this.$button1.setProperty("caption", value);
    };

    this.$propHandlers["icon"] = function(value) {
        this.$button1.setProperty("icon", value);
    };

    this.$propHandlers["tooltip"] = function(value) {
        this.$button1.setProperty("tooltip", value);
    };

    this.$propHandlers["hotkey"] = function(value) {
        this.$button1.setProperty("hotkey", value);
    };

    this.$propHandlers["disabled"] = function(value) {
        this.$button1.setProperty("disabled", value);
        this.$button2.setProperty("disabled", value);
    };

    this.$propHandlers["disabled-split"]= function(value) {
        this.$button2.setProperty("disabled", value);
    };

    this.$propHandlers["button-skin"] = function(value) {
        this.$button1.setProperty("skin", value);
        this.$button2.setProperty("skin", value);
    };

    this.$propHandlers["class"] = function(value) {
        apf.setStyleClass(this.$ext, value, this.$lastClassValue ? [this.$lastClassValue] : null);
        this.$lastClassValue = value;
    };

    this.$propHandlers["submenu"] = function(value) {
        this.$button2.setProperty("submenu", value);

        var _self = this;
        this.$button2.addEventListener("mousedown", function() {
            var menu = self[value] || value;
            
            if (!menu.$splitInited) {
                _self.dispatchEvent("submenu.init");
                menu.addEventListener("display", function(){
                    var split = this.opener.parentNode;
                    var diff = apf.getAbsolutePosition(split.$button2.$ext)[0]
                        - apf.getAbsolutePosition(split.$button1.$ext)[0];

                    this.$ext.style.marginLeft = ~this.$ext.className.indexOf("moveleft") 
                        ? 0
                        : "-" + diff + "px";
                });
                menu.$splitInited = true;
            }

            this.removeEventListener("mousedown", arguments.callee);
        });
    };

    this.$draw = function(){
        var _self = this;
        this.$ext = this.$pHtmlNode.appendChild(document.createElement("div"));
        this.$ext.className = "splitbutton";
        if (this.getAttribute("style"))
            this.$ext.setAttribute("style", this.getAttribute("style"));

        var skin = this["button-skin"] || this.getAttribute("skin") || this.localName;

        this.$button1 = new apf.button({
            htmlNode: this.$ext,
            parentNode: this,
            skinset: this.getAttribute("skinset"),
            skin: skin,
            "class": "main",
            onmouseover: function() {
                apf.setStyleClass(this.$ext, "primary");
                if (_self.$button2.disabled)
                    return;
                _self.$button2.$setState("Over", {});

                _self.dispatchEvent("mouseover", { button: this });
            },
            onmouseout: function() {
                apf.setStyleClass(this.$ext, "", ["primary"]);
                if (_self.$button2.disabled)
                    return;
                _self.$button2.$setState("Out", {});

                _self.dispatchEvent("mouseout", { button: this });
            },
            onmousedown: function() {
                _self.dispatchEvent("mousedown", { button: this });
            },
            onclick: function(e) {
                _self.dispatchEvent("click");
            }
        });

        this.$button2 = new apf.button({
            htmlNode: this.$ext,
            parentNode: this,
            skinset: this.getAttribute("skinset"),
            skin: skin,
            "class": "arrow",
            onmouseover: function() {
                apf.setStyleClass(this.$ext, "primary");
                _self.$button1.$setState("Over", {});

                _self.dispatchEvent("mouseover", { button: this });
            },
            onmouseout: function() {
                if (!_self.$button2.value) {
                    apf.setStyleClass(this.$ext, "", ["primary"]);
                    _self.$button1.$setState("Out", {});
                }
                else {
                    apf.setStyleClass(this.$ext, "primary");
                    _self.$button1.$setState("Over", {});
                }

                _self.dispatchEvent("mouseout", { button: this });
            },
            onmousedown: function() {
                _self.dispatchEvent("mousedown", { button: this });
            },
            onclick: function(e) {
                _self.dispatchEvent("split.click", e);
            }
        });
    };

    this.$loadAml = function(x) {

    };

}).call(apf.splitbutton.prototype = new apf.GuiElement());

apf.aml.setElement("splitbutton",  apf.splitbutton);






//@todo DOCUMENT the modules too


/**
 * This element displays a rectangular area which allows a
 * user to type information. 
 *
 * The information typed can be
 * restricted by using `this.$masking`. The information can also
 * be hidden from view when used in password mode. 
 *
 * By adding an 
 * autocomplete element as a child, the 
 * value for the textbox can be looked up as you type. By setting the 
 * {@link apf.textbox.mask mask attribute}, complex data input 
 * validation is done while the user types.
 *
 * #### Example: Simple Boxes
 *
 * ```xml, demo
 * <a:application xmlns:a="http://ajax.org/2005/aml">
 *  <a:table columns="150">
 *   <!-- startcontent -->
 *   <a:textbox value="Text"></a:textbox>
 *   <a:textbox value="Text" disabled="true" initial-message="I'm disabled!"></a:textbox>
 *   <!-- endcontent -->
 *  </a:table>
 * </a:application>
 * ```
 *
 * #### Example: Validation
 *
 * ```xml, demo
 * <a:application xmlns:a="http://ajax.org/2005/aml">
 *   <!-- startcontent -->
 *   <a:label for="lbl2">Please enter a minimum of three characters</a:label>
 *   <a:textbox 
 *     id = "lbl2"
 *     minlength = "3" 
 *     maxlength = "5" 
 *     invalidmsg = "Invalid! Please enter a minimum of three characters" />
 *     <a:label for="lbl3">Enter your email address</a:label>
 *   <a:textbox 
 *     id = "lbl3"
 *     datatype = "a:email" 
 *     invalidmsg = "Invalid! Please enter a proper email address" />
 *   <a:label 
 *     caption = "A US Phone Number" 
 *     for = "txt71">
 *   </a:label>
 *   <a:textbox 
 *     mask = "(000)0000-0000;;_" 
 *     id = "txt71" />
 *   <a:label 
 *     caption = "A Date"
 *     for = "txt73">
 *   </a:label>
 *   <a:textbox 
 *     mask = "00-00-0000;;_"
 *     datatype = "xsd:date"
 *     invalidmsg = "Invalid date; Please enter a correct date"
 *     id = "txt73" />
 *   <a:label 
 *     caption = "A MAC Address" 
 *     for = "txt75" ></a:label>
 *   <a:textbox 
 *     mask = "XX-XX-XX-XX-XX-XX;;_"
 *     id = "txt75" />
 *   <!-- endcontent -->
 * </a:application>
 * ```
 *
 * #### Example: A Regular Box
 *
 * ```xml, demo
 * <a:application xmlns:a="http://ajax.org/2005/aml">
 *     <!-- startcontent -->
 *     <a:bar id="winGoToFile"
 *       width = "500" 
 *       skin = "winGoToFile"
 *       minheight = "35"
 *       maxheight = "400">
 *         <a:vbox id="vboxGoToFile" edge="5 5 5 5" padding="5" anchors2="0 0 0 0">
 *             <a:textbox id="txtGoToFile" realtime="true" skin="searchbox_textbox" focusselect="true" />
 *             <a:list id="dgGoToFile"
 *               class = "searchresults noscrollbar"
 *               skin = "lineselect"
 *               maxheight = "350"
 *               scrollbar = "sbShared 32 7 7"
 *               viewport = "virtual"
 *               multiselect = "true"
 *               empty-message = "A filelist would go here.">
 *             </a:list>
 *         </a:vbox>
 *     </a:bar>
 *     <!-- endcontent -->
 * </a:application>
 * ```
 * 
 * @class apf.textbox
 * @define textbox
 * @allowchild autocomplete, {smartbinding}
 *
 * @form
 * @inherits apf.StandardBinding
 * @inheritsElsewhere apf.XForms
 *
 * @author      Ruben Daniels (ruben AT ajax DOT org)
 * @version     %I%, %G%
 * @since       0.1
 *
 *
 */
/**
 * @binding value  Determines the way the value for the element is retrieved 
 * from the bound data.
 * 
 * #### Example
 *
 * Sets the value based on data loaded into this component.
 * 
 * ```xml
 *  <a:model id="mdlTextbox">
 *      <data name="Lukasz"></data>
 *  </a:model>
 *  <a:textbox model="mdlTextbox" value="[@name]" />
 * ```
 *
 * A shorter way to write this is:
 * ```xml
 *  <a:model id="mdlTextbox">
 *      <data name="Lukasz"></data>
 *  </a:model>
 *  <a:textbox value="[mdlTextbox::@name]" />
 * ```
 *
 */
/**
 * @event click     Fires when the user presses a mousebutton while over this element and then let's the mousebutton go. 
 */
/**
 * @event mouseup   Fires when the user lets go of a mousebutton while over this element. 
 */
/**
 * @event mousedown Fires when the user presses a mousebutton while over this element. 
 */
/**
 * @event keyup     Fires when the user lets go of a keyboard button while this element is focussed. 
 * @param {Object} e The standard event object. It contains the following property:
 *  - keyCode ([[Number]]): which key was pressed. This is an ascii number.
 */
/**
 * @event clear     Fires when the content of this element is cleared. 
 */
apf.input = function(struct, tagName) {
    this.$init(tagName || "input", apf.NODE_VISIBLE, struct);
};

apf.secret = function(struct, tagName) {
    this.$init(tagName || "secret", apf.NODE_VISIBLE, struct);
};

apf.password = function(struct, tagName) {
    this.$init(tagName || "password", apf.NODE_VISIBLE, struct);
};

apf.textarea = function(struct, tagName) {
    this.$init(tagName || "textarea", apf.NODE_VISIBLE, struct);
    
    this.multiline = true;
};

// HTML5 email element
apf.email = function(struct, tagName) {
    this.$init(tagName || "email", apf.NODE_VISIBLE, struct);
};

apf.textbox = function(struct, tagName) {
    this.$init(tagName || "textbox", apf.NODE_VISIBLE, struct);
};

(function(){
    this.$focussable = true; // This object can get the focus
    this.$masking = false;
    this.$autoComplete = false;

    this.$childProperty = "value";

    //this.realtime = false;
    this.value = "";
    this.readonly = false;
    this.$isTextInput = true;
    this.multiline = false;

    /**
     * @attribute {Boolean} realtime Defines whether the value of the bound data is
     * updated as the user types it, or only when this element loses focus or
     * the user presses enter.
     */
    this.$booleanProperties["readonly"] = true;
    this.$booleanProperties["focusselect"] = true;
    this.$booleanProperties["realtime"] = true;
    this.$booleanProperties["kbclear"] = true;
    this.$supportedProperties.push("value", "mask", "initial-message",
        "focusselect", "realtime", "type", "rows", "cols", "kbclear");

    /**
     * @attribute {String} value Sets or gets the text of this element
     * 
     */
    this.$propHandlers["value"] = function(value, prop, force, initial) {
    // @todo apf3.0 check use of this.$propHandlers["value"].call
        if (!this.$input || !initial && this.getValue() == value)
            return;

        // Set Value
        if (!initial && !value && !this.hasFocus()) //@todo apf3.x research the use of clear
            return this.$clear();
        else if (this.isHTMLBox) {
            if (this.$input.textContent != value)
                this.$input.textContent = value;
        }
        else if (this.$input.value != value)
            this.$input.value = value;
        
        if (!initial)
            apf.setStyleClass(this.$ext, "", [this.$baseCSSname + "Initial"]);
        
        if (this.$button)
            this.$button.style.display = value && !initial ? "block" : "none";
    };

    //See validation
    //var oldPropHandler = this.$propHandlers["maxlength"];
    this.addEventListener("prop.maxlength", function(e) {
        //Special validation support using nativate max-length browser support
        if (this.$input.tagName.toLowerCase().match(/input|textarea/))
            this.$input.maxLength = parseInt(e.value) || null;
    });
    
    this.addEventListener("prop.editable", function(e) {
        if (e.value) 
            apf.addListener(this.$input, "mousedown", apf.preventDefault);
        else
            apf.removeListener(this.$input, "mousedown", apf.preventDefault);
    });

    /**
     * @attribute {String} mask Sets or gets a complex input pattern that the user should
     * adhere to. 
     * 
     * This is a string which is a combination of special and normal
     * characters. It is comma seperated, and thus has two options. The first option
     * specifies whether the non-input characters (the chars not typed by the
     * user) are in the value of this element. The second option specifies the
     * character that is displayed when the user hasn't yet filled in a
     * character.
     *
     *  The following characters are possible:
     *
     *   - `0`: any digit
     *   - `1`: the number 1 or 2.
     *   - `9`: any digit or a space.
     *   - `#`: user can enter a digit, space, plus or minus sign.
     *   - `L`: any alpha character, case insensitive.
     *   - `?`: any alpha character, case insensitive or space.
     *   - `A`: any alphanumeric character.
     *   - `a`: any alphanumeric character or space.
     *   - `X`: hexadecimal character, case insensitive.
     *   - `x`: hexadecimal character, case insensitive or space.
     *   - `&`: any whitespace.
     *   - `C`: any character.
     *   - `!`: causes the input mask to fill from left to right instead of from right to left.
     *   - `'`: the start or end of a literal part.
     *   - `"`: the start or end of a literal part.
     *   - `>`: converts all characters that follow to uppercase.
     *   - `<`: converts all characters that follow to lowercase.
     *   - `\`: cancel the special meaning of a character.
     * 
     * #### Example
     *
     * An American phone number:
     *
     * ```xml
     *  <a:textbox mask="(000)0000-0000;;_" />
     * ```
     * 
     * #### Example
     *
     * A Dutch postal code:
     *
     * ```xml
     *  <a:textbox mask="0000 AA;;_" />
     * ```
     * 
     * #### Example
     *
     * A date
     * 
     * ```xml
     *  <a:textbox mask="00-00-0000;;_" datatype="xsd:date" />
     * ```
     * 
     * #### Example
     *
     * A serial number
     * 
     * ```xml
     *  <a:textbox mask="'WCS74'0000-00000;1;_" />
     * ```
     * 
     * #### Example
     *
     * A MAC address
     * 
     * ```xml
     *  <a:textbox mask="XX-XX-XX-XX-XX-XX;;_" />
     * ```
     */
    this.$propHandlers["mask"] = function(value) {
        if (this.mask.toLowerCase() == "password")
            return;

        if (!value) {
            throw new Error("Not Implemented");
        }

        if (!this.$masking) {
            this.$masking = true;
            this.implement(apf.textbox.masking);
            this.focusselect = false;
            //this.realtime = false;
        }

        this.setMask(this.mask);
    };

    //this.$propHandlers["ref"] = function(value) {
    //    this.$input.setAttribute("name",  value.split("/").pop().split("::").pop()
    //        .replace(/[\@\.\(\)]*/g, ""));
    //};

    /**
     * @attribute {String} initial-message Sets or gets the message displayed by this element
     * when it doesn't have a value set. This property is inherited from parent
     * nodes. When none is found, it is looked for on the appsettings element.
     */
    this.$propHandlers["initial-message"] = function(value) {
        if (value) {
            
            
            //this.$propHandlers["value"].call(this, value, null, true);
        }
        
        if (!this.value)
            this.$clear(true);
            
        if (this.type == "password" && this.$inputInitFix) {
            this.$inputInitFix.textContent = value;
            apf.setStyleClass(this.$inputInitFix, "initFxEnabled");
        } 
    };

    /**
     * @attribute {Number} rows Sets or gets the row length for a text area.
     */
    this.$propHandlers["rows"] = function(value) {
        if (this.$input.tagName.toLowerCase() == "textarea" && value) {
            this.setProperty("rows", value);
            if (this.$ext) {
                this.$ext.rows = value;
            }
        }
    };

    /**
     * @attribute {Number} cols Sets or gets the column height for a text area.
     */
    this.$propHandlers["cols"] = function(value) {
        if (this.$input.tagName.toLowerCase() == "textarea" && value) {
            this.setProperty("cols", value);
            if (this.$ext) {
                this.$ext.cols = value;
            }            
        } 
    };
    
    /**
     * @attribute {Boolean} focusselect Sets or gets whether the text in this element is
     * selected when this element receives focus.
     */
    this.$propHandlers["focusselect"] = function(value) {
        var _self = this;
        this.$input.onmousedown = function(){
            _self.focusselect = false;
        };

        this.$input.onmouseup = 
        this.$input.onmouseout = function(){
            _self.focusselect = value;
        };
    };

    /**
     * @attribute {String} type Sets or gets the type or function this element represents.
     * This can be any arbitrary name, although there are some special values:
     *   
     *   - `"username"`: this element is used to type in the name part of login credentials.
     *   - `"password"`: this element is used to type in the password part of login credentials.
     */
    this.$propHandlers["type"] = function(value) {
        if (value && "password|username".indexOf(value) > -1
          && typeof this.focusselect == "undefined") {
            this.focusselect = true;
            this.$propHandlers["focusselect"].call(this, true);
        }
    };

    this.$isTextInput = function(e) {
        return true;
    };

    // *** Public Methods *** //

    

    /**
     * Sets the value of this element. This should be one of the values
     * specified in the `values` attribute.
     * @param {String} value The new value of this element
     */
    this.change = 
    this.setValue = function(value) {
        this.setProperty("value", value, false, true);
        this.dispatchEvent("afterchange", { value: value });
    };

    /**
     * Clears an element's value.
     */    
    this.clear = function(){
        this.setProperty("value", "");
    };
    
    //@todo cleanup and put initial-message behaviour in one location
    this.$clear = function(noEvent) {
        if (this["initial-message"]) {
            apf.setStyleClass(this.$ext, this.$baseCSSname + "Initial");
            this.$propHandlers["value"].call(this, this["initial-message"], null, null, true);
        }
        else {
            this.$propHandlers["value"].call(this, "", null, null, true);
        }
        
        if (!noEvent)
            this.dispatchEvent("clear");//@todo this should work via value change
    };

    /**
     * Returns the current value of this element.
     * @return {String} The current value.
     */
    this.getValue = function(){
        var v;
        
        if (this.isHTMLBox) 
            v = this.$input.innerText;
        else 
            v = this.$input.value;
            
        return v == this["initial-message"] ? "" : v.replace(/\r/g, "");
    };
    
    

    /**
     * Selects the text in this element.
     */
    this.select = function(){ 
        this.$input.select(); 
    };

    /**
     * Deselects the text in this element.
     */
    this.deselect = function(){this.$input.deselect();};

    /**** Private Methods *****/

    this.$enable = function(){this.$input.disabled = false;};
    this.$disable = function(){this.$input.disabled = true;};

    this.$insertData = function(str) {
        return this.setValue(str);
    };

    /**
     * @private
     */
    this.insert = function(text) {
        this.$input.value += text;
    };

    this.addEventListener("$clear", function(){
        this.value = "";//@todo what about property binding?
        
        if (this["initial-message"] && apf.document.activeElement != this) {
            this.$propHandlers["value"].call(this, this["initial-message"], null, null, true);
            apf.setStyleClass(this.$ext, this.$baseCSSname + "Initial");
        }
        else {
            this.$propHandlers["value"].call(this, "");
        }
        
        this.dispatchEvent("clear"); //@todo apf3.0
    });

    this.$keyHandler = function(key, ctrlKey, shiftKey, altKey, e) {
        if (this.$button && key == 27 && this.kbclear) {
            //this.$clear();
            if (this.value) {
                this.change("");
                
                this.dispatchEvent("keydown", {
                    keyCode: key,
                    ctrlKey: ctrlKey,
                    shiftKey: shiftKey,
                    altKey: altKey,
                    htmlEvent: e});
                
                e.stopPropagation();
            }
            //this.focus({mouse:true});
        }
        
        // Disabled this because it was being fired via the document as well
        // Tested using the gotoline plugin
        // if (this.dispatchEvent("keydown", {
        //     keyCode   : key,
        //     ctrlKey   : ctrlKey,
        //     shiftKey  : shiftKey,
        //     altKey    : altKey,
        //     htmlEvent : e}) === false)
        //         return false;
    };

    this.$registerElement = function(oNode) {
        if (!oNode) return;
        if (oNode.localName == "autocomplete")
            this.$autoComplete = oNode;
    };

    var fTimer;
    this.$focus = function(e) {
        if (!this.$ext || this.$ext.disabled)
            return;

        this.$setStyleClass(this.$ext, this.$baseCSSname + "Focus");

        var value = this.getValue();
        if (this["initial-message"] && !value) {
            this.$propHandlers["value"].call(this, "", null, null, true);
            apf.setStyleClass(this.$ext, "", [this.$baseCSSname + "Initial"]);
        }
        
        var _self = this;
        function delay(){
            try {
                if (!fTimer || document.activeElement != _self.$input) {
                    _self.$input.focus();
                }
                else {
                    clearInterval(fTimer);
                    return;
                }
            }
            catch (e) {}

            if (_self.$masking)
                _self.setPosition();

            if (_self.focusselect)
                _self.select();
        };

        delay();
    };

    this.$blur = function(e) {
        if (!this.$ext)
            return;
        
        if (!this.realtime)
            this.change(this.getValue());
    
        if (e)
            e.cancelBubble = true;

        this.$setStyleClass(this.$ext, "", [this.$baseCSSname + "Focus", "capsLock"]);

        var value = this.getValue();
        if (this["initial-message"] && !value) {
            this.$propHandlers["value"].call(this, this["initial-message"], null, null, true);
            apf.setStyleClass(this.$ext, this.$baseCSSname + "Initial");
        }

        try {
            if (!e || e.srcElement != apf.window)
                this.$input.blur();
        }
        catch (e) {}

        // check if we clicked on the oContainer. ifso dont hide it
        if (this.oContainer) {
            $setTimeout("var o = apf.lookup(" + this.$uniqueId + ");\
                o.oContainer.style.display = 'none'", 100);
        }
        
        clearInterval(fTimer);
    };

    // *** Init *** //

    this.$draw = function(){
        var _self = this,
            typedBefore = false;
        
        
        if (this.localName == "codeeditor") {
            this.skin = "textarea";
            this.$loadSkin();
        }
        
        
        //Build Main Skin
        this.$ext = this.$getExternal(null, null, function(oExt) {
            var mask = this.getAttribute("mask");

            if ((typeof mask == "string" && mask.toLowerCase() == "password")
              || "secret|password".indexOf(this.localName) > -1) {
                this.type = "password";
                this.$getLayoutNode("main", "input").setAttribute("type", "password");
            }
            
            

            oExt.setAttribute("onmousedown", "if (!this.host.disabled) \
                this.host.dispatchEvent('mousedown', {htmlEvent : event});");
            oExt.setAttribute("onmouseup",   "if (!this.host.disabled) \
                this.host.dispatchEvent('mouseup', {htmlEvent : event});");
            oExt.setAttribute("onclick",     "if (!this.host.disabled) \
                this.host.dispatchEvent('click', {htmlEvent : event});");
        });
        this.$input = this.$getLayoutNode("main", "input", this.$ext);
        this.$button = this.$getLayoutNode("main", "button", this.$ext);
        this.$inputInitFix = this.$getLayoutNode("main", "initialfix", this.$ext);
        
        if (this.type == "password")
            this.$propHandlers["type"].call(this, "password");

        if (!apf.hasContentEditable && "input|textarea".indexOf(this.$input.tagName.toLowerCase()) == -1) {
            var node = this.$input;
            this.$input = node.parentNode.insertBefore(document.createElement("textarea"), node);
            node.parentNode.removeChild(node);
            this.$input.className = node.className;
            if (this.$ext == node)
                this.$ext = this.$input;
        }
        
        if (this.$button) {
            this.$button.onmouseup = function(){
                _self.$clear(); //@todo why are both needed for doc filter
                _self.change(""); //@todo only this one should be needed
                _self.focus({mouse:true});
            }
        }

        //@todo for skin switching this should be removed
        if (this.$input.tagName.toLowerCase() == "textarea") {
            this.addEventListener("focus", function(e) {
                //if (this.multiline != "optional")
                    //e.returnValue = false
            });
        }
        
        this.$input.onselectstart = function(e) {
            if (!e) e = event;
            e.cancelBubble = true;
        }
        this.$input.host = this;

        this.$input.onkeydown = function(e) {
            e = e || window.event;
            
            if (this.host.disabled) {
                e.returnValue = false;
                return false;
            }

            //Change
            if (!_self.realtime) {
                var value = _self.getValue();
                if (e.keyCode == 13 && value != _self.value)
                    _self.change(value);
            }
            else if (apf.isWebkit && _self.xmlRoot && _self.getValue() != _self.value) //safari issue (only old??)
                $setTimeout("var o = apf.lookup(" + _self.$uniqueId + ");\
                    o.change(o.getValue())");

            if (_self.readonly 
              || (!_self.multiline || _self.multiline == "optional") && e.keyCode == 13 && !e.shiftKey
              || e.ctrlKey && (e.keyCode == 66 || e.keyCode == 73
              || e.keyCode == 85)) {
                e.returnValue = false;
                return false;
            }

            if (typedBefore && this.getAttribute("type") == "password" && this.value != "") {
                var hasClass = (_self.$ext.className.indexOf("capsLock") > -1),
                    capsKey = (e.keyCode === 20);
                if (capsKey) // caps off
                    apf.setStyleClass(_self.$ext, hasClass ? null : "capsLock", hasClass ? ["capsLock"] : null);
            }

            //Autocomplete
            if (_self.$autoComplete || _self.oContainer) {
                var keyCode = e.keyCode;
                $setTimeout(function(){
                    if (_self.$autoComplete)
                        _self.$autoComplete.fillAutocomplete(keyCode);
                    else
                        _self.fillAutocomplete(keyCode);
                });
            }

            //Non this.$masking
            if (!_self.mask) {
                return _self.$keyHandler(e.keyCode, e.ctrlKey,
                    e.shiftKey, e.altKey, e);
            }
        };

        this.$input.onkeyup = function(e) {
            if (!e)
                e = event;
                
            if (this.host.disabled)
                return false;

            var keyCode = e.keyCode;
            
            if (_self.$button)
                _self.$button.style.display = _self.getValue() ? "block" : "none";

            if (_self.realtime) {
                $setTimeout(function(){
                    var v;
                    if (!_self.mask && (v = _self.getValue()) != _self.value)
                        _self.change(v); 
                });
            }
            
            if (_self.isValid && _self.isValid() && e.keyCode != 13 && e.keyCode != 17)
                _self.clearError();
            
        };

        

        if (apf.hasAutocompleteXulBug)
            this.$input.setAttribute("autocomplete", "off");

        if ("INPUT|TEXTAREA".indexOf(this.$input.tagName) == -1) {
            this.isHTMLBox = true;

            this.$input.unselectable = "Off";
            this.$input.contentEditable = true;
            //this.$input.style.width = "1px";

            this.$input.select = function(){
                var r = document.createRange();
                r.setStart(_self.$input.firstChild || _self.$input, 0);
                var lastChild = _self.$input.lastChild || _self.$input;
                r.setEnd(lastChild, lastChild.nodeType == 1
                    ? lastChild.childNodes.length
                    : lastChild.nodeValue.length);
                
                var s = window.getSelection();
                s.removeAllRanges();
                s.addRange(r);
            }
            
            this.$input.onpaste = function(e) {
                if (e.clipboardData.types.indexOf("text/html") == -1)
                    return;
                    
                var sel = window.getSelection();
                var range = sel.getRangeAt(0);
                
                setTimeout(function(){
                    var range2 = sel.getRangeAt(0);
                    range2.setStart(range.startContainer, range.startOffset);
                    var c = range2.cloneContents();
                    range2.deleteContents();
                    
                    var d = document.body.appendChild(document.createElement("div")); 
                    d.appendChild(c); 
                    var p = d.innerText;
                    
                    if (!_self.multiline)
                        p = p.replace(/([\r\n])/g, "");
                    
                    d.parentNode.removeChild(d);
                    
                    range2.insertNode(document.createTextNode(p));
                });
            };
        };

        this.$input.deselect = function(){
            if (!document.selection) return;

            var r = document.selection.createRange();
            r.collapse();
            r.select();
        };

        var f;
        apf.addListener(this.$input, "keypress", f = function(e) {
            if (_self.$input.getAttribute("type") != "password")
                return apf.removeListener(_self.$input, "keypress", f);
            e = e || window.event;
            // get key pressed
            var which = -1;
            if (e.which)
                which = e.which;
            else if (e.keyCode)
                which = e.keyCode;

            // get shift status
            var shift_status = false;
            if (e.shiftKey)
                shift_status = e.shiftKey;
            else if (e.modifiers)
                shift_status = !!(e.modifiers & 4);

            if (((which >= 65 && which <=  90) && !shift_status) ||
                ((which >= 97 && which <= 122) && shift_status)) {
                // uppercase, no shift key
                apf.setStyleClass(_self.$ext, "capsLock");
            }
            else {
                apf.setStyleClass(_self.$ext, null, ["capsLock"]);
            }
            typedBefore = true;
        });
    };

    this.$loadAml = function() {
        if (typeof this["initial-message"] == "undefined")
            this.$setInheritedAttribute("initial-message");

        if (typeof this.realtime == "undefined")
            this.$setInheritedAttribute("realtime");
    }

    this.addEventListener("DOMNodeRemovedFromDocument", function(){
        if (this.$button)
            this.$button.onmousedown = null;
        
        if (this.$input) {
            this.$input.onkeypress = 
            this.$input.onmouseup = 
            this.$input.onmouseout = 
            this.$input.onmousedown = 
            this.$input.onkeydown = 
            this.$input.onkeyup = 
            this.$input.onselectstart = null;
        }
    });

}).call(apf.textbox.prototype = new apf.StandardBinding());


apf.config.$inheritProperties["initial-message"] = 1;
apf.config.$inheritProperties["realtime"] = 1;

apf.input.prototype = 
apf.secret.prototype = 
apf.password.prototype =
apf.textarea.prototype =
apf.email.prototype = apf.textbox.prototype;

apf.aml.setElement("input",    apf.input);
apf.aml.setElement("secret",   apf.secret);
apf.aml.setElement("password", apf.password);
apf.aml.setElement("textarea", apf.textarea);
apf.aml.setElement("textbox",  apf.textbox);








/**
 * This element displays a bar containing buttons and other AML elements.
 * 
 * This element is usually positioned in the top of an application allowing
 * the user to choose from grouped buttons.
 *
 * #### Example
 *
 * ```xml, demo
 * <a:application xmlns:a="http://ajax.org/2005/aml">
 *  <a:window 
 *    id = "winMail"
 *    contextmenu = "fileMenu"
 *    width = "300"
 *    height = "200" 
 *    visible = "true"
 *    resizable = "true" 
 *    title = "An App">
 *  <!-- startcontent -->
 *      <a:toolbar>
 *          <a:menubar>
 *              <a:button submenu="fileMenu">File</a:button>
 *              <a:button submenu="editMenu">Edit</a:button>
 *          </a:menubar>
 *      </a:toolbar>
 * 
 *     <a:menu id="editMenu">
 *          <a:item>About us</a:item>
 *          <a:item>Help</a:item>
 *      </a:menu>
 *      <a:menu id="fileMenu">
 *          <a:item icon="email.png">Tutorials</a:item>
 *          <a:item>Live Helps</a:item>
 *          <a:divider></a:divider>
 *          <a:item>Visit Ajax.org</a:item>
 *          <a:item>Exit</a:item>
 *      </a:menu>
 *  <!-- endcontent -->
 *  </a:window>
 * </a:application>
 * ```
 *
 * @class apf.toolbar
 * @define toolbar
 * @container
 *
 * @allowchild bar, menubar
 *
 * @author      Ruben Daniels (ruben AT ajax DOT org)
 * @version     %I%, %G%
 * @since       0.4
 *
 * @inherits apf.Presentation
 */

apf.toolbar = function(struct, tagName) {
    this.$init(tagName || "toolbar", apf.NODE_VISIBLE, struct);
};

(function(){
    this.$focussable = false;
    
    // *** DOM Hooks *** //
    
    
    // *** Init *** //

    this.$draw = function(){
        //Build Main Skin
        this.$ext = this.$getExternal();
        this.$int = this.$getLayoutNode("main", "container", this.$ext);
    };
}).call(apf.toolbar.prototype = new apf.Presentation());

apf.aml.setElement("toolbar", apf.toolbar);




/**
 * @constructor
 * @private
 */
apf.textbox.masking = function(){
    /*
        Special Masking Values:
        - PASSWORD
        
        <a:Textbox name="custref" mask="CS20999999" maskmsg="" validation="/CS200[3-5]\d{4}/" invalidmsg="" bind="custref/text()" />
    */
    
    var _FALSE_ = 9128748732;

    var _REF = {
        "0" : "\\d",
        "1" : "[12]",
        "9" : "[\\d ]",
        "#" : "[\\d +-]",
        "L" : "[A-Za-z]",
        "?" : "[A-Za-z ]",
        "A" : "[A-Za-z0-9]",
        "a" : "[A-Za-z0-9 ]",
        "X" : "[0-9A-Fa-f]",
        "x" : "[0-9A-Fa-f ]",
        "&" : "[^\s]",
        "C" : "."
    };
    
    var lastPos = -1;
    var masking = false;
    var oInput = this.$input;
    var pos = [];
    var initial, myvalue, format, fcase, replaceChar;

    this.setPosition = function(setpos) {
        setPosition(setpos || lastPos || 0);
    };

    this.addEventListener("$clear", function(){
        this.value = "";
        if (this.mask) 
            return this.setValue("");
    });
    
    this.$propHandlers["value"] = function(value) {
        var data = "";
        if (this.includeNonTypedChars) {
            for (var i = 0; i < initial.length; i++) {
                if (initial.substr(i, 1) != value.substr(i, 1))
                    data += value.substr(i, 1);//initial.substr(i,1) == replaceChar
            }
        }

        this.$insertData(data || value);
        setPosition(myvalue.length);
    };
    
    //Char conversion
    var numpadKeys = {
        "96": "0",
        "97": "1",
        "98": "2",
        "99": "3",
        "100": "4",
        "101": "5",
        "102": "6",
        "103": "7",
        "104": "8",
        "105": "9",
        "106": "*",
        "107": "+",
        "109": "-",
        "110": ".",
        "111": "/"
    };
    
    this.addEventListener("keydown", function(e) {
        var key = e.keyCode,
            stop = false;

        switch (key) {
            case 39:
                //RIGHT
                setPosition(lastPos + 1);
                stop = true;
                break;
            case 37:
                //LEFT
                setPosition(lastPos - 1);
                stop = true;
                break;
            case 35:
            case 34:
                setPosition(myvalue.length);
                stop = true;
                break;
            case 33:
            case 36:
                setPosition(0);
                stop = true;
                break;
            case 8:
                //BACKSPACE
                deletePosition(lastPos - 1);
                setPosition(lastPos - 1);
                stop = true;
                break;
            case 46:
                //DEL
                deletePosition(lastPos);
                setPosition(lastPos);
                stop = true;
                break;
            default:
                if (key == 67 && e.ctrlKey) {
                    window.clipboardData.setData("Text", this.getValue());  
                    stop = true;
                }
            break;
        }

        //@todo why isnt the conversion not always good? Check backtick.
        var chr = numpadKeys[key] || String.fromCharCode(key);
        if (setCharacter(chr))
            setPosition(lastPos + 1);

        var value, pos = lastPos;
        if (this.realtime && (value = this.getValue()) != this.value) {
            this.change(value);
            setPosition(pos);
        }

        if (apf.isCharacter(e.keyCode) || stop)
            return false;
    }, true);
    
    /* ***********************
            Init
    ************************/
    
    this.$initMasking = function(){
        ///this.keyHandler = this._keyHandler;
        this.$keyHandler = null; //temp solution
        masking = true;

        this.$input[apf.isIphone ? "onclick" : "onmouseup"] = function(e) {
            var pos = Math.min(calcPosFromCursor(), myvalue.length);
            setPosition(pos);
            return false;
        };
        
        this.$input.onpaste = function(e) {
            e = e || window.event;
            e.returnValue = false;
            this.host.setValue(window.clipboardData.getData("Text") || "");
            //setPosition(lastPos);
            $setTimeout(function(){
                setPosition(lastPos);
            }, 1); //HACK good enough for now...
        };
        
        this.getValue = function(){
            if (this.includeNonTypedChars)
                return initial == this.$input.value
                    ? "" 
                    : this.$input.value.replace(new RegExp(replaceChar, "g"), "");
            else
                return myvalue.join("");
        };
        
        this.setValue = function(value) {
            this.$propHandlers["value"].call(this, value);
        };
    };
    
    this.setMask = function(m) {
        if (!masking)
            this.$initMasking();
        
        m = m.split(";");
        replaceChar = m.pop();
        this.includeNonTypedChars = parseInt(m.pop(), 10) !== 0;
        var mask = m.join(""); //why a join here???
        var validation = "";
        var visual = "";
        var mode_case = "-";
        var strmode = false;
        var startRight = false;
        var chr;
        pos = [];
        format = "";
        fcase = "";
        
        for (var looppos = -1, i = 0; i < mask.length; i++) {
            chr = mask.substr(i, 1);
            
            if (!chr.match(/[\!\'\"\>\<\\]/)) {
                looppos++;
            }
            else {
                if (chr == "!")
                    startRight = true;
                else if (chr == "<" || chr == ">")
                    mode_case = chr;
                else if (chr == "'" || chr == "\"")
                    strmode = !strmode;
                continue;
            }
            
            if (!strmode && _REF[chr]) {
                pos.push(looppos);
                visual     += replaceChar;
                format     += chr;
                fcase      += mode_case;
                validation += _REF[chr];
            }
            else
                visual += chr;
        }

        this.$input.value = visual;
        initial = visual;
        //pos = pos;
        myvalue = [];
        //format = format;
        //fcase = fcase;
        replaceChar = replaceChar;
        
        //setPosition(0);//startRight ? pos.length-1 : 0);
        
        //validation..
        //forgot \ escaping...
    };
    
    function checkChar(chr, p) {
        var f = format.substr(p, 1);
        var c = fcase.substr(p, 1);

        if (chr.match(new RegExp(_REF[f])) == null)
            return _FALSE_;
        if (c == ">")
            return chr.toUpperCase();
        if (c == "<")
            return chr.toLowerCase();
        return chr;
    }

    function setPosition(p) {
        if (p < 0)
            p = 0;

        if (typeof pos[p] == "undefined") {
            oInput.selectionStart = oInput.selectionEnd = pos[pos.length - 1] + 1;
            lastPos = pos.length;
            return false;
        }
        oInput.selectionStart = pos[p];
        oInput.selectionEnd = pos[p] + 1;

        lastPos = p;
    }
    
    function setCharacter(chr) {
        if (pos.length && pos[lastPos] == null)
            return false;
        
        chr = checkChar(chr, lastPos);
        if (chr == _FALSE_)
            return false;

        var val = oInput.value;
        var start = oInput.selectionStart;
        var end = oInput.selectionEnd;
        oInput.value = val.substr(0, start) + chr + val.substr(end);
        oInput.selectionStart = start;
        oInput.selectionEnd = end;
        
        myvalue[lastPos] = chr;
        
        return true;
    }
    
    function deletePosition(p) {
        if (pos[p] == null)
            return false;
        
        var val = oInput.value;
        var start = pos[p];
        var end = pos[p] + 1;
        oInput.value = val.substr(0, start) + replaceChar + val.substr(end);
        oInput.selectionStart = start;
        oInput.selectionEnd = end;
        
        //ipv lastPos
        myvalue[p] = " ";
    }
    
    this.$insertData = function(str) {
        if (str == this.getValue())
            return;

        var i, j;
        
        try {
            if (oInput.selectionStart == oInput.selectionEnd)
                setPosition(0); // is this always correct? practice will show...
        }
        catch (ex) {
            // in FF (as we know it), we cannot access the selectStart property
            // when the control/ input doesn't have the focus or is not visible.
            // A workaround is provided here...
            if (!str)
                return;
            var chr, val;
            for (i = 0, j = str.length; i < j; i++) {
                lastPos = i;
                if (pos[lastPos] == null)
                    continue;
                chr = checkChar(str.substr(i, 1), i);
                if (chr == _FALSE_)
                    continue;
                val = oInput.value;
                oInput.value = val.substr(0, pos[i]) + chr + val.substr(pos[i] + 1);
            }
            if (str.length)
                lastPos++;
            return; // job done, bail out
        }

        str = this.dispatchEvent("insert", { data : str }) || str;
        
        if (!str) {
            if (!this.getValue()) return; //maybe not so good fix... might still flicker when content is cleared
            for (i = this.getValue().length - 1; i >= 0; i--)
                deletePosition(i);
            setPosition(0); 
            return;
        }
        
        for (i = 0, j = str.length; i < j; i++) {
            lastPos = i;
            setCharacter(str.substr(i, 1));
            setPosition(i + 1);
        }
        if (str.length)
            lastPos++;
    };
    
    function calcPosFromCursor(){
        var range, lt = 0;

        range = document.selection.createRange();
        var r2 = range.duplicate();
        r2.expand("textedit");
        r2.setEndPoint("EndToStart", range);
        lt = r2.text.length;
    
        for (var i = 0; i < pos.length; i++) {
            if (pos[i] > lt)
                return (i == 0) ? 0 : i - 1;
        }

        return myvalue.length; // always return -a- value...
    }
};







require("./lib/menu/menu")(apf);
require("./lib/flexbox")(apf);
require("./lib/page")(apf);



//Start
apf.start();


        register(null, {apf: apf});
    }
}));
