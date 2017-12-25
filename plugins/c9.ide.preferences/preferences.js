define(function(require, exports, module) {
    main.consumes = [
        "Editor", "editors", "ui", "commands", "menus", "layout", 
        "tabManager", "util", "settings"
    ];
    main.provides = ["preferences"];
    return main;
    
    /*
        * General Settings
        * Project Settings
        * Key Bindings
        - TextMate Bundles
        - Themes
            - http://tmtheme-editor.herokuapp.com/#/PlasticCodeWrap
    */
    
    function main(options, imports, register) {
        var Editor = imports.Editor;
        var editors = imports.editors;
        var tabs = imports.tabManager;
        var commands = imports.commands;
        var settings = imports.settings;
        var menus = imports.menus;
        var util = imports.util;
        var layout = imports.layout;
        var ui = imports.ui;
        
        var debug = location.href.indexOf('menus=1') > -1;
        
        /***** Initialization *****/
        
        var extensions = [];
        
        var handle = editors.register("preferences", "Preferences", 
                                      Preferences, extensions);
        var emit = handle.getEmitter();
        emit.setMaxListeners(1000);
        
        var WIDTH = "300";
        
        var drawn = false;
        var parent, navigation, activePanel, container;
        
        function focusOpenPrefs() {
            var pages = tabs.getTabs();
            for (var i = 0, tab = pages[i]; tab; tab = pages[i++]) {
                if (tab.editorType == "preferences") {
                    tabs.focusTab(tab);
                    return true;
                }
            }
        }
        
        handle.on("load", function() {
            settings.on("read", function() {
                settings.setDefaults("user/general", [["animateui", true]]);
            });
            
            commands.addCommand({
                name: "openpreferences",
                hint: "show the open settings panel",
                group: "General",
                bindKey: { mac: "Command-,", win: "Ctrl-," },
                exec: function (editor, args) {
                    var tab = tabs.focussedTab;
                    var toggle = args.toggle || args.source == "click";
                    if (tab && tab.editor.type == "preferences" && toggle) {
                        tab.close();
                        return;
                    }
                    if (focusOpenPrefs()) {
                        if (args.panel)
                            activate(args.panel, args.section);
                        
                        return;
                    }
    
                    tabs.open({
                        editorType: "preferences",
                        active: true
                    }, function() {
                        if (args.panel)
                            activate(args.panel, args.section);
                    });
                }
            }, handle);
            
            var menu = tabs.getElement("mnuEditors");
            menus.addItemToMenu(menu, 
                new ui.item({
                    caption: "Open Preferences",
                    hotkey: "commands.openpreferences",
                    onclick: function(e) {
                        if (focusOpenPrefs())
                            return;
                        
                        e.pane = this.parentNode.pane;
                        tabs.open({
                            editorType: "preferences",
                            active: true,
                            pane: e.pane
                        }, function() {});
                    }
                }), 500, handle);
            
            menus.addItemByPath("Cloud9/~", new ui.divider(), 280, handle);
            menus.addItemByPath("Cloud9/Preferences", new ui.item({
                command: "openpreferences"
            }), 300, handle);
            
            var btn = new ui.button({
                "skin": "c9-menu-btn",
                "class": "preferences",
                "tooltip": "Preferences",
                // "width"   : 28,
                "command": "openpreferences"
            });
            ui.insertByIndex(layout.findParent({ 
                name: "preferences" 
            }), btn, 900, handle);
            
            navigation = new ui.bar({
                htmlNode: document.body,
                "width": "170",
                "class": "navigation",
                "style": "overflow-y:auto; overflow-x:hidden",
                "visible": "false"
            });
        });
        
        function draw(e) {
            if (drawn) return;
            drawn = true;
            
            // Insert CSS
            var css = require("text!./preferences.css");
            ui.insertCss(css, null, handle);
            
            // Create UI elements
            parent = e.tab.appendChild(new ui.hsplitbox({
                "class": "bar-preferences",
                "anchors": "0 0 0 0",
            }));
            parent.appendChild(navigation);
            container = parent.appendChild(new ui.bar());
            handle.addElement(parent);
            
            navigation.show();
            
            emit("draw");
        }
        
        /***** Methods *****/
        
        function addNavigation(caption, index, parent, plugin) {
            var level = parent ? parent.level + 1 : 1;
            var markup = "<div class='level" + level 
                + "'><" + (level != 2 ? "a" : "span")
                + ">" + (debug ? "[" + (index || "") + "] " : "") + caption 
                + "</" + (level != 2 ? "a" : "span") 
                + "></div>";
            
            if (!parent)
                parent = navigation.$int;
            else {
                if (parent.lastChild.tagName == "BLOCKQUOTE")
                    parent = parent.lastChild;
                else
                    parent = parent.appendChild(
                        document.createElement("blockquote"));
            }
            
            var htmlNode = ui.insertHtml(parent, markup, plugin)[0];
            ui.insertByIndex(parent, htmlNode, index, false);
            
            htmlNode.level = level;
            htmlNode.name = plugin.name;
            htmlNode.hostPlugin = plugin;
            
            return htmlNode;
        }
        
        function activate(panel, section) {
            if (!drawn) {
                if (!activePanel)
                    handle.once("draw", function() { activate(activePanel); });
                activePanel = panel;
                return;
            }
            if (typeof panel == "string") {
                var panels = navigation && navigation.$ext && navigation.$ext.children;
                if (panels) {
                    for (var i = 0; i < panels.length; i++) {
                        if (panels[i].name == panel || panels[i].name == "preferences." + panel) {
                            panel = panels[i].hostPlugin;
                            break;
                        }
                    }
                }
            }
            if (!panel || !panel.show)
                return console.error("Couldn't find preference panel", panel);
            if (activePanel && activePanel != panel)
                activePanel.hide();
            panel.show(!activePanel);
            if (section)
                panel.scrollTo(section);
            activePanel = panel;
        }
        
        function add(state, plugin) {
            emit("add", {
                state: state,
                plugin: plugin
            });
        }
        
        /***** Register and define API *****/
        
        /**
         * The presentation handle. This is the object you get when you 
         * request the preferences service in your plugin. Use this object
         * to add your preference definition.
         * 
         * Example:
         * 
         *     define(function(require, exports, module) {
         *         main.consumes = ["preferences"];
         *         main.provides = ["myplugin"];
         *         return main;
         *     
         *         function main(options, imports, register) {
         *             var prefs = imports.preferences;
         *             
         *             prefs.add({
         *                "General" : {
         *                     position : 10,
         *                     "User Interface" : {
         *                         position : 20,
         *                         "Enable UI Animations" : {
         *                             type     : "checkbox",
         *                             setting  : "user/general/@animateui",
         *                             position : 1000
         *                         }
         *                     }
         *                 }
         *             }, plugin);
         *         });
         *     });
         * 
         * 
         * @class preferences
         * @extends Plugin
         * @singleton
         */
        handle.freezePublicAPI({
            /**
             * The panel that is currently being shown
             * @property {PreferencePanel} activePanel
             * @readonly
             */
            get activePanel() { return activePanel; },
            
            /**
             * The APF UI element that is the containing element of the preference editor.
             * This property is here for internal reasons only. *Do not 
             * depend on this property in your plugin.*
             * @property {AMLElement} aml
             * @private
             * @readonly
             */
            get aml() { return container; },
            
            /**
             * The DOM element that is the containing element in the UI.
             * @property {DOMElement} container
             * @readonly
             */
            get container() { return container.$int; },
            
            _events: [
                /**
                 * Fires when the add method is caled
                 * @event add
                 * @param {Object} e
                 * @param {Object} e.state  The state that is being passed to the add method.
                 * @param {Plugin} e.plugin The plugin that called the add method
                 */
                "add"
            ],
            
            /**
             * @method add
             * @inheritdoc preferences.Preferences#add
             */
            add: add,
            
            /**
             * Adds an item to the navigation on the left of the preference
             * editor.
             * @param {String}      caption  The caption of the navigation item.
             * @param {Number}      index    The position of the navigation item.
             * @param {HTMLElement} parent   The parent of the navigation item. 
             *   Pass null if this is a root item.
             * @param {Plugin}      plugin   The plugin responsible for adding
             *   the navigation item.
             * @return {HTMLElement} returns the html element that is added and
             *   can be used to create sub navigation items.
             */
            addNavigation: addNavigation,
            
            /**
             * Activates a preference panel which will show that panel and 
             * hide the currently active panel.
             * @param {PreferencePanel} Panel  The panel to activate
             */
            activate: activate
        });
        
        /***** Editor *****/
        
        function Preferences() {
            var plugin = new Editor("Ajax.org", main.consumes, extensions);
            //var emit = plugin.getEmitter();
            var tab;
            
            plugin.on("resize", function(e) {
                emit("resize", e);
            });
            
            plugin.on("draw", function(e) {
                tab = e.tab;
                draw(e);
            });
            
            plugin.on("getState", function(e) {
                e.state.activePanel = activePanel && activePanel.name;
                e.state.section = activePanel && activePanel.section;
            });
            plugin.on("setState", function(e) {
                activate(e.state.activePanel, e.state.section);
            });
            
            /***** Lifecycle *****/
            
            plugin.on("documentLoad", function(e) {
                var doc = e.doc;
                doc.title = "Preferences";
                
                function setTheme() {
                    var bg = ui.getStyleRule(".bar-preferences .container .header", "backgroundColor") || "#F0F0F0";
                    doc.tab.backgroundColor = bg; //"#2d2d2d";
                    if (util.shadeColor(bg, 1).isLight)
                        doc.tab.classList.remove("dark");
                    else
                        doc.tab.classList.add("dark");
                }
                
                layout.on("themeChange", setTheme, e.doc);
                setTheme();
            });
            plugin.on("documentActivate", function(e) {
                e.doc.tab.on("unload", function() {
                    if (parent.parentNode == tab)
                        tab.removeChild(parent);
                });
                
                tab.appendChild(parent);
                
                emit("show");
            });
            
            /***** Register and define API *****/
            
            /**
             * Preference Editor for Cloud9. Use the `add` method to add 
             * a UI to allow a user to edit your plugin's settings.
             * 
             * Example of adding settings for the terminal:
             * 
             *     prefs.add({
             *         "Editors" : {
             *             "Terminal" : {
             *                 position : 100,
             *                 "Text Color" : {
             *                    type     : "colorbox",
             *                    setting  : "user/terminal/@foregroundColor",
             *                    position : 10100
             *                 },
             *                 "Background Color" : {
             *                    type     : "colorbox",
             *                    setting  : "user/terminal/@backgroundColor",
             *                    position : 10200
             *                 },
             *                 "Selection Color" : {
             *                    type     : "colorbox",
             *                    setting  : "user/terminal/@selectionColor",
             *                    position : 10250
             *                 },
             *                 "Font Family" : {
             *                    type     : "textbox",
             *                    setting  : "user/terminal/@fontfamily",
             *                    position : 10300
             *                 },
             *                 "Font Size" : {
             *                    type     : "spinner",
             *                    setting  : "user/terminal/@fontsize",
             *                    min      : "1",
             *                    max      : "72",
             *                    position : 11000
             *                 },
             *                 "Antialiased Fonts" : {
             *                    type     : "checkbox",
             *                    setting  : "user/terminal/@antialiasedfonts",
             *                    position : 12000
             *                 },
             *                 "Blinking Cursor" : {
             *                    type     : "checkbox",
             *                    setting  : "user/terminal/@blinking",
             *                    position : 12000
             *                 },
             *                 "Scrollback" : {
             *                    type     : "spinner",
             *                    setting  : "user/terminal/@scrollback",
             *                    min      : "1",
             *                    max      : "100000",
             *                    position : 13000
             *                 }
             *             }
             *         }
             *     }, plugin);
             * 
             * @class preferences.Preferences
             * @extends Editor
             */
            plugin.freezePublicAPI({
                /**
                 * Adds new preference form elements to the preference editor.
                 * 
                 * The preference editor uses the {@link Form} elements 
                 * internally. See {@link Form#constructor} for a detailed description
                 * of the available elements and their properties.
                 * 
                 * Instead of providing the `defaultValue` or `value` property
                 * set the `setting` property to the setting that the
                 * user can edit. See {@link settings} for more information.
                 * 
                 * Example (from find in files):
                 * 
                 *     prefs.add({
                 *        "General" : {
                 *            position : 100,
                 *            "Find in Files" : {
                 *                position : 30,
                 *                 "Show Full Path in Results" : {
                 *                     type     : "checkbox",
                 *                     position : 100,
                 *                     setting  : "user/findinfiles/@fullpath"
                 *                 },
                 *                 "Clear Results Before Each Search" : {
                 *                     type     : "checkbox",
                 *                     position : 100,
                 *                     setting  : "user/findinfiles/@clear"
                 *                 },
                 *                 "Scroll Down as Search Results Come In" : {
                 *                     type     : "checkbox",
                 *                     position : 100,
                 *                     setting  : "user/findinfiles/@scrolldown"
                 *                 },
                 *                 "Open Files when Navigating Results with ↓ ↑" : {
                 *                     type     : "checkbox",
                 *                     position : 100,
                 *                     setting  : "user/findinfiles/@consolelaunch"
                 *                 }
                 *            }
                 *        }
                 *     }, plugin);
                 *   
                 * 
                 * @param {Object} definition  The definition object consists
                 * of three levels of objects. The first level describes the primary
                 * heading. Under this level are sub headings. The third level
                 * describes the form elements to add. The key of each level
                 * is used as the caption in the UI.
                 */
                add: add
            });
            
            plugin.load(null, "preferences");
            
            return plugin;
        }
        
        register(null, {
            preferences: handle
        });
    }
});