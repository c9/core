define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "tabManager"
    ];
    main.provides = ["mergetool"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var tabManager = imports.tabManager;
        
        var addConflictMarker = require("./diff/conflictmarker");
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        // var emit = plugin.getEmitter();
        
        function load() {
            tabManager.on("open", onNewValue, plugin);
            tabManager.on("reload", onNewValue, plugin);
            tabManager.on("switchEditor", onNewValue, plugin);
        }
        
        /***** Methods *****/
        
        function onNewValue(e) {
            var tab = e.tab;
            var value = tab.document.recentValue;
            if (!value || typeof value != "string") return;
            
            if (hasMergeState(value))
                decorateTab(tab);
        }
        
        function hasMergeState(value) {
            return /^<{7} /gm.test(value)
                && /^={7}/gm.test(value)
                && /^>{7} /gm.test(value);
        }
        
        function decorateTab(tab) {
            if (tab.editor.ace)
                addConflictMarker(tab.editor.ace);
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("unload", function() {
            
        });
        
        /***** Register and define API *****/
        
        /**
         * This is an example of an implementation of a plugin. Check out [the source](source/template.html)
         * for more information.
         * 
         * @class Template
         * @extends Plugin
         * @singleton
         */
        plugin.freezePublicAPI({
            /**
             * 
             */
            decorateTab: decorateTab
        });
        
        register(null, {
            mergetool: plugin
        });
    }
});