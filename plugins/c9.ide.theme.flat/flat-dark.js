define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "layout", "menus", "tabinteraction", "settings",
        "dialog.notification"
    ];
    main.provides = ["theme.flat-dark"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var menus = imports.menus;
        var settings = imports.settings;
        var layout = imports.layout;
        var tabinteraction = imports.tabinteraction;
        var notify = imports["dialog.notification"].show;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var oldHeight, oldMinimizedHeight, oldTabInteraction, oldTabDelta;
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            var update = function(e) {
                var fromFlat = /^flat-/.test(e.oldTheme);
                var toFlat = /^flat-/.test(e.theme);
                if (e.theme == "flat-dark" && !fromFlat) {
                    oldHeight = menus.height;
                    layout.getElement("logobar").setHeight(40);
                    oldMinimizedHeight = menus.minimizedHeight;
                    oldTabInteraction = tabinteraction.plusMargin;
                    oldTabDelta = apf.tabRightDelta;
                    
                    menus.height = 40;
                    menus.minimizedHeight = 8;
                    
                    tabinteraction.plusMargin = 14;
                    apf.tabRightDelta = 25;
                    
                    settings.set("user/ace/@cursorStyle", "smooth slim");
                }
                else if (e.oldTheme == "flat-dark" && !toFlat) {
                    // temporary hack for local version
                    var oldHeight = window.process ? 27 : 31;
                    menus.height = oldHeight;
                    layout.getElement("logobar").setHeight(oldHeight);
                    
                    menus.minimizedHeight = oldMinimizedHeight;
                    
                    tabinteraction.plusMargin = oldTabInteraction;
                    apf.tabRightDelta = oldTabDelta;
                    
                    settings.set("user/ace/@cursorStyle", "ace");
                }
            };
            
            layout.on("themeChange", update);
            
            if (layout.theme == "flat-dark")
                update({ theme: layout.theme });
            else if (!settings.getBool("user/theme/@ask-flat-dark") && false) {
                var hideThemeSwitch = notify("<div class='c9-theme-switch'>"
                    + "The <a href='#' target='_blank'>Flat Dark Theme</a> is "
                    + "now available. Click here to switch.</div>", true);
                
                document.querySelector(".c9-theme-switch").addEventListener("click", function() {
                    hideThemeSwitch();
                    settings.set("user/general/@skin", "flat-dark");
                    layout.updateTheme();
                }, false);
                
                settings.set("user/theme/@ask-flat-dark", true);
            }
        }
        
        var drawn = false;
        function draw() {
            if (drawn) return;
            drawn = true;
            
            emit("draw");
        }
        
        /***** Methods *****/

        
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
            drawn = false;
        });
        
        /***** Register and define API *****/
        
        /**
         * 
         **/
        plugin.freezePublicAPI({
            
        });
        
        register(null, {
            "theme.flat-dark": plugin
        });
    }
});