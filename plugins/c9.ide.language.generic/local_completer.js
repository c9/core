define(function(require, exports, module) {

var baseLanguageHandler = require('plugins/c9.ide.language/base_handler');
var completeUtil = require("plugins/c9.ide.language/complete_util");

var MAX_SIZE_BYTES = 5 * 1000 * 1000;
var DEFAULT_SPLIT_REGEX = /[^a-zA-Z_0-9\$]+/;
var MAX_SCORE = 1000000;
var TRUNCATE_LINES = 10000;

var completer = module.exports = Object.create(baseLanguageHandler);
    
completer.handlesLanguage = function(language) {
    return true;
};

completer.handlesEditor = function() {
    return this.HANDLES_ANY;
};

completer.getMaxFileSizeSupported = function() {
    // More than our conservative default
    return MAX_SIZE_BYTES;
};

// For the current document, gives scores to identifiers not on frequency, but on distance from the current prefix
function wordDistanceAnalyzer(doc, pos, prefix, suffix) {
    var splitRegex = getSplitRegex(pos);
    
    // Get the current document text, skipping the current word
    var linesBefore = doc.getLines(Math.max(0, pos.row - TRUNCATE_LINES / 2), pos.row - 1);
    var linesAfter = doc.getLines(pos.row + 1, Math.min(doc.getLength(), pos.row + TRUNCATE_LINES / 2));
    var textBefore = linesBefore.join("\n");
    var textAfter = linesAfter.join("\n");
    var line = getFilteredLine(doc.getLine(pos.row), pos.column, prefix, suffix);

    // Split entire document into words
    var identifiers = textBefore.split(splitRegex);
    var prefixPosition = identifiers.length;
    identifiers = identifiers.concat(line.split(splitRegex), textAfter.split(splitRegex));
    
    // Find prefix to find other identifiers close it
    var identDict = Object.create(null);
    for (var i = 0; i < identifiers.length; i++) {
        var ident = identifiers[i];
        if (ident.length === 0)
            continue;
        var distance = Math.max(prefixPosition, i) - Math.min(prefixPosition, i);
        // Score substracted from 100000 to force descending ordering
        if (identDict[ident])
            identDict[ident] = Math.max(MAX_SCORE - distance, identDict[ident]);
        else
            identDict[ident] = MAX_SCORE - distance;
        
    }
    return identDict;
}

function getSplitRegex(pos) {
    var idRegex = completer.$getIdentifierRegex(pos);
    if (!idRegex || !idRegex.source.match(/\[[^^][^\]]*\]/))
        return DEFAULT_SPLIT_REGEX;
    return new RegExp("[^" + idRegex.source.substr(1, idRegex.source.length - 2) + "]+");
}

function getFilteredLine(line, column, prefix, suffix) {
    return line.substr(0, column - prefix.length)
        + line.substr(column + suffix.length);
}

function analyze(doc, pos) {
    var line = doc.getLine(pos.row);
    var prefix = completeUtil.retrievePrecedingIdentifier(line, pos.column, completer.$getIdentifierRegex());
    var suffix = completeUtil.retrieveFollowingIdentifier(line, pos.column, completer.$getIdentifierRegex());
    return wordDistanceAnalyzer(doc, pos, prefix, suffix);
}
    
completer.complete = function(doc, fullAst, pos, options, callback) {
    var identDict = analyze(doc, pos);
    var line = doc.getLine(pos.row);
    var regex = this.$getIdentifierRegex(pos);
    var identifier = completeUtil.retrievePrecedingIdentifier(line, pos.column, regex);
    var fullIdentifier = identifier + completeUtil.retrieveFollowingIdentifier(line, pos.column, regex);
         
    var allIdentifiers = [];
    for (var ident in identDict) {
        allIdentifiers.push(ident);
    }
    var matches = completeUtil.findCompletions(identifier, allIdentifiers);
    
    matches = matches.slice(0, 100); // limits results for performance

    var allowSlashes = regex && regex.source.match(/^\[.*\/.*]/);
    var allowDollars = regex && regex.source.match(/\$\$/);
    
    callback(null, matches.filter(function(m) {
        if (allowDollars) {
            return !m.match(allowSlashes ? /^([0-9_\/]|\/[^\/])/ : /^[0-9_\/]/);
        }  
        else {
            return !m.match(allowSlashes ? /^([0-9$_\/]|\/[^\/])/ : /^[0-9$_\/]/);
        }
    }).map(function(m) {
        return {
          name: m,
          replaceText: m,
          icon: null,
          score: m === fullIdentifier ? MAX_SCORE : identDict[m],
          isGeneric: true,
          priority: 0,
          $source: "local"
        };
    }));
};

});
