/**
 * jsonalyzer shell analysis
 *
 * @copyright 2013, Ajax.org B.V.
 * @author Lennart Kats <lennart add c9.io>
 */
define(function(require, exports, module) {

var PluginBase = require("plugins/c9.ide.language.jsonalyzer/worker/jsonalyzer_base_handler");
var child_process = require("child_process");

var handler = module.exports = Object.create(PluginBase);
var bashBin;

handler.extensions = ["sh"];

handler.languages = ["sh"];

handler.maxCallInterval = handler.CALL_INTERVAL_BASIC;

handler.init = function(options, callback) {
    bashBin = options.bashBin || "bash";
    callback();
};

handler.analyzeCurrent = function(path, doc, ast, options, callback) {
    var child;
    try {
        child = child_process.execFile(
            bashBin,
            doc ? ["-n"] : ["-n", path],
            function(err, stdout, stderr) {
                if (err && err.code !== 2) return callback(err);
    
                var markers = [];
                var lastMarker;
                
                stderr.split("\n").forEach(function(line) {
                    var match = line.match(/^([^:]+):\s*(?:line\s*)?([^:]+):\s*(.*)/);
                    if (!match)
                        return;
                    var row = match[2];
                    var message = match[3];
                    if (message.match(/^`(.*)'$/)) {
                        // This message only shows the line of the last message,
                        // and is not a message by itself
                        return tryAddColumn(lastMarker, RegExp.$1);
                    }
                    
                    markers.push(lastMarker = {
                        pos: { sl: parseInt(row, 10) - 1 },
                        message: message,
                        level: message.match(/error/) ? "error" : "warning"
                    });
                });
                
                callback(null, null, markers);
            }
        );
    }
    catch (err) {
        // Out of memory or other fatal error?
        err.code = "EFATAL";
        return callback(err);
    }
    
    child.stdin.on("error", function(e) {
        // Ignore; execFile will handle process result
    });
    
    if (doc)
        child.stdin.end(doc);
};

function tryAddColumn(marker, line) {
    if (!marker || !marker.message.match(/token `(.)'/))
        return;
    var token = RegExp.$1;
    var tokenIndex = line.indexOf(token);
    if (tokenIndex === -1 || tokenIndex !== line.lastIndexOf(token))
        return;
    marker.pos.sc = tokenIndex;
    marker.pos.ec = tokenIndex + 1;
}

});