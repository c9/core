define(function(require, exports, module) {
    main.consumes = ["Plugin", "installer", "proc"];
    main.provides = ["installer.bash"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var installer = imports.installer;
        var proc = imports.proc;
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        
        /**
         * Execute a bash bash script
         */
        function execute(script, options, onData, callback) {
            if (typeof script == "string") {
                script = {
                    code: script
                };
            }
            
            installer.ptyExec({
                name: "Bash",
                code: script.code,
                args: script.args,
                cwd: options.cwd,
            }, onData, callback);
        }
        
        function isAvailable(callback) {
            callback(true);
        }
        
        plugin.on("load", function() {
            installer.addPackageManager("bash", plugin);
        });
        plugin.on("unload", function() {
            installer.removePackageManager("bash");
        });
        
        plugin.freezePublicAPI({ execute: execute, isAvailable: isAvailable });
        
        register(null, {
            "installer.bash": plugin
        });
    }
});