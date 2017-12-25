define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "ui", "layout", "menus", "preferences", "settings"
    ];
    main.provides = ["notification.bubble"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var ui = imports.ui;
        var menus = imports.menus;
        var layout = imports.layout;
        var settings = imports.settings;
        var prefs = imports.preferences;

        /***** Initialization *****/

        var plugin = new Plugin("Ajax.org", main.consumes);
        var skin = require("text!./skin.xml");
        var markup = require("text!./bubble.xml");
        var emit = plugin.getEmitter();
        
        var ntNotifications;
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            settings.on("read", function() {
                settings.setDefaults("user/collab", [["showbubbles", true]]);
            });
            
            prefs.add({
                "General": {
                    "Collaboration": {
                        "Show Notification Bubbles": {
                            type: "checkbox",
                            position: 1000,
                            path: "user/collab/@showbubbles"
                        }
                    }
                }
            }, plugin);
        }
        
        var drawn = false;
        function draw() {
            if (drawn) return;
            drawn = true;
            
            ui.insertSkin({
                name: "bubble",
                data: skin,
            }, plugin);
            
            ui.insertMarkup(layout.findParent(plugin), markup, plugin);
            ntNotifications = plugin.getElement("ntNotifications");
            
            ntNotifications.on("closed", function(e) {
               emit("closed", { html: e.html });
            });
            
            emit("draw");
        }

        /***** Methods *****/

        function popup(message, persistent, callback) {
            if (!settings.getBool("user/collab/@showbubbles"))
                return;
            
            draw();
            
            if (ntNotifications.showing > 4)
                return;
            
            if (menus.minimized)
                ntNotifications.setAttribute("start-padding", 25);
            else
                ntNotifications.setAttribute("start-padding", 45);
                
            return ntNotifications.popup(message, null, null, persistent, callback);
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
            drawn = false;
        });

        /***** Register and define API *****/
        /**
         * Bubble volatile notifications for CLoud9
         **/
        plugin.freezePublicAPI({
            /**
             * 
             */
            popup: popup,
            
            _events: [
                /**
                 * @event draw
                 */
                "draw"
            ]
        });

        register(null, {
            "notification.bubble": plugin
        });
    }
});