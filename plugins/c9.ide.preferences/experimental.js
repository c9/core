define(function(require, exports, module) {
    main.consumes = [
        "PreferencePanel", "ui", "dialog.alert", "settings", "c9"
    ];
    main.provides = ["preferences.experimental"];
    return main;

    function main(options, imports, register) {
        var PreferencePanel = imports.PreferencePanel;
        var settings = imports.settings;
        var ui = imports.ui;
        var c9 = imports.c9;
        var alert = imports["dialog.alert"].show;
        
        /***** Initialization *****/
        
        var plugin = new PreferencePanel("Ajax.org", main.consumes, {
            caption: "Experimental",
            form: true,
            index: 500
        });
        var emit = plugin.getEmitter();
        emit.setMaxListeners(1000);
        
        var intro, hasAlerted;
        
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
                + 'and can be enabled via this page. <i>Use at your own risk</i>.</p>';
        }
        
        /***** Methods *****/
        
        var found = {};
        function addExperiment(name, defaultValue, caption){
            var uniqueId = name.replace(/\//g, "-");
            
            var parts = caption.split("/");
            var current, obj = { "Experimental": current = {} };
            for (var i = 0; i < parts.length; i++) {
                current[parts[i]] = current = {};
            }
            current.type = "checkbox";
            current.setting = "state/experiments/@" + uniqueId;
            current.onchange = function(e){
                if (!hasAlerted) {
                    alert("Experimental Features",
                        "To see the effect of this change, please refresh Cloud9.");
                    hasAlerted = true;
                }
            };
            
            if (!found[caption])
                plugin.add(obj, plugin);
            found[caption] = true;
            
            settings.setDefaults("state/experiments", [[uniqueId, Number(defaultValue)]]);
            
            // return value from url if present, otherwise return the setting
            var idx = c9.location.indexOf(name + "=");
            if (idx !== -1) {
                if (c9.location.indexOf(name + "=0") != -1)
                    return false;
                if (c9.location.indexOf(name + "=1") != -1)
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
            hasAlerted = false;
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
             * Define a new experimental feature.
             * 
             * @param {String} name            The internal name of this experiment, e.g. foo
             * 
             * @param {Boolean} defaultValue   The default state of this experiment when not configure
             *                      
             * @param {String} caption         The name of this setting in the UI, e.g. SDK/Plugin Manager
             * 
             * @return {Boolean} true if this experiment is currently enabled
             */
            addExperiment: addExperiment
        });
        
        register(null, {
            "preferences.experimental": plugin
        });
    }
});