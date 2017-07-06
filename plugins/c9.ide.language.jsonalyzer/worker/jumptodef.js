/**
 * jsonalyzer jumptodef handler
 *
 * @copyright 2013, Ajax.org B.V.
 * @author Lennart Kats <lennart add c9.io>
 */
define(function(require, exports, module) {

var index = require("./semantic_index");
var handler;
var worker = require("plugins/c9.ide.language.core/worker");
var fileIndexer = require("./file_indexer");
var workerUtil = require("plugins/c9.ide.language/worker_util");

module.exports.init = function(_handler) {
    handler = _handler;
};

module.exports.jumpToDefinition = function(doc, fullAst, pos, options, callback) {
    var line = doc.getLine(pos.row);
    var docValue = doc.getValue();
    var identifier = workerUtil.getIdentifier(line, pos.column);

    // We don't specify an editor service here, so we bypass caching mechanisms
    var indexOptions = {};
    var that = this;
    fileIndexer.analyzeCurrent(handler.path, docValue, fullAst, indexOptions, function(err, summary, imports) {
        if (err) {
            if (err.code === "ESUPERSEDED")
                return that.jumpToDefinition(doc, fullAst, pos, options, callback);
            console.error(err);
            return callback(); // can't pass error to this callback
        }

        // Before we use summaries, we'll actually first try to get an outline;
        // that may come from us (after caching above), or it may come from
        // some other outliner.
        worker.$lastWorker.getOutline(function(outline) {
            var results = [];
            if (outline && outline.items)
                results = findInOutline(outline.items, identifier);

            // Maybe we can get it from the summary instead of the outline
            if (!results.length)
                results = findInSummaries([summary], identifier, results);

            // We only actually download & analyze new files if really needed
            var needAllImports = !results.length;
            if (needAllImports)
                fileIndexer.analyzeOthers(imports, needAllImports, done);
            else
                done();
            
            function done() {
                var summaries = index.getAny(imports);
                results = findInSummaries(summaries, identifier, results);
                if (doc.region)
                    results.forEach(function(result) {
                        result.row -= doc.region.sl;
                    });
                callback(results);
            }
        });
    });
};

function findInSummaries(summaries, identifier, results) {
    summaries.forEach(function(summary) {
        var entries = index.findEntries(summary, identifier);
        for (var uname in entries) {
            entries[uname].forEach(function(entry) {
                results.push({
                    row: entry.row,
                    column: entry.column,
                    path: summary.path,
                    icon: entry.icon
                        || entry.kind === "package" && "package"
                        || entry.kind === "event" && "event"
                        || "unknown2",
                    isGeneric: true
                });
            });
        }
    });
    return results;
}

function isNameMatch(identifier, indexName) {
    // Match name from outline, considering index names like foo.bar or foo()
    return identifier === indexName
        || indexName.replace && identifier === indexName.replace(/(.*\.)?([^.]*?)(\([^\]]*\))?$/, "$2");
}

function findInOutline(outline, identifier, results) {
    if (!results)
        results = [];
    for (var i = 0; i < outline.length; i++) {
        if (isNameMatch(identifier, outline[i].name)) {
            results.push({
                row: outline[i].pos.sl,
                column: outline[i].pos.sc,
                icon: outline[i].icon,
                isGeneric: true
            });
        }
        if (outline[i].items)
            findInOutline(outline[i].items, identifier, results);
    }
    return results;
}

function getPropertyName(node) {
    var result;
    node.rewrite(
        'PropAccess(o, p)', function(b) {
            result = b.p.value; 
        }
    );
    return result;
}

});
