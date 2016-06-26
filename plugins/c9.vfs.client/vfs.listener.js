/**
 * Listens to pub sub events from the VFS server and reconnects VFS as neccessary
 */
define(function(require, exports, module) {
    "use strict";
    
    main.consumes = [
        "Plugin", "pubsub", "vfs", "metrics", "vfs.endpoint", "dialog.alert"
    ];
    main.provides = ["vfs.listener"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var pubsub = imports.pubsub;
        var vfs = imports.vfs;
        var vfsEndpoint = imports["vfs.endpoint"];
        var metrics = imports.metrics;
        var showAlert = imports["dialog.alert"].show;

        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;

            pubsub.on("message", function(m) {
                if (m.type !== "workspace") return;
                
                if (m.action == "state_changed") {
                    metrics.increment("vfs.state_changed", 1, true);
                    
                    vfsEndpoint.clearCache();
                    vfs.reconnect();
                }
                else if (m.action == "remote_changed") {
                    metrics.increment("vfs.remote_changed", 1, true);
                    vfsEndpoint.clearCache();
                    
                    showAlert("Workspace configuration changed!",
                        "The configuration of this workspace has changed.",
                        "Cloud9 will be reloaded in order to activate the changes.", 
                        function() { 
                            setTimeout(function() { 
                                window.location.reload();
                            }, 500); 
                        }
                    ); 
                }
            });
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("unload", function() {
            loaded = false;
        });

        /***** Register and define API *****/
        
        plugin.freezePublicAPI({});
        
        register(null, {
            "vfs.listener": plugin
        });
    }
});