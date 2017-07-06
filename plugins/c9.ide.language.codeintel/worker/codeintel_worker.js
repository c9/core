/**
 * codeintel worker
 *
 * @copyright 2016, Ajax.org B.V.
 * @author Lennart Kats <lennart add c9.io>
 */
define(function(require, exports, module) {

var baseHandler = require("plugins/c9.ide.language/base_handler");
var workerUtil = require("plugins/c9.ide.language/worker_util");

var DAEMON_PORT = 10881;
var ERROR_PORT_IN_USE = 98;
var ERROR_NO_SERVER = 7;
var LANGUAGES = {
    c_cpp: "C++",
    css: "CSS",
    django: "Django",
    perl: "Perl",
    php: "PHP",
    ruby: "Ruby",
    tcl: "Tcl",
    
    // HTML-based & template languages
    html4: "HTML",
    html: "HTML5",
    rhtml: "RHTML",
    templatetoolkit: "TemplateToolkit",
    smarty: "Smarty",
    twig: "Twig",
    xslt: "XSLT",
    xul: "XUL",
    
    // Other unused languages
    python: "Python",
    python3: "Python3",
    golang: "Go",
    javascript: "JavaScript",
    less: "Less",
    mason: "Mason",
    mustache: "Mustache",
    mxml: "MXML",
    nodejs: "Node.js",
    xbl: "XBL",
    xml: "XML",
};

var handler = module.exports = Object.create(baseHandler);
var languages = [];
var paths = {};
var server;
var launchCommand;
var enabled;
var daemon;
var lastInfoTimer;
var lastInfoPopup;

handler.handlesLanguage = function(language) {
    return languages.indexOf(language) > -1;
};

handler.addLanguage = function(language) {
    languages.push(language);
};

handler.$disableZeroLengthCompletion = true;

handler.init = function(callback) {
    var emitter = handler.getEmitter();
    emitter.on("setup", function(e) {
        server = e.server;
        launchCommand = e.launchCommand;
        paths = e.paths;
        enabled = e.enabled;
    });
    callback();
};

handler.onDocumentOpen = function(path, doc, oldPath, callback) {
    if (!launchCommand) return callback();
    
    ensureDaemon(callback);
};

/**
 * Complete code at the current cursor position.
 */
handler.complete = function(doc, fullAst, pos, options, callback) {
    if (!enabled) return callback();
    
    if (options.language === "PHP" && !options.identifierPrefix && (!options.line[pos.column - 1] || " " === options.line[pos.column - 1]))
        return callback(new Error("Warning: codeintel doesn't support empty-prefix completions"));
    
    callDaemon("completions", handler.path, doc, pos, options, function(err, results, meta) {
        if (err) return callback(err);
        
        results && results.forEach(function beautifyCompletion(r) {
            r.isContextual = true;
            r.guessTooltip = true;
            r.nodoc = "always";
            r.replaceText = r.replaceText || r.name;
            r.priority = r.name[0] === "_" || r.replaceText === r.replaceText.toUpperCase() ? 3 : 4;
            r.icon = r.name[0] === "_" ? r.icon.replace(/2?$/, "2") : r.icon;
        });
        callback(null, results);
    });
};

/**
 * Jump to the definition of what's under the cursor.
 */
handler.jumpToDefinition = function(doc, fullAst, pos, options, callback) {
    if (!enabled) return callback();
    
    callDaemon("definitions", handler.path, doc, pos, options, callback);
};

/**
 * Invoke a function on our completer daemon. It runs as an HTTP daemon
 * so we use curl to send a request.
 */
function callDaemon(command, path, doc, pos, options, callback) {
    ensureDaemon(function(err, dontRetry) {
        if (daemon && daemon.notInstalled)
            handler.getEmitter().emit("not_installed", { language: options.language });
        if (err) return callback(err);
        
        var start = Date.now();
        workerUtil.execAnalysis(
            "curl",
            {
                mode: "stdin",
                json: true,
                args: [
                    "-H", "Expect:", // don't wait for "100-Continue"
                    "-s", "--data-binary", "@-", // get input from stdin
                    "localhost:" + DAEMON_PORT + "?mode=" + command
                    + "&row=" + pos.row + "&column=" + pos.column
                    + "&language=" + LANGUAGES[options.language]
                    + "&path=" + encodeURIComponent(path.replace(/^\//, ""))
                    + "&dirs=" + (paths[options.language] || "").replace(/:/g, ",")
                    + (options.noDoc ? "&nodoc=1" : ""),
                ],
            },
            function onResult(err, stdout, stderr, meta) {
                if (err) {
                    if (err.code === ERROR_NO_SERVER && !dontRetry)
                        return callDaemon(command, path, doc, pos, options, callback);
                        
                    return callback(new Error("codeintel_server failed, not responding, or not installed yet"));
                }
                
                if (typeof stdout !== "object")
                    return callback(new Error("Couldn't parse codeintel output: " + stdout));
                
                console.log("[codeintel_worker] " + command + " in " + (Date.now() - start)
                    + "ms (ci: " + meta.serverTime + "ms): "
                    + doc.getLine(pos.row).substr(0, pos.column));

                callback(null, stdout, meta);
            }
        );
    });
}

/**
 * Make sure we're running our codeintel server.
 * It listens on a port in the workspace container or host.
 */
function ensureDaemon(callback) {
    if (daemon)
        return done(daemon.err, true);

    daemon = {
        err: new Error("Still starting daemon, enhance your calm"),
        kill: function() {
            this.killed = true;
        },
        notInstalled: false,
    };
    
    workerUtil.spawn(
        "bash",
        {
            args: [
                "-c", launchCommand,
                "--", "$PYTHON -c '" + server + "' daemon --port " + DAEMON_PORT
            ],
        },
        function(err, child) {
            var output = "";
            if (err) {
                daemon.err = err;
                return workerUtil.showError("Could not start python completion daemon. Please reload to try again.");
            }
            daemon = child;
            daemon.err = null;
            
            if (daemon.killed)
                daemon.kill();
            
            // We (re)start the daemon after 30 minutes to conserve memory
            var killTimer = setTimeout(daemon.kill.bind(daemon), 30 * 60 * 1000);
            
            child.stderr.on("data", function(data) {
                output += data;
                if (/!!Daemon listening/.test(data)) {
                    done();
                }
                else if (/^!!(Updating .*|Installing .*)/.test(data)) {
                    var message = RegExp.$1;
                    clearTimeout(lastInfoTimer);
                    lastInfoTimer = setTimeout(function() {
                        lastInfoPopup = workerUtil.showInfo(message, 5000);
                    }, 3000);
                }
                else if (/^!!Done(.*)/.test(data)) {
                    if (lastInfoPopup)
                        workerUtil.showInfo(RegExp.$1, 3000);
                    lastInfoPopup = null;
                }
                else if (/^!!Not installed/.test(data)) {
                    daemon.notInstalled = true;
                }
                else if (/^!!/.test(data)) {
                    workerUtil.showError(data);
                }
                else {
                    console.log("[codeintel_worker] " + data);
                }
            });
            child.on("exit", function(code) {
                clearInfoPopup();
                if (code === ERROR_PORT_IN_USE) // someone else running daemon?
                    return done(null, true);
                if (!code || /Daemon listening/.test(output)) // everything ok, try again later
                    daemon = null;
                clearTimeout(killTimer);
                done(code && new Error("[codeintel_worker] Daemon failed: " + output), true);
            });
        }
    );
    
    function clearInfoPopup() {
        clearTimeout(lastInfoTimer);
        lastInfoPopup && lastInfoPopup.hide();
    }
    
    function done(err, dontRetry) {
        callback && callback(err, dontRetry);
        callback = null;
        handler.sender.emit("codeintel_ready", { err: err && err.stack });
    }
}

});