define(function(require, exports, module) {
    main.consumes = ["Plugin", "cli_commands", "proc", "bridge.client"];
    main.provides = ["open"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var cmd = imports.cli_commands;
        var proc = imports.proc;
        var bridge = imports["bridge.client"];
        
        var fs = require("fs");
        var PATH = require("path");

        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        // var emit = plugin.getEmitter();

        var loaded;
        function load(){
            if (loaded) return;
            loaded = true;
            
            cmd.addCommand({
                name: "open", 
                info: "     Opens a file or directory.",
                usage: "[--wait] [--pipe] <path>",
                options: {
                    "wait": {
                        description: "Wait until the file(s) are closed",
                        "default": false,
                        "boolean": true
                    },
                    "pipe": {
                        description: "Pipe data from a command into c9",
                        "default": false,
                        "boolean": true
                    }
                },
                check: function(argv) {
                    if (argv._.length < 2 && !argv["path"] && !argv.pipe)
                        throw new Error("Missing path");
                },
                exec: function(argv) {
                    if (argv.pipe) {
                        openWithPipe(function(){});
                        return;
                    }
                    open(
                        argv._.slice(1),  // Remove "open" from the paths
                        argv.wait,
                        function(){});
                }
            });
        }

        /***** Methods *****/

        function open(paths, wait, callback) {
            try {
                paths = paths.map(function(path) {
                    var isDir = fs.existsSync(path) && fs.statSync(path).isDirectory();
                    path = PATH.resolve(path);
                    if (path.substr(0, process.env.HOME.length) == process.env.HOME)
                        path = "~" + path.substr(process.env.HOME.length);
                        
                    return {
                        path: path,
                        type: isDir ? "directory" : "file"
                    };
                });
            } catch (e) {
                var msg = e.message.split(",")[1].trim();
                console.error(msg.charAt(0).toUpperCase() + msg.substr(1));
                return;
            }
            
            var last;
            paths.forEach(function(info) {
                var path = info.type == "directory"
                    ? info.path : PATH.dirname(info.path);
                
                if (!last) {
                    last = path;
                }
                else {
                    var one = last.split(PATH.sep);
                    var two = path.split(PATH.sep);
                    for (var i = 0; i < one.length; i++) {
                        if (one[i] != two[i]) {
                            last = one.slice(0, i).join(PATH.sep);
                            return;
                        }
                    }
                }
            });
            // cwd = last || process.cwd();
            // else if (workspace == ".")
            //     cwd = process.cwd();
            
            var message = {
                type: "open",
                workspace: "local",
                wait: wait,
                // cwd       : cwd,
                paths: paths
            };
            
            bridge.send(message, function cb(err, response) {
                if (err) {
                    if (err.code == "ECONNREFUSED") {
                        // Seems Cloud9 is not running, lets start it up
                        startCloud9Local({}, function(success) {
                            if (success)
                                bridge.send(message, cb);
                            else {
                                console.log("Could not start Cloud9. "
                                    + "Please check your configuration.");
                                callback(err);
                                
                                process.exit(40); // This appears to be needed; let's return something useful
                            }
                        });
                        return;
                    }
                    else
                        console.log(err.message);
                }
                
                if (response !== true)
                    console.log("Could not open ", paths);
                
                process.exit(); // I don't get why this is needed
            });
        }
        
        function openWithPipe(callback) {
            bridge.send({
                type: "pipe",
                path: process.cwd() + "/" + "Pipe " + (new Date()).toLocaleString().replace(/:/g, "."),
            }, function cb(err, response) {
                if (err) {
                    if (err.code == "ECONNREFUSED") {
                        // Seems Cloud9 is not running, lets start it up
                        startCloud9Local({}, function(success) {
                            if (success)
                                bridge.send({ type: "pipe" }, cb);
                            else {
                                console.log("Could not start Cloud9. "
                                    + "Please check your configuration.");
                                callback(err);
                                
                                process.exit(40); // This appears to be needed; let's return something useful
                            }
                        });
                        return;
                    }
                    else {
                        console.log(err.message);
                        return;
                    }    
                }
                
                var stdin = process.openStdin();
                stdin.setEncoding("utf8");
                var finished = 0;
                stdin.on("data", function(chunk) {
                    finished++;
                    bridge.send({
                        type: "pipeData",
                        data: chunk,
                        tab: response
                    }, function(err, message) {
                        // Dunno why, but this always returns No Response...
                        // Escaping that error so end users aren't confused...
                        if (err && err.message !== "No Response") 
                            console.log(err.message);
                        finished--;
                    });
                });
                stdin.on("end", function() {
                    (function retry() {
                        if (finished === 0)
                            process.exit();
                        setTimeout(retry, 100);
                    })();
                });
            });
        }
        
        function startCloud9Local(opts, callback) {
            if (options.platform == "darwin") {
                proc.spawn("open", {
                    args: ["-b", "io.c9.desktop"],
                    detached: true
                }, function(err, process) {
                    if (err)
                        return callback(false);

                    // required so the parent can exit
                    process.unref();
                    
                    var timed = Date.now();
                    (function retry(){
                        bridge.send({ type: "ping" }, function(err, message) {
                            if (!err) 
                                return callback(true);
                            
                            if (Date.now() - timed > 10000)
                                return callback(false);
                            
                            if (message !== true)
                                return callback(false);
                            
                            setTimeout(retry, 100);
                        });
                    })();
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
        
        plugin.on("load", function(){
            load();
        });
        plugin.on("enable", function(){
            
        });
        plugin.on("disable", function(){
            
        });
        plugin.on("unload", function(){
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
            open: open
        });
        
        register(null, {
            open: plugin
        });
    }
});