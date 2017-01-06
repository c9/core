/**
 * jsonalyzer Go code completion
 *
 * @copyright 2015, Ajax.org B.V.
 * @author Lennart Kats <lennart add c9.io>
 */
define(function(require, exports, module) {

var baseHandler = require("plugins/c9.ide.language/base_handler");
var workerUtil = require("plugins/c9.ide.language/worker_util");

var handler = module.exports = Object.create(baseHandler);
var daemon;
var enabled = true;

handler.handlesLanguage = function(language) {
    return language === "golang";
};

handler.init = function(callback) {
    var emitter = handler.getEmitter();
    emitter.on("set_go_config", function(e) {
        enabled = e.enabled;
    });
    callback();
};

handler.onDocumentOpen = function(path, doc, oldPath, callback) {
    ensureDaemon(callback);
};

/* TODO
handler.getIdentifierRegex = function() {
    return /\w/;
};
*/

// TODO: improve this regex for Go
handler.getCompletionRegex = function() {
    return (/^[\.]$/);
};

// TODO: check this regex for Go
handler.getExpressionPrefixRegex = function() {
     // Match strings that can be an expression or its prefix
    return new RegExp(
        // 'if/while/for ('
        "(\\b(if|while|for|switch)\\s*\\("
        // other identifiers and keywords without (
        + "|\\b\\w+\\s+"
        // equality operators, operators such as + and -,
        // and opening brackets { and [
        + "|(==|!=|[-+]=|[-+*%<>?!|&{[])\\s*)+"
    );
};

/**
 * Complete code at the current cursor position.
 */
handler.complete = function(doc, fullAst, pos, options, callback) {
    if (!enabled) return callback();
    
    ensureDaemon(function(err) {
        if (err) return callback(err);
        
        var start = Date.now();
        workerUtil.execAnalysis(
            "bash", // TODO: don't use bash here, better GOPATH handling
            {
                args: [
                    "-c",
                    "GOPATH=$HOME/.c9/gocode:$GOPATH ~/.c9/gocode/bin/gocode -f=json autocomplete " + getOffset(doc, pos)
                ],
                mode: "stdin",
                json: true,
            },
            function(err, response, responseErr, meta) {
                if (err) return callback(err);
                
                var results = response && response[1] && response[1].map(
                    function beautifyCompletion(r) {
                        r.isContextual = true;
                        r.guessTooltip = true;
                        if (/func\(/.test(r.type)) {
                            r.replaceText = r.name + "(^^)";
                            r.name += "()";
                            r.icon = "method";
                        }
                        else if (r.class === "package") {
                            r.icon = "package";
                        }
                        else {
                            r.icon = "property";
                        }
                        r.docHead = r.type;
                        r.priority = 4;
                        return r;
                    }
                );
                
                console.log("[go_completer] completed in " + (Date.now() - start)
                    + "ms (gocode: " + meta.serverTime + "ms): "
                    + doc.getLine(pos.row).substr(0, pos.column));
                callback(null, results);
            }
        );
    });
};

function getOffset(doc, pos) {
    var result = 0;
    var lines = doc.getAllLines();
    for (var i = 0; i < lines.length; i++) {
        if (i === pos.row)
            return result + pos.column;
        
        result += lines[i].length + 1;
    }
}

handler.predictNextCompletion = function(doc, fullAst, pos, options, callback) {
    if (!options.matches.length) {
        // Normally we wouldn't complete here, maybe we can complete for the next char?
        // Let's do so unless it looks like the next char may be a newline or equals sign
        if (options.line[pos.column - 1] && /(?![{;})\]\s"'\+\-\*])./.test(options.line[pos.column - 1]))
            return callback(null, { predicted: "" });
    }
    var predicted = options.matches.filter(function(m) {
        return m.isContextual;
    });
    if (predicted.length !== 1 || predicted[0].icon === "method")
        return callback();
    console.log("[go_completer] Predicted our next completion will be for " + predicted[0].replaceText + ".");
    callback(null, {
        predicted: predicted[0].replaceText + ".",
        showEarly: predicted[0].class === "package"
    });
};

/**
 * Make sure we're running a jedi daemon (../server/jedi_server.py).
 * It listens on a port in the workspace container or host.
 */
function ensureDaemon(callback) {
    if (daemon)
        return done(daemon.err);

    var loadingErr = new Error("Still starting daemon, enhance your calm");
    loadingErr.code = "ELOADING";
    daemon = {
        err: loadingErr,
        kill: function() {
            this.killed = true;
        }
    };
    
    workerUtil.spawn(
        "bash",
        {
            args: [
                // TODO: cleanup install procedure
                "-c", "mkdir -p ~/.c9/gocode; GOPATH=$HOME/.c9/gocode go get -u github.com/nsf/gocode && ~/.c9/gocode/bin/gocode"
            ]
        },
        function(err, child) {
            if (err) return done(err);
            
            daemon = child;
            daemon.err = null;
            
            if (daemon.killed)
                daemon.kill();
            
            child.stderr.on("data", function(data) {
                console.log("[stderr]", data);
            });
            child.on("exit", function(code) {
                var tip = code === 127 ? " Please make sure go is on your PATH for bash." : "";
                done(code && "Error " + code + " starting daemon. " + tip);
            });
        }
    );
    
    function done(err) {
        if (err) {
            daemon.err = err;
            if (err.code !== "ELOADING")
                workerUtil.showError("Could not setup or start Go completion daemon. Please reload to try again.");
            return callback(err);
        }
        callback();
    }
}

});