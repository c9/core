/*
 * jsonalyzer JavaScript analysis plugin base class
 *
 * @copyright 2013, Ajax.org B.V.
 * @author Lennart Kats <lennart add c9.io>
 */
define(function(require, exports, module) {

var asyncForEach = require("plugins/c9.ide.language.core/worker").asyncForEach;
var workerUtil = require("plugins/c9.ide.language/worker_util");

// require child_process only if we're server-side
var child_process = typeof process === "undefined" || !process.version
    ? null
    : arguments[0]("child_process");

/**
 * The jsonalyzer analysis plugin base class.
 * 
 * @ignore Experimental.
 * 
 * @class language.jsonalyzer_base_handler
 */
module.exports = {

    // ABSTRACT MEMBERS

    /**
     * The languages this handler applies to,
     * e.g. ["php"].
     * 
     * Must be overridden by inheritors.
     */
    languages: [],
    
    /**
     * The extensions this handler applies to,
     * e.g. ["php"]. Used when the language
     * of a file cannot be determined.
     * 
     * Must be overridden by inheritors.
     */
    extensions: [],
    
    /**
     * The maximum interval between calls for server-side handlers,
     * e.g. 2000 to allow for a delay of maximally 2000ms between
     * two calls. Lower numbers put heavier load on the workspace.
     * 
     * May be overridden by server-side inheritors.
     * 
     * @see {@link #CALL_INTERVAL_MIN}   The suggested minimal value of 500ms.
     * @see {@link #CALL_INTERVAL_BASIC} The default value of 1200ms.
     */
    maxCallInterval: 2000,
    
    // CONSTANTS
    
    CALL_INTERVAL_MIN: 500,
    
    CALL_INTERVAL_BASIC: 1200,
    
    // ABSTRACT MEMBERS
    
    /**
     * Initializes this handler.
     * 
     * May be overridden by inheritors.
     *
     * @param {Object} options  The options passed while registering this handler.
     * @param {Function} callback
     * @param {String} callback.err
     */
    init: function(options, callback) {
        callback();
    },

    /**
     * Find all imports in a file.
     * Likely to be called each time analyzeCurrent is called.
     * 
     * May be overridden by inheritors.
     * 
     * @param {String} path
     * @param {String} value
     * @param {Object} ast                         The AST, if available
     * @param {Object} options
     * @param {String} options.service      The service this is triggered for, e.g. "complete" or "outline"
     * @param {String} options.isSave       Whether this has been triggered by a save
     * @param {Function} callback
     * @param {String} callback.err
     * @param {Object} callback.result
     */
    findImports: function(path, value, ast, options, callback) {
        callback();
    },
    
    /**
     * Analyze the current file.
     * 
     * Should be overridden by inheritors.
     * 
     * @param {String} path
     * @param {String} value
     * @param {Object} ast                  The AST, if available
     * @param {Object} options
     * @param {String} options.service      The service this is triggered for, e.g. "complete" or "outline"
     * @param {String} options.isSave       Whether this has been triggered by a save
     * @param {Function} callback
     * @param {String} callback.err
     * @param {Object} callback.indexEntry
     * @param {Object} callback.markers
     */
    analyzeCurrent: function(path, value, ast, options, callback) {
        callback();
    },
    
    /**
     * Analyze the other/imported files.
     * 
     * May be overridden by inheritors.
     * 
     * @param {String} paths
     * @param {Object} options
     * @param {Function} callback
     * @param {String[]} callback.errs
     * @param {String} callback.result
     */
    analyzeOthers: function(paths, options, callback) {
        callback();
    },
    
    /**
     * @internal Design to be revisited.
     */
    analyzeWorkspaceRoot: function(callback) {
        callback();
    },
    
    // UTILITY
    
    /**
     * Utility function to call analyzeCurrent on a list of paths.
     * 
     * Should not be overridden by inheritors.
     */
    analyzeCurrentAll: function(paths, options, callback) {
        var errs = [];
        var results = [];
        var _self = this;
        asyncForEach(
            paths,
            function(path, next) {
                workerUtil.readFile(path, { unsaved: true }, function(err, doc) {
                    if (err) {
                        errs.push(err);
                        results.push(null);
                        return next();
                    }
                    
                    _self.analyzeCurrent(path, doc, null, options, function(err, result) {
                        errs.push(err);
                        results.push(result);
                        next();
                    });
                });
            },
            function() {
                callback(errs, results);
            }
        );
    },
    
    /**
     * Invoke a linter using child_process.
     * Only available for server-side plugins.
     * 
     * As many linters return non-zero a exit code when errors are found,
     * this function does not return an err for non-zero exits.
     * It passes an additional argument originalErr for clients interested in those.
     * 
     * See {@link language.worker_util#execAnalysis} for invoking linters directly from a worker.
     * 
     * @param {String} linter
     * @param {String[]} args
     * @param {String} [stdin]
     * @param {Object} [options]
     * @param {String} [options.cwd]
     * @param {String} [options.maxBuffer]
     * @param {String} [options.timeout]
     * @param {Function} callback
     * @param {Object} callback.err
     * @param {String} callback.stdout
     * @param {String} callback.stderr
     * @param {Number} callback.originalErr
     */
    $lint: function(linter, args, stdin, options, callback) {
        var a = arguments;
        callback = a[4] || a[3] || a[2];
        options = typeof a[3] == "object" && a[3]
            || typeof a[2] == "object" && !(a[2] instanceof Buffer) && a[2];
        stdin = (typeof a[2] == "string" || a[2] instanceof Buffer) && a[2];

        if (!child_process)
            return callback(new Error("Only implemented for server-side plugins"));
        
        options = options || {};
        options.maxBuffer = options.maxBuffer || 200 * 1024;
        options.env = options.env || {};
        var PATH = options.env.PATH || this.defaultEnv && this.defaultEnv.PATH || process.env.PATH;
        options.env.PATH = process.platform === "linux"
            ? PATH + ":/mnt/shared/bin"
            : PATH;
        for (var key in process.env) {
            options.env[key] = options.env[key] != null ? options.env[key] : process.env[key];
        }
        
        try {
            var child = child_process.execFile(
                linter, args, options,
                function(err, stdout, stderr) {
                    if (err && ["ENOENT", "EACCES"].indexOf(err.code) > -1) {
                        err = new Error(err.code + ": No " + (linter === "bash" ? "linter" : linter) + " installation found");
                        err.code = "EFATAL";
                        return callback(err, stdout, stderr);
                    }
                    
                    callback(null, stdout, stderr, err);
                }
            );

            child.stdin.on("error", function(e) {
                // Ignore; execFile will handle process result
            });
    
            if (stdin)
                child.stdin.end(stdin);
        }
        catch (err) {
            // Out of memory or other fatal error?
            err.code = "EFATAL";
            callback(err);
        }
    }
};

});