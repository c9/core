/**
 * jsonalyzer Makefile analysis
 *
 * @copyright 2013, Ajax.org B.V.
 * @author Lennart Kats <lennart add c9.io>
 */
define(function(require, exports, module) {

var jsonalyzer = require("plugins/c9.ide.language.jsonalyzer/worker/jsonalyzer_worker");
var PluginBase = require("plugins/c9.ide.language.jsonalyzer/worker/jsonalyzer_base_handler");
var ctagsUtil = require("plugins/c9.ide.language.jsonalyzer/worker/ctags/ctags_util");

var TAGS = [
    { regex: /(?:^|\n)([A-Za-z0-9 \.].*?)\s*:(?!=)/g, kind: "property" },
    { regex: /(?:^|\n)([A-Za-z0-9].*?)\s*:=/g, kind: "property2" }
];
var GUESS_FARGS = false;
var EXTRACT_DOCS = false;

var handler = module.exports = Object.create(PluginBase);

handler.languages = ["makefile"];

handler.extensions = [];

handler.supportedPaths = "(^|\/)Makefile.*";

handler.analyzeCurrent = function(path, doc, ast, options, callback) {
    if (doc === "")
        return callback(null, {});
        
    if (doc.length > jsonalyzer.getMaxFileSizeSupported())
        return callback(null, {});
    
    var results = {};
    TAGS.forEach(function(tag) {
        if (tag.kind === "import")
            return;
        ctagsUtil.findMatchingTags(
            path, doc, tag, GUESS_FARGS, EXTRACT_DOCS, results);
    });
    callback(null, { properties: results });
};

handler.analyzeOthers = handler.analyzeCurrentAll;

handler.findImports = function(path, doc, ast, options, callback) {
    callback(null, ctagsUtil.findMatchingOpenFiles(path));
};


});