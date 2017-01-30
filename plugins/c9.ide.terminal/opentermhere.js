define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "ui", "tree", "tabManager", "commands", "util"
    ];
    main.provides = ["opentermhere"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var ui = imports.ui;
        var tree = imports.tree;
        var util = imports.util;
        var tabManager = imports.tabManager;
        var commands = imports.commands;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        // var emit = plugin.getEmitter();
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            commands.addCommand({
                name: "opentermhere",
                hint: "Open a terminal in the folder of the selected item of the tree",
                group: "General",
                bindKey: { mac: "Command-Option-L", win: "Alt-L" },
                exec: openTerminalHere
            }, plugin);
            
            tree.getElement("mnuCtxTree", function(mnuCtxTree) {
                ui.insertByIndex(mnuCtxTree, new ui.item({
                    match: "",
                    caption: "Open Terminal Here",
                    command: "opentermhere"
                }), 1020, plugin);
            });
        }
        
        /***** Methods *****/
        
        function openTerminalHere() {
            var node = tree.selectedNode;
            if (!node) return;
            var path = node.isFolder ? node.path : node.parent.path;
            
            tabManager.open({
                focus: true,
                editorType: "terminal",
                document: { terminal: { cwd: util.normalizePath(path) }}
            });
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
         * 
         **/
        plugin.freezePublicAPI({
            /**
             * 
             */
            openTerminalHere: openTerminalHere
        });
        
        register(null, {
            opentermhere: plugin
        });
    }
});