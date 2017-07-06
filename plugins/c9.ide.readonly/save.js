/**
 * Mock save plugin for the readonly mode
 */
 
define(function(require, exports, module) {
    main.consumes = ["Plugin"];
    main.provides = ["save"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        plugin.freezePublicAPI({});
        
        register(null, { save: plugin });
    }
});