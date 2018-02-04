define(function(require, module, exports) {
    main.consumes = [
        "Plugin", "proc", "settings", "fs", "c9", "util", "http", "info"
    ];
    main.provides = ["run"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var settings = imports.settings;
        var proc = imports.proc;
        var util = imports.util;
        var fs = imports.fs;
        var c9 = imports.c9;
        var info = imports.info;

        var basename = require("path").basename;
        var dirname = require("path").dirname;
        var join = require("path").join;
        
        /***** Initialization *****/
        
        var handle = new Plugin("Ajax.org", main.consumes);
        var handleEmit = handle.getEmitter();
        
        var CLEANING = -2;
        var STOPPING = -1;
        var STOPPED = 0;
        var STARTING = 1;
        var STARTED = 2;
        
        var installPath = options.installPath || "~/.c9";
        var TMUX = options.tmux || installPath + "/bin/tmux";
        var BASH = "bash";
        
        var runners = util.cloneObject(options.runners);
        var testing = options.testing;
        var runnerPath = options.runnerPath || "/.c9/runners";
        var base = (options.base || "").replace(/\/?$/, "/");
        var workspace = info.getWorkspace();
        var processes = [];
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            // Settings
            settings.on("read", function(e) {
                // Defaults
                settings.setDefaults("project/run", [
                    ["path", runnerPath]
                ]);
            }, handle);
            // @todo Could consider adding a watcher to ~/.c9/runners
        }
        
        /***** Methods *****/
        
        function addRunner(name, runner, plugin) {
            runners[name] = runner;
            plugin.addOther(function() { delete runners[name]; });
        }
        
        function listRunners(callback) {
            var _runners = Object.keys(runners || {});
            fs.exists(settings.get("project/run/@path"), function(exists) {
                if (!exists)
                    return callback(null, _runners);
                
                fs.readdir(settings.get("project/run/@path"), function(err, files) {
                    // if (err && err.code == "ENOENT")
                    //     return callback(err);
                    
                    if (files) {
                        files.forEach(function(file) {
                            var name = file.name.match(/(.*)\.run$/);
                            if (!name) {
                                if (file.name.match(/\.\w+$/))
                                    return console.warn("Runner ignored, doesn't have .run extension: " + file.name);
                                name = [0, file.name];
                            }
                            if (_runners.indexOf(name[1]) < 0)
                                _runners.push(name[1]);
                        });
                    }
                    
                    callback(null, _runners);
                });
            });
        }
        
        function detectRunner(options, callback) {
            listRunners(function(err, names) {
                if (err) return callback(err);
                
                var count = 0;
                names.forEach(function(name) {
                    if (!runners[name]) {
                        count++;
                        getRunner(name, false, function() {
                            if (--count === 0)
                                done();
                        });
                    }
                });
                if (count === 0) done();
            });
            
            function done() {
                for (var name in runners) {
                    var runner = runners[name];
                    if (runner.python_version
                        && runner.python_version !== settings.get("project/python/@version"))
                        continue;
                    if (matchSelector(runner.selector, options.path))
                        return callback(null, runner);
                }
                
                var err = new Error("Could not find Runner");
                err.code = "ERUNNERNOTFOUND";
                callback(err);
            }
        }
        
        function matchSelector(selector, path) {
            if (typeof selector == "string") {
                if (selector.indexOf("source.") === 0)
                    return selector == "source." + fs.getExtension(path);
                else {
                    var re = new RegExp(selector);
                    var file = basename(path);
                    return re.test(file);
                }
            }
            else if (Array.isArray(selector)) {
                return selector.some(function(n) {
                    return matchSelector(n, path);
                });
            }
            else {
                return false;
            }
        }

        function getRunner(name, refresh, callback) {
            if (typeof refresh == "function") {
                callback = refresh;
                refresh = false;
            }
            
            // Fix legacy runner names
            if (name === "Python 2.7")
                name = "Python 2";
            if (name === "Python 3.4")
                name = "Python 3";

            // When runner is loaded and we don't require a refresh
            if (runners[name] && refresh === false) {
                return done(runners[name]);
            }

            // Search for <name>.run or <name> and load
            var path = settings.get("project/run/@path") + "/" + name + ".run";
            fs.exists(path, function test(exists) {
                if (!exists) {
                    if (/\.run$/.test(path)) {
                        path = settings.get("project/run/@path") + "/" + name;
                        return fs.exists(path, test);
                    }
                    callback("Runner does not exist");
                } else {
                    fs.readFile(path, "utf8", function(err, data) {
                        if (err) return callback(err);
                        
                        var runner = util.safeParseJson(data, callback);    
                        if (!runner) return;
                        
                        runner.caption = runner.caption || name.replace(/\.run$/, "");
                        runners[runner.caption] = runner;
                        done(runner);
                    });
                }
            });
            
            function done(runner) {
                callback(null, runner);
            }
        }

        function restoreProcess(state) {
            var process = new Process(state);
            handleEmit("create", { process: process });
            return process;
        }
        
        function makeAbsolutePath(path) {
            if (!path) return path;
            if (path.charAt(0) === "~")
                return join(c9.home, path.substr(1));
            if (!/^([a-zA-Z]:)?\//.test(path))
                return join(base, path);
            return path;
        }
        
        function run(runner, options, name, callback) {
            if (typeof name == "function") {
                callback = name;
                name = null;
            }
            
            if (!name)
                name = "output";
            
            
            options.relPath = options.path;
            options.path = makeAbsolutePath(options.path);
            options.path = c9.toExternalPath(options.path, "/");
            options.cwd = makeAbsolutePath(options.cwd);
            
            var proc = new Process(name, runner, options, callback);
            processes.push(proc);
            
            var event = { process: proc, runner: runner };
            
            proc.on("starting", function() { handleEmit("starting", event); });
            proc.on("started", function() { handleEmit("started", event); });
            proc.on("stopping", function() { handleEmit("stopping", event); });
            proc.on("stopped", function() {
                handleEmit("stopped", event); 
                processes.remove(proc);
            });
            
            handleEmit("create", event);
            
            return proc;
        }
        
        function stopAll() {
            processes.forEach(function(proc) {
                proc.stop();
            });
        }
        
        /***** Process Class *****/
            
        function Process(procName, runner, options, callback) {
            var plugin = new Plugin("Ajax.org", main.consumes);
            var emit = plugin.getEmitter();
            emit.setMaxListeners(100);
            
            var running = STOPPED;
            var deferred = options && options.deferred;
            var meta = {};
            var pid, process, cmd;
            
            if (typeof procName == "object") {
                pid = procName.pid;
                runner = procName.runner;
                running = procName.running;
                procName = procName.name;
            }
            
            // Deal with connection issues
            c9.on("stateChange", function(e) {
                if (e.state & c9.PROCESS) {
                    if (running == STARTED || running == STARTING)
                        checkState();
                }
                else if (running == STARTED || running == STARTING) {
                    emit("away");
                }
            }, plugin);
    
            /***** Methods *****/
            
            function run(srunner, options, callback) {
                // If we're already running something do nothing
                // @todo this check needs to be improved, to check the output buffer
                if (running && (!options || !options.force))
                    return callback(new Error("Already running"));
                
                running = STARTING;
                
                if (srunner == "auto") {
                    return detectRunner(options, function(err, runner) {
                        if (err) return callback(err);
                        options.force = true;
                        run(runner, options, callback);
                    });
                }
                
                // Set the runner property
                runner = srunner;
                
                emit("starting");
                
                if (deferred)
                    return setTimeout(callback);
                
                options.debugport = options.debugport || runner.debugport;
                options.debughost = options.debughost || runner.debughost;
                
                var cmd = "";
                
                // Display a message prior to running the command
                if (runner.info)
                    cmd += "printf '\\033[1m" + runner.info.replace(/%/g, "%%") + "\\033[m\n' ; ";
                    
                // Set the PATH variable if needed
                if (runner.path)
                    cmd += "export PATH=" + runner.path + " ; ";
                    
                var env = util.extend({}, options.env, runner.env);
                for (var name in env) {
                    // HACK: old configurations used double quoting of environment values;
                    //       let's support such nastiness for now
                    var value = /^["'].*["']$/.test(env[name])
                        ? env[name]
                        : env[name].replace(/'/g, "'\\''");
                    cmd += "export " + name + "='" + value + "'; ";
                }

                // Open a pty session with tmux on the output buffer
                if (runner.script) {
                    // Replace variables
                    cmd = insertVariables(cmd, options);
                    cmd += typeof runner.script == "string" ? runner.script : runner.script.join("\n");
                    var matches = cmd.match(/\$[\w\-]+/g) || [];
                    var argRe = /\$args(?=\s|$|[&|>;])/g;
                    var seen = { $args: true };
                    cmd = matches.map(function(key) {
                        if (seen[key])
                            return "";
                        seen[key] = 1;
                        var val = getVariable(key.slice(1), options);
                        if (val == key)
                            return "";
                        return key.slice(1) + "=" + bashQuote([val]) + ";";
                    }).join("") + "\n" + cmd;
                    // handle args separately to allow passing multiple arguments, or piping the output
                    cmd = cmd.replace(argRe, options.args && options.args.raw || getVariable("args", options));
                } else {
                    // @todo add argument escaping
                    cmd += bashQuote(options.debug && runner["cmd-debug"] || runner.cmd);
                    // Replace variables
                    cmd = insertVariables(cmd, options);
                }
                
                var cwd = options.cwd || runner.working_dir 
                        || options.path && dirname(c9.toInternalPath(options.path)) || "/";
                
                cwd = insertVariables(cwd, options);
                console.log(cmd);
                // Execute run.sh
                proc.tmux(cmd, {
                    session: procName,
                    detach: options.detach !== false,
                    base: installPath.replace(/^~/, c9.home || "~"),
                    kill: true,
                    output: true,
                    cols: 100,
                    rows: 5,
                    cwd: cwd,
                    validatePath: true,
                    testing: testing
                }, function(err, pty, processId) {
                    if (err)
                        return callback(err);

                    // Set process variable for later use
                    process = pty;
                    pid = processId;
                    
                    // Running
                    running = STARTED;
                    emit("started", { pty: pty, options: options });
                    
                    // if not detached
                    if (options.detach === false) {
                        // Hook data and exit events
                        pty.on("data", function(data) { emit("data", data); });
                        pty.on("exit", function() { emit("detach"); });
                    }
                    // Else if detached
                    else {
                        if (pid == -1) {
                            // The process already exited
                            callback(null, -1);
                            cleanup();
                        }
                        else {
                            callback(null, pid);
                        }
                    }
                });
            }
            
            function getVariable(name, options) {
                var fnme, idx;
                var path = options.path;
                var args = options.args;
                var port;

                if (name == "command") 
                    return (options.relPath || "");
                if (name == "file") 
                    return (path || "");
                if (name == "file_path")
                    return dirname(path || "");
                if (name == "file_name") 
                    return basename(path || "");
                if (name == "file_extension") {
                    if (!path) return "";
                    fnme = basename(path);
                    idx = fnme.lastIndexOf(".");
                    return idx == -1 ? "" : fnme.substr(idx + 1);
                }
                if (name === "args")
                    return bashQuote(args, true);
                if (name == "file_base_name") {
                    if (!path) return "";
                    fnme = basename(path);
                    idx = fnme.lastIndexOf(".");
                    return idx == -1 ? fnme : fnme.substr(0, idx);
                }
                if (name == "debugport")
                    return (parseInt(options.debugport) || 0) + "";
                if (name == "debughost")
                    return bashQuote(options.debughost);
                if (name == "packages")
                    return installPath + "/packages";
                if (name == "project_path")
                    return base;
                if (name == "project_id")
                    return workspace.id;
                if (name == "project_name")
                    return workspace.name;
                if (name == "project_contents")
                    return workspace.contents;
                if (name == "hostname")
                    return c9.hostname || "localhost";
                if (name == "hostname_path") {
                    port = (options.local ? ":" + (c9.port || "8080") : "");
                    return ("https://" + c9.hostname || "http://localhost") + port + "/" + (options.relPath || "");
                }
                if (name == "url") {
                    port = (options.local ? ":" + (c9.port || "8080") : "");
                    return (c9.hostname 
                        ? "https://" + c9.hostname
                        : "http://localhost") + port;
                }
                if (name == "port")
                    return c9.port || "8080";
                if (name == "ip")
                    return "0.0.0.0";
                if (name == "home")
                    return c9.home;
                if (name == "python")
                    return settings.get("project/python/@version");
                if (name == "python_path")
                    return settings.get("project/python/@path");
                if (name == "debug")
                    return options.debug + "";
                return "$" + name;
            }
            function reverse(str) { 
                return str.split('').reverse().join('');
            }
            function insertVariables(cmd, options) {
                // Loop until we get a fixpoint, since our pattern matches the
                // two characters next to a variable and would otherwise skip
                // over adjacent variables like $ip:$port.
                var oldCmd;
                do {
                    oldCmd = cmd;
                    cmd = cmd.replace(/(^|[^\\])(?:\$([\w_]+)|\$\{([^}]+)\})([^\\]|)/g,
                    function(m, startChar, name, nameBrackets, endChar) {
                        if (name || !nameBrackets)
                            return startChar + getVariable(name, options) + endChar;
                        else if (startChar) {
                            
                            // Test for default value
                            if (nameBrackets.match(/^([\w_]+)\:(.*)$/))
                                return startChar + (getVariable(RegExp.$1, options) || RegExp.$2) + endChar;
                                
                            // Test for conditional shell expression value
                            if (nameBrackets.match(/^([\w_]+)\?`(.*)`$/))
                                return options[RegExp.$1] ? "`" + RegExp.$2 + "`" : "";
                            
                            // Test for conditional value
                            if (nameBrackets.match(/^([\w_]+)\?(.*)$/))
                                if (options[RegExp.$1])
                                    return startChar + RegExp.$2 + endChar;
                                else if (startChar.trim().charAt(0).match(/['"]/))
                                    return ""; // remove quotes
                                else
                                    return startChar + endChar;
                                
                            // Test for regular expression
                            if (nameBrackets.match(/^([\w_]+)\/(.*)$/)) {
                                return startChar + reverse(nameBrackets)
                                    .replace(/^\/?(.*)\/(?!\\)(.*)\/(?!\\)([\w_]+)$/, 
                                    function (m, replace, find, name) {
                                        var data = getVariable(reverse(name), options);
                                        var re = new RegExp(reverse(find), "g");
                                        return data.replace(re, reverse(replace));
                                    }) + endChar;
                            }
                            
                            // TODO quotes
                            // Assume just a name
                            return startChar + getVariable(nameBrackets, options) + endChar;
                        }
                    });
                } while (cmd !== oldCmd);
                
                return cmd;
            }
            
            function cleanup(callback) {
                function finish() {
                    pid = 0;
                    runner = null;
                    running = STOPPED;
                    emit("stopped");
                    
                    callback && callback();
                    
                    return false; // Prevent error when watchfile doesn't exist
                }
                
                if (running == CLEANING || running == STOPPING || running == STOPPED) {
                    if (running !== 0)
                        return finish();
                    else
                        return callback && callback();
                }
    
                if (running > 0) {
                    running = STOPPING;
                    emit("stopping");
                }
                
                checkState();
            }
            
            function stop(callback) {
                callback = callback || function() {};
                
                if (!running)
                    return callback();
                
                if (!pid) {
                    // If there's no PID yet, wait until we get one and then stop
                    if (running === STARTING) {
                        // Make sure the process times out
                        var timer = setTimeout(function() {
                            cleanup(function() {
                                callback(new Error("Could not get PID from process. "
                                    + "The process seemed to not be running anymore."));
                            });
                        }, 2000);
                        
                        plugin.on("started", function(e) {
                            clearTimeout(timer);
                            
                            if (e.pid > 0)
                                stop(callback);
                            else
                                callback();
                        });
                    }
                    else {
                        cleanup(function() {
                            callback(new Error("Could not get PID from running "
                                + "process. Process might still be running in the "
                                + "background."));
                        });
                    }
                    return;
                }
                running = STOPPING;
                emit("stopping");
    
                killOldProcess(callback);
            }
            
            function killOldProcess(callback) {
                // (on Windows, execFile("kill") is handled specially)
                if (c9.platform === "win32")
                    return proc.execFile("kill", { args: [pid]}, done);
                
                var runCfg = runner;
                
                if (runCfg && runCfg.cmdStop) {
                    return proc.execFile("bash", { args: ["-c", bashQuote(runCfg.cmdStop)]}, done);
                }
                
                proc.killtree(pid, { graceful: true }, function() {
                    if (runCfg && runCfg.cmdCleanup) {
                        proc.execFile("bash", { args: ["-c", bashQuote(runCfg.cmdCleanup)]}, done);
                    }
                    else if (meta.debug && runner && runner.debugport) {
                        var kill = "kill -9 $(lsof -i:" + runner.debugport + " -t);"
                            + "if sudo -n true; then sudo kill -9 $(sudo lsof -i:" + runner.debugport + " -t); fi";
                        proc.execFile("sh", { args: ["-c", kill]}, done);
                    }
                    else {
                        done();
                    }
                });
                
                function done(err, e) {
                    // Clean up here to make sure runner is in correct state
                    if (err && err.code !== "EDISCONNECT")
                        err = null;
                    cleanup(function() {
                        callback(err, e);
                    });
                }
            }
            
            var checking;
            function checkState(cb) {
                if (checking) return checking.push(cb);
                
                checking = [cb];
                
                // Execute run.sh
                proc.tmux("", {
                    session: procName,
                    fetchpid: true
                }, function(err, pty, newPid) {
                    var callbacks = checking || [];
                    checking = false;
                    // Process has exited
                    if (err || newPid == -1 || !newPid) {
                        cleanup();
                    }
                    else {
                        pid = newPid;
                        if (!running) {
                            running = STARTED;
                            emit("started", { pty: pty, options: options });
                        }
                        emit("back");
                    }
                    callbacks.forEach(function(cb) { cb && cb(); });
                });
            }
            
            function getState() {
                return {
                    pid: pid,
                    name: procName,
                    running: running >= 0 ? running : 0,
                    runner: runner
                };
            }
            
            function detach(callback) {
                // Kill the pty session
                if (process)
                    process.write(String.fromCharCode(2) + "d");
                
                // proc.execFile(TMUX, {
                //     args: [ "detach-client", "-t", procName ]
                // }, callback);
            }
            
            /***** Register and define API *****/
        
            /**
             * Represents a process started with a `runner`. 
             * 
             * See the {@link run#run run plugin} for information on how to
             * start a process.
             * 
             * @class run.Process
             */
            plugin.freezePublicAPI({
                /**
                 * @property {-2} CLEANING  Indicates the process run state is 
                 * being cleaned up. To be tested against the `running` property.
                 */
                CLEANING: CLEANING,
                /**
                 * @property {-1} STOPPING  Indicates the process is being 
                 * killed. To be tested against the `running` property.
                 */
                STOPPING: STOPPING,
                /**
                 * @property  {0} STOPPED  Indicates the process is not running. 
                 * To be tested against the `running` property.
                 */
                STOPPED: STOPPED,
                /**
                 * @property {1} STARTING  Indicates the process is getting 
                 * started. To be tested against the `running` property.
                 */
                STARTING: STARTING,
                /**
                 * @property  {2} STARTED  Indicates the process is running. 
                 * To be tested against the `running` property.
                 */
                STARTED: STARTED,
                
                /**
                 * @property {Number} running  Indicates the state of the process.
                 */
                get running() { return running; },
                /**
                 * @property {Object} runner  The object describing how to run 
                 * the process.
                 */
                get runner() { return runner; },
                /**
                 * @property {Number} pid  The pid of the running process if any
                 */
                get pid() { return pid; },
                /**
                 * @property {String} name  The name of the process.
                 */
                get name() { return procName; },
                /**
                 * @property {Object} meta
                 */
                get meta() { return meta; },
                /**
                 * @property {Object} command  The command that started this process
                 */
                get command() { return cmd; },
                
                _events: [
                    /**
                     * Fires when the process is going to be killed
                     * @event stopping
                     */
                    "stopping",
                    /**
                     * Fires when the process stopped running
                     * @event stopped
                     */
                    "stopped",
                    /**
                     * Fires when the process is being started
                     * @event starting
                     */
                    "starting",
                    /**
                     * Fires when the process is started. This event also fires 
                     * during startup if there's a PID file present
                     * @event started
                     */
                    "started"
                ],
                
                /**
                 * Returns the state of this process for use later.
                 * @return {Object}
                 */
                getState: getState,
                
                /**
                 * Validates whether the process is still running
                 */
                checkState: checkState,
                
                /**
                 * Detach from the currently running process. This is only 
                 * relevant if options.detach was set to false when starting 
                 * the process.
                 */
                detach: detach,
                
                /**
                 * Stop the currently running process.
                 * @param {Function} callback     Called when the process is stopped
                 * @param {Error}    callback.err The error object, if an error 
                 * has occured.
                 */
                stop: stop,
                
                /**
                 * 
                 */
                run: function(callback) {
                    if (!deferred)
                        return callback(new Error("Cannot call run() on non-deferred process"));
                    
                    deferred = false;
                    options.force = true;
                    
                    run(runner, options, callback || function() {});
                },
                
                /**
                 * Fetch variables from a string. See the {@link run#run run method} for more info.
                 * @param {String} str
                 */
                insertVariables: function(str) {
                    return insertVariables(str, options);
                }
            });
            
            if (!pid)
                run(runner, options, callback || function() {});
            else
                checkState();
            
            return plugin;
        }
        
        function bashQuote(commandArgs, alsoQuoteArgs) {
            if (!commandArgs) 
                return "";
            return commandArgs.map(function(part) {
                if (part === "$args" && !alsoQuoteArgs)
                    return part;
                return part.match(/^`.*`$/) // shell expression
                        ? part
                        : "\"" + part.replace(/'/g, "'\"'") + "\"";
            }).join(" ");
        }
        
        /***** Lifecycle *****/
        
        handle.on("load", function() {
            load();
        });
        handle.on("enable", function() {
            
        });
        handle.on("disable", function() {
            
        });
        handle.on("unload", function() {
            loaded = false;
        });
        
        /***** Register and define API *****/
        
        /**
         * Runs arbitrary programs and code from within Cloud9 based on a
         * runner. 
         * 
         * *NB.: If you just want to run a process in the background you should
         * use {@link proc#spawn} or related methods. This runner is architected
         * specifically for running (and debugging) processes in Cloud9 that the
         * user monitors in an {@link output} pane.*
         * 
         * Example:
         * 
         *     run.getRunner("node", false, function(err, runner) {
         *         if (err) throw err.message;
         *         
         *         var process = run.run(runner, {
         *             path: "/helloworld.js"
         *         }, function(err, pid) {
         *             if (err) throw err.message;
         * 
         *             console.log("The PID is ", pid);
         *         });
         *     });
         * 
         * You can also ask for auto-detection of the runner based on the file
         * extension:
         * 
         *     var process = run.run("auto", {
         *         path: "/helloworld.js"
         *     }, function(err, pid) {
         *         if (err) throw err.message;
         *     
         *         console.log("The PID is ", pid);
         *     });
         * 
         * A runner is a simple struct that describes how to run a 
         * certain subset of files. For instance a runner describing how to run 
         * Node.js files looks like this:
         * 
         *     {
         *         "cmd": [node, "${debug?--debug-brk=15454}", "$file"],
         *         "debugger": "v8",
         *         "debugport": 15454,
         *         "selector": "source.js",
         *         "info": "Your code is running at $hostname"
         *     }
         * 
         * The concept of runners is based on the
         * [Sublime Text(tm) Build Systems](http://docs.sublimetext.info/en/sublime-text-3/file_processing/build_systems.html),
         * and is compatible with that format. There are a several
         * built-in runners, and external plugins can add new runners as well.
         * Users can also add runners to their .c9/runners directory in
         * the workspace. We recommend users to commit these runners to their
         * repository.
         * 
         * The {@link build Cloud9 Build System} also uses a compatible
         * format for the cloud9 builders.
         * 
         * It is possible to combine builders and runners, therefore it is
         * often not needed to describe the build and run step in the same
         * definition.
         * 
         * A process is always started in a [TMUX](http://en.wikipedia.org/wiki/Tmux) 
         * session. TMUX is a PTY multi-plexer which has several advantages; 
         * multiple clients can connect to the same session and the sessions are 
         * kept even if no user is connected. 
         * 
         * You can connect an {@link output} pane to the started process to
         * see the output of your running process. The name passed to
         * {@link run#run} should be the same as the name of the output pane
         * you open:
         * 
         *     tabManager.open({
         *         editorType : "output", 
         *         active     : true,
         *         document   : {
         *             title  : "My Process Name",
         *             output : {
         *                 id : "name_of_process"
         *             }
         *         }
         *     }, function(){});
         * 
         * Note that by default the process name is "output" and is shown in the
         * default output panel (available via the View menu).
         * 
         * @singleton
         */
        handle.freezePublicAPI({
            /**
             * @property {-2} CLEANING  Indicates the process run state is 
             * being cleaned up. To be tested against the `runner` property.
             */
            CLEANING: CLEANING,
            /**
             * Indicates the process is being killed. To be tested against 
             * the `running` property.
             * @property {-1} STOPPING
             */
            STOPPING: STOPPING,
            /**
             * Indicates the process is not running. To be tested against 
             * the `running` property.
             * @property {0}  STOPPED 
             */
            STOPPED: STOPPED,
            /**
             * Indicates the process is getting started. To be tested against 
             * the `running` property.
             * @property {1}  STARTING
             */
            STARTING: STARTING,
            /**
             * Indicates the process is running. To be tested against 
             * the `running` property.
             * @property {2}  STARTED 
             */
            STARTED: STARTED,
            
            /**
             * @property {run.Process[]}  processes  List of running processes
             */
            get processes() { return processes; },
            /**
             * @property {Object[]}  runners  List of available runners
             */
            get runners() { return runners; },
            
            _events: [
                /**
                 * Fires when the process is going to be killed
                 * @event stopping
                 * @param {Object} e
                 * @param {run.Process} e.process the process that is stopping
                 */
                "stopping",
                /**
                 * Fires when the process stopped running
                 * @event stopped 
                 * @param {Object} e
                 * @param {run.Process} e.process the process that is stopped
                 */
                "stopped",
                /**
                 * Fires when the process is being started
                 * @event starting 
                 * @param {Object} e
                 * @param {run.Process} e.process the process that is starting
                 */
                "starting",
                /**
                 * Fires when the process is started. This event also fires 
                 * during startup if there's a PID file present
                 * @event started 
                 * @param {Object} e
                 * @param {run.Process} e.process the process that is stopped
                 */
                "started",
                /**
                 * Fires when the process is created.
                 * @event create
                 * @param {Object} e
                 * @param {run.Process} e.process the process that is created
                 */
                "create"
            ],
            
            /**
             * Retrieves an array of names of runners available to the system.
             * A runner is a JSON file that describes how a certain file can
             * be executed. The JSON file format is based on and compatible with
             * the sublime build scripts. Besides the build in runners, the
             * user can store runners in <installPath>/runners. This list will contain
             * both the user's runners as well as the build-in runners.
             * @param {Function} callback           Called when the runners are retrieved
             * @param {Error}    callback.err       The error object if an error occurred.
             * @param {String[]} callback.runners   A list of names of runners.
             */
            listRunners: listRunners,
            
            /**
             * Detect the runner that will be used to run a certain file
             * @param {Object}   options
             * @param {Function} callback
             */
            detectRunner: detectRunner,
            
            /**
             * Retrieves an individual runner's JSON object based on it's name.
             * The names of available runners can be retrieved using `listRunners`.
             * @param {Function} callback         Called when the runner is retrieved
             * @param {Function} callback.err     The error object if an error occurred.
             * @param {Function} callback.runner  A runner object. See {@link #run} for more information.
             */
            getRunner: getRunner,
            
            /**
             * Adds a new runner to the list of runners
             * @param {String} name       The name of the runner to add
             * @param {Object} runner     The runner to add
             */
            addRunner: addRunner,
            
            /**
             * Stop all running processes
             */
            stopAll: stopAll,
            
            /**
             * Check whether a selector matches a certain path
             * @param {String/Array} selector
             * @param {String}       path
             */
            matchSelector: matchSelector,
            
            /**
             * Gets a process based on a pid
             * @param {Object} state  The state object returned by {@link run.Process.getState}.
             * @return {run.Process}
             */
            restoreProcess: restoreProcess,
            
            /**
             * Starts a process based on a runner and options that are passed.
             * The runner can specify how to run a file. The implementation is 
             * based on sublime's build scripts. I'm copying some of their 
             * documentation here below for now:
             * [Source: http://docs.sublimetext.info/en/latest/reference/build_systems.html]
             * 
             * Generated commands can contain variables that are replaced just
             * prior to running the command. The following list are the supported
             * variables:
             * 
             * <table>
             * <tr><td>Variable</td><td>               Description</td></tr>
             * <tr><td>"$file_path"</td><td>           The directory of the current file, e. g., C:\Files.</td></tr>
             * <tr><td>"$file"</td><td>                The full path to the current file, e. g., C:\Files\Chapter1.txt.</td></tr>
             * <tr><td>"$args"</td><td>                Any arguments entered after the file name.</td></tr>
             * <tr><td>"$file_name"</td><td>           The name portion of the current file, e. g., Chapter1.txt.</td></tr>
             * <tr><td>"$file_extension"</td><td>      The extension portion of the current file, e. g., txt.</td></tr>
             * <tr><td>"$file_base_name"</td><td>      The name only portion of the current file, e. g., Document.</td></tr>
             * <tr><td>"$packages"</td><td>            The full path to the Packages folder.</td></tr>
             * <tr><td>"$project"</td><td>             The full path to the current project file.</td></tr>
             * <tr><td>"$project_path"</td><td>        The directory of the current project file.</td></tr>
             * <tr><td>"$project_name"</td><td>        The name portion of the current project file.</td></tr>
             * <tr><td>"$project_extension"</td><td>   The extension portion of the current project file.</td></tr>
             * <tr><td>"$project_base_name"</td><td>   The name only portion of the current project file.</td></tr>
             * <tr><td>"$hostname"</td><td>            The hostname of the workspace.</td></tr>
             * <tr><td>"$hostname_path"</td><td>       The hostname of the workspace together with the relative path of the project file.</td></tr>
             * <tr><td>"$url"</td><td>                 The full url to access the workspace.</td></tr>
             * <tr><td>"$port"</td><td>                The port assigned to the workspace.</td></tr>
             * <tr><td>"$ip"</td><td>                  The ip address to run a process against in the workspace.</td></tr>
             * </table>
             * 
             * The following declarations can be used to add defaults or regexp
             * replacements to the these variables:
             * 
             *     ${debug?--debug}
             * 
             * This will emit --debug if the debug option is set to true
             * 
             *     ${project_name:Default}
             * 
             * This will emit the name of the current project if there is one, otherwise Default.
             * 
             *     ${file/\.php/\.txt/}
             * 
             * This will emit the full path of the current file, replacing .php with .txt.
             * 
             * @param {Object/"auto"} runner Object describing how to run a process. 
             *   Alternatively this can be set to "auto" to auto-detect the runner.
             * @param {Array} runner.cmd Array containing the command to run and its desired 
             *  arguments. If you don’t specify an absolute path, the 
             *  external program will be searched in your PATH, one of your 
             *  system’s environmental variables. The command can contain 
             *  variables.
             * @param {RegExp} [runner.line_regex] If file_regex doesn’t match on the 
             *  current line, but line_regex exists, and it does match on 
             *  the current line, then walk backwards through the buffer 
             *  until a line matching file regex is found, and use these two 
             *  matches to determine the file and line to go to.
             * @param {RegExp} [runner.selector] Used when the automatic selection of the
             *  runner is set. Cloud9 uses this scope selector to 
             *  find the appropriate build system for the active view.
             * @param {String} [runner.working_dir] Directory to change the current 
             *  directory to before running cmd. The original current 
             *  directory is restored afterwards.
             * @param {Object} [runner.env] Dictionary of environment variables to be merged 
             *  with the current process’ before passing them to cmd.
             * 
             *  Use this element, for example, to add or modify environment 
             *  variables without modifying your system’s settings.
             * @param {Boolean} [runner.shell] If true, cmd will be run through the shell.
             *  In our implementation all commands run through the shell.
             *  This cannot be changed.
             * @param {Boolean} [runner.debugger] Set this to the type string of
             *  the debugger that should connect to the process. The built-in
             *  debuggers are 'v8' and 'gdb'.
             * @param {Boolean} [runner.debugport] Set this to the port number
             *  that the debugger will connect to.
             * @param {String} [runner.path] This string will replace the current process’ 
             *  PATH before calling cmd. The old PATH value will be restored 
             *  after that.
             * 
             *  Use this option to add directories to PATH without having 
             *  to modify your system’s settings.
             * @param {String} [runner.info] message to be outputted in the output buffer
             *  prior to running the processes. This message can contain 
             *  variables.
             * @param {Array} [runner.variants] currently not supported.
             * @param {Object}  options
             * @param {String}  options.path  the path to the file to execute
             * @param {String}  options.cwd   the current working directory
             * @param {Array}   options.args  arguments to be passed to the program
             * @param {Boolean} options.debug whether to start the process in debug mode
             * @param {String} [name]   the unique name of the output buffer. 
             *   Defaults to "output". There can only be one process running on
             *   an output buffer at the same time. After a process has ended
             *   the process object is stale.
             * @param {Function} callback     called when the process is started
             * @param {Error}    callback.err The error object if an error occurred.
             * @returns {run.Process} The process object
             */
            run: run
        });
        
        register(null, {
            run: handle
        });
    }
});
