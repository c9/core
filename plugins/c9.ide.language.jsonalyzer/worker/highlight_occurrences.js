/**
 * jsonalyzer jumptodef handler
 *
 * @copyright 2013, Ajax.org B.V.
 * @author Lennart Kats <lennart add c9.io>
 */
define(function(require, exports, module) {

var index = require("./semantic_index");
var handler;
var fileIndexer = require("./file_indexer");
var workerUtil = require("plugins/c9.ide.language/worker_util");

module.exports.init = function(_handler) {
    handler = _handler;
};

module.exports.highlightOccurrences = function(doc, fullAst, pos, options, callback) {
    var summary = index.get(handler.path);
    if (!summary)
        return callback(); // we're closed, come back later
        
    var line = doc.getLine(pos.row);
    var identifier = workerUtil.getIdentifier(line, pos.column);
    
    var entries = index.findEntries(summary, identifier);
    if (Object.keys(entries).length)
        return callback(getOccurrences(doc, pos, identifier, entries["_" + identifier]));
    
    var imports = index.getImports(handler.path);
    var others = index.getAny(imports);
    for (var i = 0; i < others.length; i++) {
        if (index.hasEntries(others[i], identifier))
            return callback(getOccurrences(doc, pos, identifier, []));
    }
    
    callback();
};

function getOccurrences(doc, pos, identifier, entryList) {
    var line = doc.getLine(pos.row);
    var prefix = workerUtil.getPrecedingIdentifier(line, pos.column);
    var realColumn = pos.column - prefix.length;
    
    var results = [{
        pos: {
            sl: pos.row,
            el: pos.row,
            sc: realColumn,
            ec: realColumn + identifier.length
        },
        type: "occurrence_other"
    }];
    
    var foundSelf = false;
    entryList.forEach(function(entry) {
        if (!entry.column) { // guess the column
            var entryLine = doc.getLine(entry.row);
            entry.column = entryLine.indexOf(identifier);
            if (entry.column < 0)
                return;
        }
        if (entry.row === pos.row && entry.column === realColumn)
            return foundSelf = true;
        results.push({
            pos: {
                sl: entry.row,
                el: entry.row,
                sc: entry.column,
                ec: entry.column + identifier.length
            },
            type: "occurrence_main"
        });
    });
    return { markers: foundSelf ? [] : results, isGeneric: true };
}

});
