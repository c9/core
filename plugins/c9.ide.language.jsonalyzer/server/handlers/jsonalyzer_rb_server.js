/**
 * jsonalyzer php analysis
 *
 * @copyright 2013, Ajax.org B.V.
 * @author Lennart Kats <lennart add c9.io>
 */
define(function(require, exports, module) {

var PluginBase = require("plugins/c9.ide.language.jsonalyzer/worker/jsonalyzer_base_handler");

var handler = module.exports = Object.create(PluginBase);

handler.extensions = ["rb"];

handler.languages = ["ruby"];

handler.maxCallInterval = handler.CALL_INTERVAL_BASIC;

handler.init = function(options, callback) {
    callback();
};

handler.analyzeCurrent = function(path, doc, ast, options, callback) {
    this.$lint(
        "ruby",
        doc ? ["-wc", "-Ku"] : ["-wc", path],
        doc,
        function(err, stdout, stderr) {
            if (err) return callback(err);

            var markers = [];
            
            stderr.split("\n").forEach(function(line) {
                var match = line.match(/^(.*?):(\d+): (.*)/);
                if (!match)
                    return;
                var row = match[2];
                var message = match[3];
                markers.push({
                    pos: { sl: parseInt(row, 10) - 1 },
                    message: message,
                    level: message.match(/warning/) ? "warning" : "error"
                });
            });
            
            callback(null, null, markers);
        }
    );
};

});