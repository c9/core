define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "commands", "menus", "tree.favorites", "tabManager", 
        "c9", "fs"
    ];
    main.provides = ["open"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var commands = imports.commands;
        var c9 = imports.c9;
        var fs = imports.fs;
        var menus = imports.menus;
        var favorites = imports["tree.favorites"];
        var tabManager = imports.tabManager;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        // var emit = plugin.getEmitter();
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            commands.addCommand({
                name: "open",
                hint: "open a file or folder",
                exec: function() { open(); }
            }, plugin);
            
            menus.addItemByPath("File/Open...", new apf.item({ 
                command: "open" 
            }), 400, plugin);
        }
        
        /***** Methods *****/
        
        function open() {
            var input = document.createElement("input");
            input.type = "file";
            input.multiple = true;
            
            function handler(path, i, err, stat) {
                if (stat.mime.match(/(folder|directory)$/)) {
                    favorites.addFavorite(path);
                }
                else {
                    tabManager.openFile(path, i === 0, function() {});
                }
            }
            
            // input.nwdirectory = true;
            input.onchange = function() {
                var files = input.files;
                for (var i = 0; i < files.length; i++) {
                    var path = c9.toInternalPath(input.files[i].path);
                    fs.stat(path, handler.bind(this, path, i));
                }
            };
            input.click();
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
         * 
         **/
        plugin.freezePublicAPI({
            /**
             * 
             */
            open: open
        });
        
        register(null, {
            open: plugin
        });
    }
});