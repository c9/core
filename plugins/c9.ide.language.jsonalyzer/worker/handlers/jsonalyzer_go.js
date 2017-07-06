/**
 * jsonalyzer python analysis
 *
 * @copyright 2013, Ajax.org B.V.
 * @author Lennart Kats <lennart add c9.io>
 */
define(function(require, exports, module) {

var jsonalyzer = require("plugins/c9.ide.language.jsonalyzer/worker/jsonalyzer_worker");
var PluginBase = require("plugins/c9.ide.language.jsonalyzer/worker/jsonalyzer_base_handler");
var ctagsUtil = require("plugins/c9.ide.language.jsonalyzer/worker/ctags/ctags_util");

var TAGS = [
    { regex: /(?:^|\n)\s*package\s+([^\s\(]+)/g, kind: "package" },
    { regex: /(?:^|\n)\s*type\s+([^\s\(]+)/g, kind: "method2", indent: 1 },
    { regex: /(?:^|\n)\s*func\s+([^\s\r\(]+)/g, kind: "method", indent: 1 },
    {
        regex: new RegExp(
            "(?:^|\\n)\\s*import\\s+([^ \\(]+)"
        ),
        kind: "import"
    }
];
var GUESS_FARGS = true;
var EXTRACT_DOCS = true;

var handler = module.exports = Object.create(PluginBase);

handler.languages = ["golang"];

handler.extensions = ["go"];

handler.analyzeCurrent = function(path, doc, ast, options, callback) {
    if (doc === "")
        return callback(null, {});
        
    if (doc.length > jsonalyzer.getMaxFileSizeSupported())
        return callback(null, {});
    
    var results = {};
    TAGS.forEach(function(tag) {
        if (tag.kind === "import")
            return;
        ctagsUtil.findMatchingTags(path, doc, tag, GUESS_FARGS, EXTRACT_DOCS, results);
    });

    var serverHandler = jsonalyzer.getServerHandlerFor(path, "go");
    if (options.service || !serverHandler)
        return callback(null, { properties: results });
    
    serverHandler.analyzeCurrent(path, doc, ast, options, function(err, summary, markers) {
        if (err && err.code === "ESUPERSEDED")
            return callback(err);
        if (err)
            console.error(err.stack || err);
        return callback(null, { properties: results }, markers);
    });
};

handler.analyzeOthers = handler.analyzeCurrentAll;

handler.findImports = function(path, doc, ast, options, callback) {
    // TODO: get open files + guess imports
    callback(null, ctagsUtil.findMatchingOpenFiles(path));
};


});