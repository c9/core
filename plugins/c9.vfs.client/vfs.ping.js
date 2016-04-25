define(function(require, exports, module) {
    "use strict";

    main.consumes = ["Plugin", "ext", "c9", "vfs"];
    main.provides = ["vfs.ping"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var c9 = imports.c9;
        var ext = imports.ext;

        /***** Initialization *****/

        var plugin = new Plugin("Ajax.org", main.consumes);
        var api;

        var loaded = false;
        function load(oldVfs) {
            if (loaded && !oldVfs) return;
            loaded = true;
            
            ext.loadRemotePlugin("ping", {
                file: oldVfs ? undefined : "c9.vfs.client/ping-service.js",
                code: oldVfs ? require("text!./ping-service.js") : undefined
            }, function(err, remote) {
                if (!remote && !oldVfs)
                    return load(true);
                
                if (!remote)
                    return console.error(err);

                api = remote;
            });

            c9.on("stateChange", function(e) {
                if (e.state & c9.NETWORK) {
                    load();
                }
                else {
                    loaded = false;
                    api = null;
                }
            }, plugin);
        }

        /***** Lifecycle *****/

        plugin.on("load", function(){
            load();
        });

        /***** Register and define API *****/
        function ping(callback) {
            if (!callback) {
                callback = function(err, result) {
                    if (err)
                        return console.error(err);
                    console.log("ping took", result, "ms");
                };
            }

            if (!api) return callback(new Error("Client is offline"));

            var start = Date.now();
            api.ping("serverTime", function(err, response) {
                if (err) return callback(err);

                callback(null, {
                    serverTime: response.serverTime,
                    total: Date.now() - start
                });
            });
        }

        window.ping = ping;

        /**
         *
         **/
        plugin.freezePublicAPI({
            ping: ping
        });

        register(null, { "vfs.ping" : plugin });
    }

});