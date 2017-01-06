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
codeintel.addLanguage("ruby");

handler.handlesLanguage = function(language) {
    return language === "ruby";
};

handler.getIdentifierRegex = function() {
    return (/[a-zA-Z0-9_\x7f-\xff]/);
};

handler.getCompletionRegex = function() {
    return /[\.]/;
};

handler.getCacheCompletionRegex = function() {
     // Match strings that can be an expression or its prefix, i.e.
     // keywords/identifiers followed by whitespace and/or operators
    return new RegExp(
        // 'if/while/for ('
        "(\\b(if|while|for|switch)\\s*\\("
        // other identifiers and keywords without (
        + "|\\b\\w+\\s+"
        // equality operators, operators such as + and -,
        // and opening brackets { and [
        + "|(===?|!==?|[-+]=|[-+*%>?!|&{[])"
        // spaces
        + "|\\s)+"
    );
};

});