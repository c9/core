define(function(require, exports, module) {
    main.consumes = [
        "PreferencePanel", "ui", "dialog.confirm", "settings",
        "preferences"
    ];
    main.provides = ["preferences.project"];
    return main;

    function main(options, imports, register) {
        var PreferencePanel = imports.PreferencePanel;
        var prefs = imports.preferences;
        var ui = imports.ui;
        
        /***** Initialization *****/
        
        var plugin = new PreferencePanel("Ajax.org", main.consumes, {
            caption: "Project Settings",
            form: true,
            index: 50
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
                    "class": "intro",
                    style: "padding:12px;position:relative;"
                })
            }], plugin);
            
            prefs.on("add", function(e) {
                if ("Project" in e.state)
                    plugin.add(e.state, e.plugin);
            }, plugin);
            
            prefs.on("draw", function(e) {
                if (!prefs.activePanel)
                    prefs.activate(plugin);
            }, plugin);
        }
        
        var drawn = false;
        function draw(e) {
            if (drawn) return;
            drawn = true;
            
            intro.$int.innerHTML = 
                '<h1>Project Settings</h1><p>These settings are specific to this project. They are saved at: '
                + '<span style="padding:5px 0 5px 0px"><a href="javascript:void(0)">'
                + '&lt;project>/.c9/project.settings'
                + '</a>.</span></p><p class="hint">Hint: Add the .c9 folder to your '
                + 'repository to share these settings with your collaborators.</p>';
            
            intro.$int.querySelector("a").onclick = function() { 
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
            _events: [
                
            ]
        });
        
        register(null, {
            "preferences.project": plugin
        });
    }
});