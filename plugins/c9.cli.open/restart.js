define(function(require, exports, module) {
    main.consumes = ["Plugin", "cli_commands", "proc"];
    main.provides = ["restart"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var cmd = imports.cli_commands;
        var proc = imports.proc;
        
        var fs = require("fs");
        var PATH = require("path");

        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        // var emit = plugin.getEmitter();

        var loaded;
        function load() {
            if (loaded) return;
            loaded = true;
            
            cmd.addCommand({
                name: "restart", 
                info: "  Restarts the currently running Cloud9",
                options: {},
                exec: function(argv) {
                    restart(function(err, success) {
                        console.log(err || success);
                        process.exit();
                    });
                }
            });
        }

        /***** Methods *****/
        
        function restart(callback) {
            if (options.platform == "darwin") {
                fs.readFile(process.env.HOME + "/.c9/pid", function(err, data) {
                    if (err) return callback("Cloud9 is Not Running");
                    
                    data = String(data).split(":");
                    
                    var pid = data[0];
                    var path = data[1];
                    
                    // Kill existing process
                    proc.execFile("kill", {
                        args: ["-9", pid]
                    }, function(err, stdout, stderr) {
                        if (err) 
                            return callback("Could not kill Cloud9");
                        
                        // Start new process
                        proc.spawn("open", {
                            args: ["-b", "io.c9.desktop", "--args", "-w", path],
                            detached: true
                        }, function(err, child) {
                            if (err)
                                return callback(false);
            
                            // required so the parent can exit
                            child.unref && child.unref();
                            
                            callback(null, "Restarted Cloud9");
                        });
                    });
                });
            }
            else if (options.platform == "linux") {
                
            }
            else if (options.platform == "windows") {
                
            }
            else {
                callback(false);
            }
        }

        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("enable", function() {
            
        });
        plugin.on("disable", function() {
            
        });
        plugin.on("unload", function() {
            loaded = false;
        });
        
        /***** Register and define API *****/

        /**
         * Finds or lists files and/or lines based on their filename or contents
         **/
        plugin.freezePublicAPI({
            /**
             *
             */
            restart: restart
        });
        
        register(null, {
            restart: plugin
        });
    }
});