define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "installer"
    ];
    main.provides = ["installer.cli"];
    return main;

    /*
        - Always assume one session
        - Start immediately
    */

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var installer = imports.installer;
        
        var RED = "\x1b[01;31m";
        var GREEN = "\x1b[01;32m";
        var YELLOW = "\x1b[01;33m";
        var BLUE = "\x1b[01;34m";
        var MAGENTA = "\x1b[01;35m";
        var LIGHTBlUE = "\x1b[01;94m";
        var RESETCOLOR = "\x1b[0m";
        var BOLD = "\x1b[01;1m";
        var UNBOLD = "\x1b[01;21m";
        
        var verbose = true;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        // var emit = plugin.getEmitter();
        
        function load() {
            installer.$setPtyExec(function(options, callback) {
                var cwd = options.cwd;
                if (cwd && cwd.charAt(0) == "~")
                    cwd = process.env.HOME + "/" + cwd.substr(1);
                var childProcess = require("child_process");
                var p = childProcess.spawn("bash", [
                    "-c", options.code
                ].concat(options.args || []), {
                    stdio: [
                        process.stdin, 
                        verbose ? process.stdout : "ignore", 
                        verbose ? process.stderr : "ignore"
                    ],
                    cwd: cwd
                });
                p.on("close", function(code) {
                    if (!code) callback();
                    else callback(new Error("Failed " + options.name + ". Exit code " + code));
                });
            });
            
            // Hook the creation of new sessions
            installer.on("beforeStart", function(e) {
                start(e.session);
            }, plugin);
        }
        
        /***** Methods *****/
        
        function start(session, callback) {
            // Start Installation
            if (verbose) {
                logln("Installation Started", LIGHTBlUE);
                logln("");
            }
            else {
                log("Installing Dependencies...", LIGHTBlUE);
            }
            
            session.on("run", function() {
                if (!verbose) return;
                
                var heading = "Package " + session.package.name 
                    + " " + (session.package.version || "");
                logln(heading + "\n" + Array(heading.length + 1).join("-"));
            });
            
            var lastOptions;
            session.on("each", function(e) {
                if (!verbose) return;
                
                if (lastOptions != e.options) {
                    lastOptions = e.options;
                    if (e.options.name) {
                        logln("Installing " + e.options.name, BLUE);
                        logln("");
                    }
                }
            });
            session.on("data", function(e) {
                if (!verbose) return;
                
                log(e.data);
            });
            
            session.start(function(err) {
                if (err) {
                    logln("\n" + err.message + "\n\n" + RED
                      + "One or more errors occured. "
                      + "Please try to resolve them and "
                      + "try again or contact support@c9.io. " 
                      + (!verbose ? "Use --verbose to see more output." : "")
                      + RESETCOLOR);
                }
                else if (verbose) {
                    logln("");
                    logln("Installation Completed.", LIGHTBlUE);
                }
                else {
                    logln(" [Done]", LIGHTBlUE);
                }
            }, true);
        }
        
        function log(msg, color, unset) {
            logln(msg, color, unset, true);
        }
        
        function logln(msg, color, unset, noLineEnd) {
            process.stdout.write((color || "") + msg + (color ? unset || RESETCOLOR : "") + (noLineEnd ? "" : "\n"));
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("unload", function() {
            verbose = true;
        });
        
        /***** Register and define API *****/
        
        plugin.freezePublicAPI({
            get verbose() { return verbose; },
            set verbose(v) { verbose = v; }
        });
        
        register(null, {
            "installer.cli": plugin
        });
    }
});