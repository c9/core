/**
 * Bogus plugin. Circularity ftw.
 */
define(function(require, exports, module) {
    "use strict";

    main.consumes = [
        "Plugin", "ui", "myplugin"
    ];
    main.provides = ["myplugin"];
    return main;
    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var ui = imports.ui;
        // Note: the syntax error below is intentional and used by architect_resolver_test.js
        imports.

        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        var foo;
        var bar;
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            foo = 1;
            bar = 2;
            
            // ...
        }
        function myfunc(arg0, arg1) {
            
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function(){
            load();
        });
        
        plugin.on("unload", function(){
            foo = undefined;
        });
        
        /***** Register and define API *****/
        
        /**
         * 
         **/
        plugin.freezePublicAPI({
            myfunc: myfunc
            
        });
        
        //register(null, { "myplugin" : plugin });
        register(null, { "myplugin" : {
            myfunc2: myfunc
        }});
    }
});