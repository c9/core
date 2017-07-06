/**
 * JavaScript jump to definition.
 *
 * @copyright 2013, Ajax.org B.V.
 */
define(function(require, exports, module) {

var baseLanguageHandler = require('plugins/c9.ide.language/base_handler');
var handler = module.exports = Object.create(baseLanguageHandler);
var scopes = require("plugins/c9.ide.language.javascript/scope_analyzer");

handler.handlesLanguage = function(language) {
    return language === "javascript" || language === "jsx";
};

handler.jumpToDefinition = function(doc, ast, pos, options, callback) {
    if (!ast || !options.node)
        return callback();
    scopes.analyze(doc.getValue(), ast, function() {
        scopes.getRenamePositions(doc, ast, pos, options, function (data) {
            if (!data || !data.declarations || data.declarations.length === 0) {
                return callback(null);
            }
            
            callback(data.declarations);
        });
    }, true);
};

});
