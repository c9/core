define(function(require, exports, module) {
    main.consumes = ["Plugin", "installer", "proc", "c9"];
    main.provides = ["installer.zip"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var installer = imports.installer;
        var proc = imports.proc;
        var c9 = imports.c9;
        
        var bashBin = options.bashBin || "bash";
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        
        /**
         * Extracts a zip package to a target directory
         * Optionally downloads a zip package from a url
         */
        function execute(task, options, onData, callback) {
            if (!task.source && !task.url) {
                throw new Error("Invalid Task Definition. Missing source "
                    + "or url field: " + JSON.stringify(task));
            }
            
            var source = (task.source || "-1").replace(/^~/, c9.home);
            var target = task.target.replace(/^~/, c9.home);
            
            installer.ptyExec({
                name: "Zip",
                bash: bashBin,
                proc: proc,
                code: require("text!./zip.sh"),
                args: [source, target, task.url || "", task.dir || ""],
                cwd: options.cwd
            }, onData, callback);

        }
        
        function isAvailable(callback) {
            callback(true);
        }
        
        plugin.on("load", function() {
            installer.addPackageManager("zip", plugin);
        });
        plugin.on("unload", function() {
            installer.removePackageManager("zip");
        });
        
        plugin.freezePublicAPI({ execute: execute, isAvailable: isAvailable });
        
        register(null, {
            "installer.zip": plugin
        });
    }
});