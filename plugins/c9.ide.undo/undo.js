define(function(require, exports, module) {
    "use strict";
    
    main.consumes = [
        "Plugin", "menus", "tabManager", "commands", "apf"
    ];
    main.provides = ["undo"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var menus = imports.menus;
        var commands = imports.commands;
        var tabs = imports.tabManager;
        var apf = imports.apf;

        /***** Initialization *****/

        var plugin = new Plugin("Ajax.org", main.consumes);
        // var emit = plugin.getEmitter();

        function canDo (actionName) {
            return function (editor, args, event) {
                var tab = tabs.focussedTab;
                if (!tab) return;
                if (event instanceof KeyboardEvent && !tabs.focussed)
                    return false;
                return tab && tab.document.undoManager[actionName]();
            };
        }

        var canUndo = canDo("canUndo");
        var canRedo = canDo("canRedo");

        var loaded = false;
        function load(callback) {
            if (loaded) return false;
            loaded = true;

            commands.addCommand({
                name: "undo",
                exec: undo,
                isAvailable: canUndo,
                bindKey: { mac: "Command-Z", win: "Ctrl-Z" }
            }, plugin);
            commands.addCommand({
                name: "redo",
                exec: redo,
                isAvailable: canRedo,
                bindKey: { mac: "Command-Shift-Z|Command-Y", win: "Ctrl-Shift-Z|Ctrl-Y" }
            }, plugin);

            menus.addItemByPath("Edit/Undo", new apf.item({
                command: "undo"
            }), 100, plugin);
            menus.addItemByPath("Edit/Redo", new apf.item({
                command: "redo"
            }), 200, plugin);
        }

        /***** Methods *****/
        function undo(editor) {
            if (editor && editor.ace)
                editor.ace.execCommand("undo");
            else if (canUndo() && apf.isChildOf(tabs.container, apf.activeElement, true))
                tabs.focussedTab.document.undoManager.undo();
        }

        function redo(editor) {
            if (editor && editor.ace)
                editor.ace.execCommand("redo");
            else if (canRedo() && apf.isChildOf(tabs.container, apf.activeElement, true))
                tabs.focussedTab.document.undoManager.redo();
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
            loaded = false;
        });

        /***** Register and define API *****/

        /**
         * Undo module for Cloud9
         * @singleton
         */
        plugin.freezePublicAPI({
            /**
             * Reverts the last edit made to the currently focussed tab document
             */
            undo: undo,

            /**
             * Re-executes the last reverted edit in the currently focussed tab document
             */
            redo: redo
        });

        register(null, {
            undo: plugin
        });
    }
});
