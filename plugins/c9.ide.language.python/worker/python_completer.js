/**
 * jsonalyzer Python code completion
 *
 * @copyright 2015, Ajax.org B.V.
 * @author Lennart Kats <lennart add c9.io>
 */
define(function(require, exports, module) {

var baseHandler = require("plugins/c9.ide.language/base_handler");
var workerUtil = require("plugins/c9.ide.language/worker_util");

var KEYWORD_REGEX = new RegExp(
    "^(and|as|assert|break|class|continue|def|del|elif|else|except|exec|"
    + "finally|for|from|global|if|import|in|is|lambda|not|or|pass|print|"
    + "raise|return|try|while|with|yield)$"
);
var DAEMON_PORT = 10880;
var ERROR_PORT_IN_USE = 98;
var ERROR_NO_SERVER = 7;

var handler = module.exports = Object.create(baseHandler);
var pythonVersion = "python2";
var enabled;
var pythonPath = "";
var jediServer;
var launchCommand;
var showedJediError;
var daemon;

handler.handlesLanguage = function(language) {
    return language === "python";
};

handler.init = function(callback) {
    var emitter = handler.getEmitter();
    emitter.on("set_python_config", function(e) {
        pythonVersion = e.pythonVersion;
        pythonPath = e.pythonPath;
        enabled = e.completion;
        if (daemon) {
            daemon.kill();
            daemon = null;
        }
    });
    emitter.on("set_python_scripts", function(e) {
        jediServer = e.jediServer;
        launchCommand = e.launchCommand;
    });
    callback();
};

handler.getIdentifierRegex = function() {
    return /\w/;
};

handler.getCompletionRegex = function() {
    return (/(\.|\b(import|from|if|while|from|raise|return) |% )$/); 
};

handler.getCacheCompletionRegex = function() {
     // Match strings that can be an expression or its prefix, i.e.
     // keywords/identifiers followed by whitespace and/or operators
    return / ?(\b\w+\s+|\b(if|while|for|print)\s*\(|([{[\-+*%<>!|&/,%]|==|!=)\s*)*/;
};

handler.onDocumentOpen = function(path, doc, oldPath, callback) {
    if (!enabled) return callback();
    ensureDaemon(callback);
};

/**
 * Complete code at the current cursor position.
 */
handler.complete = function(doc, fullAst, pos, options, callback) {
    if (!enabled) return callback();
    
    callDaemon("completions", handler.path, doc, pos, options, function(err, results, meta) {
        if (err) return callback(err);
        
        results && results.forEach(function beautifyCompletion(r) {
            r.isContextual = true;
            r.guessTooltip = true;
            r.replaceText = r.replaceText || r.name;
            r.priority = r.name[0] === "_" || r.replaceText === r.replaceText.toUpperCase() ? 3 : 4;
            r.icon = r.icon || "property";
            r.icon = r.name[0] === "_" ? r.icon.replace(/2?$/, "2") : r.icon;
            r.noDoc = options.noDoc;
            if (!r.doc)
                return;
            if (r.replaceText === "print(^^)" && pythonVersion === "python2" && !/\.[^ ]*$/.test(options.line.substr(pos.column)))
                r.replaceText = "print";
            var docLines = r.doc.split(/\r\n|\n|\r/);
            var docBody = docLines.slice(2).join("\n");
            r.docHeadHtml = workerUtil.filterDocumentation(docLines[0]).replace(/^([A-Za-z0-9$_]+\()self, /, "$1");
            r.doc = workerUtil.filterDocumentation(docBody.replace(/``/g, "'"));
        });
        callback(null, results);
    });
};

/**
 * Jump to the definition of what's under the cursor.
 */
handler.jumpToDefinition = function(doc, fullAst, pos, options, callback) {
    if (!enabled) return callback();
    
    callDaemon("goto_definitions", handler.path, doc, pos, options, callback);
};

/**
 * Predict how to complete code next. Did the user just type 'mat'?
 * Then we probably only have a completion 'math'. So we can predict
 * that the user may type 'math.' next and precompute completions.
 */
handler.predictNextCompletion = function(doc, fullAst, pos, options, callback) {
    var line = options.line;
    if (!options.matches.length) {
        // Normally we wouldn't complete here, maybe we can complete for the next char?
        // Let's do so unless it looks like the next char may be a newline or equals sign
        if (line[pos.column - 1] && /(?![:)}\]\s"'\+\-\*])./.test(line[pos.column - 1]))
            return callback(null, { predicted: "" });
    }
    var predicted = options.matches.filter(function(m) {
        return m.isContextual
            && !m.replaceText.match(KEYWORD_REGEX);
    });
    if (predicted.length > 0 && "import".substr(0, line.length) === line)
        return callback(null, { predicted: "import " });
    if (predicted.length !== 1 || predicted[0].icon === "method")
        return callback();
    if (/^\s+import /.test(line))
        return callback();
    console.log("[python_completer] Predicted our next completion will be for " + predicted[0].replaceText + ".");
    callback(null, {
        predicted: predicted[0].replaceText + ".",
        showEarly: predicted[0].replaceText === "self" || predicted[0].icon === "package"
    });
};

/**
 * Invoke a function on our jedi python daemon. It runs as an HTTP daemon
 * so we use curl to send a request.
 */
function callDaemon(command, path, doc, pos, options, callback) {
    ensureDaemon(function(err, dontRetry) {
        if (err) return callback(err);
        
        var start = Date.now();
        workerUtil.execAnalysis(
            "curl",
            {
                mode: "stdin",
                json: true,
                args: [
                    "-s", "--data-binary", "@-", // get input from stdin
                    "-H", "Expect:", // don't wait for "100-Continue"
                    "localhost:" + DAEMON_PORT + "?mode=" + command
                    + "&row=" + (pos.row + 1) + "&column=" + pos.column
                    + "&path=" + encodeURIComponent(path.replace(/^\//, ""))
                    + (options.noDoc ? "&nodoc=1" : ""),
                ],
            },
            function onResult(err, stdout, stderr, meta) {
                if (err) {
                    if (err.code === ERROR_NO_SERVER && !dontRetry)
                        return callDaemon(command, path, doc, pos, options, callback);
                    return callback(new Error("jedi_server failed or not responding"));
                }
                
                if (typeof stdout !== "object")
                    return callback(new Error("Couldn't parse python-jedi output: " + stdout));
                
                console.log("[python_completer] " + command + " in " + (Date.now() - start)
                    + "ms (jedi: " + meta.serverTime + "ms): "
                    + doc.getLine(pos.row).substr(0, pos.column));

                callback(null, stdout, meta);
            }
        );
    });
}

/**
 * Make sure we're running a jedi daemon (../server/jedi_server.py).
 * It listens on a port in the workspace container or host.
 */
function ensureDaemon(callback) {
    if (daemon)
        return done(daemon.err, true);

    daemon = {
        err: new Error("Still starting daemon, enhance your calm"),
        kill: function() {
            this.killed = true;
        }
    };
    
    workerUtil.spawn(
        "bash",
        {
            args: [
                "-c", launchCommand, "--", pythonVersion,
                "$PYTHON -c '" + jediServer + "' daemon --port " + DAEMON_PORT
            ],
            env: { PYTHONPATH: pythonPath },
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
                if (/Daemon listening/.test(data))
                    done();
            });
            child.on("exit", function(code) {
                if (code === ERROR_PORT_IN_USE) // someone else running daemon?
                    return done(null, true);
                if (!code || /Daemon listening/.test(output)) // everything ok, try again later
                    daemon = null;
                clearTimeout(killTimer);
                done(code && new Error("[python_completer] Daemon failed: " + output), true);
            });
        }
    );
    
    function done(err, dontRetry) {
        if (err && /No module named jedi/.test(err.message) && !showedJediError) {
            workerUtil.showError("Jedi not found. Please run 'pip install jedi' or 'sudo pip install jedi' to enable Python code completion.");
            showedJediError = true;
        }
        callback && callback(err, dontRetry);
        handler.sender.emit("python_completer_ready");
        callback = null;
    }
}

});
