define(function(require, exports, module) {
    main.consumes = ["Plugin", "ui", "menus", "commands"];
    main.provides = ["open"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var ui = imports.ui;
        var menus = imports.menus;
        var commands = imports.commands;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        // var emit = plugin.getEmitter();
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            menus.addItemByPath("File/Open...", new ui.item({ 
                command: "navigate" 
            }), 400, plugin);
        }
        
        /***** Methods *****/
        
        function open() {
            commands.exec("navigate");
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