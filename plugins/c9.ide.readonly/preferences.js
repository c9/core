/**
 * Mock preferences plugin for the readonly mode
 */
 
define(function(require, exports, module) {
    main.consumes = ["Plugin", "settings"];
    main.provides = ["preferences"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var settings = imports.settings;
        
        settings.on("read", function() {
            settings.setDefaults("user/general", [["animateui", true]]);
        });
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        plugin.freezePublicAPI({
            add: function() {}
        });
        
        register(null, { preferences: plugin });
    }
});