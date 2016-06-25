define(function(require, exports, module) {
    main.consumes = ["c9", "Plugin", "ext"];
    main.provides = ["bridge"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var c9 = imports.c9;
        var ext = imports.ext;
        var Eventemitter = require("events").EventEmitter;
        
        var JSONStream = require("./json-stream");

        /***** Initialization *****/

        var plugin = new Plugin("Ajax.org", main.consumes);
        //var emit = plugin.getEmitter();
        
        function setup(SOCKET){
            var bridge = new Eventemitter();
            var stream, api;
        
            function load(callback){
                ext.loadRemotePlugin("bridge", {
                    code: c9.standalone ? undefined : require("text!./bridge-service.js"),
                    file: c9.standalone ? "c9.ide.bridge/bridge-service.js" : undefined,
                    redefine: true
                }, function(err, remote) {
                    if (err)
                        return console.error(err);
    
                    api = remote;
                    
                    api.genSocket(SOCKET, function(){
                        api.connect(function(err, meta) {
                            if (err) 
                                return console.error(err); // this should never happen
        
                            stream = new JSONStream(meta.stream);
                            
                            stream.on("error", function(err) {
                                console.error(err);
                            });
                                
                            stream.on("data", function(payload) {
                                bridge.emit("message", { 
                                    message: payload.message,
                                    respond: function(err, message){
                                        stream.write({
                                            id: payload.id,
                                            message: message,
                                            error: err
                                        });
                                    }
                                });
                                
                            });
        
                            stream.on("close", function(){
                                load();
                            });
                            
                            callback();
                        });
                    });
                });
    
                window.addEventListener("unload", function(){
                    api && api.disconnect();
                });
            }
            
            function write(json){
                if (!stream) {
                    plugin.once("ready", function(){ write(json); });
                    return;
                }
                
                stream.write(json);
            }
            
            /***** Methods *****/
            bridge.load = load;
            
            bridge.unload = function(){
                    api && api.disconnect();
                    stream = null;
                    api = null;
                };
            
            bridge.write = write;
            
            
            return bridge;
        }

        /**
         * Bridge for plugins Communicate
         **/
        plugin.freezePublicAPI({ 
            /**
             * 
             */
            setup:setup
        });

        register(null, {
            bridge: plugin
        });
    }
});
