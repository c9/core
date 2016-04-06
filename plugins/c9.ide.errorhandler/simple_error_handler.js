/**
 * This is a basic error handler which forwards window.onerror events to the
 * API server
 *
 * @extends Plugin
 * @singleton
 */
define(function(require, exports, module) {
    "use strict";

    main.consumes = [
        "Plugin",
    ];
    main.provides = ["error_handler"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;

        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            if (
                location.protocol !== "file:"
                && location.href.indexOf("dev") === -1
                && (location.href.indexOf("c9.io") > -1))
            {
                var oldOnError = window.onerror;
                window.onerror = function(m, u, l) {
                    var errorInfo = {
                        agent: navigator.userAgent,
                        type: "General Javascript Error",
                        e: [m, u, l],
                        workspaceId: plugin.workspaceId
                    };
                    
                    emit("error", errorInfo);
                    
                    submitError(errorInfo);
                    
                    if (oldOnError)
                        oldOnError.apply(this, arguments);
                };
    
                // Catch all APF Routed errors
                // ui.addEventListener("error", function(e) {
                //     var errorInfo = {
                //         agent       : navigator.userAgent,
                //         type        : "APF Error",
                //         message     : e.message,
                //         tgt         : e.currentTarget && e.currentTarget.serialize(),
                //         url         : e.url,
                //         state       : e.state,
                //         e           : e.error,
                //         workspaceId : plugin.workspaceId
                //     };
                    
                //     emit("error", errorInfo);
                    
                //     http.request("/api/debug", {
                //         method      : "POST",
                //         contentType : "application/json",
                //         body        : errorInfo
                //     }, function(err) {
                //         if (err) console.error(err);
                //     });
                // });
            }
        }
        
        function submitError(errorInfo) {
            // Not implemented:
            // http.request("/api/debug", {
            //     method: "POST",
            //     contentType: "application/json",
            //     body: errorInfo
            // }, function(err) {
            //     if (err) console.error(err);
            // });
        }
        
        function reportError(exception, customData) {
            if (customData)
                console.error(exception, customData);
            else
                console.error(exception.stack || exception);
            submitError(exception);
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function(){
            load();
        });
        
        plugin.on("unload", function(){
            loaded = false;
        });
        
        /***** Register and define API *****/
        
        plugin.freezePublicAPI({
            /** @deprecated Use log() instead. */
            reportError: reportError,
            log: reportError
        });
        
        register(null, { "error_handler" : plugin });
    }
});