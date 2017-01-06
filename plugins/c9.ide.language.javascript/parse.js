/**
 * Cloud9 Language Foundation
 *
 * @copyright 2013, Ajax.org B.V.
 */
define(function(require, exports, module) {

var parser = require("treehugger/js/parse");
var traverse = require("treehugger/traverse");
var baseLanguageHandler = require('plugins/c9.ide.language/base_handler');

var handler = module.exports = Object.create(baseLanguageHandler);

handler.handlesLanguage = function(language) {
    // Note that we don't really support jsx here,
    // but rather tolerate it using error recovery...
    return language === "javascript" || language === "jsx";
};

handler.handlesEditor = function() {
    return this.HANDLES_ANY;
};

handler.parse = function(code, callback) {
    var result;
    try {
        code = code.replace(/^(#!.*\n)/, "//$1");
        result = parser.parse(code);
        traverse.addParentPointers(result);
    } catch (e) {
        // Ignore any *fatal* parse errors; eslint will report them
        result = null;
    }
    
    callback(result);
};

handler.getMaxFileSizeSupported = function() {
    // .25 of current base_handler default
    return .25 * 10 * 1000 * 80;
};

handler.findNode = function(ast, pos, callback) {
    var treePos = { line: pos.row, col: pos.column };
    callback(ast.findNode(treePos));
};

handler.getPos = function(node, callback) {
    callback(node.getPos());
};

handler.getMaxFileSizeSupported = function() {
    // More than our conservative default
    return 1000 * 1000;
};

/* Ready to be enabled to replace Narcissus, when mature

handler.analyze = function(value, ast) {
    var error = ast.getAnnotation("error");
    if (error)
        return [{
            pos: {sl: error.line},
            type: 'error',
            message: error.message || "Parse error."
        }];
    else
        return [];
};
*/

});
