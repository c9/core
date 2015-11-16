define(function(require, module, exports) {
    main.consumes = ["Plugin", "apf"];
    main.provides = ["ui"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        require("plugins/c9.ide.ui/codebox")(imports.apf);
        var settings;

        var packed = require("text!./style.less").length === 0;
        var packedThemes = packed || options.packedThemes !== false;

        /***** Initialization *****/

        var plugin = new Plugin("Ajax.org", main.consumes);
        
        var cssLibs = [];
        
        var loaded = false;
        function load(){
            if (loaded || apf.uiLoaded) return false;
            loaded = true;
            apf.uiLoaded = true;
            
            // Before we have Proxy Objects, we'll extend the apf objects with the needed api
            apf.Class.prototype.on = function(){
                this.addEventListener.apply(this, arguments);
            };
            apf.Class.prototype.once = function(name, listener) {
                var _self = this;
                function callback(){
                    listener.apply(this, arguments);
                    _self.removeEventListener(name, callback);
                }
                this.addEventListener(name, callback);
            };
            apf.Class.prototype.emit = apf.Class.prototype.dispatchEvent;
            apf.Class.prototype.off = apf.Class.prototype.removeEventListener;
            
            Object.defineProperty(apf.Class.prototype, '$html', {
                get: function() { return this.$int || this.$container || this.$ext; },
                enumerable: false,
                configurable: false
            });
            
            apf.preProcessCSS = insertLess;
            
            // Load a basic document into APF
            apf.initialize('<a:application xmlns:a="http://ajax.org/2005/aml" />');
            
            window.addEventListener("mousedown", function() {
                document.body.classList.add("disableIframe");
            }, true);
            
            window.addEventListener("mouseup", function() {
                document.body.classList.remove("disableIframe");
            }, true);
        }
        
        function initSettings(v) {
            settings = v;
            
            function wrap(prototype, prop, isNumber) {
                delete prototype.$booleanProperties[prop];
                var oldHandler = prototype.$propHandlers[prop] || function(value) {
                    this[prop] = value;
                };
                
                var func = isNumber ? settings.getNumber : settings.getBool;
                
                prototype.$propHandlers[prop] = function(value) {
                    var _self = this;
                    var dynProp = this.getAttribute(prop);
                    var isDynProp = ~(String(dynProp) || "").indexOf("/");
                    
                    if (isNumber) {
                        if (parseInt(value, 10) == value || !value) {
                            isDynProp && settings.set(dynProp, value, null, null, true);
                            return oldHandler.call(_self, parseInt(value, 10));
                        }
                    }
                    else {
                        if (this.localName == "checkbox") {
                            var idx = this.$values && this.$values.indexOf(value);
                            if (!isNaN(idx) && idx > -1) {
                                isDynProp && settings.set(dynProp, value, null, null, true);
                                return oldHandler.call(_self, value);
                            }
                        }
                        
                        if (apf.isTrue(value)) {
                            isDynProp && settings.set(dynProp, value, null, null, true);
                            return oldHandler.call(_self, true);
                        }
                        else if (apf.isFalse(value) || !value) {
                            isDynProp && settings.set(dynProp, value, null, null, true);
                            return oldHandler.call(_self, false);
                        }
                    }
                    
                    oldHandler.call(_self, func(value));
                    
                    function listen(){ 
                        var v = func(value);
                        if (_self[prop] != v) 
                            oldHandler.call(_self, v); 
                    }
                    settings.on(value, listen);
                    
                    this.once("DOMNodeRemovedFromDocument", function(){
                        settings.off(value, listen);
                    });
                };
            }
            wrap(apf.item.prototype, "checked", false);
            wrap(apf.spinner.prototype, "value", true);
            wrap(apf.group.prototype, "value", false);
            wrap(apf.checkbox.prototype, "value", false);
            wrap(apf.tab.prototype, "animate", false);
        }
        
        ["model", "tree", "button", "menu", "item", "bar", "divider", "toolbar",
         "list", "tab", "textbox", "textarea", "radiobutton", "checkbox", "page",
         "splitter", "hsplitbox", "vsplitbox", "group", "img", "label", "spinner",
         "dropdown", "BindingColumnRule", "datagrid", "hbox", "vbox", "colorbox",
         "frame", "password", "modalwindow", "filler", "splitbutton", "codebox"].forEach(function(tag) {
             plugin[tag] = function(struct) {
                 return new apf[tag](struct);
             };
        });
        
        /***** Methods *****/
        
        function defineLessLibrary(css, plugin) {
            if (packed && css)
                throw new Error("Can't add dynamic less library in packed mode!");
            if (packedThemes) return;
                
            cssLibs.push(css);
            plugin.addOther(function(){
                cssLibs.splice(cssLibs.indexOf(css), 1);
            });
        }
        
        function createStyleSheet(css) {
            var style = document.createElement("style");
            style.appendChild(document.createTextNode(css));
            document.getElementsByTagName("head")[0].appendChild(style);
            return style;
        }
        
        function insertLess(css, filename, staticPrefix, _callback, force) {
            var callback = _callback || function(err) {
                if (err) console.error(err);    
            };
            css = css.trim();
            filename = filename || "unknown.css";
            staticPrefix = staticPrefix || "";
            
            if (!css) return callback();
            
            if (!force) {
                if (packed && css)
                    throw new Error("Can't add dynamic less library in packed mode!");
                if (packedThemes) return;
            }
            // use dynamic require because we don't want this in the packed version
            require(["./lib_less1.5"], function(less) {
                if (less) less.async = true;
                var parser = new less.Parser({
                    filename: filename
                });
                
                // Parse Less Code
                var baseLib = "@base-path : \"" + staticPrefix + "\";\n"
                    + "@image-path : \"" + staticPrefix + "/images\";\n"
                    + "@icon-path : \"" + staticPrefix + "/icons\";\n";
                
                var code = baseLib + "\n" + cssLibs.join("\n") + "\n" + css;
                parser.parse(code, function (e, tree) {
                    if (e)
                        return callback(e);
                        
                    // Add css to the DOM
                    var style = createStyleSheet(tree.toCSS({
                        relativeUrls: true,
                        rootpath: staticPrefix || ""
                    }));
                    callback(null, style);
                });
            });
        }
        
        function insertCss(css, staticPrefix, plugin) {
            if (!css) return;
            
            if (staticPrefix instanceof Plugin) {
                plugin = staticPrefix;
                staticPrefix = "";
            }

            var force = packedThemes && String(staticPrefix).match(/^http/);
            if (staticPrefix !== false && !packedThemes || force) {
                var filename = staticPrefix + "/" + plugin.name + ".less";
                insertLess(css, filename, staticPrefix, function(err, style) {
                    if (err)
                        return console.error(err);
                    
                    // Cleanup
                    if (style) {
                        plugin.addOther(function(){
                            style.parentNode.removeChild(style);
                        });
                    }
                }, force);
            }
            else {
                if (!packed && packedThemes && staticPrefix !== false) {
                    return;
                }
                var style = createStyleSheet(css);
                
                // Cleanup
                plugin.addOther(function(){
                    style.parentNode.removeChild(style);
                });
            }
        }
        
        function insertSkin(skin, plugin) {
            var data = skin.data;
            
            delete skin.data;
            skin.src = "<skins />";
            skin.id = skin.name;

            var skinNode = new apf.skin(skin);
            skinNode.setProperty("src", data);
            
            apf.document.documentElement.appendChild(skinNode);
            
            plugin.addElement(skinNode);
        }
        
        function insertHtml(parent, markup, plugin) {
            if (!parent)
                parent = document.body;
            
            var lastChild = parent.lastChild;
            parent.insertAdjacentHTML("beforeend", markup);
            
            var nodes = [];
            if (!lastChild)
                nodes.push(parent.lastChild);
            else {
                while (lastChild.nextSibling) {
                    nodes.push(lastChild = lastChild.nextSibling);
                }
            }
            
            plugin.addOther(function(){
                nodes.forEach(function(node) {
                    node.parentNode.removeChild(node);
                });
            });
            
            return nodes;
        }
        
        function insertMarkup(parent, markup, plugin) {
            //@todo find a way to get a list of all elements added
            
            if (!parent)
                parent = apf.document.documentElement;
                
            if (parent.$amlDestroyed) return; // Parent is already destroyed
                
            //var allMarker = apf.all.length;
            var childMarker = parent.childNodes.length;
            
            parent.insertMarkup(markup, {
                callback: function(){
                    
                }
            });
            
            //var allNodes = apf.all.slice(allMarker);
            var childNodes = parent.childNodes.slice(childMarker);
            
            return plugin.addElement.apply(plugin, childNodes);
        }
        
        function insertByIndex(parent, item, index, plugin) {
            var beforeNode, diff = 100000000, nodes = parent.childNodes;
            for (var i = 0, l = nodes.length; i < l; i++) {
                var d = nodes[i].$position - index;
                if (d > 0 && d < diff) {
                    beforeNode = nodes[i];
                    diff = d;
                }
            }
            
            if (typeof item == "string") {
                var bar = new apf.bar({htmlNode: document.createElement("div")});
                bar.insertMarkup(item, { callback: function(){} });
                item = bar.childNodes.slice();
                bar.childNodes.length = 0;
                bar.destroy();
            }
            
            if (Array.isArray(item)) {
                for (var i = 0; i < item.length; i++) {
                    var node = parent.insertBefore(item[i], beforeNode);
                    node.$position = index;
                    
                    if (plugin !== false)
                        plugin.addElement(node);
                    
                }
                return item[0];
            } else {
                var node = parent.insertBefore(item, beforeNode);
                node.$position = index;
                
                if (plugin !== false)
                    plugin.addElement(node);
                
                return node;
            }
        }
        
        function addClass(html, name) {
            html.className = 
              html.className.replace(new RegExp(" " + name, "g"), "")
                + " " + name;
        }
        
        function removeClass(html, name) {
            html.className = 
                html.className.replace(new RegExp(" " + name, "g"), "");
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function(){
            load();
        });
        plugin.on("unload", function(){
            loaded = false;
        });
        
        /***** Register and define API *****/
         
        /**
         * The Cloud9 UI Library is exposed through this plugin. The UI widgets
         * that Cloud9 uses are called AMLElements. These elements can be
         * created programmatically, or using a markup language, called AML.
         * 
         * This plugin has three main functions:
         * 
         * * A set of functions to insert HTML, CSS and AML into the UI.
         * * A set of constructors for the AMLElements.
         * * A set of helper methods that allow for easy manipulation of the
         * HTML DOM, the XML DOM, Stylesheets and AML Elements.
         * 
         * ## Insertion Functions ##
         * 
         * The five insertions functions ({@link #insertSkin}, {@link #insertCss}, 
         * {@link #insertHtml}, {@link #insertMarkup}, {@link #insertByIndex})
         * are commonly used in the draw method of a plugin. See the source of
         * {@link Template} for an elaborate example. 
         * 
         * Here's a simple example:
         * 
         *     // Import Skin
         *     ui.insertSkin({
         *         name         : "c9statusbar",
         *         data         : require("text!./skin.xml"),
         *         "media-path" : options.staticPrefix + "/images/",
         *         "icon-path"  : options.staticPrefix + "/icons/"
         *     }, plugin);
         *     
         *     // Create UI elements
         *     ui.insertMarkup(parentElement, require("text!./markup.xml"), plugin);
         *     
         *     // Insert CSS
         *     ui.insertCss(require("text!./style.css"), plugin);
         * 
         * The following example shows how you can use the AML markup language
         * to create a window.
         * 
         *     <a:window center="true" buttons="close" resizable="true" title="Hello World">
         *         <h1>Hello World!</h1>
         *         
         *         <p>Hello there! How are you?</p>
         *     
         *         <a:hbox edge="23 0 10" pack="end" padding="8">
         *             <a:button>Cancel</a:button>
         *             <a:button default="2">OK</a:button>
         *         </a:hbox>
         *     </a:window>
         * 
         * ## AMLElement Constructors ##
         * 
         * The following list of widgets are offered by the ui plugin:
         * 
         * {@link ui.button}, {@link ui.menu}, 
         * {@link ui.item}, {@link ui.bar}, {@link ui.divider}, {@link ui.toolbar}, 
         * {@link ui.tab}, {@link ui.textbox}, {@link ui.textarea}, 
         * {@link ui.radiobutton}, {@link ui.checkbox}, {@link ui.page}, 
         * {@link ui.hsplitbox}, {@link ui.vsplitbox}, 
         * {@link ui.label}, {@link ui.spinner}, 
         * {@link ui.dropdown}, {@link ui.colorbox}, {@link ui.frame}, 
         * {@link ui.password}.
         * 
         * This example shows how to create a button using the {@link ui.button}
         * constructor. When pressed the button will execute the save command.
         * 
         *     var button = new ui.button({
         *         id       : "saveButton",
         *         caption  : "Save",
         *         tooltip  : "Save",
         *         skin     : "c9-toolbarbutton-glossy",
         *         command  : "save"
         *     });
         * 
         * @singleton
         */
        plugin.freezePublicAPI({
            /**
             * @property {Boolean} whether c9 was started in the packed version
             */
            get packed() { return packed; },
            
            /**
             * @property {Boolean} whether to load packed less files
             */
            get packedThemes() { return packedThemes; },
            
            /**
             * @ignore
             */
            set settings(v) { initSettings(v); },
            
            /**
             * 
             */
            defineLessLibrary: defineLessLibrary,
            
            /**
             * Imports a CSS string into the browser as a new stylesheet.
             * 
             * Example:
             * 
             *     var cssString = require("text!./myplugin.css");
             *     ui.insertCss(cssString, options.staticPrefix, plugin);
             * 
             * You can also generate the css with javascript:
             * 
             *     var cssString = ".myplugin { background: url(images/test.png); }";
             *     ui.insertCss(cssString, options.staticPrefix, plugin);
             * 
             * Make sure to always point to images using the "images/" path. The
             * `staticPrefix` parameter will prefix those paths with the path
             * for your plugin. Your images should always recide in a folder 
             * called "images".
             * 
             * @param {String} css             The css definition as you would write in a .css file.
             * @param {String} [staticPrefix]  The path or url that will prefix 
             *   all the image urls. Make sure that this comes from the options 
             *   of your plugin (See {@link Architect}). By making this an option
             *   of your plugin the path can be set to a different one for the
             *   when all cloud9 plugins are packaged and the images are loaded
             *   from a different url (a static file server).
             * @param {Plugin} plugin          The plugin responsible for 
             *   inserting the css. This is needed for cleanup during the unload
             *   phase of the plugin.
             */
            insertCss: insertCss,
            
            /**
             * Load a skin definition into Cloud9. A skin definition 
             * describes the HTML and CSS used for AML widgets. 
             * 
             * When you wish customize the styling of AML elements, copy the
             * skin from the main skins.xml file into your own skin.xml file 
             * and load that file using this method.
             * 
             * Example:
             * 
             *     // Import Skin
             *     ui.insertSkin({
             *         name         : "mypluginname",
             *         data         : require("text!./skin.xml"),
             *         "media-path" : options.staticPrefix + "/images/",
             *         "icon-path"  : options.staticPrefix + "/icons/"
             *     }, plugin);
             * 
             * You can then reference the skin, using the skinset attribute:
             * 
             *     <a:button skinset="mypluginname" />
             *     
             * Or set the skinset attribute on a parent to apply it to all it's
             * children:
             * 
             *     <a:window skinset="mypluginname">
             *         <!-- your children -->
             *     </a:window>
             * 
             * @param {String} skin    The skin definition.
             * @param {Plugin} plugin  The plugin responsible for 
             *   loading the skin. This is needed for cleanup during the unload
             *   phase of the plugin.
             */
            insertSkin: insertSkin,
            
            /**
             * Inserts AMLElements from their xml definition.
             * 
             * Example:
             * 
             *     // Create UI elements
             *     ui.insertMarkup(parentElement, require("text!./markup.xml"), plugin);
             *     
             * The following example shows how you can use the AML markup language
             * to create a window.
             * 
             *     <a:window center="true" buttons="close" resizable="true" title="Hello World">
             *         <h1>Hello World!</h1>
             *         
             *         <p>Hello there! How are you?</p>
             *     
             *         <a:hbox edge="23 0 10" pack="end" padding="8">
             *             <a:button>Cancel</a:button>
             *             <a:button default="2">OK</a:button>
             *         </a:hbox>
             *     </a:window>
             * 
             * @param {AMLElement} parent  The parent where the newly created 
             *   elements are inserted into.
             * @param {String}     markup  The markup that describes the UI elements.
             * @param {Plugin}     plugin  The plugin responsible for 
             *   inserting the markup. This is needed for cleanup during the unload
             *   phase of the plugin. 
             */
            insertMarkup: insertMarkup,
            
            /**
             * Inserts an html string into the DOM and returns the inserted
             * HTML elements in an array. This method is very similar to 
             * `.innerHTML += "markup"`, but it's faster and it makes sure these
             * elements are cleaned up when the plugin is unloaded.
             * 
             * Example:
             * 
             *     var html = "<div>Hello World</div>";
             *     var nodes = ui.insertHtml(document.body, html, plugin);
             *     nodes[0].className = "red";
             * 
             * @param {HTMLElement} parent  The parent of the newly created 
             *   elements.
             * @param {String}      markup  The html string.
             * @param {Plugin}      plugin  The plugin responsible for 
             *   inserting the html. This is needed for cleanup during the unload
             *   phase of the plugin. 
             */
            insertHtml: insertHtml,
            
            /**
             * Appends an AMLElement to a parent where the child position is
             * determined by a number. The higher the number the higher the 
             * child position compared to other children.
             * 
             * The use of index numbers to determine the position is a concept
             * that is used throughout Cloud9. It allows different plugins
             * to determine the position of UI elements, while being oblivious
             * of other plugins.
             * 
             * Example:
             * 
             *     // Insert a divider on the right of the button
             *     ui.insertByIndex(amlToolbar, amlButton, 100, plugin);
             *     ui.insertByIndex(amlToolbar, amlDivider, 200, plugin);
             *     
             * @param {AMLElement} parent    The ui element to which the `child` 
             *   is added.
             * @param {AMLElement} child     The ui element to add to the `parent`.
             * @param {Number}     index     The position in the stack of child
             *   elements of the `parent`.
             * @param {Plugin}     [plugin]  The plugin responsible for 
             *   inserting the aml. This is needed for cleanup during the unload
             *   phase of the plugin. Only pass the plugin argument if the 
             *   element that is inserted has not yet been added to the plugin.
             */
            insertByIndex: insertByIndex,
            
            /**
             * @ignore
             */
            n: apf.n,
            
            /**
             * @ignore
             */
            b: apf.b,
            
            /**
             * Escapes "&amp;", greater than, less than signs, quotation marks, 
             * and others into the proper XML entities.
             * 
             * @param  {String}  str           The XML string to escape.
             * @param  {Boolean} [strictMode]  By default, this function 
             *   attempts to NOT double-escape XML entities. This flag turns 
             *   that behavior off when set to `true`.
             * @return {String} The escaped    string
             */
            escapeXML: apf.escapeXML,
            
            /**
             * Retrieves the absolute x- and y-coordinates, relative to the 
             * browser's drawing area or the specified `refParent`.
             * @param {HTMLElement} htmlNode    The element to check
             * @param {HTMLElement} [refParent] The reference parent
             * @param {Boolean}     [inclSelf]  Whether to include the position of the element to check in the return value.
             * @returns {Number[]} The x- and y-coordinates of `htmlNode`.
             */
            getAbsolutePosition: apf.getAbsolutePosition,
            
            /**
             * Constructs a stylesheet.
             * @param   {Object}  [win] A reference to a browser window
             * @returns {String} The created CSS stylesheet
             */ 
            createStylesheet: apf.createStylesheet,
            
            /**
             * Imports a stylesheet defined by a multidimensional array. 
             * @param {Array}    def  A multidimensional array specifying stylesheets to import
             * @param {Object}   [win] A reference to a window
             */    
            importStylesheet: apf.importStylesheet,
            
            /**
             * Retrieves the value of a single CSS rule.
             * @param {String} name         The CSS name of the rule (i.e. `.class` or `#id`).
             * @param {String} type         The CSS property to retrieve.
             * @param {String} [stylesheet] The name of the stylesheet to change.
             * @param {Object} [win]        A reference to a window
             * @return {String/Number}
             */
            getStyleRule: apf.getStyleRule,
            
            /**
             * Sets a property of a CSS rule.
             * @param {String} name         The CSS name of the rule (i.e. `.class` or `#id`).
             * @param {String} type         The CSS property to change.
             * @param {String} value        The CSS value of the property.
             * @param {String} [stylesheet] The name of the stylesheet to change.
             * @param {Object} [win]        A reference to a window
             */
            setStyleRule: apf.setStyleRule,
            
            /**
             * @ignore
             */
            removeStyleRule: apf.removeStyleRule,
            /**
             * @ignore
             */
            setStyleClass: apf.setStyleClass,
            
            /**
             * Returns the distance between the border left and border right 
             * values of an element, taking padding into consideration.
             * @param {HTMLElement} oHtml The element to check
             * @returns {Number} The final calculation, or 0, if there's no difference
             */
            getWidthDiff: apf.getWidthDiff,
            
            /**
             * Returns the distance between the border top and border bottom 
             * values of an element, taking padding into consideration.
             * @param {HTMLElement} oHtml The element to check
             * @returns {Number} The final calculation, or 0, if there's no difference
             */
            getHeightDiff: apf.getHeightDiff,
            
            /**
             * Returns an array with two elements. The first is the distance 
             * between the margin left and margin right values of an element; 
             * the second is the distance between the margin top top and margin 
             * bottom values of an element.
             * @param {HTMLElement} oHtml The element to check
             * @returns {Number[]} An array containing the differences
             */
            getMargin: apf.getMargin,
            
            /**
             * Determines whether a node is a child of another node.
             *
             * @param {HTMLElement} pNode      The potential parent element.
             * @param {HTMLElement} childnode  The potential child node.
             * @param {Boolean}     [orItself] Whether the method also returns `true` when `pNode` is the `childnode`.
             * @return {Boolean} `false` if the second argument is not a child of the first.
             */
            isChildOf: apf.isChildOf,
            
            /**
             * @ignore
             */
            layout: apf.layout,
            
            /**
             * Performs an async function serially on each of the list items.
             * 
             * @param {Array}    list          A list of elements to iterate over asynchronously
             * @param {Function} async         An ssync function of the form `function(item, callback)`
             * @param {Function} callback      Called after all items have been processed
             * @param {Error}    callback.err  Error if any has occured.
             */
            asyncForEach: apf.asyncForEach,
            
            /**
             * Adds a className to an html element. This method leaves
             * existing classes applied to the html element.
             * 
             * @param {HTMLElement}  html  The element to apply the class to.
             * @param {String}       name  The name of the CSS class to add.
             */
            addClass: addClass,
            
            /**
             * Removes a className to an html element. This method leaves
             * other classes applied to the html element.
             * 
             * @param {HTMLElement}  html  The element to remove the class from.
             * @param {String}       name  The name of the CSS class to remove.
             */
            removeClass: removeClass,
            
            /**
             * @ignore
             */
            createNodeFromXpath: apf.createNodeFromXpath,
            
            /**
             * Determines whether a string is true (in the HTML attribute sense).
             * @param {Mixed} value The variable to check. Possible truth values include:
             * 
             * * true  
             * * 'true'
             * * 'on'  
             * * 1     
             * * '1'   
             * 
             * @return {Boolean} Whether the string is considered to imply truth.
             */
            isTrue: apf.isTrue,
            
            /**
             * Determines whether a string is false (in the HTML attribute sense).
             * @param {Mixed} value The variable to check. Possible false values include:
             * 
             * * false   
             * * 'false' 
             * * 'off'   
             * * 0       
             * * '0'     
             * 
             * @return {Boolean} whether the string is considered to imply untruth.
             */
            isFalse: apf.isFalse,
            
            /**
             * @ignore
             */
            xmldb: apf.xmldb,
            
            /**
             * @ignore
             */
            getCleanCopy: apf.getCleanCopy,
            
            /**
             * This method retrieves the current value of a CSS property on an 
             * HTML element.
             * @param {HTMLElement} html  the element to read the property from
             * @param {String}      name  the property to read
             * @returns {String}
             */
            getStyle: apf.getStyle
        });
        
        register("", {
            ui: plugin
        });
    }
});