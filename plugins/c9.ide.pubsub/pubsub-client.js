/**
 * PubSub module for the Cloud9 that's used to publish events to the client IDE
 *
 * @copyright 2013, Ajax.org B.V.
 */
define(function(require, exports, module) {
    main.consumes = ["c9", "Plugin", "ext"];
    main.provides = ["pubsub"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var c9 = imports.c9;
        var ext = imports.ext;

        /***** Initialization *****/

        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();

        var stream, api;

        var loaded = false;
        var oldVfs = false;
        function load(oldVfs) {
            if (loaded && !oldVfs) return;
            loaded = true;

            ext.loadRemotePlugin("pubsub", {
                file: oldVfs ? undefined : "c9.ide.pubsub/pubsub-service.js",
                code: oldVfs ? require("text!./pubsub-service.js") : undefined
            }, function(err, remote) {
                if (!remote && !oldVfs)
                    return load(true);
                
                if (!remote)
                    return console.error(err);

                api = remote;

                api.subscribe(function(err, meta) {
                    console.log("PubSub connected");
                    emit.sticky("connected");
                    if (err) {
                        loaded = false;
                        console.error(err);
                        return;
                    }

                    stream = meta.stream;

                    stream.on("data", function(chunk) {
                        var message;
                        try { message = JSON.parse(chunk); }
                        catch (e) {
                            return setTimeout(function() {
                                loaded = false;
                                load();
                            }, 5000);
                        }
                        console.log("PubSub message:", message);
                        emit("message", message);
                    });

                    stream.on("close", function() {
                        loaded = false;
                    });
                });
            });
        }

        function unload() {
            console.warn("PubSub disconnected");
            api = stream = null;
            loaded = false;
        }

        /***** Methods *****/

        plugin.on("load", function() {
            c9.on("connect", load, plugin);
            c9.on("disconnect", unload, plugin);
        });

        /***** Register and define API *****/

        /**
         * Bridge To Communicate from CLI to IDE
         **/
        plugin.freezePublicAPI({
            _events: [
                /**
                 * Fires when a message is published to this user on this workspace.
                 * @event error 
                 * @param {Object} msg
                 * @param {String} msg.channel
                 * @param {String} msg.type
                 * @param {String} msg.action
                 * @param {Object} msg.body
                 */
                "message",
                /**
                 * Fires when the client is connected
                 */
                "connected"
            ],
            
            get connected() { return loaded && !!stream; },
        });

        register(null, {
            pubsub: plugin
        });
    }
});
