
define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "bridge", "tabManager", "panels", "tree.favorites", "tree", 
        "fs", "preferences", "settings", "c9", "commands"
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
        var commands = imports.commands;
        
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
                    case "exec":
                        exec(message, e.respond);
                        break;
                    case "pipe":
                        createPipe(message, e.respond);
                        break;
                    case "pipeData":
                        updatePipe(message, e.respond);
                        break;
                    case "ping":
                        e.respond(null, true);
                        break;
                    default:
                        if (message.type)
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
        function createPipe(message, callback) {
            tabManager.once("ready", function(){
                tabManager.open({
                    focus: true,
                    editorType: "ace",
                    path: message.path && c9.toInternalPath(message.path),
                    document: { meta : { newfile: true } }
                }, function(err, tab) {
                    if (err) 
                        return callback(err);
                    callback(null, tab.path || tab.name);
                });
            }); 
        }
        
        function updatePipe(message, callback) {
            tabManager.once("ready", function() {
                var tab = tabManager.findTab(message.tab);
                var c9Session = tab && tab.document.getSession();
                if (c9Session && c9Session.session)
                   c9Session.session.insert({row: Number.MAX_VALUE, column: Number.MAX_VALUE} , message.data);
                callback(null, true);
            });
        }
        
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
                        var m = /:(\d*)(?::(\d*))?$/.exec(path);
                        var jump = {};
                        if (m) {
                            if (m[1])
                                jump.row = parseInt(m[1], 10) - 1;
                            if (m[2])
                                jump.column = parseInt(m[2], 10);
                            path = path.slice(0, m.index);
                        }
                        
                        fs.exists(path, function(existing) {
                            var tab = tabManager.open({
                                path: path,
                                focus: i === 0,
                                document: existing
                                    ? { ace: { jump: jump } }
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

        function exec(message, callback) {
            var result = commands.exec(message.command, message.args);
            var err = result ? null : "command failed";
            callback(err, result);
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
