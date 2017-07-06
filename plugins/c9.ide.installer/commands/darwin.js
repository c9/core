define(function(require, exports, module) {
    main.consumes = ["Plugin", "installer", "c9"];
    main.provides = ["installer.darwin"];
    return main;
    
    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var installer = imports.installer;
        var c9 = imports.c9;
        
        var bashBin = options.bashBin || "bash";
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        
        /**
         * Installs a .deb package
         */
        function execute(task, options, onData, callback) {
            installer.ptyExec({
                name: "Darwin",
                bash: bashBin,
                code: require("text!./darwin.sh"),
                args: [task],
                cwd: options.cwd,
            }, onData, callback);
        }
        
        function isAvailable(callback) {
            return callback(c9.platform == "darwin");
        }
        
        plugin.on("load", function() {
            installer.addPackageManager("darwin", plugin);
            installer.addPackageManagerAlias("darwin", "osx");
        });
        plugin.on("unload", function() {
            installer.removePackageManager("darwin");
        });
        
        plugin.freezePublicAPI({ execute: execute, isAvailable: isAvailable });
        
        register(null, {
            "installer.darwin": plugin
        });
    }
});