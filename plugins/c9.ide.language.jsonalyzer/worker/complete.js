define(function(require, exports, module) {

var index = require("./semantic_index");
var fileIndexer = require("./file_indexer");
var completeUtil = require("plugins/c9.ide.language/complete_util");
var workerUtil = require("plugins/c9.ide.language/worker_util");
var ctagsUtil = require("./ctags/ctags_util");
var handler;

var PRIORITY_LOW = 1;
var PRIORITY_HIGH = 2;

module.exports.init = function(_handler) {
    handler = _handler;
};

module.exports.complete = function(doc, fullAst, pos, options, callback) {
    if (options.node && options.node.cons === "PropertyInit") // HACK for javascript
        return callback();

    var lines = doc.getAllLines();
    var line = lines[pos.row];
    var identifier = completeUtil.retrievePrecedingIdentifier(line, pos.column, workerUtil.getIdentifierRegex());
    
    // Try not to complete anything if we appear to be in a property access expression
    if (line[pos.column - identifier.length - 1] === ".")
        return callback();
    
    getCurrentLazy(handler.path, doc, fullAst, function(err, result, imports) {
        if (err)
            console.log("[jsonalyzer] Warning: could not analyze " + handler.path + ": " + err);
        var currentFile = result;
        var currentResults = getCompletionResults(null, PRIORITY_HIGH, identifier, currentFile, pos, line);
        var otherResults = [];
        imports.forEach(function(path) {
            var summary = index.get(path);
            if (summary)
                otherResults = otherResults.concat(
                    getCompletionResults(path, PRIORITY_LOW, identifier, summary));
        });
        callback(currentResults.concat(otherResults));

        // Try to fetch any additional imports, and reopen the completer if needed
        var unresolved = imports.filter(function(i) { return !index.get(i); });
        if (unresolved.length) {
            fileIndexer.analyzeOthers(unresolved, true, function() {
                if (index.getAny(unresolved).length)
                    workerUtil.completeUpdate(pos, line);
            });
        }
    });
};

function getCurrentLazy(path, doc, fullAst, callback) {
    var result = index.get(path);
    if (result)
        return callback(null, result, index.getImports(path));
    fileIndexer.analyzeCurrent(handler.path, doc.getValue(), fullAst, { service: "complete" }, callback);
}

function getCompletionResults(path, priority, identifier, summary, skipPos, skipLine) {
    if (!summary)
        return [];
    var entries = index.findEntries(summary, identifier, true);
    var file = path && path.match(/[^\/]*$/)[0];
    
    var results = [];
    for (var uname in entries) {
        entries[uname].forEach(function(e) {
            var name = uname.substr(1);
            // Don't show entries from the current row
            // when we use a cached summary
            if (skipPos && e.row === skipPos.row && !isDefinedInLine(skipLine, name, skipPos, identifier))
                return;
            if (e.noComplete)
                return;
            results.push(toCompletionResult(file, name, priority, e));
        });
    }
    return results;
}

function isDefinedInLine(line, name, skipPos, skipPrefix) {
    var first = line.indexOf(name);
    var last = line.lastIndexOf(name);
    if (first !== last)
        return true;
    return first !== skipPos.column - skipPrefix.length;
}

function toCompletionResult(file, name, priority, entry) {
    var fullName = entry.guessFargs
        ? name + ctagsUtil.guessFargs(entry.docHead, name)
        : name;
    var braces = fullName !== name ? "(^^)" : "";
    
    return {
        id: name,
        name: fullName,
        replaceText: name + braces,
        icon: "kind" in entry ? entry.kind : "unknown2",
        meta: file,
        doc: entry.doc,
        docHead: entry.docHead,
        priority: priority,
        isGeneric: true,
        guessTooltip: true,
    };
}

});