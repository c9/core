define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "ui", "commands", "menus", "preferences", "settings"
    ];
    main.provides = ["myplugin"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var ui = imports.ui;
        var menus = imports.menus;
        var commands = imports.commands;
        var settings = imports.settings;
        var prefs = imports.preferences;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var showing;
        function load() {
            commands.addCommand({
                name: "mycommand",
                bindKey: { mac: "Command-I", win: "Ctrl-I" },
                isAvailable: function() { return true; },
                exec: function() {
                    showing ? hide() : show();
                }
            }, plugin);
            
            menus.addItemByPath("Tools/My Menu Item", new ui.item({
                command: "mycommand"
            }), 300, plugin);
            
            settings.on("read", function(e) {
                settings.setDefaults("user/my-plugin", [
                    ["first", "1"],
                    ["second", "all"]
                ]);
            });
            
            prefs.add({
                "Example": {
                    position: 450,
                    "My Plugin": {
                        position: 100,
                        "First Setting": {
                            type: "checkbox",
                            path: "user/my-plugin/@first",
                            position: 100
                        },
                        "Second Setting": {
                            type: "dropdown",
                            path: "user/my-plugin/@second",
                            width: "185",
                            position: 200,
                            items: [
                                { value: "you", caption: "You" },
                                { value: "me", caption: "Me" },
                                { value: "all", caption: "All" }
                            ]
                        }
                    }
                }
            }, plugin);
        }
        
        var drawn = false;
        function draw() {
            if (drawn) return;
            drawn = true;
            
            // Insert HTML
            var markup = require("text!./plugin.html");
            ui.insertHtml(document.body, markup, plugin);
            
            // Insert CSS
            ui.insertCss(require("text!./style.css"), null, plugin);
        
            emit("draw");
        }
        
        /***** Methods *****/
        
        function show() {
            draw();
            
            var div = document.querySelector(".helloworld");
            div.style.display = "block";
            div.innerHTML = settings.get("user/my-plugin/@second");
            
            emit("show");
            showing = true;
        }
        
        function hide() {
            if (!drawn) return;
            
            document.querySelector(".helloworld").style.display = "none";
            
            emit("hide");
            showing = false;
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("unload", function() {
            drawn = false;
            showing = false;
        });
        
        /***** Register and define API *****/
        
        /**
         * This is an example of an implementation of a plugin.
         * @singleton
         */
        plugin.freezePublicAPI({
            /**
             * @property showing whether this plugin is being shown
             */
            get showing() { return showing; },
            
            _events: [
                /**
                 * @event show The plugin is shown
                 */
                "show",
                
                /**
                 * @event hide The plugin is hidden
                 */
                "hide"
            ],
            
            /**
             * Show the plugin
             */
            show: show,
            
            /**
             * Hide the plugin
             */
            hide: hide,
        });
        
        register(null, {
            "myplugin": plugin
        });
    }
});