/**
 * File Finder module for the Cloud9 that uses nak
 *
 * @copyright 2013, Ajax.org B.V.
 */
define(function(require, exports, module) {
    main.consumes = ["c9", "Plugin", "net"];
    main.provides = ["bridge-client"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var c9 = imports.c9;
        var net = imports.net;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        // var emit = plugin.getEmitter();
        
        var PORT = options.port || 17123;
        
        /***** Methods *****/
        
        function send(message, callback) {
            net.connect(PORT, {}, function(err, stream) {
                if (err)
                    return callback(err);
                
                stream.write(JSON.stringify(message));
                stream.end();
                
                callback();
            });
        }
        
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
            "bridge-client": plugin
        });
    }
});