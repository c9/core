define(function(require, exports, module) {
    main.consumes = ["Plugin", "installer", "proc"];
    main.provides = ["installer.centos"];
    return main;
    
    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var installer = imports.installer;
        var proc = imports.proc;
        
        var bashBin = options.bashBin || "bash";
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        
        /**
         * Installs a yum package
         */
        function execute(task, options, onData, callback) {
            var script = 'set -e\n'
                + 'sudo yum -y install ' + task
                + "\n";
            
            installer.ptyExec({
                name: "CentOS",
                bash: bashBin,
                code: script,
                cwd: options.cwd,
            }, onData, callback);
        }
        
        var available;
        function isAvailable(callback) {
            if (typeof available != "undefined")
                return callback(available);
            
            proc.execFile("which", { args: ["yum"]}, function(err, stdout) {
                if (err) return callback(false);
                
                available = stdout.length > 0;
                callback(available);
            });
        }
        
        plugin.on("load", function() {
            installer.addPackageManager("centos", plugin);
            installer.addPackageManagerAlias("centos", "rhel", "fedora");
        });
        plugin.on("unload", function() {
            installer.removePackageManager("centos");
            available = undefined;
        });
        
        plugin.freezePublicAPI({ execute: execute, isAvailable: isAvailable });
        
        register(null, {
            "installer.centos": plugin
        });
    }
});