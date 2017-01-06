define(function(require, exports, module) {
    main.consumes = ["Plugin", "automate", "vfs", "c9", "proc", "fs", "error_handler"];
    main.provides = ["installer"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var automate = imports.automate;
        var c9 = imports.c9;
        var fs = imports.fs;
        var proc = imports.proc;
        var errorHandler = imports.error_handler;
        
        var DEBUG = c9.location.indexOf("debug=3") != -1;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var NAMESPACE = "installer";
        var installSelfCheck = options.installSelfCheck;
        var installChecked = false;
        
        var packages = {};
        var sessions = [];
        var installed = false;
        var waitForSuccess = false;
        var installCb, arch, platform, parentPty;
        
        // Check that all the dependencies are installed
        var VERSION = 1;
        
        if (!options.cli) {
            createSession("Cloud9 IDE", VERSION, require("./install/install"));
            // createSession("Cloud9 CLI", VERSION, require("./install/install.cli"));
        }
        
        function load() {
            if (c9.readonly)
                return;
            
            if (options.cli)
                return simpleInstallRead();
            
            imports.vfs.on("beforeConnect", function(e) {
                if (installChecked)
                    return e.done(false);
                
                if (!installSelfCheck) {
                    installChecked = true;
                    e.done(false);
                    simpleInstallRead();
                    return;
                }
                
                installCb = e.done;
                
                if (!proc.installMode)
                    readFromDisk(e.vfs);
                else
                    proc.installMode = e.vfs;
                
                return false;
            });
        }
        
        /***** Methods *****/
        
        function simpleInstallRead() {
            var path = options.installPath.replace(c9.home, "~") + "/installed";
            fs.readFile(path, function(err, data) {
                if (err) {
                    if (err.code == "ENOENT")
                        data = "";
                    else {
                        c9.once("connect", simpleInstallRead);
                        return;
                    }
                }
                
                parse(data);
                emit.sticky("ready", installed);
            });
        }
        
        function parse(data) {
            if (data.match(/^1[\r\n]*$/)) // Backwards compatibility
                data = "Cloud9 IDE@1\nc9.ide.collab@1\nc9.ide.find@1\nCloud9 CLI@1";
            
            installed = {};
            data.split("\n").forEach(function(line) {
                if (!line) return;
                var p = line.split("@");
                installed[p[0]] = parseInt(p[1], 10) || 0;
            });
            
            if (!installSelfCheck) {
                installed["Cloud9 IDE"] = 1;
                installed["c9.ide.collab"] = 1;
                installed["c9.ide.find"] = 1;
                installed["Cloud9 CLI"] = 1;
            }
        }
        
        function readFromDisk(vfs) {
            function done(err) {
                if (!installed) installed = {};
                
                if (err && err.code == "ENOENT" || installed["Cloud9 IDE"] !== VERSION) {
                    // Tmux and pty.js are probably not installed. Lets switch 
                    // to a special mode of proc
                    proc.installMode = vfs;
                    
                    plugin.once("success", function() {
                        proc.installMode = false;
                        installChecked = true;
                        installCb(true);
                        installCb = null;
                    });
                    
                    // Wait until installer is done
                    plugin.on("stop", function listen(e) {
                        if (e.session.package.name == "Cloud9 IDE" && (!e.error || !waitForSuccess)) {
                            plugin.waitForSuccess = false;
                            plugin.off("stop", listen);
                        }
                    }, plugin);
                }
                else {
                    installChecked = true;
                    installCb();
                    installCb = null;
                }
                
                emit.sticky("ready", installed);
            }
            
            vfs.readfile(options.installPath.replace(c9.home, "~") + "/installed", {
                encoding: "utf8"
            }, function(err, meta) {
                if (err) {
                    if (err.code == "ENOENT") done(err);
                    return; // Wait for reconnect to try again
                }
                
                var data = "";
                var stream = meta.stream;
                stream.on("data", function(chunk) { data += chunk; });
                stream.on("end", function() { 
                    parse(data);
                    done();
                });
            });
        }
        
        function addPackageManager(name, implementation) {
            automate.addCommand(NAMESPACE, name, implementation);
        }
        
        function removePackageManager(name) {
            automate.removeCommand(NAMESPACE, name);
        }

        // Add aliases to support a broader range of platforms
        function addPackageManagerAlias() {
            var args = [NAMESPACE];
            for (var i = 0; i < arguments.length; i++) {
                args.push(arguments[i]);
            }
            
            automate.addCommandAlias.apply(this, args);
        }
        
        function isInstalled(pkgName, pkgVersion, callback) {
            if (!installSelfCheck)
                return true;
            
            if (typeof pkgVersion == "function")
                callback = pkgVersion, pkgVersion = undefined;
            
            if (!installed && callback) {
                return plugin.once("ready", function() {
                    if (isInstalled(pkgName, pkgVersion, callback))
                        callback();
                });
            }
            
            var boolInstalled = installed[pkgName] 
                && (pkgVersion ? installed[pkgName] == pkgVersion : true);
            
            if (!boolInstalled && callback) {
                plugin.on("stop", function listen() {
                    if (isInstalled(pkgName, pkgVersion)) {
                        callback();
                        plugin.off("stop", listen);
                    }
                });
            }
            
            return boolInstalled;
        }
        
        function reinstall(packageName, silent) {
            if (packages[packageName]) {
                if (!silent)
                    emit("reinstall", { name: packageName });
                
                createSession(packageName, packages[packageName].version, 
                    packages[packageName].populate, null, true);
                    
                return true;
            }
            
            return false;
        }
        
        function createSession(packageName, packageVersion, populateSession, callback, force) {
            if (!installed) {
                return plugin.on("ready", 
                    createSession.bind(this, packageName, packageVersion, populateSession, callback, force));
            }
            
            if (!options.cli && !c9.isReady) {
                return c9.on("ready", 
                    createSession.bind(this, packageName, packageVersion, populateSession, callback, force));
            }
            
            if (typeof packageVersion == "function") {
                force = callback;
                callback = populateSession;
                populateSession = packageVersion;
                packageVersion = populateSession.version;
            }
            
            packageVersion = populateSession.version || parseInt(packageVersion, 10) || 0;
            packages[packageName] = { 
                version: packageVersion,
                populate: populateSession 
            };
            
            if (!force && installed[packageName] == packageVersion)
                return callback && callback();
            
            var session = automate.createSession(NAMESPACE);
            
            var add = session.task; delete session.task;
            function install(options, task, validate) {
                if (!task || typeof task == "function") {
                    if (typeof task == "function")
                        validate = task;
                    task = options;
                    options = {};
                }
                
                add(task, options, validate);
            }
            
            function start(callback, force) {
                if (force || emit("beforeStart", { session: session }) !== false) {
                    // Pre script
                    if (pre) session.tasks.unshift({ "bash": pre });
                    
                    // Post script
                    if (post) session.tasks.push({ "bash": post });
                    
                    // Start installation
                    session.run(callback);
                }
            }
            
            session.on("run", function() {
                emit("start", { session: session }); 
            });
            session.on("stop", function(err) {
                sessions.splice(sessions.indexOf(session), 1);
                emit("stop", { session: session, error: err });
                
                // Update installed file
                if (!err && force !== 2) {
                    installed[packageName] = packageVersion;
                    var contents = Object.keys(installed).map(function(item) {
                        return item + "@" + installed[item];
                    }).join("\n");
                    fs.writeFile("~/.c9/installed", contents, function() {
                        callback && callback(err);
                    });
                }
                else {
                    callback && callback(err);
                }
            });
            session.on("each", function(e) {
                emit("each", e); 
            });
            
            var intro, pre, post;
            session.freezePublicAPI({
                /**
                 * 
                 */
                package: {
                    name: packageName,
                    version: packageVersion
                },
                
                /**
                 * 
                 */
                get introduction() { return intro; },
                set introduction(value) { intro = value; },
                /**
                 * 
                 */
                get preInstallScript() { return pre; },
                set preInstallScript(value) { pre = value; },
                /**
                 * 
                 */
                get postInstallScript() { return post; },
                set postInstallScript(value) { post = value; },
                
                /**
                 * 
                 */
                install: install,
                
                /**
                 * 
                 */
                start: start
            });
            
            session.on("unload", function() {
                sessions.splice(sessions.indexOf(session), 1);
            }, plugin);
            
            sessions.push(session);
            
            if (arch === undefined) {
                arch = null;
                proc.execFile("uname", { args: ["-ms"]}, function(e, p) {
                    var parts = p.trim().split(/\s+/);
                    platform = parts[0].toLowerCase();
                    if (/MINGW|MSYS|CYGWIN/i.test(platform))
                        platform = c9.platform; // windows only supports local version
                        
                    arch = parts[1];
                    if (/x86_64/i.test(arch))
                        arch = "x64";
                    else if (/armv6l/i.test(arch)) 
                        arch = "armv6l";
                    else if (/armv7l/i.test(arch)) 
                        arch = "armv7l";
                    else if (/i.*86/i.test(arch))
                        arch = "x86";
                    if (!arch)
                        arch = undefined;
                    
                    emit.sticky("arch", arch);
                });
            }
            
            plugin.once("arch", function() {
                populateSession(session, {
                    platform: platform,
                    arch: arch
                });
            });
            
            return session;
        }
        
        function ptyExec(options, onData, callback) {
            if (parentPty) {
                return parentPty(options, callback);
            }
            
            if (c9.platform == "win32") {
                options.code = options.code.replace(/\r\n/g, "\n");
                return proc.spawn("bash.exe", {
                    args: ["-c", options.code].concat(options.args || []),
                    cwd: options.cwd || null
                }, function(err, pty) {
                    if (err) return callback(err);
                    pty.stderr.on("data", function(chunk) {
                        onData(chunk, pty);
                    });
                    pty.stdout.on("data", function(chunk) {
                        onData(chunk, pty);
                    });
                    pty.on("exit", function(code) {
                        if (!code) callback();
                        else callback(new Error("Failed " + options.name + ". Exit code " + code));                     
                    });
                });
            }
            // Working around PTY.js not having an exit code
            // Until https://github.com/chjj/pty.js/pull/110#issuecomment-93573223 is merged
            // wrap script in a function and use subshell to prevent exit 0 skipping echo ß
            // make sure sudo is called with correct passwd and 
            var script = (DEBUG ? "set -x\n" : "")
                + 'export TERM=xterm\n' // helps with debian dialog error on apt-get install
                + 'fcn() {\n' + options.code + '\n}\n'
                + 'sudo(){ /usr/bin/sudo -S -p "###[sudo] password for %p: " "$@" ; }\n'
                + 'exit() { if [ "$1" == "0" ]; then echo ß; else echo "exiting with $1"; fi; command exit $1; }\n'
                + 'fcn "$@" && echo ß\n';
                
            proc.pty(options.bash || "bash", {
                args: ["-c", script].concat(options.args || []),
                cwd: options.cwd || null
            }, function(err, pty) {
                if (err) return callback(err);
                
                var done = false;
                var buffer = "";
                
                // Pipe the data to the onData function
                pty.on("data", function(chunk) {
                    buffer += chunk;
                    if (chunk.indexOf("ß") > -1) {
                        done = true;
                        chunk = chunk.replace("ß", "");
                    }
                    onData(chunk, pty);
                });
                
                // When process exits call callback
                pty.on("exit", function(code) {
                    if (!done && !code) code = "E_MISSING_END_MARKER";
                    
                    if (code) {
                        errorHandler.log("install error", {
                            output: buffer,
                            script: script,
                            name: options.name,
                            args: options.args,
                            code: code
                        });
                    }
                    
                    if (!code) callback();
                    else callback(new Error("Failed " + options.name + ". Exit code " + code));
                });
            });
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("unload", function() {
            installChecked = false;
            installed = false;
            installCb = arch = platform = undefined;
            waitForSuccess = false;
            parentPty = null;
        });
        
        /***** Register and define API *****/
        
        /**
         * 
         **/
        plugin.freezePublicAPI({
            /**
             * 
             */
            get packages() { return packages; },
            
            /**
             * 
             */
            get sessions() { return sessions; },
            
            /**
             * 
             */
            get installed() { return installed; },
            
            /**
             * 
             */
            get checked() { return installChecked; },
            
            /**
             * 
             */
            get ptyEnabled() { return installChecked && c9.platform != "win32"; },
            
            /**
             * @ignore
             */
            get waitForSuccess() { return waitForSuccess; },
            set waitForSuccess(v) { waitForSuccess = v; if (!v) emit("success"); },
            
            _events: [
                /**
                 * @event beforeStart
                 */
                "beforeStart",
                /**
                 * @event start
                 */
                "start",
                /**
                 * @event stop
                 */
                "stop",
                /**
                 * @event each
                 */
                "each"
            ],
            
            /**
             * 
             */
            isInstalled: isInstalled,
            
            /**
             * 
             */
            reinstall: reinstall,
            
            /**
             * 
             */
            createSession: createSession,
            
            /**
             * 
             */
            addPackageManager: addPackageManager,
            
            /**
             * 
             */
            removePackageManager: removePackageManager,
            
            /**
             * 
             */
            addPackageManagerAlias: addPackageManagerAlias,
            
            /**
             * 
             */
            ptyExec: ptyExec,
            /**
             * @ignore
             */
            $setPtyExec: function(v) { if (options.cli) parentPty = v; }
        });
        
        register(null, {
            installer: plugin
        });
    }
});