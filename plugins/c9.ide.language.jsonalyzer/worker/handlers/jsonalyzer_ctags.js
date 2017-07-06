/**
 * jsonalyzer CTAGS-based analysis
 *
 * @copyright 2013, Ajax.org B.V.
 * @author Lennart Kats <lennart add c9.io>
 */
define(function(require, exports, module) {

var index = require("plugins/c9.ide.language.jsonalyzer/worker/semantic_index");
var PluginBase = require("plugins/c9.ide.language.jsonalyzer/worker/jsonalyzer_base_handler");
var jsonalyzer = require("plugins/c9.ide.language.jsonalyzer/worker/jsonalyzer_worker");
var ctags = require("plugins/c9.ide.language.jsonalyzer/worker/ctags/ctags_ex");
var ctagsUtil = require("plugins/c9.ide.language.jsonalyzer/worker/ctags/ctags_util");
var asyncForEach = require("plugins/c9.ide.language.core/worker").asyncForEach;
var workerUtil = require("plugins/c9.ide.language/worker_util");

var handler = module.exports = Object.create(PluginBase);

var IDLE_TIME = 50;

handler.languages = ctags.languages;

handler.extensions = ctags.extensions;

handler.isGeneric = true;

handler.findImports = function(path, doc, ast, options, callback) {
    callback(null, ctagsUtil.findMatchingOpenFiles(path));
};

handler.analyzeCurrent = function(path, doc, ast, options, callback) {
    if (doc === "")
        return callback(null, {});
        
    if (doc.length > jsonalyzer.getMaxFileSizeSupported())
        return callback();

    // Let's not slow down completion, since other handlers
    // likely give better results anyway. We'll just use the last analysis.
    // And also, we don't care about saves, just about changes
    if ((options.service === "complete" || options.isSave) && index.get(path))
        return callback(null, index.get(path));
    if (options.language)
        path = ctags.pathForLanguage(options.language, path);
    ctags.analyze(path, doc, options, callback);
};

handler.analyzeOthers = function(paths, options, callback) {
    var errs = [];
    var results = [];
    var _self = this;
    asyncForEach(
        paths,
        function(path, next) {
            workerUtil.readFile(path, { unsaved: true }, function(err, doc) {
                if (err) {
                    errs.push(err);
                    results.push(null);
                    return next();
                }
                
                _self.analyzeCurrent(path, doc, null, {}, function(err, result) {
                    errs.push(err);
                    results.push(result);
                    next();
                });
            });
        },
        function() {
            callback(errs, results);
        }
    );
};

});
