/**
 * jsonalyzer file indexer
 *
 * @copyright 2013, Ajax.org B.V.
 * @author Lennart Kats <lennart add c9.io>
 */
define(function(require, exports, module) {

var indexer = module.exports;
var index = require("./semantic_index");
var languageWorker = require("plugins/c9.ide.language.core/worker");
var workerUtil = require("plugins/c9.ide.language/worker_util");
var assert = require("c9/assert");
var worker;

var QUEUE_DELAY = 5 * 1000;
var QUEUE_MAX_TIME = 120 * 1000;

var queueSet = {};
var queueTimer;
var queueWatcher;
var isJobActive = false;
var queueCallbacks = [];
var lastPath;
var lastDocValue;

indexer.init = function(_worker) {
    worker = _worker;
};

/**
 * Analyze a single file.
 * Check with the index first whether analysis is required.
 * 
 * @param {String} path
 * @param {String} docValue
 * @param {Object} ast                  The AST, if available
 * @param {Object} options
 * @param {String} options.service      The service this is triggered for, e.g. "complete" or "outline"
 * @param {Function} callback
 * @param {String} callback.err
 * @param {Object} callback.result
 */
indexer.analyzeCurrent = function(path, docValue, ast, options, callback) {
    var entry = index.get(path);
    
    // Allow using cached entry when a new job is scheduled anyway
    if (entry && !entry.stale &&
        (languageWorker.$lastWorker.updateScheduled || languageWorker.$lastWorker.updateAgain)) {
        entry.stale = true; // only do this once
        return callback(null, entry, index.getImports(path), entry.markers);
    }
    
    // Allow using cached entry when we just did this one
    if (entry && !entry.stale && path === lastPath && docValue === lastDocValue)
        return callback(null, entry, index.getImports(path), entry.markers);
    
    lastPath = path;
    lastDocValue = docValue;
    
    var language = worker.language;
    var plugin = worker.getHandlerFor(path, language);
    options.language = language;
    
    var watcher = setTimeout(function() {
        console.log("Warning: did not receive a response for 20 seconds from " + plugin.$source);
    }, 20000);
    return plugin.analyzeCurrent(path, docValue, ast, options, function(err, indexEntry, markers) {
        clearTimeout(watcher);
        if (err) {
            index.setBroken(path, err);
            return callback(err);
        }
        assert(indexEntry || markers, "jsonalyzer handler must return a summary and/or markers");
        
        indexEntry = indexEntry || index.get(path) || {};
        markers = indexEntry.markers = indexEntry.markers || markers;
        indexEntry.handler = plugin;
        
        if (!options.service) {
            // Only cache summaries for non-editor-service analysis;
            // e.g. don't do it when we only requested an outline
            index.set(path, plugin.guidName + ":", indexEntry);
        }
        else {
            var oldEntry = index.get(path);
            if (oldEntry)
                oldEntry.stale = true;
        }
        
        plugin.findImports(path, docValue, ast, options, function(err, imports) {
            if (err) {
                console.error("[jsonalyzer] error finding imports for " + path + ": " + err);
                imports = [];
            }
            imports = (imports || []).filter(function(i) {
                // Don't return self or unanalyzeable imports
                return i !== path;
            });
            index.set(path, plugin.guidName + ":", null, imports);
            callback(null, indexEntry, imports, markers);
        });
    });
};

/**
 * Enqueue unanalyzed files for analysis.
 * Check with the index first whether analysis is required.
 * 
 * @param {String[]} paths
 * @param {Boolean} [now]
 * @param {Function} callback  The callback; check with the index for results
 */
var enqueue = indexer.analyzeOthers = function(paths, now, callback) {
    if (callback)
        queueCallbacks.push(callback);
    
    for (var i = 0; i < paths.length; i++) {
        queueSet["_" + paths[i]] = paths[i];
    }
    
    if (now)
        return consumeQueue();
    
    if (!queueTimer)
        queueTimer = setTimeout(consumeQueue, QUEUE_DELAY);
};

function consumeQueue() {
    queueTimer = null;
    if (isJobActive)
        return;
    isJobActive = true;
    updateQueueWatcher();
    
    var paths = [];
    for (var item in queueSet) {
        if (index.get(queueSet[item]))
            continue;
        paths.push(queueSet[item]);
    }
    queueSet = {};
    
    var pathsPerPlugin = {};
    for (var i = 0; i < paths.length; i++) {
        var plugin = worker.getHandlerFor(paths[i]);
        if (!plugin) // path added when not fully initialized yet
            continue;
        if (!pathsPerPlugin[plugin.guidName]) {
            pathsPerPlugin[plugin.guidName] = {
                plugin: plugin,
                paths: []
            };
        }
        pathsPerPlugin[plugin.guidName].paths.push(paths[i]);
    }
    
    workerUtil.asyncForEach(
        Object.keys(pathsPerPlugin),
        function(guidName, next) {
            var task = pathsPerPlugin[guidName];
            
            // Make sure we haven't analyzed these yet
            task.paths = task.paths.filter(function(path) {
                var entry = index.get(path);
                return !entry || entry.stale;
            });
                 
            task.plugin.analyzeOthers(task.paths, {}, function(errs, results) {
                assert(!errs || Array.isArray(errs));
                updateQueueWatcher();
                
                if (!results)
                    return next();
                
                // Help debuggers
                var pathsCopy = task.paths.slice();
                var resultsCopy = (results || []).slice();
                var errsCopy = (errs || []).slice();
                
                while (pathsCopy.length) {
                    var err = errsCopy.pop();
                    var path = pathsCopy.pop();
                    var result = resultsCopy.pop();
                    if (err) {
                        index.setBroken(path, err);
                        console.log("[jsonalyzer] Warning: failed to import " + path + ": " + err);
                        continue;
                    }
                    assert(result);
                    result.handler = task.plugin;
                    index.set(path, guidName + ":", result);
                }
                
                next();
            });
        },
        done
    );
    
    function done() {
        isJobActive = false;
        clearTimeout(queueWatcher);
        var callbacks = queueCallbacks;
        queueCallbacks = [];
        callbacks.forEach(function(callback) { callback(); });
    }
    
    function updateQueueWatcher() {
        clearTimeout(queueWatcher);
        queueWatcher = setTimeout(function() {
            isJobActive = false;
            console.error("Warning: file_indexer plugin timeout, restarting");
            consumeQueue();
        }, QUEUE_MAX_TIME);
    }
}

});

