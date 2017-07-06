define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "dialog.error", "ui", "settings", "tabManager", "save", 
        "menus", "preferences.keybindings", "preferences.general",
        "preferences.project", "c9", "commands", "watcher", "fs", 
        "tree.favorites", "util", "app"
    ];
    main.provides = ["configure"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var settings = imports.settings;
        var commands = imports.commands;
        var save = imports.save;
        var menus = imports.menus;
        var watcher = imports.watcher;
        var tabManager = imports.tabManager;
        var ui = imports.ui;
        var c9 = imports.c9;
        var fs = imports.fs;
        var kbprefs = imports["preferences.keybindings"];
        var genprefs = imports["preferences.general"];
        var prjprefs = imports["preferences.project"];
        var services = imports.app.services;
        var showError = imports["dialog.error"].show;
        var favs = imports["tree.favorites"];
        var util = imports.util;
        
        var join = require("path").join;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        // var emit = plugin.getEmitter();
        
        var cssSession = new Plugin("Ajax.org", main.consumes);
        var initPlugin;
        
        var pathFromFavorite = options.pathFromFavorite;
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            // Init Script
            var script = settings.get("user/config/init.js");
            if (script) {
                runInitJs(script);
            }
            
            // Init CSS
            var css = settings.get("user/config/styles.css");
            if (css)
                insertCss(css, false, cssSession);
                
            settings.on("user/config/styles.css", function(css) {
                cssSession.cleanUp();
                insertCss(css, false, cssSession);
            });
            
            commands.addCommand({
                name: "restartc9",
                group: "General",
                bindKey: { mac: "Command-R", win: "Ctrl-R" },
                exec: function() {
                    location.reload();
                }
            }, plugin);
            commands.addCommand({
                name: "rerunInitScript",
                group: "General",
                bindKey: { mac: "Command-Enter", win: "Ctrl-Enter" },
                isAvailable: function() {
                    return tabManager.focussedTab && tabManager.focussedTab.path == "~/.c9/init.js";
                },
                exec: function() {
                    var script = settings.get("user/config/init.js");
                    runInitJs(script);
                }
            }, plugin);
            
            menus.addItemByPath("Cloud9/~", new ui.divider(), 300, plugin);
            menus.addItemByPath("Cloud9/Go To Your Dashboard", new ui.item({
                onclick: function() { window.open(options.dashboardUrl); }
            }), 310, plugin);
            
            menus.addItemByPath("Cloud9/~", new ui.divider(), 350, plugin);
            menus.addItemByPath("Cloud9/Open Your Project Settings", new ui.item({
                onclick: editProjectSettings
            }), 400, plugin);
            menus.addItemByPath("Cloud9/Open Your User Settings", new ui.item({
                onclick: editUserSettings
            }), 400, plugin);
            menus.addItemByPath("Cloud9/Open Your Keymap", new ui.item({
                onclick: function() {
                    kbprefs.editUserKeys();
                }
            }), 600, plugin);
            menus.addItemByPath("Cloud9/Open Your Init Script", new ui.item({
                onclick: editInitJs
            }), 700, plugin);
            menus.addItemByPath("Cloud9/Open Your Stylesheet", new ui.item({
                onclick: editStylesCss
            }), 800, plugin);
            
            if (!c9.hosted) {
                menus.addItemByPath("Cloud9/Restart Cloud9", new apf.item({
                    command: "restartc9"
                }), 2000080, plugin);
            } else {
                menus.addItemByPath("Cloud9/Restart Workspace", new apf.item({
                    command: "restartc9vm"
                }), 2000080, plugin);
            }
            
            genprefs.on("edit", function() {
                editUserSettings(); 
            });
            prjprefs.on("edit", function() {
                editProjectSettings();
            });
            
            save.on("beforeSave", function(e) {
                if (!e.document.meta.config) return;
                
                var path = e.document.meta.config;
                
                // Doing save as, it is now a normal document
                if (e.path != path && e.path != util.normalizePath(path)) {
                    delete e.document.meta.config;
                    delete e.document.meta.nofs;
                    return;
                }
                
                if (path == "~/.c9/init.js") {
                    settings.setJson("user/config/init.js", e.document.value);
                    showError("Please reload or press '" + commands.getHotkey("rerunInitScript") + "' for these changes to take effect.");
                }
                else if (path == "~/.c9/styles.css") {
                    var css = e.document.value;
                    settings.setJson("user/config/styles.css", css);
                }
                else if (path == settings.paths.project) {
                    try { var project = JSON.parse(e.document.value); }
                    catch (e) { 
                        showError("Syntax Error in Project Settings: " + e.message); 
                        return false;
                    }
                    
                    // @todo doesn't update UI
                    // settings.model.project = project;
                    settings.read({ project: project });
                    settings.save(true);
                }
                else if (path == settings.paths.user) {
                    try { var user = JSON.parse(e.document.value); }
                    catch (e) { 
                        showError("Syntax Error in User Settings: " + e.message); 
                        return false;
                    }
                    
                    // @todo doesn't update UI
                    // settings.model.user = user;
                    settings.read({ user: user });
                    settings.save(true);
                }
                
                delete e.document.meta.newfile;
                e.document.undoManager.bookmark();
                
                return false;
            }, plugin);
            
            // Load initial project settings from disk and match against latest from database
            var initWatcher, projectPath;
            settings.on("read", function() {
                if (initWatcher) return;
                initWatcher = true;
                
                // Keep project file consistent with changes on disk
                watcher.on("change", function(e) {
                    if (e.path == projectPath)
                        fs.readFile(e.path, readHandler);
                });
                watcher.on("delete", function(e) {
                    if (e.path == projectPath)
                        watcher.watch(projectPath);
                });
                watcher.on("failed", function(e) {
                    if (e.path == projectPath) {
                        setTimeout(function() {
                            watcher.watch(projectPath); // Retries once after 1s
                        });
                    }
                });
                
                function readHandler(err, data) {
                    if (err) return;
                    
                    settings.paths.project = projectPath;
                    
                    try { var json = JSON.parse(data); }
                    catch (e) { return; }
                    
                    settings.update("project", json);
                }
                    
                function updateFavPath() {
                    var mainPath = favs.getFavoritePaths()[0];
                    if (mainPath) 
                        mainPath = join(mainPath, ".c9/project.settings");
                    else 
                        mainPath = originalPath;
                    
                    // Unwatch old project path
                    if (projectPath)
                        watcher.unwatch(projectPath);
                    
                    // Set new project path
                    projectPath = mainPath;
                    
                    // Watch project path
                    watcher.watch(projectPath);
                    
                    // Read from disk
                    fs.readFile(mainPath, readHandler);
                }
                
                // At startup read the project settings from disk
                if (pathFromFavorite) {
                    var originalPath = settings.paths.project;
                    
                    favs.on("favoriteAdd", updateFavPath);
                    favs.on("favoriteRemove", updateFavPath);
                    favs.on("favoriteReorder", updateFavPath);
                    
                    updateFavPath();
                }
                else {
                    projectPath = settings.paths.project;
                    
                    // Watch project path
                    watcher.watch(projectPath);
                    
                    // Read from disk
                    fs.readFile(projectPath, readHandler);
                }
            });
        }
        
        /***** Methods *****/
        
        function insertCss(css, staticPrefix, plugin) {
            // we do not use ui.insertCss to make sure user stylesheet is 
            // appended to the body tag and have highest priority
            // without this priority of css rules will be different after
            // saving stylesheet and after reloading cloud9
            
            css += "\n/*# sourceURL=~/.c9/styles.css */";
            var style = document.createElement("style");
            style.appendChild(document.createTextNode(css));
            document.body.appendChild(style);
            
            // Cleanup
            plugin.addOther(function() {
                style.parentNode.removeChild(style);
            });
        }
        
        function openTab(path, value, syntax, defaultValue) {
            tabManager.open({
                path: path,
                value: value || defaultValue,
                active: true,
                editorType: "ace",
                document: {
                    ace: { customSyntax: syntax },
                    meta: { config: path, newfile: !value.length, nofs: true }
                }
            }, function(err, tab) {
                
            });
        }
        
        function editInitJs() {
            var script = settings.get("user/config/init.js") || "";
            openTab("~/.c9/init.js", script, "javascript", 
                "// You can access plugins via the 'services' global variable\n" + 
                "/*global services, plugin*/\n" +
                "\n" +
                "// to load plugins use\n" +
                "// services.pluginManager.loadPackage([\n" +
                "//     \"https://<user>.github.io/<project>/build/package.<name>.js\",\n" +
                "//     \"~/.c9/plugins/<name>/package.json\",\n" +
                "// ]);\n");
        }
        
        function editStylesCss() {
            var css = settings.get("user/config/styles.css") || "";
            openTab("~/.c9/styles.css", css, "css");
        }
        
        function editProjectSettings() {
            var value = JSON.stringify(settings.model.project, 0, "    ")
                .replace(/"true"/g, "true")
                .replace(/"false"/g, "false");
            openTab(settings.paths.project, value, "javascript");
        }
        function editUserSettings() {
            var value = JSON.stringify(settings.model.user, 0, "    ")
                .replace(/"true"/g, "true")
                .replace(/"false"/g, "false");
            openTab(settings.paths.user, value, "javascript");
        }
        
        function runInitJs(script) {
            c9.once("ready", function() {
                try {
                    var fn = new Function("services, plugin", script
                        + "\n//@ sourceURL=config/init.js");
                    if (initPlugin) initPlugin.unload();
                    var initPlugin = new Plugin("initScript", []);
                    initPlugin.name = "initScript";
                    fn(services, initPlugin);
                }
                catch (e) {
                    console.error(e);
                    setTimeout(function() {
                        showError("Error Executing init.js: ", e.message);
                    }, 500);
                }
             });
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
            if (initPlugin) initPlugin.unload();
        });
        
        /***** Register and define API *****/
        
        /**
         * 
         **/
        plugin.freezePublicAPI({
            /**
             * 
             */
            editInitJs: editInitJs,
            
            /**
             * 
             */
            editStylesCss: editStylesCss,
            
            /**
             * 
             */
            editProjectSettings: editProjectSettings,
            
            /**
             * 
             */
            editUserSettings: editUserSettings
        });
        
        register(null, {
            configure: plugin
        });
    }
});
