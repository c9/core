define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "c9", "settings", "ui", "menus", "ace", 
        "ace.gotoline", "tabManager"
    ];
    main.provides = ["ace.status"];
    return main;

    function main(options, imports, register) {
        var c9 = imports.c9;
        var Plugin = imports.Plugin;
        var settings = imports.settings;
        var ui = imports.ui;
        var tabs = imports.tabManager;
        var menus = imports.menus;
        var gotoline = imports["ace.gotoline"];
        var aceHandle = imports.ace;
        
        var skin = require("text!./skin.xml");
        var markup = require("text!./statusbar.xml");
        var menuAml = require("text!./menu.xml");
        
        var aceWhitespace = require("ace/ext/whitespace");
        var lang = require("ace/lib/lang");
        
        /***** Generic Load *****/
        
        // Set up the generic handle
        var handle = new Plugin("Ajax.org", main.consumes);
        var statusbars = {};
        var menuItem, menu, menuTabs;
        
        handle.on("load", function() {
            settings.on("read", function(e) {
                settings.setDefaults("user/ace/statusbar", [["show", "true"]]);
            }, handle);
            
            menuItem = new ui.item({
                test: "1",
                type: "check",
                checked: "user/ace/statusbar/@show"
                // -> if you're looking for disabled, check the init function :-)
                // the moment that someone clicks this thing well call preinit 
                // (its already called if the user has it checked on IDE load)
            });
            
            menus.addItemByPath("View/Status Bar", menuItem, 600, handle);
            
            aceHandle.on("create", function(e) {
                if (e.editor.type != "ace")
                    return;
                
                var editor = e.editor;
                var statusbar;
                
                editor.once("draw", function() {
                    statusbar = new Statusbar(editor);
                }, editor);
                editor.once("unload", function h2() {
                    if (statusbar) statusbar.unload();
                }, editor);
            });
            
            ui.insertMarkup(null, menuAml, handle);
            
            menu = handle.getElement("menu");
            menuTabs = handle.getElement("menuTabs");
            
            var currentSession;
            function setCurrentSession(menu) {
                var node = menu.opener;
                while (node && node.localName != "tab")
                    node = node.parentNode;
                if (!node) return;
                
                var tab = node.cloud9pane.getTab();
                currentSession = tab.document.getSession();
            }
            
            function setOption(name, value) {
                if (currentSession) {
                    if (currentSession.setOption)
                        currentSession.setOption(name, value);
                    currentSession.statusBar.update();
                }
            }
            
            function getOption(name) {
                return currentSession && currentSession.session.getOption(name);
            }
            
            // Checkboxes
            menu.on("afterrender", function(e) {
                var itmSbWrap = handle.getElement("itmSbWrap");
                var itmSbWrapPM = handle.getElement("itmSbWrapPM");
                
                itmSbWrap.on("click", function() {
                    setOption("wrap", itmSbWrap.checked
                        ? itmSbWrapPM.checked ? "printMargin" : true
                        : false);
                });
                itmSbWrapPM.on("click", function() {
                    setOption("wrap", itmSbWrapPM.checked
                        ? "printMargin"
                        : itmSbWrap.checked);
                });
                
                function update(e) {
                    if (!e || e.value) {
                        setCurrentSession(menu);
                        
                        var wrap = getOption("wrap");
                        itmSbWrap.setAttribute("checked", !ui.isFalse(wrap));
                        itmSbWrapPM.setAttribute("checked", wrap == "printMargin");
                    }
                }
                
                menu.on("prop.visible", update);
                update();
            });
            
            // Menu Tab functionality
            var handlers = [
                function() { setOption("useSoftTabs", this.checked); },
                function() {},
                function() { setOption("tabSize", 2); },
                function() { setOption("tabSize", 3); },
                function() { setOption("tabSize", 4); },
                function() { setOption("tabSize", 8); },
                function() {
                    if (!currentSession) return;
                    aceWhitespace.detectIndentation(currentSession.session);
                    currentSession.setOption("guessTabSize", true);
                    currentSession.statusBar.update();
                },
                // Tabs to Spaces
                function() {
                    if (!currentSession) return;
                    aceWhitespace.convertIndentation(currentSession.session, " ");
                    currentSession.statusBar.update();
                },
                // Spaces to Tabs
                function() {
                    if (!currentSession) return;
                    aceWhitespace.convertIndentation(currentSession.session, "\t");
                    currentSession.statusBar.update();
                }
            ];
            
            menuTabs.on("afterrender", function(e) {
                var items = menuTabs.selectNodes("a:item");
                items.forEach(function(node, idx) {
                    node.on("click", handlers[idx]);
                });
                
                var itmTabSize = handle.getElement("itmTabSize");
                itmTabSize.on("afterchange", function() {
                    setOption("tabSize", this.value);
                    update();
                });
                
                var lut = [0, 0, 2, 3, 4, 0, 0, 0, 5];
                
                function update(e) {
                    if (e && !e.value)
                        return;
                    
                    setCurrentSession(menuTabs);
                    
                    items[0].setAttribute("checked", getOption("useSoftTabs"));
                    
                    var tabSize = getOption("tabSize") || 1;
                    items.forEach(function(node, idx) {
                        node.setAttribute("selected", "false");
                    });
                    if (lut[tabSize])
                        items[lut[tabSize]].setAttribute("selected", "true");
                    itmTabSize.setAttribute("value", getOption("tabSize"));
                }
                
                menuTabs.on("prop.visible", update);
                update();
            });
        });
        
        handle.on("unload", function() {
            drawn = false;
            
            Object.keys(statusbars).forEach(function(name) {
                statusbars[name].unload();
            });
            
            statusbars = {};
            menuItem = null;
            menu = null;
            menuTabs = null;
        });
        
        /***** Methods *****/
        
        var drawn = false;
        function draw() {
            if (drawn) return;
            drawn = true;
            
            // Import Skin
            ui.insertSkin({
                name: "c9statusbar",
                data: skin,
            }, handle);
        }
        
        function getStatusbar(editor) {
            return statusbars[editor.name];
        }
        
        function show() {
            settings.set("user/ace/statusbar/@show", "true");
        }
        
        function hide() {
            settings.set("user/ace/statusbar/@show", "false");
        }
        
        /***** Register and define API *****/
        
        /**
         * Manages the status bar instances for ace.
         * @singleton
         **/
        handle.freezePublicAPI({
            /**
             * Show all the status bars.
             */
            show: show,
            
            /**
             * Hide all the status bars.
             */
            hide: hide,
            
            /**
             * Retrieve the status bar that belongs to an ace editor.
             * @param {Editor} ace  The ace editor the status bar belongs to.
             * @return {ace.status.Statusbar}
             */
            getStatusbar: getStatusbar,
            
            /**
             * Inserts CSS for the statusbar.
             * @private
             */
            draw: draw
        });
            
        /***** Initialization *****/
        
        function Statusbar(editor) {
            var plugin = new Plugin("Ajax.org", main.consumes);
            var emit = plugin.getEmitter();
            
            var showRange;
            
            var bar, lblSelection, lblStatus, lblRowCol, lblTabs, lblSyntax; // ui elements
            
            statusbars[editor.name] = plugin;
            
            var loaded = false;
            function load() {
                if (loaded) return false;
                loaded = true;
                
                function updateBarVisible() {
                    if (!settings.getBool("user/ace/statusbar/@show")) {
                        bar && bar.hide();
                        menuItem.enable();
                    }
                    else {
                        draw();
                        bar.show();
                        menuItem.enable();
                    }
                }
                
                settings.on("user/ace/statusbar", updateBarVisible, plugin);
                
                if (settings.getBool("user/ace/statusbar/@show"))
                    draw();
                
                editor.on("documentLoad", function(e) {
                    var doc = e.doc;
                    var session = doc.getSession();
                    session.statusBar = plugin;
                    session.session.on("changeMode", function(e) { statusUpdate.schedule(); });
                    
                    if (!doc.hasValue())
                        doc.once("setValue", function() {
                            statusUpdate.schedule();
                        }, doc);
                }, plugin);
                editor.on("documentActivate", function(e) { statusUpdate.schedule(); }, plugin);
                editor.on("documentUnload", function(e) {
                    delete e.doc.getSession().statusBar;
                }, plugin);
            }
            
            var drawn = false;
            function draw() {
                if (drawn) return;
                drawn = true;
            
                handle.draw();
                
                // Create UI elements
                var htmlNode = editor.aml; //ace.container.parentNode.host;
                ui.insertMarkup(htmlNode, markup, plugin);
                
                function setTheme(e) {
                    var theme = e.theme;
                    if (!theme) return;

                    var cssClass = theme.cssClass;
                    var isDark = theme.isDark;
                    
                    var bg = ui.getStyleRule("." + cssClass, "backgroundColor");
                    
                    bar.setAttribute("class", isDark ? "ace_dark" : "");
                    if (bg) {
                        // bg = bg.replace(/rgb\((.*)\)/, "rgba($1, 0.9)");
                        bar.$ext.style.backgroundColor = bg;
                    }
                }
                editor.on("themeChange", setTheme);
                
                bar = plugin.getElement("bar");
                lblSelection = plugin.getElement("lblSelectionLength");
                lblStatus = plugin.getElement("lblEditorStatus");
                lblRowCol = plugin.getElement("lblRowCol");
                lblTabs = plugin.getElement("lblTabs");
                lblSyntax = plugin.getElement("lblSyntax");
                
                // For editor search of submenus
                bar.editor = editor;
                
                // Set sub menus
                var button = plugin.getElement("btnSbPrefs");
                button.setAttribute("submenu", menu);

                lblTabs.setAttribute("submenu", menuTabs);
                
                var mnuSyntax = menus.get("View/Syntax").menu;
                lblSyntax.setAttribute("submenu", mnuSyntax);
                lblSyntax.on("mousedown", function() {
                    if (editor.activeDocument)
                        tabs.focusTab(editor.activeDocument.tab);
                });
        
                // Click behavior for the labels
                lblSelection.on("click", function() {
                    showRange = !showRange;
                    updateStatus();
                });
                
                lblRowCol.on("click", function() {
                    gotoline.gotoline(null, null, true);
                });
                
                // Hook into ace
                var ace = editor.ace;
                if (!ace.$hasStatusBar) {
                    // Throttle UI updates
                    ace.on("changeSelection", function() { selStatusUpdate.schedule(); });
                    ace.on("changeStatus", function() { statusUpdate.schedule(); });
                    ace.on("keyboardActivity", function() { statusUpdate.schedule(); });
                    ace.renderer.on("scrollbarVisibilityChanged", function(e, renderer) {
                        bar.$ext.style.right = renderer.scrollBarV.getWidth() + 5 + "px";
                        bar.$ext.style.bottom = renderer.scrollBarH.getHeight() + 3 + "px";
                    })(null, ace.renderer);
                    ace.$hasStatusBar = true;
                    
                    var theme = editor.theme;
                    setTheme({ theme: theme });
                }
                
                // Update status information
                updateStatus();
                
                emit("draw");
            }
            
            var selStatusUpdate = lang.delayedCall(updateSelStatus, 10);
            var statusUpdate = lang.delayedCall(updateStatus, 10);
            
            /***** Helper Functions *****/
            
            function updateSelStatus() {
                var ace = editor.ace;
                if (!ace || !drawn || !ace.selection) return;
                
                var selLen;
                if (!ace.selection.isEmpty()) {
                    var range = ace.getSelectionRange();
                    
                    if (showRange) {
                        selLen = "(" +
                            (range.end.row - range.start.row) + ":" +
                            (range.end.column - range.start.column) + ")";
                    } 
                    else {
                        selLen = "(" + ace.session.getTextRange(range).length + " Bytes)";
                    }
                } 
                setCaption(lblSelection, selLen);
                
                var cursor = ace.selection.lead;
                var columnText = (cursor.row + 1) + ":" + (cursor.column + 1);
                if (ace.selection.rangeCount)
                    columnText += " [\u202f" + ace.selection.rangeCount + "\u202f]";
                setCaption(lblRowCol, columnText);
            }
            
            function updateStatus() {
                var ace = editor.ace;
                if (!ace || !drawn) return;
                
                updateSelStatus();
                
                setCaption(lblTabs, 
                    (ace.getOption("useSoftTabs") ? "Spaces" : "Tabs") + ": "
                      + ace.getOption("tabSize")); // "\\[" + + "\\]");
                
                var status = ace.keyBinding.getStatusText() || "";
                if (ace.commands.recording)
                    status = "REC";
                    
                setCaption(lblStatus, status);
                
                var caption = aceHandle.getSyntaxCaption(ace.session.syntax);
                setCaption(lblSyntax, caption);
            }
            
            function setCaption(lbl, value) {
                if (!lbl) return;
                if (!value) return lbl.hide();
                if (!lbl.visible) lbl.show();
                lbl.setAttribute("caption", value);
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
                loaded = false;
            });
            
            /***** Register and define API *****/
            
            /**
             * The status bar for ace editors.
             * @class ace.status.Statusbar
             **/
            plugin.freezePublicAPI({
                /**
                 * Redraw the display of the statusbar
                 */
                update: updateStatus
            });
            
            plugin.load(null, "acestatus");
            
            return plugin;
        }
        
        register(null, {
            "ace.status": handle
        });
    }
});