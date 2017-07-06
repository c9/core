/*global nativeRequire*/
define(function(require, exports, module) {
    main.consumes = [
        "c9", "Plugin", "info", "menus", "ui", "commands", "login",
        "tabManager", "tree.favorites", "auth", "settings", "api"
    ];
    main.provides = ["projectManager"];
    return main;

    function main(options, imports, register) {
        var c9 = imports.c9;
        var Plugin = imports.Plugin;
        var info = imports.info;
        var menus = imports.menus;
        var login = imports.login;
        var api = imports.api;
        var ui = imports.ui;
        var commands = imports.commands;
        var tabManager = imports.tabManager;
        var favs = imports["tree.favorites"];
        var auth = imports.auth;
        var settings = imports.settings;

        // Some require magic to get nw.gui
        var nw = nativeRequire("nw.gui"); 
        
        // Ref to window
        var win = nw.Window.get();
        var app = nw.App;
        var server = window.server;
        var windowManager = server.windowManager;
            
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        // var emit = plugin.getEmitter();
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            commands.addCommand({
                name: "newWindow",
                exec: function() {
                    var state = JSON.parse(JSON.stringify(settings.model.state));
                    var stateSettings = {
                        console: state.console,
                        panels: state.panels,
                        menus: state.menus
                    };
                    delete stateSettings.console["json()"];
                    
                    server.openWindow({
                        stateSettings: stateSettings,
                        focus: true
                    }, showProgress());
                }
            }, plugin);
            
            commands.addCommand({
                name: "closeEmptyWindow",
                bindKey: { win: "ctrl-w", mac: "cmd-w" },
                exec: function () { win.close(); },
                isAvailable: function() {
                    return tabManager.getTabs().filter(function(t) {
                        return t.pane.visible;
                    }).length;
                }
            }, plugin);
            
            menus.addItemByPath("File/New Window", new ui.item({
                value: "",
                command: "newWindow"
            }), 250, plugin);
            
            var c = 900;
            
            menus.addItemByPath("Cloud9/~", new ui.divider(), c += 100, plugin);
            
            // projects menu
            menus.addItemByPath("Cloud9/Recent Windows/", new ui.menu({
                "onprop.visible": function(e) {
                    if (e.value) {
                        windowManager.getRecentWindows(function(err, recentWindows) {
                            recentWindows = recentWindows.sort(function(a, b) {
                                if (b.isOpen !== a.isOpen)
                                    return b.isOpen ? 1 : -1;
                                if (b.isEmpty !== a.isEmpty)
                                    return b.isEmpty ? -1 : 1;
                                return b.time - a.time;
                            });
                            
                            menus.remove("Cloud9/Recent Windows/");
                            
                            var dividerAdded = false;
                            var c = 0;
                            recentWindows.forEach(function(x) {
                                if (!x.isOpen && !dividerAdded) {
                                    dividerAdded = true;
                                    menus.addItemByPath("Cloud9/Recent Windows/~", 
                                        new ui.divider(), c += 100, plugin);
                                }
                                addMenuItem("Cloud9/Recent Windows/", x, c += 100);
                            });
                        });
                    }
                },
                "onitemclick": function(e) {
                    var options = e.value;
                    options.focus = true;
                    server.openWindow(options, showProgress());
                }
            }), c += 100, plugin);
            
            login.on("ready", function(e) {
                var name = "user_" + e.id;
                var c = 0;
                
                menus.addItemByPath(name + "/My Workspaces/", new ui.menu({
                    "onprop.visible": function(e) {
                        if (e.value) updateC9Projects("");
                    },
                    "onitemclick": function(e) {
                        var options = e.relatedNode.value;
                        if (options) {
                            options.focus = true;
                            server.openWindow(options, showProgress());
                        }
                    }
                }), c += 100, plugin);
                
                menus.addItemByPath(name + "/Shared Workspaces/", new ui.menu({
                    "onprop.visible": function(e) {
                        if (e.value) updateC9Projects("/shared");
                    },
                    "onitemclick": function(e) {
                        var options = e.relatedNode.value;
                        if (options) {
                            options.focus = true;
                            server.openWindow(options, showProgress());
                        }
                    }
                }), c += 100, plugin);
                
                addDisabled(name, "/My Workspaces/Loading workspace list...");
                addDisabled(name, "/Shared Workspaces/Loading workspace list...");
                    
                // menus.addItemByPath(name + "/Projects/~", new ui.divider(), c += 100, plugin);
                menus.addItemByPath(name + "/~", new ui.divider(), c += 100, plugin);
            });
                
            function updateC9Projects(type) {
                info.getUser(function(err, user) {
                    if (err) return console.error(err);
                    api.user.get("projects" + type, function(err, projects) {
                        var c = 0;
                        var name = "user_" + user.id;
                        var menuName = name + (type ? "/Shared Workspaces/" : "/My Workspaces/");
                        menus.remove(menuName);
                        
                        if (err || !projects) {
                            menus.addItemByPath(menuName + "Error while loading workspace list", 
                                new ui.item({ disabled: true }), c, plugin);
                            return;
                        }
                        
                        if (projects && projects.length) {
                            projects.map(function(x) {
                                return {
                                    name: x.owner.name + "/" + x.name,
                                    projectName: x.name,
                                    pid: x.pid,
                                    isRemote: true,
                                };
                            }).sort(function(a, b) {
                                return a.name.localeCompare(b.name);
                            }).forEach(function (x) {
                                addMenuItem(menuName, x, c += 100);
                            });
                        } else {
                            addDisabled(menuName, type
                                ? "You have no Shared workspaces" 
                                : "You have no workspaces");
                        }
                    });
                });
            }
            
            function addMenuItem(menu, value, c) {
                menus.addItemByPath(menu + menus.escape(value.name),
                    new ui.item({ value: value }), c || 0, plugin);
            }
            
            function addDisabled(name, path) {
                menus.addItemByPath(name + path, 
                    new ui.item({ disabled: true }), 0, plugin);
            }
            
            function updateFavorites() {
                windowManager.setFavorites(win.options.id, favs.favorites);
            }
            
            function updateLoginState(e) {
                if (e.oldUid === e.uid)
                    return;
                windowManager.signalToAll("checkLogin", {
                    winId: win.id,
                    uid: e.newUid || e.uid
                });
            }
            
            win.on("checkLogin", function(e) {
                if (e && e.winId != win.id)
                    auth.login(e.uid != -1);
            });
            
            auth.on("login", updateLoginState);
            auth.on("logout", updateLoginState);
            favs.on("favoriteRemove", updateFavorites);
            favs.on("favoriteAdd", updateFavorites);
            favs.on("favoriteReorder", updateFavorites);
            updateFavorites();
        }
        
        /***** Methods *****/
        
        function showProgress() {
            // window needed for windows and win on mac
            window.addEventListener("blur", restoreCursor);
            win.on("blur", restoreCursor);
            window.addEventListener("mousedown", restoreCursor);
            ui.setStyleRule("*", "cursor", "progress!important");
            function restoreCursor() {
                ui.setStyleRule("*", "cursor", "");
                window.removeEventListener("blur", restoreCursor);
                win.removeListener("blur", restoreCursor);
                window.removeEventListener("mousedown", restoreCursor);
            }
            return restoreCursor;
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
            
        });
        
        register(null, {
            projectManager: plugin
        });
    }
});
