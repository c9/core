define(function(require, exports, module) {
    main.consumes = ["Plugin", "installer"];
    main.provides = ["installer.message"];
    return main;
    
    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var installer = imports.installer;
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        
        function execute(task, options, onData, callback) {
            onData("\n" + task);
            callback();
        }
        
        function isAvailable(callback) {
            return callback(true);
        }
        
        plugin.on("load", function() {
            installer.addPackageManager("message", plugin);
        });
        plugin.on("unload", function() {
            installer.removePackageManager("message");
        });
        
        plugin.freezePublicAPI({ execute: execute, isAvailable: isAvailable });
        
        register(null, {
            "installer.message": plugin
        });
    }
});