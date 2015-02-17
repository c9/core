
define(function(require, exports, module) {
    main.consumes = ["c9", "Plugin", "ext"];
    main.provides = ["bridge"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var c9 = imports.c9;
        var ext = imports.ext;

        /***** Initialization *****/

        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();

        var ENABLED = options.startBridge !== false;
        var PORT = options.port || 17123;

        var stream, api;

        var loaded = false;
        function load(){
            if (loaded) return;
            loaded = true;
            
            if (!ENABLED) return;

            ext.loadRemotePlugin("bridge", {
                code: require("text!./bridge-service.js"),
                redefine: true
            }, function(err, remote) {
                if (err)
                    return console.error(err);

                api = remote;

                api.connect(PORT, function(err, meta) {
                    if (err) {
                        loaded = false;

                        if (err.code == "EADDRINUSE") {
                            console.warn("Another Application is using port "
                                + PORT + ". CLI client interface disabled. Restart Cloud9 to retry connecting.");
                        }
                        else
                            console.error(err);

                        return;
                    }

                    stream = meta.stream;

                    stream.on("data", function(chunk) {
                        try { var message = JSON.parse(chunk); }
                        catch (e) {
                            setTimeout(function(){
                                loaded = false;
                                load();
                            }, 60000);
                            return;
                        }
                        emit("message", { message: message });
                    });

                    stream.on("close", function(){
                        loaded = false;
                    });
                });
            });

            window.addEventListener("unload", unload);
        }
        
        function unload() {
            api && api.disconnect();
            api = stream = null;
            loaded = false;
        }

        /***** Methods *****/

        plugin.on("load", function(){
            c9.on("connect", load, plugin);
            c9.on("disconnect", unload, plugin);
        });

        plugin.on("unload", function(){
            api && api.disconnect();
        });

        /***** Register and define API *****/

        /**
         * Bridge To Communicate from CLI to IDE
         **/
        plugin.freezePublicAPI({ });

        register(null, {
            bridge: plugin
        });
    }
});
