define(function(require, exports, module) {
    main.consumes = ["Plugin", "installer", "c9"];
    main.provides = ["installer.npm"];
    return main;
    
    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var installer = imports.installer;
        var c9 = imports.c9;
        
        var bashBin = options.bashBin || "bash";
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        
        function execute(task, options, onData, callback, global) {
            var script = [
                'set -e',
                'export C9_DIR="$HOME"/.c9',
                // always use nodejs version installed by .c9
                'export PATH="$C9_DIR/node/bin:$C9_DIR/node_modules/.bin:/mnt/shared/sbin:$PATH"',
                'mkdir -p ./node_modules',
                 // TODO make sure we do not install a folder from cwd instead of npm module
                'npm install --production ' + task,
            ];
            
            installer.ptyExec({
                name: "npm",
                bash: bashBin,
                code: script.join("\n"),
                cwd: options.cwd,
            }, onData, callback);
        }
        
        function isAvailable(callback) {
            callback(true);
        }
        
        plugin.on("load", function() {
            installer.addPackageManager("npm", plugin);
            
            if (c9.platform === "win32")
                installer.addPackageManager("npm-g", plugin);
        });
        plugin.on("unload", function() {
            installer.removePackageManager("npm");
            
            if (c9.platform === "win32")
                installer.removePackageManager("npm-g");
        });
        
        plugin.freezePublicAPI({ execute: execute, isAvailable: isAvailable });
        
        register(null, { "installer.npm": plugin });
    }
});