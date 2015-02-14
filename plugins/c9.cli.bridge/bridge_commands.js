
define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "bridge", "tabManager", "panels", 
        "tree.favorites", "tree", "fs"
    ];
    main.provides = ["bridge_commands"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var bridge = imports.bridge;
        var tabs = imports.tabManager;
        var panels = imports.panels;
        var tree = imports.tree;
        var favs = imports["tree.favorites"];
        var fs = imports.fs;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        // var emit = plugin.getEmitter();
        
        var BASEPATH = options.basePath;
        
        var loaded = false;
        function load(){
            if (loaded) return;
            loaded = true;
            
            bridge.on("message", function(e) {
                var message = e.message;
                
                switch (message.type) {
                    case "open":
                        open(message);
                        break;
                    case "ping":
                        break;
                }
            });
        }
        
        /***** Methods *****/
        
        function open(message) {
            message.paths.forEach(function(info, i) {
                var path = info.path;
                
                // Make sure file is inside workspace
                if (path.substr(0, BASEPATH.length) !== BASEPATH)
                    return;
                
                // Remove base path
                path = path.substr(BASEPATH.length);
                
                if (info.type == "directory") {
                    path = path.replace(/\/$/, "");
                    
                    panels.activate("tree");
                    
                    var node = favs.addFavorite(path);
    
                    tree.expand(path, function(err) {
                        tree.select(node); //path || "/");
                        tree.scrollToSelection();
                    });
                    tree.focus();
                }
                else {
                    tabs.once("ready", function(){
                        fs.exists(path, function(existing) {
                            tabs.open({
                                path: path,
                                active: i === 0,
                                document:
                                    existing
                                        ? undefined
                                        : { meta : { newfile: true } }
                            }, function(){});
                        });
                    });
                }
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
            "bridge_commands": plugin
        });
    }
});
