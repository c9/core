/**
 * jsonalyzer markdown analysis
 *
 * @copyright 2013, Ajax.org B.V.
 * @author Lennart Kats <lennart add c9.io>
 */
define(function(require, exports, module) {

var jsonalyzer = require("plugins/c9.ide.language.jsonalyzer/worker/jsonalyzer_worker");
var PluginBase = require("plugins/c9.ide.language.jsonalyzer/worker/jsonalyzer_base_handler");
var ctagsUtil = require("plugins/c9.ide.language.jsonalyzer/worker/ctags/ctags_util");

var TAGS = [
    { regex: /(?:^|\n)# (.*?)[#\s]*(?:\n|$)/g, kind: "property" },
    { regex: /(?:^|\n)([A-Za-z0-9].*?)\s*\n={2,}(?:\n|$)/g, kind: "property" },
    { regex: /(?:^|\n)#{2} (.*?)[#\s]*(?:\n|$)/g, kind: "property2", indent: 1 },
    { regex: /(?:^|\n)([A-Za-z0-9].*?)\s*\n-{2}(?:\n|$)/g, kind: "property2", indent: 1 },
    { regex: /(?:^|\n)#{3} (.*?)[#\s]*(?:\n|$)/g, kind: "property2", indent: 2 },
    { regex: /(?:^|\n)([A-Za-z0-9].*?)\s*\n-{3,}(?:\n|$)/g, kind: "property2", indent: 2 },
    { regex: /(?:^|\n)#{4} (.*?)[#\s]*(?:\n|$)/g, kind: "property2", indent: 3 },
    { regex: /(?:^|\n)([A-Za-z0-9].*?)\s*\n-{4,}(?:\n|$)/g, kind: "property2", indent: 3 },
    { regex: /(?:^|\n)#{5} (.*?)[#\s]*(?:\n|$)/g, kind: "property2", indent: 4 },
    { regex: /(?:^|\n)([A-Za-z0-9].*?)\s*\n-{5,}(?:\n|$)/g, kind: "property2", indent: 4 },
    { regex: /(?:^|\n)#{6} (.*?)[#\s]*(?:\n|$)/g, kind: "property2", indent: 5 },
    { regex: /(?:^|\n)([A-Za-z0-9].*?)\s*\n-{6,}(?:\n|$)/g, kind: "property2", indent: 5 },
];
var GUESS_FARGS = false;
var EXTRACT_DOCS = false;

var handler = module.exports = Object.create(PluginBase);

handler.languages = ["markdown"];

handler.extensions = ["md", "markdown"];

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