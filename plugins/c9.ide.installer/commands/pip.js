define(function(require, exports, module) {
    main.consumes = ["Plugin", "installer"];
    main.provides = ["installer.pip"];
    return main;
    
    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var installer = imports.installer;
        
        var bashBin = options.bashBin || "bash";
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        
        /**
         * Installs a PIP package
         */
        function execute(task, options, onData, callback) {
            var PIP = "pip";
            
            var script = 'set -e\n'
                + PIP + ' install ' + task;
                + "\n";
            
            installer.ptyExec({
                name: "PIP",
                bash: bashBin,
                code: script,
                cwd: options.cwd,
            }, onData, callback);
        }
        
        function isAvailable(callback) {
            callback(true);
        }
        
        plugin.on("load", function() {
            installer.addPackageManager("pip", plugin);
        });
        plugin.on("unload", function() {
            installer.removePackageManager("pip");
        });
        
        plugin.freezePublicAPI({ execute: execute, isAvailable: isAvailable });
        
        register(null, {
            "installer.pip": plugin
        });
    }
});