define(function(require, exports, module) {

var baseLanguageHandler = require('plugins/c9.ide.language/base_handler');

var handler = module.exports = Object.create(baseLanguageHandler);
    
handler.handlesLanguage = function(language) {
    return language === "sh";
};

handler.getIdentifierRegex = function() {
    return (/[a-zA-Z_0-9\.\-\~]/);
};

handler.getCompletionRegex = function() {
    return (/\$/);
};


});
