define(function(require, exports, module) {
    "use strict";
    
    main.consumes = [
        "Plugin", "tabManager", "settings", "preferences", "auth"
    ];
    main.provides = ["closeconfirmation"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var tabs = imports.tabManager;
        var settings = imports.settings;
        var prefs = imports.preferences;
        var auth = imports.auth;
        var ideProviderName = options.ideProviderName || "Cloud9";

        /***** Initialization *****/

        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var defaultValue = options.defaultValue;

        var loaded = false;
        function load(callback) {
            if (loaded) return false;
            loaded = true;

            // when unloading the window
            window.onbeforeunload = onBeforeUnloadHandler;
            
            settings.on("read", function() {
                settings.setDefaults("user/general", [
                    ["confirmexit", defaultValue]
                ]);
            }, plugin);

            prefs.add({
                "General": {
                    "General": {
                        "Warn Before Exiting": {
                            type: "checkbox",
                            position: 8000,
                            path: "user/general/@confirmexit"
                        }
                    }
                }
            }, plugin);
        }

        function unload() {
            if (window.onbeforeunload === onBeforeUnloadHandler)
                window.onbeforeunload = null;
        }

        /***** Methods *****/

        function onBeforeUnloadHandler() {
            var changed = tabs.getTabs().some(function(tab) {
                return tab.document.value && tab.document.changed;
            });

            emit("exit", { changed: changed });

            // see what's in the settings
            var confirmExit = settings.getBool("user/general/@confirmexit") && auth.loggedIn;
            if (confirmExit) {
                if (changed)
                    return "You have unsaved changes. Your changes will be lost if you don't save them";
                else
                    return "You're about to leave " + ideProviderName + ".";
            }
        }

        /***** Lifecycle *****/

        plugin.on("load", function() {
            load();
        });
        plugin.on("enable", function() {

        });
        plugin.on("disable", function() {

        });
        plugin.on("unload", function() {
            unload();
            loaded = false;
        });

        /***** Register and define API *****/
        /**
         * Shows a 'close confirmation' popup when closing the IDE
         * @singleton
         */
        plugin.freezePublicAPI({
        });

        register(null, {
            closeconfirmation: plugin
        });
    }
});
