define(function(require, exports, module) {
    main.consumes = ["Plugin"];
    main.provides = ["focusManager"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        // var emit = plugin.getEmitter();
        
        var tabManager;
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
        }
        
        /***** Methods *****/
        
        function focus(el, blurTab) {
            if (!el) return;
            if (el.$amlLoaded) {
                el.focus();
                if (blurTab) {
                    var tab = tabManager && tabManager.focussedTab;
                    if (tab && tab.editor) 
                        tab.editor.focus(false, true);
                }
            }
            else if (!el.$amlDestroyed) {
                tabManager.focusTab(el);
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
            loaded = false;
        });
        
        /***** Register and define API *****/
        
        /**
         * This is a stub for the real focus manager that will be build in the
         * future. For now it is used by dialog to return focus
         **/
        plugin.freezePublicAPI({
            set tabManager(v) { tabManager = v; },
            
            get activeElement() { 
                if (tabManager && tabManager.focussed)
                    return tabManager.focussedTab;
                else
                    return apf.activeElement;
            },
            
            focus: focus
        });
        
        register(null, {
            focusManager: plugin
        });
    }
});
