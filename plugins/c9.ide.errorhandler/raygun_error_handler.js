/**
 * This error handler is for client side error logging
 * It also automatically catches window.onerror and sends them to raygun.io
 * You can also import it and call .log to manually send an error
 *
 * @extends Plugin
 * @singleton
 */
define(function(require, exports, module) {
    "use strict";

    main.consumes = [
        "Plugin", "info", "metrics"
    ];
    main.provides = ["error_handler"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var info = imports.info;
        var metrics = imports.metrics;

        /***** Initialization *****/
        
        var Raygun = require("./raygun").Raygun;
        var apiKey = options.apiKey;
        var version = options.version;
        var revision = options.revision;
        
        var plugin = new Plugin("Ajax.org", main.consumes);

        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            // without apiKey raygun throws an error
            if (!apiKey) return;
            
            var user = info.getUser();
            var workspace = info.getWorkspace();
            
            Raygun.init(apiKey).attach().withCustomData(function(ex) {
                return {
                    user: {
                        id: user.id,
                        name: user.name,
                        email: user.email
                    },
                    workspace: {
                        id: workspace.id,
                        name: workspace.name,
                        contents: workspace.contents
                    },
                    revision: revision,
                    data: ex && ex.data
                };
            });
            Raygun.setUser(info.getUser().name);
            Raygun.setVersion(version + ".0");
        }
        
        function log(exception, customData, tags) {
            metrics.increment("errorhandler.log");
            if (typeof exception === "string")
                exception = new Error(exception);
            if (!exception)
                exception = new Error("Unspecified error");
            console.error(exception);
            if (customData)
                console.log(customData);
            if (!exception.stack)
                exception.stack = new Error().stack;
            Raygun.send(exception, customData, tags);
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        
        /***** Register and define API *****/
        
        plugin.freezePublicAPI({
            /** @deprecated Use log() instead. */
            reportError: log,
            log: log
        });
        
        register(null, { "error_handler": plugin });
    }
});