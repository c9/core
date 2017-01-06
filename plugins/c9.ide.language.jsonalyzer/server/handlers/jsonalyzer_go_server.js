/**
 * jsonalyzer php analysis
 *
 * @copyright 2013, Ajax.org B.V.
 * @author Lennart Kats <lennart add c9.io>
 */
define(function(require, exports, module) {

var PluginBase = require("plugins/c9.ide.language.jsonalyzer/worker/jsonalyzer_base_handler");

var handler = module.exports = Object.create(PluginBase);

handler.extensions = ["go"];

handler.languages = ["golang"];

handler.maxCallInterval = handler.CALL_INTERVAL_BASIC;

handler.init = function(options, callback) {
    callback();
};

handler.analyzeCurrent = function(path, doc, ast, options, callback) {
    this.$lint(
        "gofmt",
        doc ? ["-e"] : ["-e", path],
        doc,
        { env: { PATH: process.env.PATH + ":/opt/go/bin" }},
        function(err, stdout, stderr) {
            if (err) return callback(err);
            
            var markers = [];
            
            stderr.split("\n").forEach(function(line) {
                var match = line.match(/^[^:]*:([^:]*):([^:]*): (.*)/);
                if (!match)
                    return;
                var row = match[1];
                var column = match[2]; // unused, might go stale too soon
                var message = match[3];
                markers.push({
                    pos: { sl: row - 1 },
                    message: message,
                    level: "error"
                });
            });
            
            callback(null, null, markers);
        }
    );
};

});