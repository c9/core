/**
 * jsonalyzer JavaScript analysis plugin index
 *
 * @copyright 2013, Ajax.org B.V.
 * @author Lennart Kats <lennart add c9.io>
 */
define(function(require, exports, module) {

var handler /*: require("plugins/c9.ide.language.jsonalyzer/worker/jsonalyzer_worker")*/;
var scopeAnalyzer = require('plugins/c9.ide.language.javascript/scope_analyzer');
var workerUtil = require("plugins/c9.ide.language/worker_util");
var KIND_PACKAGE = scopeAnalyzer.KIND_PACKAGE;
var KIND_HIDDEN = scopeAnalyzer.KIND_HIDDEN;
var GC_INTERVAL = 5 * 60 * 1000;

var index = module.exports;

var analyzedFiles = {};
// var knownPathCache = {};
var pathGuids = {};
var accessedSinceGC = {};
var summaries = {};
var imports = {};
    
index.init = function(_handler) {
    handler = _handler;
    
    var _self = this;
    setInterval(function() {
        _self.gc();
    }, GC_INTERVAL);
};

/**
 * Get zero or more summaries matching given guids or paths.
 * 
 * @param {String} guidOrPaths
 */
index.getAny = function(guidsOrPaths) {
    return guidsOrPaths.map(index.get.bind(index)).filter(function(i) {
        return !!i;
    });
};

/**
 * Get a summary given a guid or file path.
 * 
 * @param {String} guidOrPath
 */
index.get = function(guidOrPath) {
    accessedSinceGC["_" + guidOrPath] = true;
    var guid = pathGuids["_" + guidOrPath];
    return guid ? summaries["_" + guid] : summaries["_" + guidOrPath];
};

/**
 * Get the imports of given a guid or file path.
 * 
 * @param {String} guidOrPath
 * @param {Boolean} excludeAnalyzed   Don't include imports that exist in the index
 */
index.getImports = function(guidOrPath, excludeAnalyzed) {
    accessedSinceGC["_" + guidOrPath] = true;
    var guid = pathGuids["_" + guidOrPath];
    var results = guid ? imports["_" + guid] : imports["_" + guidOrPath];
    if (!results)
        return [];
    if (excludeAnalyzed)
        results = results.filter(function(r) { return !index.get(r); });
    return results;
};

/**
 * Set a summary for file path.
 * 
 * @param {String} path
 * @param {String} guidPrefix
 * @param summary
 * @param {String[]} [pathImports]
 */
index.set = function(path, guidPrefix, summary, pathImports) {
    var guid = summary && summary.guid || guidPrefix + path;
    pathGuids["_" + path] = guid;
    if (summary) {
        summary.path = path;
        summaries["_" + guid] = summary;
    }
    if (pathImports)
        imports["_" + guid] = pathImports;
};

/**
 * Mark a summary for file path as broken.
 * 
 * @param {String} path
 * @param {String} [reason]
 */
index.setBroken = function(path, reason) {
    var guid = "broken:" + path;
    pathGuids["_" + path] = guid;
    summaries["_" + guid] = {
        broken: reason || "broken"
    };
    imports["_" + guid] = [];
};

/**
 * Flatten index entries into a single associative object.
 *
 * @param summary
 * @return {Object}
 */
index.flattenSummary = function(summary, result) {
    if (!summary)
        return {};
    result = result || {};
    
    var that = this;
    if (Array.isArray(summary)) {
        summary.forEach(function(e) { that.flattenSummary(e, result);});
        return result;
    }
    if (!summary || !summary.properties)
        return result;
    
    for (var p in summary.properties) {
        if (!result[p])
            result[p] = summary.properties[p];
        else
            result[p] = result[p].concat(summary.properties[p]);
        this.flattenSummary(summary.properties[p], result);
    }
    
    return result;
};

/**
 * Find entries in a summary that match a given name,
 * and return them as an associative object.
 * 
 * @param summary
 * @param {String} entry
 * @param {Boolean matchByPrefix  Use prefix matching to find entries
 * @return {Object}
 */
index.findEntries = function(summary, entry, matchByPrefix, dontFindAll) {
    function findUnderscoreEntries(properties, uentry) {
        if (!matchByPrefix && properties[uentry]) {
            result[uentry] = (result[uentry] || []).concat(properties[uentry]);
            if (dontFindAll)
                return;
        }
        
        for (var p in properties) {
            if (matchByPrefix && p.indexOf(uentry) === 0) {
                result[p] = (result[p] || []).concat(properties[p]);
                if (dontFindAll)
                    return;
            }
            if (!properties[p].properties)
                continue;
            findUnderscoreEntries(properties[p].properties, uentry);
        }
    }
    
    if (!summary.properties)
        return {};
    if (entry === "" && matchByPrefix)
        return this.flattenSummary(summary);
        
    var result = {};
    findUnderscoreEntries(summary.properties, "_" + entry);
    return result;
};

index.hasEntries = function(summary, entry, matchByPrefix) {
    return !!Object.keys(this.findEntries(summary, entry, matchByPrefix, true)).length;
};

index.removeByPath = function(path) {
    var guid = pathGuids["_" + path];
    if (!guid)
        return;

    delete analyzedFiles["_" + path];
    delete pathGuids["_" + guid];
    delete summaries[guid];
};

index.removeByPathPrefix = function(pathPrefixes) {
    for (var upath in pathGuids) {
        var matches = pathPrefixes.filter(function(p) {
            return upath.indexOf(p) === 1;
        });
        if (matches.length === 0)
            continue;
        
        var uguid = "_" + pathGuids[upath];
        delete summaries[uguid];
        delete imports[uguid];
        delete pathGuids[upath];
    }
};
    
/**
 * Garbage collect the index. Called automatically in an interval.
 * @internal
 */
index.gc = function() {
    var openFiles = workerUtil.getOpenFiles();
    for (var upath in pathGuids) {
        var guid = pathGuids[upath];
        
        if (accessedSinceGC[upath])
            continue;
        if (accessedSinceGC["_" + guid] || openFiles.indexOf(upath.substr(1)) > -1)
            continue;
        
        delete pathGuids[upath];
        delete summaries["_" + guid];
        delete imports["_" + guid];
    }
    accessedSinceGC = {};
};

index.clear = function() {
    pathGuids = {};
    summaries = {};
    imports = {};
    accessedSinceGC = {};
};

index.markStale = function(handler) {
    if (!handler)
        return;
    for (s in summaries) {
        if (summaries[s].handler === handler)
            summaries[s].stale = true;
    }
};

index.$clearAccessedSinceGC = function() {
    accessedSinceGC = {};
};

});