
define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "bridge", "tabManager", "panels", "tree.favorites", "tree", 
        "fs", "preferences", "settings", "c9"
    ];
    main.provides = ["bridge.commands"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var bridge = imports.bridge;
        var tabManager = imports.tabManager;
        var panels = imports.panels;
        var tree = imports.tree;
        var settings = imports.settings;
        var favs = imports["tree.favorites"];
        var fs = imports.fs;
        var c9 = imports.c9;
        var prefs = imports.preferences;
        
        var async = require("async");
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        // var emit = plugin.getEmitter();
        
        var BASEPATH = options.basePath;
        
        function load(){
            bridge.on("message", function(e) {
                var message = e.message;
                
                switch (message.type) {
                    case "open":
                        open(message, e.respond);
                        break;
                    case "ping":
                        e.respond(null, true);
                        break;
                    default:
                        console.error("Unknown Bridge Command: ", message.type);
                        break;
                }
            }, plugin);
            
            settings.on("read", function(e) {
                settings.setDefaults("user/terminal", [
                    ["defaultEnvEditor", "false"]
                ]);
            }, plugin);
            
            prefs.add({
                "Editors" : {
                    "Terminal" : {
                        "Use Cloud9 as the Default Editor" : {
                            type: "checkbox",
                            path: "user/terminal/@defaultEnvEditor",
                            position: 14000
                        }
                    }
                }
            }, plugin);
        }
        
        /***** Methods *****/
        
        function open(message, callback) {
            var i = -1;
            var tabs = [];
            BASEPATH = c9.toInternalPath(BASEPATH);

            async.each(message.paths, function(info, next) {
                var path = info.path;
                i++;
                
                path = c9.toInternalPath(path);
                // Make sure file is inside workspace
                if (path.charAt(0) !== "~") {
                    if (path.substr(0, BASEPATH.length) !== BASEPATH)
                        return; // Dont' call callback. Perhaps another client will pick this up.
                    
                    // Remove base path
                    path = path.substr(BASEPATH.length);
                }
                
                if (info.type == "directory") {
                    path = path.replace(/\/$/, "");
                    
                    panels.activate("tree");
                    
                    var node = favs.addFavorite(path);
    
                    tree.expand(path, function() {
                        tree.select(node); //path || "/");
                        tree.scrollToSelection();
                        next();
                    });
                    tree.focus();
                }
                else {
                    tabManager.once("ready", function(){
                        fs.exists(path, function(existing) {
                            var tab = tabManager.open({
                                path: path,
                                focus: i === 0,
                                document: existing
                                    ? undefined
                                    : { meta : { newfile: true } }
                            }, function(){
                                next();
                            });
                            
                            if (message.wait) {
                                tab.on("close", function(){
                                    tabs.splice(tabs.indexOf(tab), 1);
                                    if (!tabs.length)
                                        callback(null, true);
                                });
                            }
                            
                            tabs.push(tab);
                        });
                    });
                }
            }, function(err){
                if (err)
                    return callback(err);
                    
                if (!message.wait || !tabs.length)
                    callback(null, true);
            });
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function(){
            load();
        });
        
        plugin.on("unload", function(){
            
        });
        
        /***** Register and define API *****/
        
        /**
         * Bridge To Communicate from CLI to IDE
         **/
        plugin.freezePublicAPI({});
        
        register(null, {
            "bridge.commands": plugin
        });
    }
});
