define(function(require, module, exports) {
    main.consumes = [
        "Plugin", "tabManager", "menus", "settings", "layout", "ui", 
        "commands", "anims"
    ];
    main.provides = ["console"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var ui = imports.ui;
        var tabs = imports.tabManager;
        var settings = imports.settings;
        var menus = imports.menus;
        var anims = imports.anims;
        var commands = imports.commands;
        var layout = imports.layout;
        
        var cssString = require("text!./style.css");
        var markup = require("text!./console.xml");
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var onFinishTimer, consoleRow, animating;
        var container, changed, maximized, maxHeight, lastZIndex, height;
        
        var hidden = true;
        var minHeight = 60;
        var collapsedHeight = 0;
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            // Commands
            commands.addCommand({
                name: "toggleconsole",
                group: "Panels",
                bindKey: { mac: "Ctrl-Esc", win: "F6" },
                exec: function(editor, args) {
                    if (hidden || args.show) {
                        show();
                        focusConsole();
                    } else {
                        hide();
                    }
                }
            }, plugin);
            
            commands.addCommand({
                name: "maximizeconsole",
                group: "Panels",
                exec: function(editor, args) {
                    if (!maximized) {
                        maximizeConsoleHeight();
                    }
                    else {
                        restoreConsoleHeight();
                    }
                }
            }, plugin);
            
            // Menus
            menus.addItemByPath("View/Console", new apf.item({
                type: "check",
                command: "toggleconsole",
                checked: "state/console/@expanded"
            }), 700, plugin);

            // Settings
            settings.on("read", function(e) {
                // Defaults
                settings.setDefaults("state/console", [
                    ["expanded", true],
                    ["maximized", false],
                    ["height", 153]
                ]);
                
                // Height
                height = Math.max(minHeight, Math.min(layout.maxConsoleHeight, 
                    settings.getNumber("state/console/@height") || 0));

                setTimeout(function() {
                    // Expanded
                    if (settings.getBool("state/console/@expanded"))
                        show(true);
    
                    // Maximized
                    if (settings.getBool("state/console/@maximized"))
                        maximizeConsoleHeight();
                }, 0);
                
                changed = false;
            }, plugin);
            
            settings.on("write", function(e) {
                // if (!changed)
                //     return;
                if (!container) return;               
 
                if (drawn) {
                    var state = getState(true);
                    settings.setJson("state/console", state);
                }
            }, plugin);
            
            tabs.on("focus", function(e) {
                if (drawn && ui.isChildOf(container, e.tab.aml))
                    show();
            });
            
            if (apf.isGecko) {
                ui.setStyleRule(".console .btnsesssioncontainer .inside",
                    "padding-right", "30px");
            }
            
            // @todo fix Focus Handling in pane
        }
        
        var drawn = false;
        function draw() {
            if (drawn) return;
            drawn = true;
            
            ui.insertCss(cssString, null, plugin);

            consoleRow = layout.findParent(plugin);
            container = consoleRow.appendChild(new ui.bar({
                zindex: 99,
                height: height,
                // minheight : 60,
                "class": "console codeditorHolder"
            }));
            
            plugin.addElement(container);
            tabs.containers.push(container);
            
            if (settings.getBool("user/tabs/@asterisk"))
                ui.setStyleClass(container, "asterisk");
            
            ui.insertMarkup(container, markup, plugin);
            
            // Track splitter and update state
            var splitter = consoleRow.$handle;
            splitter && splitter.on("dragdrop", function(e) {
                height = Math.max(minHeight, container.height);
                if (height)
                    settings.set("state/console/@height", height);
                emit("resize");
            });
            
            // Create new tabs
            var state = settings.getJson("state/console");
            if (!state) {
                state = options.defaultState || {
                    type: "pane", 
                    nodes: [
                        {
                            type: "tab",
                            editorType: "terminal",
                            active: "true"
                        },
                        {
                            type: "tab",
                            editorType: "immediate",
                            document: {
                                title: "Immediate"
                            }
                        }
                    ]
                };
            }
            
            if (options.testing != 2) {
                setState(state, true, function() {});
                emit.sticky("ready");
            }

            tabs.on("paneCreate", function(e) {
                if (hidden && container && ui.isChildOf(container, e.pane.aml)) {
                    e.pane._visible = false;
                }
            });

            emit("draw");
        }
        
        /***** Methods *****/
        
        function getState(filter) {
            var state = tabs.getState(container.lastChild, filter);
            var tab = tabs.focus && tabs.findTab(state.focus);
            if (!tab || !ui.isChildOf(container, tab.pane.aml))
                delete state.focus;
            return state;
        }
        
        function setState(state, init, callback) {
            state.container = container;
            return tabs.setState(state, init, callback);
        }
        
        function getTabs() {
            return tabs.getTabs(container);
        }
        
        function getPanes() {
            return tabs.getPanes(container);
        }
        
        function clear() {
            var tabNodes = tabs.getPanes(container);
            
            for (var i = tabNodes.length - 1; i >= 0; i--) {
                var pane = tabNodes[i], nodes = pane.getTabs();
                if (!ui.isChildOf(container, pane.aml))
                    continue;
                
                for (var j = nodes.length - 1; j >= 0; j--) {
                    var tab = nodes[j];
                    tab.unload();
                }
                pane.unload();
            }
        }
        
        function maximizeConsoleHeight() {
            if (maximized)
                return;
            show(true);
            maximized = true;
        
            apf.document.documentElement.appendChild(container);
            var top = layout.getElement("root").getTop() + 1;
            container.setAttribute('anchors', top + ' 0 0 0');
            lastZIndex = container.$ext.style.zIndex;
            container.removeAttribute('height');
            container.$ext.style.maxHeight = "10000px";
            container.$ext.style.zIndex = 100000;
        
            settings.set("state/console/@maximized", true);
            plugin.getElement("btnConsoleMax").setValue(true);
            
            focusConsole();
            
            setTimeout(function() {
                getPanes().forEach(function(pane) {
                    var tab = pane.activeTab;
                    if (tab)
                        tab.editor.resize();
                });
            });
            
            emit("resize");
        }
        
        function restoreConsoleHeight() {
            if (!maximized)
                return;
            maximized = false;
        
            layout.findParent(plugin).appendChild(container);
            container.removeAttribute('anchors');
            maxHeight = window.innerHeight - 70;
            // container.$ext.style.maxHeight =  maxHeight + "px";
        
            container.setAttribute('height', maxHeight && height > maxHeight ? maxHeight : height);
            container.$ext.style.zIndex = lastZIndex;
        
            settings.set("state/console/@maximized", false);
            plugin.getElement("btnConsoleMax").setValue(false);
            
            focusConsole();
            
            getPanes().forEach(function(pane) {
                var tab = pane.activeTab;
                if (tab)
                    tab.editor.resize();
            });
            
            emit("resize");
        }
        
        function focusConsole() {
            var oldFocus = tabs.focussedTab;
            if (oldFocus && getPanes().indexOf(oldFocus.pane) != -1)
                return tabs.focusTab(oldFocus);
            
            focusActiveTabInContainer(container);
        }
        
        function focusActiveTabInContainer(containerEl) {
            var pane = tabs.findPane(containerEl.$activePaneName);
            var tab = pane && pane.activeTab;
            if (!tab) {
                tabs.getPanes(containerEl).every(function(pane) {
                    tab = pane.activeTab;
                    return !tab;
                });
            }
            tabs.focusTab(tab);
            return tab;
        }
        
        function hide(immediate) { show(immediate, true); }
        
        function show(immediate, shouldHide) {
            if (!shouldHide)
                draw();
            
            if (hidden == shouldHide || animating)
                return;
        
            hidden = shouldHide;
            animating = true;
            maxHeight = window.innerHeight - 70;
            
            getPanes().forEach(function(pane) {
                pane._visible = !shouldHide;
            });
            
            if (!shouldHide) {
                if (!tabs.focussedTab)
                    focusConsole();
            } 
            else if (tabs.focussedTab && getPanes().indexOf(tabs.focussedTab.pane) > -1) {
                // If the focussed tab is in the console, make the first
                // tab we can find inside the tabs the focussed tab.
                focusActiveTabInContainer(tabs.container);
            }
            
            var finish = function() {
                if (onFinishTimer)
                    clearTimeout(onFinishTimer);
        
                onFinishTimer = setTimeout(function() {
                    if (shouldHide) {
                        container.hide();
                    }
                    else {
                        container.$ext.style.minHeight = minHeight + "px";
                        container.minheight = minHeight;
        
                        maxHeight = window.innerHeight - 70;
                        // container.$ext.style.maxHeight = maxHeight + "px";
                    }
        
                    container.height = height + 1;
                    container.setAttribute("height", height);
                    container.$ext.style[apf.CSSPREFIX + "TransitionDuration"] = "";
        
                    animating = false;
        
                    settings.set("state/console/@expanded", !shouldHide);
        
                    apf.layout.forceResize();
                    emit("resize");
                }, 100);
            };
        
            var toHeight;
            var animOn = settings.getBool("user/general/@animateui");
            if (!shouldHide) {
                toHeight = Math.max(minHeight, Math.min(maxHeight, height));
        
                container.$ext.style.minHeight = 0;
                container.setHeight(collapsedHeight);
                //container.$ext.style.height = collapsedHeight + "px";
        
                container.show();
                
                anims.animateSplitBoxNode(container, {
                    height: toHeight + "px",
                    immediate: immediate || !animOn,
                    duration: 0.2,
                    timingFunction: "cubic-bezier(.30, .08, 0, 1)"
                }, finish);
            }
            else {
                toHeight = collapsedHeight;
        
                if (container.parentNode != consoleRow)
                    restoreConsoleHeight();
        
                container.$ext.style.minHeight = 0;
                container.$ext.style.maxHeight = "10000px";
        
                anims.animateSplitBoxNode(container, {
                    height: toHeight + "px",
                    immediate: immediate || !animOn,
                    duration: 0.2,
                    timingFunction: "ease-in-out"
                }, finish);
            }
        }
        
        function openFile(path, active, callback) {
            if (typeof active == "function")
                callback = active, active = false;
            
            open({ path: path, active: active }, callback);
        }
        
        function openEditor(type, active, callback) {
            if (typeof active == "function")
                callback = active, active = false;
            
            open({ editorType: type, active: active }, callback);
        }
        
        function open(options, callback) {
            if (!options.pane) {
                draw();
                options.pane = container.getElementsByTagNameNS(apf.ns.aml, "tab")[0].cloud9pane;
            }
            return tabs.open(options, callback);
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("enable", function() {
            
        });
        plugin.on("disable", function() {
            
        });
        plugin.on("unload", function() {
            tabs.containers.remove(container);
            clear();
            loaded = false;
        });
        
        /***** Register and define API *****/
        
        /**
         * A collapsable panel in the bottom of Cloud9's UI that contains panes, 
         * tabs and editors.
         * 
         * To open new tabs in the console you can use:
         * 
         *     console.open({
         *         path   : "/file.txt",
         *         active : true
         *     }, function(){});
         * 
         * This is equivalent to using the {@link tabManager} to open new tabs:
         * 
         *     tabManager.open({
         *         path   : "/file.txt",
         *         active : true,
         *         pane   : console.getPanes()[0]
         *     }, function(){});
         * 
         * @singleton
         */
        plugin.freezePublicAPI({
            /**
             * The AMLElement for the main panes area.
             * @property {AMLElement} container
             * @readonly
             */
            get container() { return container; },
            
            _events: [
                /**
                 * Fires after the console is drawn.
                 * @event draw
                 */
                "draw",
                /**
                 * Fires when the console is resized
                 * @event resize
                 **/
                "resize",
                /**
                 * Fires when the console is ready for adding new tabs
                 */
                "ready"
             ],
            
            /**
             * Returns an array containing all the tabs in the console.
             */
            getTabs: getTabs,
            
            /**
             * Returns an array containing all the panes in the console.
             */
            getPanes: getPanes,
            
            /**
             * Retrieves the state of all panes, tabs and documents 
             * as a single serializable object.
             * @returns {Object}
             */
            getState: getState,
            
            /**
             * Loads the state of all panes panes, tabs anddocuments from a 
             * simple object.
             * @param {Object}   state      The state describing the pane layout.
             * @param {Boolean}  [init]     When set to true, optimizes the state 
             *   loading for initialization of Cloud9.
             * @param {Function} callback  Called when the state loading is completed.
             */
            setState: setState,
            
            /**
             * Removes all panes, except one, and destroys all tabs, documents 
             * and editors. 
             * 
             * @param {Boolean} [soft=false] When set to true clear
             *   will not unload tabs. This can be useful when loading a new
             *   state with exactly the same tabs. WARNING: this can lead to
             *   leaking tabs/documents, etc. Use with caution! getTabs() will
             *   continue to return all the tabs. Even though they are no longer
             *   attached to a pane.
             */
            clear: clear,
            
            /**
             * Expands the console.
             */
            show: show,
            
            /**
             * Collapses the console.
             */
            hide: hide,
            
            /**
             * Opens a new tab in the console. If the tab with a specified
             * path already exists, that tab is activated. If state is given
             * for a document, then that state is set prior to
             * loading the tab. If a path is specified the file contents is
             * loaded into the document. If no editorType is specified, the
             * editor is determined based on the extension of the filename.
             * 
             * See also {@link tabManager#method-open}
             * 
             * @param options
             * @param {String}   [options.path]          The path of the file to open
             * @param {Pane}     [options.pane]          The pane to attach the new tab to
             * @param {String}   [options.editorType]    The type of the editor for this tab
             * @param {Boolean}  [options.active=false]  Whether this tab is set as active
             * @param {Boolean}  [options.demandExisting=false] Whether to try opening an
             *   existing tab even for tabs without a path.
             * @param {Object}   [options.document]      Object describing the 
             *   state of the document (see {@link Document#method-getState}) 
             * @param {String}   [options.value]         The contents of the file
             * @param {String}   [options.title]         The title of the tab
             * @param {String}   [options.tooltip]       The tooltip at the button of the tab
             * @param {Function} callback 
             * @param {Error}    callback.err            An error that might 
             *   occur during the load of the file contents.
             * @param {Tab}      callback.tab            The created tab.
             * @param {Function} callback.done           Call this function 
             *   when done retrieving the value. This is only relevant if 
             *   -1 is passed to `value`. You are responsible for settings the 
             *   document value yourself, like so: `tab.document.value = "value";`
             * @returns {Tab}                            The created tab.
             * @fires open
             * @fires beforeOpen
             */
            open: open,
            
            /**
             * Opens a new pane tab in the console with the default editor and loads the file
             * contents into the document. This is a convenience method. For
             * the full method description see {@link tabManager#method-open}.
             * 
             * @param {String}   path          The path of the file to open.
             * @param {Boolean}  [active]      When set to true the new tab will become active in it's pane.
             * @param {Function} callback      Called when the file contents is loaded.
             * @param {Error}    callback.err  An error that might 
             *   occur during the load of the file contents.
             * @param {Tab}      callback.tab  The created tab.
             * @returns {Tab} The created tab.
             */
            openFile: openFile,
            
            /**
             * Opens a new tab in the console with a specific editor
             * @param {String}   editorType    The type of the editor for this tab.
             * @param {Boolean}  [active]      When set to true the new tab will become active in it's pane.
             * @param {Function} callback      Called when the editor is loaded.
             * @param {Error}    callback.err  An error that might 
             *   occur during the load of the editor.
             * @param {Tab}      callback.tab  The created tab.
             * @returns {Tab} The created tab.
             */
            openEditor: openEditor
        });
        
        register(null, {
            console: plugin
        });
    }
});
