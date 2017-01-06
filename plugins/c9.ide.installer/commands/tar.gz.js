define(function(require, exports, module) {
    main.consumes = ["Plugin", "installer", "proc", "c9"];
    main.provides = ["installer.tar.gz"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var installer = imports.installer;
        var proc = imports.proc;
        var c9 = imports.c9;
        
        var bashBin = options.bashBin || "bash";
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        
        /**
         * Extracts a tar.gz package to a target directory
         * Optionally downloads a tar.gz package from a url
         */
        function execute(task, options, onData, callback) {
            if (!task.source && !task.url) {
                throw new Error("Invalid Task Definition. Missing source "
                    + "or url field: " + JSON.stringify(task));
            }
            
            var source = (task.source || "-1").replace(/^~/, c9.home);
            var target = task.target.replace(/^~/, c9.home);
            
            source = normalizePath(source);
            target = normalizePath(target);
            
            var code = require("text!./tar.gz.sh");
            if (c9.platform == "win32")
                code = code.replace(/2> >\(/g, "#");
            
            installer.ptyExec({
                name: "Tar.Gz",
                bash: bashBin,
                proc: proc,
                code: code,
                args: [".", source, target, task.url || "", task.dir || ""],
                cwd: options.cwd
            }, onData, callback);

        }
        
        function normalizePath(p) {
            if (c9.platform == "win32")
                p = p.replace(/\\/g, "/").replace(/^(\w):/, "/$1");
            return p;
        }
        
        function isAvailable(callback) {
            callback(true);
        }
        
        plugin.on("load", function() {
            installer.addPackageManager("tar.gz", plugin);
        });
        plugin.on("unload", function() {
            installer.removePackageManager("tar.gz");
        });
        
        plugin.freezePublicAPI({ execute: execute, isAvailable: isAvailable });
        
        register(null, {
            "installer.tar.gz": plugin
        });
    }
});