/*global nativeRequire nwDispatcher windowManager*/
define(function(require, exports, module) {
    main.consumes = [
        "c9", "Plugin", "menus", "settings", "ui", 
        "upload", "commands", "dialog.question", 
        "layout", "dialog.error", "util", "MenuItem",
    ];
    main.provides = ["window.frame"];
    return main;

    function main(options, imports, register) {
        var c9 = imports.c9;
        var ui = imports.ui;
        var menus = imports.menus;
        var Plugin = imports.Plugin;
        var settings = imports.settings;
        var commands = imports.commands;
        var util = imports.util;
        var layout = imports.layout;
        var question = imports["dialog.question"];
        var error = imports["dialog.error"];

        // Some require magic to get nw.gui
        var nw = nativeRequire("nw.gui"); 
        
        // Ref to window
        var win = nw.Window.get();
        var Menu = nw.Menu;
        var MenuItem = nw.MenuItem;
        var Tray = nw.Tray;
        var tray, nativeTitle, title, titlebar;
            
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        // var emit = plugin.getEmitter();
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            // Load native title
            setNativeTitle();
            
            // When the UI is loaded, show the window
            c9.once("ready", function() {
                // Check Window Location
                validateWindowGeometry();
            }, plugin);
            
            win.on("focusWindow", focusWindow);

            // Menu Items
            menus.addItemByPath("Cloud9/~", new ui.divider(), 2000000, plugin);
            menus.addItemByPath("Cloud9/Quit Cloud9", new ui.item({
                selector: "closeAllWindowsQuit:",
                command: "exit"
            }), 2000100, plugin);

            menus.addItemByPath("Window/Developer Tools", new ui.item({
                onclick: function() {
                    win.showDevTools();
                }
            }), 2000000, plugin);
            
            menus.addItemByPath("View/~", new ui.divider(), 800, plugin);
            
            var itemFullscreen = new ui.item({
                isAvailable: function() {
                    itemFullscreen.setAttribute("caption", 
                        win.isFullscreen 
                            ? "Leave Full Screen" 
                            : "Enter Full Screen");
                    return true;
                },
                command: "toggleFullscreen"
            });
            menus.addItemByPath("View/Enter Full Screen", 
                itemFullscreen, 900, plugin);
            
            commands.addCommand({
                name: "exit",
                bindKey: { mac: "Command-Q", win: "" },
                exec: function() { windowManager.quit(); }
            }, plugin);
            
            commands.addCommand({
                name: "closeWindow",
                bindKey: { mac: "", win: "Alt-F4" },
                exec: function() { win.emit("close", "quit"); }
            }, plugin);
            
            commands.addCommand({
                name: "fallback",
                bindKey: { mac: "Command-W", win: "Ctrl-F4" },
                isAvailable: function() {
                    return true;
                },
                exec: function() {
                    // Do nothing
                }
            }, plugin);
            
            commands.addCommand({
                name: "toggleFullscreen",
                exec: function() {
                    setTimeout(function() {
                        win.isFullscreen 
                            ? win.leaveFullscreen()
                            : win.enterFullscreen(); 
                    }, 100);
                }
            }, plugin);
            
            // Deal with closing
            win.on("askForQuit", function(quit) {
                var acceptQuit = quit ? windowManager.quitAll : saveAndQuit;
                // Fetch quit message, if any
                var message = window.onbeforeunload && window.onbeforeunload();
                if (message) {
                    question.show("Quit Cloud9?",
                        "Are you sure you want to " + (quit ? "exit Cloud9?" : "close this window"),
                        "Cloud9 will preserve your entire state. "
                            + "Even unsaved files or changes will still "
                            + "be available the next time you start cloud9.",
                        function() { // yes
                            settings.set("user/general/@confirmexit", 
                                !question.dontAsk);
                            
                            acceptQuit();
                        },
                        function() { // no
                            settings.set("user/general/@confirmexit", 
                                !question.dontAsk);
                            
                            if (quit)
                                windowManager.unquit();
                        }, {
                            showDontAsk: true,
                            yes: "Quit",
                            no: "Cancel",
                        });
                    // make sure nothing can cover this dialog
                    question.once("show", function() {
                        question.aml.setProperty("zindex", 30000000);
                    });
                    focusWindow();
                } else {
                    acceptQuit();
                }
            });
            
            win.on("saveAndQuit", saveAndQuit);
            
            win.on("close", function(quit) {
                win.emit("askForQuit", quit);
            });
            
            // saving can be slow for remote workspaces
            // so we hide window, Save All State and then quit
            function saveAndQuit() {
                win.hide();
                
                // Prepare cloud9 for quitting
                c9.beforequit();
                
                // Notify plugins that we're quitting
                c9.quit();
                
                // Unregister the window
                windowManager.onClose(window.win.options.id);
                
                win.close(true);
            }

            // Settings
            settings.on("read", function() {
                settings.setDefaults("user/local", [
                    ["tray", "false"]
                ]);
                if (settings.getBool("user/local/@tray"))
                    toggleTray(true);
            }, plugin);

            settings.on("user/local", function() {
                if (Boolean(tray) !== settings.getBool("user/local/@tray"))
                    toggleTray(!tray);
                if (nativeTitle !== settings.getBool("user/local/@nativeTitle"))
                    switchNativeTitle(!nativeTitle);
            }, plugin);
            
            // Preferences
            // prefs.add({
            //   "General" : {
            //       position: 100,
            //       "General" : {
            //           "Show Tray Icon" : {
            //               type: "checkbox",
            //               path: "user/local/@tray",
            //               position: 300
            //           }
            //           // "Use Native Title Bar (requires restart)" : {
            //           //     type : "checkbox",
            //           //     path : "user/local/@nativeTitle",
            //           //     position : 300
            //           // }
            //       }
            //   }
            // }, plugin);
            
            // Window
            win.on("minimize", function() {
                win.isMinimized = true;
                settings.set("state/local/window/@minimized", true);
            });
            win.on("restore", function() {
                win.isMinimized = false;
                settings.set("state/local/window/@minimized", false);
            });
            win.on("maximize", function() {
                win.isMaximized = true;
                settings.set("state/local/window/@maximized", true);
            });
            win.on("unmaximize", function() {
                win.isMaximized = false;
                settings.set("state/local/window/@maximized", false);
            });
            
            var handler = storeWindowSettings.bind(null, false);
            win.on("move", handler);
            win.on("resize", handler);
            win.on("enter-fullscreen", handler);
            win.on("leave-fullscreen", handler);
        }
        
        /***** Methods *****/
        
        var timer;
        function storeWindowSettings(force) {
            if (!force) {
                clearTimeout(timer);
                timer = setTimeout(storeWindowSettings.bind(null, true), 1000);
                return;
            }
            
            settings.set("state/local/window/@fullscreen", win.isFullscreen);
                
            win.emit("savePosition");
            
            if (win.isFullscreen || win.isMaximized || win.isMinimized)
                return;
            
            settings.set("state/local/window/@position", win.x + ":" + win.y);
            settings.set("state/local/window/@size", win.width + ":" + win.height);
        }

        function toggleTray(to) {
            if (to) {
                // Create a tray icon
                tray = new Tray({ icon: 'favicon.ico' });

                // Give it a menu
                var menu = new Menu();
                menu.append(new MenuItem({ 
                    label: 'Visit c9.io', 
                    click: function() {
                        window.open("http://c9.io");
                    }
                }));
                menu.append(new MenuItem({ 
                    label: 'Show Developer Tools', 
                    click: function() {
                        win.showDevTools();
                    }
                }));
                tray.menu = menu;
            }
            else {
                // Remove the tray
                tray.remove();
                tray = null;
            }
        }

        function switchNativeTitle(to) {

        }

        function setNativeTitle() {
            ui.insertCss(require("text!./local.less"), options.staticPrefix, plugin);
            
            var platform = process.platform; // c9.platform is remote os platform so we use process instead
            var titleHeight = platform == "win32" ? 27 : 23;
            
            var isMaximized = settings.get("state/local/window/@maximized");
            
            error.top = titleHeight + 1;
            
            var div = document.body.appendChild(document.createElement("div"));
            div.className = "window-border";
            
            // Move elements down to make room for the title bar
            layout.getElement("root").setAttribute("anchors", titleHeight + " 0 0 0");
            document.querySelector(".c9-mbar-round").style.display = "none";
            document.querySelector(".c9-mbar-logo").style.paddingTop = "0";
            document.querySelector(".c9-menu-bar .c9-mbar-cont").style.paddingRight = "16px";
            
            ui.setStyleRule(".right .panelsbar", "top", "-1px");
            ui.setStyleRule(".right .panelsbar", "position", "absolute");
            
            var logobar = layout.getElement("logobar");
            if (!menus.minimized)
                logobar.setHeight(27);
            logobar.$ext.style.maxHeight = "27px";
            
            titlebar = document.body.appendChild(document.createElement("div"));
            titlebar.className = "window-titlebar focus " + platform + (isMaximized ? " maximized" : "");

            // Caption
            title = titlebar.appendChild(document.createElement("div"));
            title.className = "caption";
            
            // Maximize
            var fullscreenbtn = titlebar.appendChild(document.createElement("div"));
            fullscreenbtn.className = "fullscreen";
            fullscreenbtn.addEventListener("click", function() {
                win.enterFullscreen();
            });
            
            // Buttons
            var closebtn = titlebar.appendChild(document.createElement("div"));
            closebtn.className = "closebtn";
            closebtn.addEventListener("click", function() {
                win.close();
            });
            var minbtn = titlebar.appendChild(document.createElement("div"));
            minbtn.className = "minbtn";
            minbtn.addEventListener("click", function() {
                win.minimize();
            });
            var maxbtn = titlebar.appendChild(document.createElement("div"));
            maxbtn.className = "maxbtn";
            maxbtn.addEventListener("click", function() {
                isMaximized && !apf.isMac
                    ? win.unmaximize()
                    : win.maximize();
            });
            
            win.on("blur", function() {
                titlebar.className = titlebar.className.replace(/ focus/g, "");
            });
            win.on("focus", function() {
                titlebar.className += " focus";
            });
            win.on("maximize", function() {
                titlebar.className += " maximized";
                isMaximized = true;
            });
            win.on("unmaximize", function() {
                titlebar.className = titlebar.className.replace(/ maximized/g, "");
                isMaximized = false;
            });
            
            var timer;
            var lastScreen = util.extend({}, screen);
            win.on("move", function(x, y) {
                clearTimeout(timer);
                timer = setTimeout(checkScreen, 500);
            });
            
            // Temporary Hack - need resolution event
            setInterval(checkScreen, 2000);
            
            function checkScreen() {
                var s = lastScreen;
                lastScreen = util.extend({}, screen);
                if (!util.isEqual(s, lastScreen))
                    validateWindowGeometry(true);
            }

            win.on("leave-fullscreen", function() {
                layout.getElement("root").setAttribute("anchors", titleHeight + " 0 0 0");
                titlebar.style.display = "block";
                document.body.classList.remove("fullscreen");
            });
            var enterFullscreen = function() {
                layout.getElement("root").setAttribute("anchors", "0 0 0 0");
                titlebar.style.display = "none";
                document.body.classList.add("fullscreen");
            };
            win.on("enter-fullscreen", enterFullscreen);
            
            if (win.isFullscreen) enterFullscreen();
            
            var menubar = document.querySelector(".c9-menu-bar");
            menubar.style.backgroundPosition = "0 -4px";
            menubar.style.webkitUserSelect = "none";
        }
        
        function focusWindow() {
            // To support all platforms, we need to call both show and focus
            win.show();
            win.focus();
        }
        
        function validateWindowGeometry(fitInScreen) {
            if (settings.get("state/local/window/@maximized"))
                return;
                
            // Check if Window Position is In view
            var changedSize;
            var changedPos;
            
            var width = Math.max(400, win.width);
            var height = Math.max(300, win.height);
            
            if (width > screen.availWidth) {
                width = screen.availWidth;
                changedSize = true;
            }
            
            if (height > screen.availHeight) {
                height = screen.availHeight;
                changedSize = true;
            }
            
            var left = win.x;
            var top = win.y;
            
            var minLeft = screen.width - screen.availWidth; // Guestimate
            if (left < minLeft) {
                left = screen.availLeft;
                changedPos = true;
            }
            else if (left > screen.availWidth + screen.availLeft) {
                left = screen.availWidth + screen.availLeft - 100;
                changedPos = true;
            }
            
            if (top < screen.availTop) {
                top = screen.availTop;
                changedPos = true;
            }
            else if (top > screen.availHeight + screen.availTop) {
                top = screen.availHeight + screen.availTop - 100;
                changedPos = true;
            }
            else if (fitInScreen && height + top > screen.availTop + screen.availHeight) {
                top = screen.availTop;
                height = screen.availHeight;
                changedPos = true;
                changedSize = true;
            }
            
            if (changedPos)
                win.moveTo(left, top);
            
            if (changedSize)
                win.resizeTo(width, height);
        }
        
        function setTitle(str) {
            if (title)
                title.textContent = str;
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
            toggleTray(false);

            loaded = false;
        });
        
        /***** Register and define API *****/
        
        /**
         * Draws the file tree
         * @event afterfilesave Fires after a file is saved
         * @param {Object} e
         *     node     {XMLNode} description
         *     oldpath  {String} description
         **/
        plugin.freezePublicAPI({
            /**
             * 
             */
            focusWindow: focusWindow,
            setTitle: setTitle
        });
        
        register(null, {
            "window.frame": plugin
        });
    }
});
