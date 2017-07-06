/**
 * jsonalyzer directory indexer
 *
 * @copyright 2013, Ajax.org B.V.
 * @author Lennart Kats <lennart add c9.io>
 */
define(function(require, exports, module) {

var indexer = module.exports;
var index = require("./semantic_index");
var workerUtil = require("plugins/c9.ide.language/worker_util");
var handler;

var PARANOID_CHECK_INTERVAL = 60 * 1000;
var QUEUE_DELAY = 2000;
var PARANOID_CHECK_SET = [
    ".git/index",
    ".hg/dirstate",
    ".svn/.wc.db",
    "node_modules/*",
    "package.json"
];

var isJobActive = false;
var lastParanoidResult = "";
var queueTimer;
var queueCallbacks = [];
var queuePaths = [];

indexer.init = function(_handler) {
    handler = _handler;
    
    enqueue("/", false);
    
    // Since we can't fully rely on the watchers, we fire off
    // a paranoid check every so often to check for changes
    setInterval(function() {
        if (!queuePaths.length)
            enqueue("/", true);
    }, PARANOID_CHECK_INTERVAL);
};

var enqueue = indexer.enqueue = function(path, paranoid, callback) {
    callback && queueCallbacks.push(callback);
    queuePaths.push(path);
    
    if (queuePaths.indexOf("/") > -1)
        return; // we queued the world already
    
    // Changes to "/" are treated with paranoia:
    // we used to get spurious events about "/"
    if (paranoid === undefined && path === "/")
        paranoid = true;
    
    if (paranoid) {
        return isChangedParanoid(function(err, result) {
            if (err)
                return console.error("[jsonalyzer] directory_indexer err: " + err);
            enqueue(result ? path : "$$no-path$$", false);
        });
    }
    
    if (!queueTimer)
        queueTimer = setTimeout(consumeQueue);
};

var consumeQueue = indexer.$consumeQueue = function() {
    queueTimer = null;
    var myQueue = queuePaths;
    var myCallbacks = queueCallbacks;
    queuePaths = [];
    queueCallbacks = [];

    index.removeByPathPrefix(myQueue);
    
    workerUtil.asyncForEach(
        handler.getAllHandlers(),
        function(plugin, next) {
            plugin.analyzeWorkspaceRoot(next);
        },
        done
    );
    
    function done() {
        isJobActive = false;
        var callbacks = myCallbacks;
        myCallbacks = [];
        callbacks.forEach(function(callback) { callback(); });
    }
};

/**
 * Do a couple of quick file date/time comparisons to determine
 * if maybe the workspace changed.
 */
function isChangedParanoid(callback) {
    workerUtil.execFile(
        "bash",
        {
            args: [
                "-c",
                "ls -l"
                + " " + PARANOID_CHECK_SET.join(" ")
                + " `find . -maxdepth 1 -type d | grep -Ev '^\\./\\.c9|^\\.$' || echo ''`"
            ]
        },
        function(err, stdout) {
            if (err)
                return callback(err);
            if (lastParanoidResult === stdout)
                return callback(null, false);
            lastParanoidResult = stdout;
            return callback(null, true);
        }
    );
}

});
