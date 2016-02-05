define(function(require, exports, module) {
    main.consumes = [
        "PreferencePanel", "ui", "dialog.confirm", "settings",
        "preferences"
    ];
    main.provides = ["preferences.general"];
    return main;

    function main(options, imports, register) {
        var PreferencePanel = imports.PreferencePanel;
        var prefs = imports.preferences;
        var settings = imports.settings;
        var ui = imports.ui;
        var confirm = imports["dialog.confirm"].show;
        
        /***** Initialization *****/
        
        var plugin = new PreferencePanel("Ajax.org", main.consumes, {
            caption: "User Settings",
            form: true,
            index: 100
        });
        var emit = plugin.getEmitter();
        emit.setMaxListeners(1000);
        
        var intro;
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            plugin.form.add([{
                type: "custom",
                title: "Introduction",
                position: 1,
                node: intro = new ui.bar({
                    "class" : "intro",
                    style: "padding:12px;position:relative;"
                })
            }], plugin);
            
            prefs.on("add", function(e) {
                if (!("Project" in e.state))
                    plugin.add(e.state, e.plugin);
            }, plugin);
        }
        
        var drawn = false;
        function draw(e) {
            if (drawn) return;
            drawn = true;
            
            plugin.add({
               "General" : {
                    position: 10,
                    "General" : {
                        position: 10,
                        "Reset to Factory Settings" : {
                            type: "button",
                            caption: "Reset to Defaults",
                            width: 140,
                            onclick: function(){
                                confirm("Reset Settings", 
                                    "Are you sure you want to reset your settings?", 
                                    "By resetting your settings to their "
                                    + "defaults you will lose all custom settings. "
                                    + "Cloud9 will return to it's original configuration", 
                                    function(){
                                        settings.reset();
                                    }, function(){},
                                    { yes: "Reset settings", no: "Cancel" });
                            }
                        }
                    },
                    "User Interface" : {
                        position: 20,
                        "Enable UI Animations" : {
                            type: "checkbox",
                            path: "user/general/@animateui",
                            position: 1000
                        },
                        "Use an Asterisk (*) to Mark Changed Tabs" : {
                            type: "checkbox",
                            path: "user/tabs/@asterisk",
                            position: 1050
                        },
                        "Display Title of Active Tab as Browser Title" : {
                            type: "checkbox",
                            path: "user/tabs/@title",
                            position: 1100
                        }
                    }
                }
            }, plugin);
            
            intro.$int.innerHTML = 
                '<h1>User Settings</h1>'
                + (options.local
                  ? '<p>These settings are saved at '
                    + '<a href="javascript:void(0)">'
                    + options.installPath + '/user.settings'
                    + '</a>.</p>'
                  : '<p>Manually edit these settings by clicking on this link: '
                    + '<a href="javascript:void(0)">'
                    + 'user.settings</a>.</p>')
                + '<p class="hint">These settings are synced across all your workspaces.</p>';
            
            intro.$int.querySelector("a").onclick = function(){ 
                emit("edit");
            };
        }
        
        /***** Methods *****/
        
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("draw", function(e) {
            draw(e);
        });
        plugin.on("unload", function() {
            loaded = false;
            drawn = false;
            intro = null;
        });
        
        /***** Register and define API *****/
        
        /**
         * 
         **/
        plugin.freezePublicAPI({
        });
        
        register(null, {
            "preferences.general": plugin
        });
    }
});