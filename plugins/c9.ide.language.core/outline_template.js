define(function(require, exports, module) {

var jsonalyzer = require("plugins/c9.ide.language.jsonalyzer/worker/jsonalyzer_worker");
var PluginBase = require("plugins/c9.ide.language.jsonalyzer/worker/jsonalyzer_base_handler");
var ctagsUtil = require("plugins/c9.ide.language.jsonalyzer/worker/ctags/ctags_util");

var CONFIG = {{CONFIG}};
var TAGS = CONFIG.tags;
var GUESS_FARGS = CONFIG.guess_fargs;
var EXTRACT_DOCS = CONFIG.extract_docs;

var handler = module.exports = Object.create(PluginBase);

handler.languages = CONFIG.languages;

handler.extensions = CONFIG.extensions;

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

    callback(null, { properties: results });
};

handler.analyzeOthers = handler.analyzeCurrentAll;

handler.findImports = function(path, doc, ast, options, callback) {
    // TODO: get open files + guess imports
    callback(null, ctagsUtil.findMatchingOpenFiles(path));
};

});