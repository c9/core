define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "menus", "commands", "tabManager", "settings",
        "preferences", "save", "ui"
    ];
    main.provides = ["ace.stripws"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var menus = imports.menus;
        var commands = imports.commands;
        var tabs = imports.tabManager;
        var settings = imports.settings;
        var prefs = imports.preferences;
        var save = imports.save;
        var ui = imports.ui;

        var whitespaceUtil = require("ace/ext/whitespace");

        /***** Initialization *****/

        var plugin = new Plugin("Ajax.org", main.consumes);
        // var emit = plugin.getEmitter();
        
        var disabled = false;

        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;

            commands.addCommand({
                name: "stripws",
                hint: "strip whitespace at the end of each line",
                exec: function() {
                    stripws();
                },
                isAvailable: function (editor) {
                    return editor && tabs.focussedTab &&
                        typeof tabs.focussedTab.path == "string";
                }
            }, plugin);

            menus.addItemByPath("Tools/Strip Trailing Space", new ui.item({
                command: "stripws"
            }), 100, plugin);

            menus.addItemByPath("Tools/~", new ui.divider(), 200, plugin);

            save.on("beforeSave", function (e) {
                var shouldStrip = settings.getBool("project/general/@stripws");
                if (!shouldStrip || e.options.silentsave)
                    return;
                var keepCursorPosition = settings.getBool("user/general/@stripwsKeepCursorPosition");
                stripws(e.document.tab, {
                    keepCursorPosition: keepCursorPosition
                });
            }, plugin);

            settings.on("read", function(e) {
                settings.setDefaults("project/general", [
                    ["stripws", !!settings.getBool("user/general/@stripws")]
                ]);
            }, plugin);

            prefs.add({
               "Project": {
                    position: 150,
                    "Code Editor (Ace)": {
                        "On Save, Strip Whitespace": {
                            type: "checkbox",
                            position: 900,
                            path: "project/general/@stripws"
                        }
                    }
               }
            }, plugin);
        }

        /***** Methods *****/

        function stripws(tab, options) {
            tab = tab || tabs.focussedTab;
            if (!tab || !tab.path || disabled)
                return;

            options = options || {};
            options.trimEmpty = true;
            var session = tab.document.getSession().session;
            whitespaceUtil.trimTrailingSpace(session, options);
            session.$syncInformUndoManager();
        }

        /***** Lifecycle *****/

        plugin.on("load", function() {
            load();
        });
        plugin.on("enable", function() {
            disabled = false;
        });
        plugin.on("disable", function() {
            disabled = true;
        });
        plugin.on("unload", function() {
            loaded = false;
        });

        /***** Register and define API *****/
        
        /**
         * Strips trailing whitespace from lines just before a file is saved.
         * @singleton
         **/
        plugin.freezePublicAPI({
            /*
             * Strips whitespace at the end of each line in the given page
             * @param {Tab} tab The tab to strip the whitespace from
             * If not provided, the currently focussed tab will be used instead
             */
            strpws: stripws
        });

        register(null, {
            "ace.stripws": plugin
        });
    }
});

