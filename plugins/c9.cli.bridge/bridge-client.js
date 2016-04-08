/**
 * File Finder module for the Cloud9 that uses nak
 *
 * @copyright 2013, Ajax.org B.V.
 */
define(function(require, exports, module) {
    main.consumes = ["c9", "Plugin", "net"];
    main.provides = ["bridge.client"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var c9 = imports.c9;
        var net = imports.net;
        
        var JSONStream = require("./json-stream");
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        // var emit = plugin.getEmitter();
        
        var counter = 0;
        var SOCKET = c9.platform == "win32"
            ? "\\\\.\\pipe\\.c9\\bridge.socket"
            : c9.home + "/.c9/bridge.socket";
        
        /***** Methods *****/
        
        function send(message, callback) {
            net.connect(SOCKET, {}, function(err, stream) {
                if (err)
                    return callback(err);
                
                var jstream = new JSONStream(stream);
                var msgId = generateMessageId();
                var done;
                
                jstream.write({
                    id: msgId,
                    message: message
                });
                
                jstream.on("data", function(payload){
                    if (payload.id == msgId && !done) {
                        done = true;
                        callback(null, payload.message);
                        stream.end();
                    }
                });
                
                jstream.on("error", function(err){
                    if (done) return;
                    callback(err);
                    done = true;
                });
                
                jstream.on("close", function(){
                    if (done) return;
                    callback(new Error("No Response"));
                    done = true;
                });
            });
        }
        
        function generateMessageId(){
            // Use vfs token
            return Math.random() + "-" + ++counter;
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
            "bridge.client": plugin
        });
    }
});