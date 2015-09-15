define(function(require, exports, module) {
    main.consumes = [
        "PreferencePanel", "ui", "dialog.confirm", "settings",
        "preferences", "c9"
    ];
    main.provides = ["preferences.experimental"];
    return main;

    function main(options, imports, register) {
        var PreferencePanel = imports.PreferencePanel;
        var prefs = imports.preferences;
        var settings = imports.settings;
        var ui = imports.ui;
        var c9 = imports.c9;
        
        /***** Initialization *****/
        
        var plugin = new PreferencePanel("Ajax.org", main.consumes, {
            caption: "Experimental",
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
                    height: 102,
                    "class" : "intro",
                    style: "padding:12px;position:relative;"
                })
            }], plugin);
        }
        
        var drawn = false;
        function draw(e) {
            if (drawn) return;
            drawn = true;
            
            intro.$int.innerHTML = 
                '<h1>Experimental Features</h1><p>Cloud9 is continuously in '
                + 'development. New features in alpha or beta are first hidden '
                + 'and can be enabled via this page. <i>Use at your own risk</i></p>';
        }
        
        /***** Methods *****/
        
        // =0 means the value should be set to 0 to disable otherwise it is enabled
        // =1 means the value should be set to 1 to enable otherwise it is disabled
        var found = {};
        function addExperiment(query, name){
            if (found[name]) return;
            found[name] = true;
            
            var key = query.split("=");
            var defValue = Number(key[1]); key = key[0];
            var uniqueId = key.replace(/\//g, "-");
            
            var parts = name.split("/");
            var current, obj = { "Experimental": current = {} };
            for (var i = 0; i < parts.length; i++) {
                current[parts[i]] = current = {};
            }
            current.type = "checkbox";
            current.setting = "state/experiments/" + uniqueId;
            
            plugin.add(obj, plugin);
            
            var idx = c9.location.indexOf(query);
            var enabled = defValue == 1 ? idx > -1 : idx === -1;
            
            if (!enabled)
                enabled = settings.getBool("state/experiments/" + uniqueId);
            
            return enabled;
        }
        
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
                
            ],
            
            /**
             * 
             */
            addExperiment: addExperiment
        });
        
        register(null, {
            "preferences.experimental": plugin
        });
    }
});