define(function(require, exports, module) {
    main.consumes = ["Plugin", "ui"];
    main.provides = ["layout"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var ui = imports.ui;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var loaded = false;
        function load() {
            if (loaded) return;
            loaded = true;
                
            // Load the skin
            var skin = require("text!/static/plugins/c9.ide.layout.classic/skins.xml");
            ui.insertSkin({ data: skin }, plugin);
            
            ui.insertCss(require("text!/static/standalone/skin/default/flat-light.css"), false, plugin);
            
            var css = require("text!/static/plugins/c9.ide.layout.classic/keyframes.css");
            css = css.replace(/@\{image-path\}/g, "/static/plugins/c9.ide.layout.classic/images");
            ui.insertCss(css, false, plugin);
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        
        plugin.on("unload", function() {
            loaded = false;
        });
        
        /***** Register and define API *****/
        
        /**
         **/
        plugin.freezePublicAPI({
        });
        
        register(null, {
            layout: plugin
        });
    }
});