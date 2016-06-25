define(function(require, exports, module) {
    main.consumes = ["c9", "Plugin", "ext", "bridge"];
    main.provides = ["clibridge"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var c9 = imports.c9;
        var ext = imports.ext;
        var bridge = imports.bridge;
        
        //var JSONStream = require("./json-stream");

        /***** Initialization *****/

        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();

        var ENABLED = options.startBridge !== false;

        /***** Methods *****/
        
        var cliBridge = bridge.setup("cli");
        
        cliBridge.on("message",function(payload){
            emit("message",payload);
        });
        
        plugin.on("load", function(){
            c9.on("connect", function(){
                if (!ENABLED) return;
                cliBridge.load(function(){
                    emit.sticky("ready");
                });   
            }, plugin);
        });

        plugin.on("unload", cliBridge.unload);

        /***** Register and define API *****/

        /**
         * Bridge To Communicate from CLI to IDE
         **/
        plugin.freezePublicAPI({ 
            /**
             * 
             */
            write: cliBridge.write
        });

        register(null, {
            clibridge: plugin
        });
    }
});
