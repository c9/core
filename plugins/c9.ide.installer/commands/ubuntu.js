define(function(require, exports, module) {
    main.consumes = ["Plugin", "installer", "proc"];
    main.provides = ["installer.ubuntu"];
    return main;
    
    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var installer = imports.installer;
        var proc = imports.proc;
        
        var bashBin = options.bashBin || "bash";
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        
        /**
         * Installs a .deb package
         */
        function execute(task, options, onData, callback) {
            var script = 'sudo apt-get -qq -y install ' + task + '\n'
                + 'EXIT=$?\n'
                + 'if [ $EXIT = 100 ]; then\n'
                + '  sudo apt-get update\n'
                + '  sudo apt-get -qq -y install ' + task + '\n'
                + '  exit $?\n'
                + 'fi\n'
                + "exit $EXIT\n";
            
            installer.ptyExec({
                name: "Ubuntu",
                bash: bashBin,
                code: script,
                cwd: options.cwd,
            }, onData, callback);
        }
        
        var available;
        function isAvailable(callback) {
            if (typeof available != "undefined")
                return callback(available);
            
            proc.execFile("which", { args: ["apt-get"]}, function(err, stdout) {
                if (err) return callback(false);
                
                available = stdout.length > 0;
                callback(available);
            });
        }
        
        plugin.on("load", function() {
            installer.addPackageManager("ubuntu", plugin);
            installer.addPackageManagerAlias("ubuntu", "debian");
        });
        plugin.on("unload", function() {
            installer.removePackageManager("ubuntu");
            available = undefined;
        });
        
        plugin.freezePublicAPI({ execute: execute, isAvailable: isAvailable });
        
        register(null, {
            "installer.ubuntu": plugin
        });
    }
});