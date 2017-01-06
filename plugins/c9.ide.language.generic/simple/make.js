define(function(require, exports, module) {

var baseLanguageHandler = require('plugins/c9.ide.language/base_handler');

var handler = module.exports = Object.create(baseLanguageHandler);
    
handler.handlesLanguage = function(language) {
    return language === "makefile";
};

handler.getIdentifierRegex = function() {
    // Allow slashes for paths, dots, dashes, tildes, no dollars
    return (/[a-zA-Z_0-9\/\.\-\~]/);
};


});
