define(function(require, exports, module) {
    main.consumes = ["Plugin", "installer"];
    main.provides = ["installer.gem"];
    return main;
    
    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var installer = imports.installer;
        
        var bashBin = options.bashBin || "bash";
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        
        /**
         * Installs a GEM package
         */
        function execute(task, options, onData, callback) {
            var GEM = "gem";
            
            var script = 'set -e\n'
                + GEM + ' install ' + task;
                + "\n";
            
            installer.ptyExec({
                name: "GEM",
                bash: bashBin,
                code: script,
                cwd: options.cwd,
            }, onData, callback);
        }
        
        function isAvailable(callback) {
            callback(true);
        }
        
        plugin.on("load", function() {
            installer.addPackageManager("gem", plugin);
        });
        plugin.on("unload", function() {
            installer.removePackageManager("gem");
        });
        
        plugin.freezePublicAPI({ execute: execute, isAvailable: isAvailable });
        
        register(null, {
            "installer.gem": plugin
        });
    }
});