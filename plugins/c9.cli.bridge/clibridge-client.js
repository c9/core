/**
 * File Finder module for the Cloud9 that uses nak
 *
 * @copyright 2013, Ajax.org B.V.
 */
define(function(require, exports, module) {
    main.consumes = ["c9", "Plugin", "net", "bridge.client"];
    main.provides = ["bridge.cli.client"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var bridgeClient = imports["bridge.client"];
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        // var emit = plugin.getEmitter();
        
        var send = bridgeClient.setup("cli");
        
        /***** Lifecycle *****/
        
        plugin.on("load", function(){
        });
        
        plugin.on("unload", function(){
        });
        
        /***** Register and define API *****/
        
        /**
         * Bridge To Communicate from CLI to IDE
         **/
        plugin.freezePublicAPI({ 
            /**
             * 
             */
            send: send
        });
        
        register(null, {
            "bridge.cli.client": plugin
        });
    }
});