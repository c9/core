define(function(require, exports, module) {

var index = require("./semantic_index");
var fileIndexer = require("./file_indexer");
var workerUtil = require("plugins/c9.ide.language/worker_util");
var handler;
var lastSummary;

module.exports.init = function(_handler) {
    handler = _handler;
};

module.exports.getRefactorings = function(doc, fullAst, pos, options, callback) {
    findEntries(doc, fullAst, pos, function(pos, identifier, hasEntries) {
        callback({ refactorings: hasEntries ? ["renameVariable"] : []});
    });
};

module.exports.getRenamePositions = function(doc, fullAst, pos, options, callback) {
    findEntries(doc, fullAst, pos, function(pos, identifier, hasEntries) {
        if (!hasEntries)
            return callback();
        workerUtil.getTokens(doc, [identifier, identifier + "()"], function(err, results) {
            if (err)
                callback();
            callback({
                length: identifier.length,
                pos: pos,
                others: results,
                isGeneric: true
            });
        });
    });
};

module.exports.commitRename = function(doc, oldId, newName, isGeneric, callback) {
    if (!isGeneric)
        return callback();
    if (!lastSummary)
        return callback();
    var matchingDef = !!Object.keys(index.findEntries(lastSummary, newName)).length;
    callback(matchingDef && "Name '" + newName + "' is already used.");
};

function findEntries(doc, fullAst, pos, callback) {
    if (handler.language === "javascript") // optimization
        return callback();
    
    var docValue = doc.getValue();
    var line = doc.getLine(pos.row);
    var identifier = workerUtil.getIdentifier(line, pos.column);
    var prefix = workerUtil.getPrecedingIdentifier(line, pos.column);
    var realPos = { row: pos.row, column: pos.column - prefix.length };
    
    fileIndexer.analyzeCurrent(handler.path, docValue, fullAst, { service: "refactor" }, function(err, result) {
        if (err)
            console.log("[jsonalyzer] Warning: could not analyze " + handler.path + ": " + err);
        lastSummary = result;
        callback(realPos, identifier, index.hasEntries(result, identifier));
    });
    
}

});