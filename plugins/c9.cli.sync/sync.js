define(function(require, exports, module) {
    main.consumes = ["Plugin", "cli_commands", "workspace", "settings", "fs", "proc"];
    main.provides = ["sync"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var cmd = imports.cli_commands;
        var workspace = imports.workspace;
        var settings = imports.settings;
        var proc = imports.proc;
        var fs = imports.fs;

        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();

        function load() {
            cmd.addCommand({
                name: "sync", 
                info: "Syncs a cloud9 workspace to local disk",
                usage: "[--resync] <workspace>:<path> <target_dir>",
                options: {
                    resync: {
                        description: "Set this flag to sync the entire folder again"
                    }
                },
                check: function(argv) {
                    if (argv._.length < 2)
                        throw new Error("Missing target directory");
                },
                exec: function(argv) {
                    //should call addSyncTarget, but for demo we call sync
                    sync(argv._[1], argv._[2], {}, function(err) {
                        if (err) console.error(err);
                    });
                }
            });

            // Load all sync targets from settings
            settings.on("read", function() {
                var targets = settings.getJson("user/sync/targets") || [];
                targets.forEach(function(target) {
                    addSyncTarget(target.wspath, target.path, function(err) {
                        if (err) console.error(err.message);
                    });
                });
            });

            settings.on("write", function() {

            });
        }

        /***** Methods *****/

        var apf = { mac: true, win: false };
        var UNISON_DIR = apf.mac 
            ? "/Library/Application\\ Support/Unison/" 
            : (apf.win 
                ? "C:\\Documents and Settings\\<your user id>\\.unison" 
                : "$HOME/.unison");
        var targets = {};

        function getWorkspace(wsname, callback) {
            emit("connecting", { wsname: wsname });

            workspace.connect(wsname, function(err, ws) {
                ws.setupSshConnection(function(err) {
                    if (err)
                        return callback(err);

                    callback(null, ws);
                });
            });
        }

        /**
         * Compare major version numbers of unison
         */
        function checkVersion(ws, callback) {
            var localVersion, remoteVersion;
            proc.execFile("unison", { args: ["-version"]}, function(err, e) {
                if (err) return callback(err);

                localVersion = e.stdout.match(/unison version ([\d\.]+)/) && parseInt(RegExp.$1, 10);
                if (!localVersion) callback(new Error("Could not find version for local unison"));

                ws.proc.execFile("unison", { args: ["-version"]}, function(err, e) {
                    if (err) return callback(err);

                    remoteVersion = e.stdout.match(/unison version ([\d\.]+)/) && parseInt(RegExp.$1, 10);
                    if (!remoteVersion) callback(new Error("Could not find version for remote unison"));

                    callback(null, localVersion == remoteVersion, localVersion, remoteVersion);
                });
            });
        }

        function addSyncTarget(wspath, path, callback) {
            var wsname = wspath.split(":")[0];
            getWorkspace(wsname, function(err, ws) {
                checkVersion(ws, function(err, match) {
                    if (err) return callback(err);

                    if (!match) {
                        var err = new Error("unison versions don't match");
                        emit("error", { error: err });
                        return callback(err);
                    }

                    sync(wspath, path, {}, function(err, process) {
                        // Ignore any error, we don't care at this point

                        fs.readFile("sync-remote.js", "utf8", function(err, data) {
                            if (err) return callback(err);

                            ws.ext.loadRemotePlugin("sync", {
                                code: data
                            }, function(err, api) {
                                targets[wspath] = api;

                                api.connect(function(err, stream) {
                                    if (err) return callback(err);

                                    stream.on("data", function(chunk) {
                                        if (chunk)
                                            sync(wspath, path, {}, function(err) {
                                                if (err) console.error(err);
                                            });
                                    });
                                    stream.on("end", function() {
                                        //@todo reconnect
                                        if (targets[wspath]) {
                                            addSyncTarget(wspath, path, function(err) {
                                                if (err) console.error(err);
                                            });
                                        }
                                    });

                                    callback(null, stream);
                                });
                            });
                        });
                    });
                });
            });
        }

        function removeSyncTarget(wspath, path, callback) {

        }

        //-testserver
		function sync(wspath, path, options, callback) {
            emit("connecting", { wspath: wspath });

            var wsname = wspath.split(":")[0];
            workspace.connect(wsname, function(err, ws) {
                ws.setupSshConnection(function(err) {
                    if (err)
                        return callback(err);

                    emit("syncing", { workspace: ws });
                
                    // Get the right path
                    var hostname = ws.hostname;
                    if (wspath.indexOf(":") == -1)
                        wspath = hostname + ":" + ws.rootPath;
                    else
                        wspath = wspath.replace(/^.*\:/, hostname + ":"); 

                    // @todo check version number

                    if (options.resync) {
                        // @todo delete config files on local machine
                        //'grep -l "Archive for root //Rubens-MacBook-Air.local//Users/rubendaniels/a.tmp" *'
                        //ws.find.find();

                        // @todo delete config files on remote machine
                        //'grep -l "Archive for root //Rubens-MacBook-Air.local//Users/rubendaniels/a.tmp" *'
                        //ws.find.find();
                    }
                    
                    // Execute unison locally (make sure unison is on the server)
                    var args = [
                        path,
                        "ssh://" + ws.username + "@" + wspath.replace(/:/, "/"),
                        "-ui",
                        "text",
                        "-auto",
                        "-batch",
                        "-ignore=Name .git"
                    ];
                    if (options.bigdel) args.push("-confirmbigdel");
                    if (options.prefer) args.push("-prefer=" + options.prefer);

                    proc.spawn("unison", {
                        args: args
                    }, function(err, process) {
                        if (err)
                            return callback(err);

                        var ondata = function(data) {
                            // confirmbigdel
                            if (data.indexOf("confirmbigdel") > -1) {
                                emit("confirmBigdel", { data: data });
                            }
                            // deleted  <-?-> changed    c
                            else if (data.match(/^(\w+)\s+\<\-\?\-\>\s+(\w+)\s+(.*)$/m)) {
                                // -diff
                                emit("confirmResolve", {
                                    local: RegExp.$1,
                                    remote: RegExp.$2,
                                    path: RegExp.$3,
                                    wspath: wspath,
                                    workspace: ws
                                });
                            }
                        };

                        process.stdout.on("data", ondata);
                        process.stderr.on("data", ondata);

                        callback(err, process);

                        console.log("Syncing started");
                    });
                });
            });

            function resolve(wspath, path, mine, callback) {
                sync(wspath, path, false, mine ? path : wspath, callback);
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
            
        });
        
        /***** Register and define API *****/

        /**
         * Finds or lists files and/or lines based on their filename or contents
         **/
        plugin.freezePublicAPI({
        	/**
        	 *
        	 */
        	sync: sync
        });
        
        register(null, {
            sync: plugin
        });
    }
});