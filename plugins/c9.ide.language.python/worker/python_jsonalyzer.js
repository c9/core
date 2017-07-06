/**
 * jsonalyzer quick 'n dirty Python outline view
 *
 * @copyright 2013, Ajax.org B.V.
 * @author Lennart Kats <lennart add c9.io>
 */
define(function(require, exports, module) {

var jsonalyzer = require("plugins/c9.ide.language.jsonalyzer/worker/jsonalyzer_worker");
var PluginBase = require("plugins/c9.ide.language.jsonalyzer/worker/jsonalyzer_base_handler");
var ctagsUtil = require("plugins/c9.ide.language.jsonalyzer/worker/ctags/ctags_util");

var TAGS = [
    { regex: /(?:^|\n)\s*class\s+([^ \(:]+)/g, kind: "unknown2" },
    { regex: /(?:^|\n)\s*def\s+(?!_)([^ \(:]+)/g, kind: "method2", indent: 1 },
    { regex: /(?:^|\n)\s*def\s+(?!__[^ \(:]+__)(_[^ \(]*)/g, kind: "method2", indent: 1 },
    { regex: /(?:^|\n)\s*def\s+(__[^ \(:]+__)/g, kind: "property2", indent: 1 },
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

handler.languages = ["py"];

handler.extensions = ["py"];

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

    return callback(null, { properties: results });
};

handler.analyzeOthers = handler.analyzeCurrentAll;

handler.findImports = function(path, doc, ast, options, callback) {
    callback(null, ctagsUtil.findMatchingOpenFiles(path));
};

});