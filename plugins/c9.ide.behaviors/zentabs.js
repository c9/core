define(function(require, exports, module) {
    main.consumes = ["Plugin", "tabManager", "preferences", "settings"];
    main.provides = ["zen"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var tabManager = imports.tabManager;
        var prefs = imports.preferences;
        var settings = imports.settings;

        /***** Initialization *****/
        var plugin = new Plugin("Ajax.org", main.consumes);

        function load() {
            prefs.add({
                "Project": {
                    position: 10,
                    "Tabs and IDE Layout": {
                        position: 1500,
                        "Limit number of open tabs per pane (ZenTabs)": {
                            type: "checked-spinner",
                            checkboxPath: "user/zentabs/@useZenTabs",
                            path: "user/zentabs/@tabLimit",
                            min: 0,
                            max: 1000,
                            position: 100
                        }
                    }
                }
            }, plugin);

            tabManager.on("open", runZenTabs, plugin);
        }

        /***** Methods *****/
        function runZenTabs(event) {
            var tab = event.tab;
            
            var zentabsEnabled = settings.getBool("user/zentabs/@useZenTabs");
            if (!zentabsEnabled) return;

            var tabLimit = settings.get("user/zentabs/@tabLimit");
            var openTabs = tab.pane.meta.accessList;
            var tabsToRemove = openTabs.length - tabLimit;

            // Try to close excess tabs, unless it's the one just opened
            for (var i = openTabs.length - 1; i > 0; i--) {
                if (tabsToRemove < 1) {
                    tab.pane.aml.$waitForMouseOut = false;
                    tab.pane.aml.$scaleinit(null, "sync");
                    return;
                }
                else if (!openTabs[i].document.changed) {
                    openTabs[i].close();
                    tabsToRemove--;
                }
            }
        }

        /***** Lifecycle *****/

        plugin.on("load", function() {
            load();
        });
        plugin.on("unload", function() {

        });

        /***** Register and define API *****/

        plugin.freezePublicAPI({

        });

        register(null, {
            "zen": plugin
        });
    }
});
