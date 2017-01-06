/**
 * Mock proc plugin for the readonly mode
 */
 
define(function(require, exports, module) {
    main.consumes = ["Plugin"];
    main.provides = ["proc"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        plugin.freezePublicAPI({
            execFile: function(path, options, callback) {
                if (!callback) callback = options;
                callback(new Error("Not implemented in read only mode"));
            }
        });
        
        register(null, { proc: plugin });
    }
});