define(function(require, exports, module) {
    main.consumes = ["c9", "Plugin", "ext"];
    main.provides = ["bridge"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var c9 = imports.c9;
        var ext = imports.ext;
        
        var JSONStream = require("./json-stream");

        /***** Initialization *****/

        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();

        var ENABLED = options.startBridge !== false;

        var stream, api;

        function load() {
            if (!ENABLED) return;

            ext.loadRemotePlugin("bridge", {
                code: c9.standalone ? undefined : require("text!./bridge-service.js"),
                file: c9.standalone ? "c9.cli.bridge/bridge-service.js" : undefined,
                redefine: true
            }, function(err, remote) {
                if (err)
                    return console.error(err);

                api = remote;

                api.connect(function(err, meta) {
                    if (err) 
                        return console.error(err); // this should never happen

                    stream = new JSONStream(meta.stream);
                    
                    stream.on("error", function(err) {
                        console.error(err);
                    });
                        
                    stream.on("data", function(payload) {
                        emit("message", { 
                            message: payload.message,
                            respond: function(err, message) {
                                stream.write({
                                    id: payload.id,
                                    message: message,
                                    error: err
                                });
                            }
                        });
                        
                    });

                    stream.on("close", function() {
                        load();
                    });
                    
                    emit.sticky("ready");
                });
            });

            window.addEventListener("unload", function() {
                api && api.disconnect();
            });
        }
        
        function write(json) {
            if (!stream) {
                plugin.once("ready", function() { write(json); });
                return;
            }
            
            stream.write(json);
        }
        
        /***** Methods *****/

        plugin.on("load", function() {
            if (c9.connected) load();
            else c9.on("connect", load, plugin);
        });

        plugin.on("unload", function() {
            api && api.disconnect();
            stream = null;
            api = null;
        });

        /***** Register and define API *****/

        /**
         * Bridge To Communicate from CLI to IDE
         **/
        plugin.freezePublicAPI({ 
            /**
             * 
             */
            write: write
        });

        register(null, {
            bridge: plugin
        });
    }
});
