define(function(require, module, exports) {
    main.consumes = ["Plugin", "ui", "preferences", "anims", "Form", "settings"];
    main.provides = ["PreferencePanel"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var ui = imports.ui;
        var anims = imports.anims;
        var settings = imports.settings;
        var Form = imports.Form;
        var prefs = imports.preferences;
        
        function PreferencePanel(developer, deps, options) {
            var plugin = new Plugin(developer, deps);
            var emit = plugin.getEmitter();
            
            var caption = options.caption;
            var noscroll = options.noscroll;
            var className = options.className || "";
            var visible = options.visible == null || options.visible;
            var index = options.index || 100;
            var headings = {};
            var subHeadings = {};
            var amlBar, navHtml, form, container, active, lastA;
            
            var drawn;
            function draw() {
                if (drawn) return;
                drawn = true;
                
                amlBar = ui.bar({
                    htmlNode: prefs.container,
                    anchors: "0 0 0 0",
                    "class": "prefpanel " + className,
                    visible: false
                });
                plugin.addElement(amlBar);
                
                if (options.form) {
                    form.draw();
                    amlBar.appendChild(container = form.aml);
                    
                    if (!noscroll) {
                        // Set up scroll interaction for navigation
                        container.$int.addEventListener("scroll", scroll);
                        
                        form.container.style.paddingBottom = 
                            (amlBar.$ext.parentNode.offsetHeight - 40) + "px";
                    }
                }
                
                emit.sticky("draw", { 
                    aml: amlBar, 
                    html: amlBar.$int, 
                    navHtml: navHtml 
                });
            }
            
            /***** Methods *****/
            
            function scroll() {
                var scrollTop = container.$int.scrollTop;
                var nodes = container.$int.childNodes;
                for (var node, i = 0; i < nodes.length; i++) {
                    if ((node = nodes[i]).nodeType != 1) continue;
                    
                    if (node.offsetTop <= scrollTop && node.offsetTop 
                      + node.offsetHeight > scrollTop) {
                        var nodeTop = Math.max(node.offsetTop 
                            + node.offsetHeight 
                            - (0.3 * node.offsetHeight), 0);
                        if (nodeTop < scrollTop)
                            node = nodes[i + 1] || node;
                          
                        if (lastA) {
                            ui.setStyleClass(lastA, "", ["current"]);
                        }
                        
                        // If item is custom ignore.
                        try {
                            var nav = node.firstChild.lastChild.firstChild;
                            if (nav) {
                                var name = nav.nodeValue;
                                lastA = subHeadings[name].navHtml;
                                ui.setStyleClass(lastA, "current");
                            }
                        } catch (e) {}
                    }
                }
            }
            
            function show(noAnim) {
                draw();
                
                if (active) return;
                active = true;
                
                navHtml.className += " active";
                
                var bq = navHtml.lastChild;
                if (bq.tagName == "BLOCKQUOTE") {
                    bq.style.display = "block";
                    bq.style.height = noAnim ? "" : 0;
                    
                    if (!noAnim) {
                        anims.animate(bq, {
                            duration: 0.15,
                            height: bq.scrollHeight + "px",
                            timingFunction: "cubic-bezier(.30, .08, 0, 1)"
                        }, function() {});
                    }
                }
                
                amlBar.show();
                
                if (!noAnim) {
                    amlBar.$ext.style.opacity = 0;
                    amlBar.$ext.style.zIndex = 100;
                    amlBar.$ext.style.display = "block";
                    
                    anims.animate(amlBar, {
                        duration: 0.15,
                        opacity: 1,
                        timingFunction: "linear"
                    }, function() {});
                }
                
                if (options.form)
                    scroll();
                
                emit("activate");
            }
            
            function hide() {
                navHtml.className = navHtml.className.replace(/ active/g, "");
                
                var bq = navHtml.lastChild;
                if (bq.tagName == "BLOCKQUOTE") {
                    anims.animate(bq, {
                        duration: 0.15,
                        height: 0,
                        timingFunction: "cubic-bezier(.30, .08, 0, 1)"
                    }, function() {
                        // amlBar && amlBar.hide();
                        bq.style.display = "none";
                    });
                }
                
                amlBar.$ext.style.zIndex = 99;
                setTimeout(function() {
                    amlBar.$ext.style.zIndex = 1;
                    amlBar.$ext.style.display = "none";
                }, 250);
                
                active = false;
                
                emit("deactivate");
            }
            
            function resize() {
                if (form && drawn && !noscroll)
                    form.container.style.paddingBottom = 
                        (amlBar.$ext.parentNode.offsetHeight - 40) + "px";
                    
                emit("resize");
            }
            
            function add(state, foreign) {
                if (!foreign)
                    throw new Error("Missing plugin parameter when calling preferences.add()");
                
                if (!container) {
                    plugin.once("draw", function() {
                        add(state, foreign);
                    });
                    return;
                }
                
                // First Level
                for (var name in state) {
                    var first = state[name];
                    var heading = getHeading(name, first.position, foreign);
                    
                    // Create Nav Elements
                    for (var caption in first) {
                        if (caption == "position") continue;
                        
                        var second = first[caption];
                        
                        // Correct index
                        if (second.position)
                            second.position = 
                                heading.index + "" + second.position;
                        
                        getSubHeading(heading, caption, second.position, foreign);
                    }
                    
                    // Create Form Elements
                    form.add(first, foreign);
                }
            }
            
            function getHeading(caption, index, plugin) {
                if (!headings[caption]) {
                    headings[caption] = {
                        navHtml: prefs.addNavigation(caption, index, navHtml, plugin),
                        index: index
                    };
                }
                
                return headings[caption];
            }
            
            function getSubHeading(heading, caption, index, plugin) {
                if (!subHeadings[caption]) {
                    var htmlNode = prefs
                        .addNavigation(caption, index, heading.navHtml, plugin);
                        
                    subHeadings[caption] = { navHtml: htmlNode, index: index };
                    htmlNode.$caption = caption;
                    
                    htmlNode.addEventListener("mousedown", scrollTo.bind(null, caption));
                }
                
                return subHeadings[caption];
            }
            
            function scrollTo(caption) {
                if (!form.headings[caption])
                    return;
                apf.tween.single(container.$int, {
                     type: "scrollTop",
                    steps: 10,
                    anim: apf.tween.easeInOutCubic,
                    from: container.$int.scrollTop,
                    to: form.headings[caption].container.$ext.offsetTop
                });
            }
            
            /***** LifeCycle *****/
            
            plugin.on("load", function() {
                if (!visible) return;
                
                navHtml = prefs.addNavigation(caption, index, null, plugin);
                navHtml.addEventListener("mousedown", function() {
                    prefs.activate(plugin);
                });
                
                prefs.on("resize", function() {
                    resize();
                });
                
                if (options.form) {
                    form = new Form({
                        className: "container",
                        style: "overflow-y:auto;overflow-x:hidden;position:absolute;left:0;top:0;right:0;bottom:0",
                        skins: { "textbox": "tbsimple" },
                        colwidth: options.colwidth || "300",
                        colmaxwidth: "300",
                        widths: {
                            "dropdown": 120,
                            "spinner": 60,
                            "textbox": 200,
                            "password": 200,
                            "colorbox": 40,
                            "button": 200,
                            "textarea": 400,
                            "checked-spinner": 50
                        }
                    }, plugin);
                }
            });
            
            plugin.on("unload", function() {
                drawn = false;
            });
            
            /***** Register and define API *****/
            
            plugin.freezePublicAPI.baseclass();
            
            /**
             * Preference panel base class for the {@link preferences preference editor}.
             * 
             * Implementing your own preference panel takes a new PreferencePanel() object 
             * rather than a new Plugin() object. Here's a short example:
             * 
             *     var plugin = new PreferencePanel("(Company) Name", main.consumes, {
             *         caption : "Advanced Settings",
             *         index   : 500,
             *         form    : true
             *     });
             *     var emit = plugin.getEmitter();
             * 
             *     plugin.on("load", function(e) {
             *         plugin.add({
             *            "General" : {
             *                 position : 10,
             *                 "User Interface" : {
             *                     position : 20,
             *                     "Enable UI Animations" : {
             *                         type : "checkbox",
             *                         path : "user/general/@animateui",
             *                         position : 1000
             *                     }
             *                 }
             *             }
             *         }, plugin);
             *     });
             *     
             *     plugin.freezePublicAPI({
             * 
             *     });
             * 
             * @class PreferencePanel
             * @extends Plugin
             */
            /**
             * @constructor
             * Creates a new PreferencePanel instance.
             * @param {String}   developer   The name of the developer of the plugin
             * @param {String[]} deps        A list of dependencies for this 
             *   plugin. In most cases it's a reference to `main.consumes`.
             * @param {Object}   options     The options for the preference panel
             * @param {String}   options.caption  The caption of the navigation item.
             * @param {Number}   options.index    The position of the navigation item.
             * @param {Boolean}  options.form     Specifies whether to create a form for this panel.
             */
            plugin.freezePublicAPI({
                /**
                 * @ignore.
                 */
                get section() { return lastA && lastA.$caption; },
                /**
                 * The APF UI element that is presenting the pane in the UI.
                 * This property is here for internal reasons only. *Do not 
                 * depend on this property in your plugin.*
                 * @property {AMLElement} aml
                 * @private
                 * @readonly
                 */
                get aml() { return amlBar; },
                
                /**
                 * The caption of the main navigation element of this panel.
                 * @property {String} caption
                 * @readonly
                 */
                get caption() { return caption; },
                
                /**
                 * The position of the navigation item
                 * @property {Number} index
                 * @readonly
                 */
                get index() { return index; },
                
                /**
                 * The form for this plugin if any is created
                 * @property {Form} form
                 * @readonly
                 */
                get form() { return form; },
                
                /**
                 * Whether this panel is active
                 * @property {Boolean} active
                 * @readonly
                 */
                get active() { return amlBar.visible; },
                
                _events: [
                    /**
                     * Fired when the panel container is drawn.
                     * @event draw
                     * @param {Object}      e
                     * @param {HTMLElement} e.html     The html container.
                     * @param {AMLElement}  e.aml      The aml container.
                     * @param {AMLElement}  e.navHtml  The html element that represents the navigation.
                     */
                    "draw",
                    /**
                     * @event activate 
                     */
                    "activate",
                    /**
                     * @event deactivate 
                     */
                    "deactivate",
                    /**
                     * @event resize 
                     */
                    "resize"
                ],
                    
                /**
                 * @method add
                 * @inheritdoc preferences.Preferences#add
                 */
                add: add,
                
                /**
                 * Shows the panel.
                 */
                show: show,
                
                /**
                 * Scrolls to a subheading.
                 */
                scrollTo: scrollTo,
                /**
                 * Hides the panel.
                 */
                hide: hide,
                
                /**
                 * Resizes the panel.
                 */
                resize: resize
            });
            
            return plugin;
        }
        
        /***** Register and define API *****/
        
        register(null, {
            PreferencePanel: PreferencePanel
        });
    }
});