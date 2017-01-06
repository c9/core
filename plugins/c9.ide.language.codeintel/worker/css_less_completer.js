/**
 * helper module for codeintel worker
 *
 * @copyright 2016, Ajax.org B.V.
 * @author Lennart Kats <lennart add c9.io>
 */
define(function(require, exports, module) {

var baseHandler = require("plugins/c9.ide.language/base_handler");
var codeintel = require("plugins/c9.ide.language.codeintel/worker/codeintel_worker");

var handler = module.exports = Object.create(baseHandler);
codeintel.addLanguage("css");
codeintel.addLanguage("less");

handler.handlesLanguage = function(language) {
    return language === "css" || language === "less";
};

handler.getIdentifierRegex = function() {
    return (/[a-zA-Z0-9_\x7f-\xff\-]/);
};

handler.getCompletionRegex = function() {
    return /: $/;
};

handler.predictNextCompletion = function(doc, ast, pos, options, callback) {
    if (options.line[pos.column - 1] === ":")
        return callback({ predicted: " " });
    callback();
};

handler.getCacheCompletionRegex = function() {
    return new RegExp(
        // identifiers, dots, @, and keywords without (
        "(\\b[\\.@\\w]+\\s+"
        // spaces
        + "|\\s)+"
    );
};

});