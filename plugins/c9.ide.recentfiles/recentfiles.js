define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "menus", "tabManager", "settings", "ui"
    ];
    main.provides = ["recentfiles"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var ui = imports.ui;
        var menus = imports.menus;
        var settings = imports.settings;
        var tabManager = imports.tabManager;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        // var emit = plugin.getEmitter();
        
        var changed, menu, divider;
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            menu = new ui.menu();
            menus.addItemByPath("File/Open Recent/", menu, 500, plugin),
            divider = new ui.divider();
            menus.addItemByPath("File/Open Recent/~", divider, 1000000, plugin);

            menus.addItemByPath("File/Open Recent/Clear Menu", new ui.item({
                onclick: function() {
                    clearMenu();
                }
            }), 2000000, plugin);
            
            // Settings
            
            settings.on("read", function(e) {
                clearMenu();
    
                var state = settings.getJson("state/recentfiles") || [];
                for (var i = state.length - 1; i >= 0; i--) {
                    if (state[i])
                        add(state[i]);
                }
            }, plugin);
    
            settings.on("write", function(e) {
                if (!changed)
                    return;
    
                var state = menu.childNodes.filter(function(node) {
                    return node.localName == "item" && typeof node.value == "object";
                }).map(function(node) {
                    return node.value;
                });
                
                settings.setJson("state/recentfiles", state);
            }, plugin);
            
            // Hooks
            
            tabManager.on("tabDestroy", function(e) {
                if (!e.tab.path || e.tab.document.meta.newfile)
                    return;
    
                add(e.tab.getState(true));
                settings.save();
            }, plugin);
        }
        
        /***** Methods *****/
        
        function search(path) {
            var found = false;
            menu.childNodes.every(function(item) {
                if (item.value && item.value.path == path) {
                    found = item;
                    return false;
                }
                return true;
            });
            return found;
        }
        
        function add(state) {
            var item = search(state.path);
            if (item) {
                menu.insertBefore(item, menu.firstChild);
            }
            else {
                menu.insertBefore(new ui.item({
                    caption: state.document.title,
                    value: state,
                    onclick: function() {
                        state.active = true;
                        tabManager.open(state, function() {});
                        this.parentNode.removeChild(this);
                    }
                }), menu.firstChild);
            }
    
            while (menu.childNodes.length > 12) {
                divider.previousSibling.destroy(true, true);
            }
    
            var nodes = menu.selectNodes("item");
            if (nodes.length == 1)
                nodes[0].disable();
            else
                nodes[nodes.length - 1].enable();
            
            changed = true;
        }
    
        function clearMenu() {
            var nodes = menu.childNodes;
            for (var i = nodes.length - 1; i >= 0; i--) {
                if (nodes[0].localName == "item")
                    nodes[0].destroy(true, true);
                else break;
            }
            var item = menu.selectNodes("item")[0];
            item && item.disable();
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
            
        });
        
        register(null, {
            recentfiles: plugin
        });
    }
});