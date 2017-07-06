/*global nativeRequire*/
define(function(require, exports, module) {
    main.consumes = [
        "c9", "Plugin", "info", "menus", "ui", "commands", "login",
        "auth", "settings", "api"
    ];
    main.provides = ["projectManager"];
    return main;

    function main(options, imports, register) {
        var commands = imports.commands;
        var Plugin = imports.Plugin;
        var menus = imports.menus;
        var login = imports.login;
        var info = imports.info;
        var api = imports.api;
        var ui = imports.ui;
        var c9 = imports.c9;
            
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        // var emit = plugin.getEmitter();
        var updating = {};
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            commands.addCommand({
                name: "newWorkspace",
                exec: function() {
                    window.open(c9.dashboardUrl + "/../new");
                }
            }, plugin);
            
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
                            window.open("/" + options.name);
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
                            window.open("/" + options.name);
                        }
                    }
                }), c += 100, plugin);
                
                
                menus.addItemByPath(name + "/New Workspace", new ui.item({
                    command: "newWorkspace"
                }), c += 100, plugin);
                
                addDisabled(name, "/My Workspaces/Loading workspace list...");
                addDisabled(name, "/Shared Workspaces/Loading workspace list...");
                    
                // menus.addItemByPath(name + "/Projects/~", new ui.divider(), c += 100, plugin);
                menus.addItemByPath(name + "/~", new ui.divider(), c += 100, plugin);
            });
                
            function updateC9Projects(type) {
                if (updating[type] - Date.now() < 500)
                    return;
                updating[type] = Date.now();
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
                        
                        updating[type] = Date.now();
                        var data = menus.get(menuName.slice(0, -1));
                        if (data.menu.visible)
                            data.item.$submenu();
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
        }
        
        /***** Methods *****/
        
        
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
            updating = {};
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
