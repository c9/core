define(function(require, exports, module) {
    main.consumes = ["Plugin", "installer", "proc", "c9"];
    main.provides = ["installer.symlink"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var installer = imports.installer;
        var c9 = imports.c9;
        
        var dirname = require("path").dirname;
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        
        /**
         * Creates a symlink
         */
        function execute(task, options, onData, callback) {
            if (!task.source || !task.target) {
                throw new Error("Invalid Task Definition. Missing source "
                    + "and/or target field: " + JSON.stringify(task));
            }
            
            var source = task.source.replace(/^~/, c9.home);
            var target = task.target.replace(/^~/, c9.home);
            
            var script = [
                'set -ex',
                'export C9_DIR="$HOME"/.c9',
                'mkdir -p "$1"',
                'ln -sf "$2" "$3"'
            ];
            
            installer.ptyExec({
                name: "ln",
                code: script.join("\n"),
                cwd: options.cwd,
                args: [".", dirname(target), source, target],
            }, onData, callback);
        }
        
        function isAvailable(callback) {
            callback(true);
        }
        
        plugin.on("load", function() {
            installer.addPackageManager("symlink", plugin);
        });
        plugin.on("unload", function() {
            installer.removePackageManager("symlink");
        });
        
        plugin.freezePublicAPI({ execute: execute, isAvailable: isAvailable });
        
        register(null, {
            "installer.symlink": plugin
        });
    }
});