define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "dialog.notification"
    ];
    main.provides = ["readonly", "preferences.experimental"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var notify = imports["dialog.notification"].show;
        
        var shouldShowError = options.shouldShowError;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);

        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            if (shouldShowError) {
                notify("<div class='c9-readonly'>You are in Read-Only Mode. "
                    + "Contact the workspace owner to get write permissions."
                    + "</div>", true);
            }
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        
        /***** Register and define API *****/
        
        plugin.freezePublicAPI({});
        
        register(null, { 
            readonly: plugin,
            "preferences.experimental": {
                addExperiment: function() {}
            }
        });
    }
});