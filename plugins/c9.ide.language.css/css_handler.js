/**
 * Cloud9 Language Foundation
 *
 * @copyright 2013, Ajax.org B.V.
 */
define(function(require, exports, module) {

var baseLanguageHandler = require("plugins/c9.ide.language/base_handler");
var CSSLint = null;
var handler = module.exports = Object.create(baseLanguageHandler);

handler.handlesLanguage = function(language) {
    return language === "css" || language === "less";
};

handler.analyze = function(value, ast, options, callback) {
    if (this.language === "less")
        return callback();
    
    if (!CSSLint) {
        return require(["ace/mode/css/csslint"], function(m) {
            CSSLint = m.CSSLint;
            callback(handler.analyzeSync(value, ast));
        });
    }
    
    callback(handler.analyzeSync(value, ast));
};

// 0: ignore, 1: warning, 2: error, 3: info
var CSSLint_RULESET = {
    "adjoining-classes": 0,
    "box-model": 1,
    "box-sizing": 1,
    "compatible-vendor-prefixes": 3,
    "display-property-grouping": 1,
    "duplicate-background-images": 1,
    "duplicate-properties": 1,
    "empty-rules": 1,
    "errors": 2,
    "fallback-colors": 3,
    "floats": 1,
    "font-faces": 1,
    "font-sizes": 1,
    "gradients": 3,
    "ids": 0,
    "import": 0,
    "important": 3,
    "known-properties": 1,
    "outline-none": 3,
    "overqualified-elements": 1,
    "qualified-headings": 3,
    "regex-selectors": 1,
    "rules-count": 1,
    "shorthand": 1,
    "star-property-hack": 1,
    "text-indent": 1,
    "underscore-property-hack": 1,
    "unique-headings": 1,
    "universal-selector": 1,
    "unqualified-attributes": 1,
    "vendor-prefix": 3,
    "zero-units": 0
};

handler.analyzeSync = function(value, ast) {
    value = value.replace(/^(#!.*\n)/, "//$1");

    if (!CSSLint)
        return;
    
    var results = value && CSSLint.verify(value, CSSLint_RULESET);
    var warnings = results ? results.messages : [];

    return warnings.map(function(warning) {
        if (CSSLint_RULESET[warning.rule.id] === 3)
            warning.type = "info";
        return {
            pos: {
                sl: warning.line - 1,
                sc: warning.col - 1
            },
            type: warning.type,
            level: warning.type,
            message: warning.message
        };
    });
};

handler.getIdentifierRegex = function() {
    return (/[_a-zA-Z0-9-]/);
};

});
