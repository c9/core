define(function(require, exports, module) {

var baseLanguageHandler = require('plugins/c9.ide.language/base_handler');

var handler = module.exports = Object.create(baseLanguageHandler);

var scopeAnalyzer = require("plugins/c9.ide.language.javascript/scope_analyzer");
var inferCompleter = require("plugins/c9.ide.language.javascript.infer/infer_completer");
    
handler.handlesLanguage = function(language) {
    return language === "javascript";
};

handler.handlesEditor = function() {
    return this.HANDLES_IMMEDIATE;
};

handler.complete = function(doc, fullAst, pos, options, callback) {
    // Redirect to scope_analyzer (who normally only handles editors,
    // but also does much more than just completion)
    return scopeAnalyzer.complete(doc, fullAst, pos, options, function(results) {
        var allResults = results || [];
        inferCompleter.complete(doc, fullAst, pos, options, function(results) {
            callback(allResults.concat(results || []));
        });
    });
};

});
