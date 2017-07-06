define(function(require, exports, module) {

var completeUtil = require("plugins/c9.ide.language/complete_util");

var baseLanguageHandler = require('plugins/c9.ide.language/base_handler');

var analysisCache = {}; // path => {identifier: 3, ...}
var globalWordIndex = {}; // word => frequency
var globalWordFiles = {}; // word => [path]
var precachedPath;
var precachedDoc;

var completer = module.exports = Object.create(baseLanguageHandler);

completer.handlesLanguage = function(language) {
    return true;
};

completer.handlesEditor = function() {
    return this.HANDLES_ANY;
};

completer.getMaxFileSizeSupported = function() {
    return 1000 * 1000;
};

function frequencyAnalyzer(path, text, identDict, fileDict) {
    var identifiers = text.split(/[^a-zA-Z_0-9\$]+/);
    for (var i = 0; i < identifiers.length; i++) {
        var ident = identifiers[i];
        if (!ident)
            continue;
            
        if (Object.prototype.hasOwnProperty.call(identDict, ident)) {
            identDict[ident]++;
            fileDict[ident][path] = true;
        }
        else {
            identDict[ident] = 1;
            fileDict[ident] = {};
            fileDict[ident][path] = true;
        }
    }
    return identDict;
}

function removeDocumentFromCache(path) {
    var analysis = analysisCache[path];
    if (!analysis) return;

    for (var id in analysis) {
        globalWordIndex[id] -= analysis[id];
        delete globalWordFiles[id][path];
        if (globalWordIndex[id] === 0) {
            delete globalWordIndex[id];
            delete globalWordFiles[id];
        }
    }
    delete analysisCache[path];
}

function analyzeDocument(path, allCode) {
    if (!analysisCache[path]) {
        if (allCode.size > 80 * 10000) {
            delete analysisCache[path];
            return;
        }
        // Delay this slightly, because in Firefox document.value is not immediately filled
        analysisCache[path] = frequencyAnalyzer(path, allCode, {}, {});
        // may be a bit redundant to do this twice, but alright...
        frequencyAnalyzer(path, allCode, globalWordIndex, globalWordFiles);
    }
}

completer.onDocumentOpen = function(path, doc, oldPath, callback) {
    if (!analysisCache[path]) {
        analyzeDocument(path, doc.getValue());
    }
    callback();
};
    
completer.onDocumentClose = function(path, callback) {
    removeDocumentFromCache(path);
    if (path == precachedPath)
        precachedDoc = null;
    callback();
};

completer.analyze = function(doc, ast, callback) {
    if (precachedDoc && this.path !== precachedPath) {
        removeDocumentFromCache(precachedPath);
        analyzeDocument(precachedPath, precachedDoc);
        precachedDoc = null;
    }
    precachedPath = this.path;
    precachedDoc = doc;
    callback();
};

completer.complete = function(doc, fullAst, pos, options, callback) {
    var line = doc.getLine(pos.row);
    var regex = this.$getIdentifierRegex(pos);
    var identifier = completeUtil.retrievePrecedingIdentifier(line, pos.column, regex);
    var identDict = globalWordIndex;
    
    var allIdentifiers = [];
    for (var ident in identDict) {
        allIdentifiers.push(ident);
    }
    var matches = completeUtil.findCompletions(identifier, allIdentifiers);
    
    var currentPath = options.path;
    matches = matches.filter(function(m) {
        return !globalWordFiles[m][currentPath];
    });
    
    matches = matches.slice(0, 100); // limits results for performance

    callback(null, matches.filter(function(m) {
        return !m.match(/^[0-9$_\/]/);
    }).map(function(m) {
        var path = Object.keys(globalWordFiles[m])[0] || "[unknown]";
        var pathParts = path.split("/");
        var foundInFile = pathParts[pathParts.length - 1];
        return {
          name: m,
          replaceText: m,
          icon: null,
          score: identDict[m],
          meta: foundInFile,
          priority: 0,
          isGeneric: true,
          $source: "open_files",
        };
    }));
};

});
