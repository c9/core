/**
 * Silly dummy Plugin plugin.
 */
define(function(require, exports, module) {
    "use strict";

    main.consumes = ["Plugin"];
    main.provides = ["Plugin"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var ui = imports.ui;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            // ...
        }
        
        function freezePublicAPI(arg0, arg1) {
            
        }
        
        function bogus(s) {
            
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function(){
            load();
        });
        
        /***** Register and define API *****/
        
        /**
         * Silly dummy Plugin plugin.
         * 
         * (And its documentation.)
         */
        plugin.freezePublicAPI({
            /**
             * This is a dummy freeze api function, you dummy. Go away.
             */
            freezePublicAPI: freezePublicAPI,
            
            /**
             * This is so bogus.
             * 
             * @param {String} s
             */
            bogus: bogus
        });
        
        register(null, { "Plugin" : plugin });
    }
});