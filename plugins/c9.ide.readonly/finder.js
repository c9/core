/**
 * Mock finder plugin for the readonly mode
 */
 
define(function(require, exports, module) {
    main.consumes = ["Plugin"];
    main.provides = ["finder"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        plugin.freezePublicAPI({
            find: function(options, callback) {
                callback(new Error("find is not available in readonly mode"));
            },
            list: function(options, callback) {
                callback(new Error("find is not available in readonly mode"));
            }
        });
        
        register(null, { finder: plugin });
    }
});