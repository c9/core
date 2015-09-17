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
            index: 500
        });
        var emit = plugin.getEmitter();
        emit.setMaxListeners(1000);
        
        var intro;
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            settings.setDefaults("state/experiments", [["@enabled", true]]);
            
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
                '<h1>Experimental Features (reload to apply changes)</h1><p style="white-space:normal">Cloud9 is continuously in '
                + 'development. New features in alpha or beta are first hidden '
                + 'and can be enabled via this page. <i>Use at your own risk</i></p>';
        }
        
        /***** Methods *****/
        
        // =0 means the value should be set to 0 to disable otherwise it is enabled
        // =1 means the value should be set to 1 to enable otherwise it is disabled
        var found = {};
        function addExperiment(query, name){
            var key = query.split("=");
            var defValue = Number(key[1]); key = key[0];
            var uniqueId = key.replace(/\//g, "-");
            
            var parts = name.split("/");
            var current, obj = { "Experimental": current = {} };
            for (var i = 0; i < parts.length; i++) {
                current[parts[i]] = current = {};
            }
            current.type = "checkbox";
            current.setting = "state/experiments/@" + uniqueId;
            
            if (!found[name])
                plugin.add(obj, plugin);
            found[name] = true;
            
            settings.setDefaults("state/experiments", [[uniqueId, !defValue]]);
            
            // return value from url if present, otherwise return the setting
            var idx = c9.location.indexOf(key + "=");
            if (idx !== -1) {
                if (c9.location.indexOf(key + "=0") != -1)
                    return false;
                if (c9.location.indexOf(key + "=1") != -1)
                    return true;
            }
            
            return settings.getBool(current.setting);
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