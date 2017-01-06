/*
 * Cloud9 Language Foundation
 *
 * @copyright 2013, Ajax.org B.V.
 */
 
/**
 * Language handler utilities. These may only be used from within
 * a language handler, which runs in a web worker.
 * 
 * Import using
 * 
 *     require("plugins/c9.ide.language/worker_util")
 * 
 * See {@link language}
 * 
 * @class language.worker_util
 */
define(function(require, exports, module) {

var worker = require("plugins/c9.ide.language.core/worker");
var completeUtil = require("./complete_util");

var MAX_MEMO_DICT_SIZE = 3000;
var msgId = 0;
var docCache = { row: null, entries: {}};

module.exports = {

    /**
     * Utility function, used to determine whether a certain feature is enabled
     * in the user's preferences.
     * 
     * @param {String} name  The name of the feature, e.g. "unusedFunctionArgs"
     * @return {Boolean}
     */
    isFeatureEnabled: function(name) {
        /*global disabledFeatures*/
        return !disabledFeatures[name];
    },
    
    /**
     * Utility function, used to determine the identifier regex for the 
     * current language, by invoking {@link #getIdentifierRegex} on its handlers.
     * 
     * @param {Object} [offset] The position to determine the identifier regex of
     * @return {RegExp}
     */
    getIdentifierRegex: function(offset) {
        return worker.$lastWorker.getIdentifierRegex(offset);
    },
    
    /**
     * Utility function, used to retrigger completion,
     * in case new information was collected and should
     * be displayed, and assuming the popup is still open.
     * 
     * @param {Object} pos   The position to retrigger this update
     * @param {String} line  The line that this update was triggered for
     */
    completeUpdate: function(pos, line) {
        return worker.$lastWorker.completeUpdate(pos, line);
    },
    
    /**
     * Calls {@link proc#execFile} from the worker, invoking an executable
     * on the current user's workspace.
     * 
     * See {@link language.worker_util#execAnalysis} for invoking tools like linters and code completers.
     * 
     * @param {String}   path                             The path to the file to execute
     * @param {Object}   [options]
     * @param {String[]} [options.args]                An array of args to pass to the executable.
     * @param {String}   [options.stdoutEncoding="utf8"]  The encoding to use on the stdout stream. Defaults to .
     * @param {String}   [options.stderrEncoding="utf8"]  The encoding to use on the stderr stream. Defaults to "utf8".
     * @param {String}   [options.cwd]                    Current working directory of the child process
     * @param {Array}    [options.stdio]                  Child's stdio configuration. (See above)
     * @param {Object}   [options.env]                    Environment key-value pairs
     * @param {String}   [options.encoding="utf8"]        
     * @param {Number}   [options.timeout=0]         
     * @param {Number}   [options.maxBuffer=200*1024]
     * @param {String}   [options.killSignal="SIGTERM"]
     * @param {Boolean}  [options.resumeStdin]            Start reading from stdin, so the process doesn't exit
     * @param {Boolean}  [options.resolve]                Resolve the path to the VFS root before executing file
     * @param {Function} [callback]
     * @param {Error}    callback.error                   The error object if an error occurred.
     * @param {String}   callback.stdout                  The stdout buffer
     * @param {String}   callback.stderr                  The stderr buffer
     */
    execFile: function(path, options, callback) {
        if (typeof options === "function")
            return this.execFile(path, {}, arguments[1]);
        
        var id = msgId++;
        worker.sender.emit("execFile", { path: path, options: options, id: id });
        worker.sender.on("execFileResult", function onExecFileResult(event) {
            if (event.data.id !== id)
                return;
            worker.sender.off("execFileResult", onExecFileResult);
            callback && callback(event.data.err, event.data.stdout, event.data.stderr);
        });
    },
    
                
    /**
     * Spawns a child process.
     * 
     * Example:
     * 
     *     proc.spawn("ls", function(err, process) {
     *         if (err) throw err;
     * 
     *         process.stdout.on("data", function(chunk) {
     *             console.log(chunk); 
     *         });
     *     });
     * 
     * @param {String}   path                             the path to the file to execute
     * @param {Object}   [options]
     * @param {Array}    [options.args]                   An array of args to pass to the executable.
     * @param {String}   [options.stdoutEncoding="utf8"]  The encoding to use on the stdout stream.
     * @param {String}   [options.stderrEncoding="utf8"]  The encoding to use on the stderr stream.
     * @param {String}   [options.cwd]                    Current working directory of the child process
     * @param {Object}   [options.stdio]                  Child's stdio configuration. 
     * @param {Object}   [options.env]                    Environment key-value pairs
     * @param {Boolean}  [options.detached]               The child will be a process group leader. (See below)
     * @param {Number}   [options.uid]                    Sets the user identity of the process. (See setuid(2).)
     * @param {Number}   [options.gid]                    Sets the group identity of the process. (See setgid(2).)
     * @param {Boolean}  [options.resumeStdin]            Start reading from stdin, so the process doesn't exit
     * @param {Boolean}  [options.resolve]                Resolve the path to the VFS root before spawning process
     * @param {Function} callback
     * @param {Error}    callback.err                     The error object if one has occured.
     * @param {proc.Process}  callback.result             A descriptor for the child process.
     * @param {Number} callback.result.pid                The PID of the child.
     * @param {Function} callback.result.kill             Kill the child.
     * @param {String} [callback.result.kill.signal]      Signal to kill the child with.
     * @param {Function} callback.result.on               Listen to standard "exit", "error", "close", "disconnect", "message"
     *                                                    child process events.
     * @param {Object} callback.result.stdout
     * @param {Function} callback.result.stdout.on        Listen to standard "close", "data", "end", "error", "readable"
     *                                                    child process events.
     * @param {Object} callback.result.stderr
     * @param {Function} callback.result.stderr.on        Listen to standard "close", "data", "end", "error", "readable"
     *                                                    child process events.
     */
    spawn: function(path, options, callback) {
        if (typeof options === "function")
            return this.execFile(path, {}, arguments[1]);
        
        var id = msgId++;
        worker.sender.emit("spawn", { path: path, options: options, id: id });
        worker.sender.on("spawnResult", function onSpawnResult(event) {
            if (event.data.id !== id)
                return;
            worker.sender.off("spawnResult", onSpawnResult);
            callback && callback(event.data.err, {
                stdout: { on: listen.bind(null, "stdout") },
                stderr: { on: listen.bind(null, "stderr") },
                on: listen.bind(null, "child"),
                kill: function(signal) {
                    worker.sender.emit("spawn_kill$" + id, { signal: signal });
                }
            });
            
            function listen(sourceName, event, listener) {
                worker.sender.on("spawnEvent$" + id + sourceName + event, function(e) {
                    listener(e.data);
                });
                worker.sender.on("spawnEvent$" + id + "childexit", function gc() {
                    setTimeout(function() {
                        worker.sender.off("spawnEvent$" + id + sourceName + event, listener);
                        worker.sender.off("spawnEvent$" + id + "childexit", gc);
                    });
                });
            }
        });
    },
    
    /**
     * Invoke an analysis tool on the current user's workspace,
     * such as a linter or code completion tool. Passes the
     * unsaved contents of the current file via stdin or using
     * a temporary file.
     * 
     * Latency of this function is determined by performance
     * of the server-side analyzer, ping times to the server,
     * and the message size.
     * 
     * Message sizes over a few kilobytes are often more
     * significant to latency than ping times. We gzip all messages,
     * and do an additional optimization when messages in JSON
     * format are used. JSON strings are packed using hash consing
     * and memoization to improve latency. Use options.json to
     * return JSON instead of strings for stdout and stderr.
     * 
     * Using stdin generally performs best and is used by default.
     * To use a temporary file instead, use the `mode` option
     * and use `$FILE` in `options.args` to get the name of
     * the temporary file.
     * 
     * Example:
     * 
     * ```
     * execAnalysis(
     *     "bash",
     *     {
     *         args: ["-n", "$FILE"],
     *         mode: "stdin"
     *     },
     *     function(err, stdout, stderr) {
     *         console.log("Bash linting results:", stderr);
     *     }
     * )
     * ```
     * 
     * This function uses collab to efficiently pass any unsaved contents
     * of the current file to the server.
     * 
     * @param {String} command                  The path to the file to execute.
     * @param {Object} [options]
     * @param {String[]} [options.args]         An array of args to pass to the executable.
     *                                          Use "$FILE" anywhere to get the path of the temporary file,
     *                                          if applicable.
     * @param {"stdin"|"tempfile"|"local-tempfile"} [options.mode="stdin"]
     *                                          Pass the unsaved contents of the current file using std, a temporary
     *                                          file, or a temporary file placed in options.cwd.
     * @param {String} [options.path]           The path to the file to analyze (defaults to the current file),
     *                                          relative to the workspace.
     * @param {String} [options.cwd]            The working directory for the command (defaults to the path of the current file),
     *                                          either relative to the root (when starting with a /) or to the workspace.
     * @param {Number} [options.timeout]        Timeout in milliseconds for requests. Default 30000.
     * @param {Boolean} [options.json]          Convert stdout and stderr to JSON when possible.
     * @param {Number} [options.maxBuffer=200*1024]
     * @param {String} [options.semaphore]      A unique string identifying this analyzer, making sure only one
     *                                          instance runs at a time. Defaults to a concatenation of 'command'
     *                                          and the current language name. Can be null to allow multiple
     *                                          instances in parallel.
     * @param {Number} [options.maxCallInterval=50]
     *                                          The maximum interval between calls for server-side handlers,
     *                                          e.g. 2000 to allow for a delay of maximally 2000ms between
     *                                          two calls. Lower numbers put heavier load on the workspace.
     * @param {Function} callback
     * @param {Error}    callback.error         The error object if an error occurred.
     * @param {String}   callback.stdout        The stdout buffer.
     * @param {String}   callback.stderr        The stderr buffer.
     */
    execAnalysis: function(command, options, callback) {
        if (typeof options === "function")
            return this.execAnalysis(command, {}, arguments[1]);
        
        var myWorker = worker.$lastWorker;
        options.command = command;
        options.path = options.path || (myWorker.$path && myWorker.$path[0] === "/" ? myWorker.$path.substr(1) : myWorker.$path);
        options.cwd = options.cwd || getRelativeDirname(options.path);
        options.maxBuffer = options.maxBuffer || 200 * 1024;
        var maxCallInterval = options.maxCallInterval || 50;
        if (myWorker.$overrideLine) {
            // Special handling for completion predictions
            maxCallInterval = 0;
            options.overrideLineRow = myWorker.$lastCompleteRow;
            options.overrideLine = options.overrideLine || myWorker.$overrideLine;
        }
        else {
            // Ensure high fidelity for current line, which may have changed in the UI
            options.overrideLineRow = myWorker.$lastCompleteRow;
            options.overrideLine = options.overrideLine || myWorker.doc.getLine(options.overrideLineRow);
        }
        if (options.path && options.path[0] === "/")
            return callback(new Error("Only workspace-relative paths are supported"));
            
        // The jsonalyzer has a nice pipeline for invoking tools like this;
        // let's use that to pass the unsaved contents via the collab bus.
        var id = msgId++;
        worker.sender.emit("jsonalyzerCallServer", {
            id: id,
            handlerPath: "plugins/c9.ide.language.jsonalyzer/server/invoke_helper",
            method: "invoke",
            filePath: options.path && (options.path[0] === "~" ? options.path : "/" + options.path),
            maxCallInterval: maxCallInterval,
            timeout: options.timeout || 30000,
            semaphore: "semaphore" in options
                ? options.semaphore
                : command + "|" + myWorker.$language,
            args: [options.path, null, null, options]
        });
        worker.sender.on("jsonalyzerCallServerResult", function onResult(event) {
            if (event.data.id !== id)
                return;
            worker.sender.off("jsonalyzerCallServerResult", onResult);
            var stdout = tryParseJSON(event.data.result[1]);
            var stderr = tryParseJSON(event.data.result[2]);
            callback(event.data.result[0], stdout, stderr, {
                serverTime: event.data.result[3],
            });
        });
        
        function getRelativeDirname(file) {
            return file && file.replace(/([\/\\]|^)[^\/\\]+$/, "").replace(/^\//, "");
        }
        
        function tryParseJSON(string) {
            try {
                return options.json ? JSON.parse(string) : string;
            }
            catch (e) {
                return string;
            }
        }
    },
    
    /**
     * Reads the entire contents from a file in the workspace,
     * using {@link fs#readFile}. May use a cached version if the file
     * is currently open in the IDE.
     * 
     * Example:
     * 
     *     worker_util.readFile('/config/server.js', function (err, data) {
     *         if (err) throw err;
     *         console.log(data);
     *     });
     *
     * @method
     * 
     * @param {String}   path               the path of the file to read
     * @param {Object}   [options]          options or encoding of this file
     * @param {String}   [options.encoding] the encoding of this file
     * @param {Boolean}  [options.allowUnsaved]
     *                                      whether to return unsaved changes
     * @param {Function} [callback]         called after the file is read
     * @param {Error}    callback.err       the error information returned by the operation
     * @param {String}   callback.data      the contents of the file that was read
     * @fires error
     * @fires downloadProgress
     */
    readFile: function(path, options, callback) {
        if (!callback) { // fix arguments
            callback = options;
            options = null;
        }
        
        if (worker.$lastWorker.$path === path) {
            callback && setTimeout(callback.bind(null, null, worker.$lastWorker.doc.getValue()), 0);
            return;
        }
        
        if (path.match(/\/$/) || path === ".") { // fail fast
            var err = new Error("File is a directory");
            err.code = "EISDIR";
            return callback(err);
        }
        
        var id = msgId++;
        worker.sender.on("readFileResult", function onReadFileResult(event) {
            if (event.data.id !== id)
                return;
            worker.sender.off("readFileResult", onReadFileResult);
            callback && callback(event.data.err && JSON.parse(event.data.err), event.data.data);
        });
        worker.sender.emit("readFile", { path: path, options: options, id: id });
    },
    
    /**
     * Loads the stat information for a single path entity.
     *
     * @param {String}   path      the path of the file or directory to stat
     * @param {Function} callback  called after the information is retrieved
     * @param {Error}    callback.err  
     * @param {Object}   callback.data 
     * @param {String}   callback.data.name      The basename of the file path (eg: file.txt).
     * @param {Number}   callback.data.size      The size of the entity in bytes.
     * @param {Number}   callback.data.mtime     The mtime of the file in ms since epoch.
     * @param {Number}   callback.data.mime      The mime type of the entity. 
     *   Directories will have a mime that matches /(folder|directory)$/. 
     *   This implementation will give inode/directory for directories.
     * @param {String}   callback.data.link      If the file is a symlink, 
     *   this property will contain the link data as a string.
     * @param {Object}   callback.data.linkStat  The stat information 
     *   for what the link points to.
     * @param {String}   callback.data.fullPath  The linkStat object 
     *   will have an additional property that's the resolved path relative to the root.
     * @fires error
     */
   stat: function(path, callback) {
        var id = msgId++;
        worker.sender.on("statResult", function onReadFileResult(event) {
            if (event.data.id !== id)
                return;
            worker.sender.off("statResult", onReadFileResult);
            callback && callback(event.data.err && JSON.parse(event.data.err), event.data.data);
        });
        worker.sender.emit("stat", { path: path, id: id });
    },
    
    /**
     * Prettify JavaDoc/JSDoc-like documentation strings to HTML.
     */
    filterDocumentation: function(doc) {
        // We prettify doc strings here since we don't have a nice
        // system for it elsewhere that does it on demand.
        // For now this kinda works and is pretty fast.
        
        if (docCache.entries["_" + doc])
            return docCache.entries["_" + doc];
            
        // Garbage collect cache
        var lastRow = worker.$lastWorker.$lastCompleteRow;
        if (docCache.row !== lastRow)
            docCache.entries = {};
        docCache.row = lastRow;
        
        var result = escapeHtml(doc)
            .replace(/(\n|^)[ \t]*\*+[ \t]*/g, "\n")
            .trim()
            // Initial newline before first parameter
            .replace(/@(param|public|private|platform|event|method|function|class|constructor|fires?|throws?|returns?|internal|ignore)/, "<br/>@$1")
            // .replace(/\n@(\w+)/, "<br/>\n@$1")
            // Paragraphs
            .replace(/\n\n(?!@)/g, "<br/><br/>")
            .replace(/@(param|public|private|platform|event|method|function|class|constructor|fires?|throws?|returns?|internal|ignore) ({[\w\.]+} )?(\[?[\w\.]+\]?)/g, "<br><b>@$1</b> <i>$2$3</i>&nbsp;")
            .replace(/\n@(\w+)/g, "<br/>\n<b>@$1</b>")
            .replace(/&lt;(\/?)code&gt;/g, "<$1tt>")
            .replace(/&lt;(\/?)(b|i|em|br|a) ?\/?&gt;/g, "<$1$2>")
            .replace(/&lt;(a\s+(target=('|&quot;)[^"'&]*('|&quot;)\s+)?href=('|&quot;)(https?:\/\/|#)[^"'&]*('|&quot;)\s*(target=('|&quot;)[^"'&]*('|&quot;)\s*)?)&gt;/g, '<$1 target="_docs">');
        docCache.entries["_" + doc] = result;
        return result;

        function escapeHtml(str) {
            return str
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;");
        }
    },

    /**
     * Show an error popup in the IDE, using dialog.error.
     * 
     * @param {String} message
     * @param {Number} [timeout]
     * @return {Object} result
     * @return {Function} result.hide   Hide the popup again
     */
    showError: function(message, timeout, info) {
        if (message.stack) {
            // Can't pass error object to UI
            console.error(message.stack);
            message = message.message;
        }
        var id = msgId++;
        var token;
        worker.sender.once("showErrorResult", function onResult(e) {
            token = e.token;
        });
        worker.sender.emit("showError", { message: message, timeout: timeout, id: id, info: info });
        return {
            hide: function hide() {
                if (token)
                    return worker.sender.emit("showError", { token: token });
                setTimeout(hide, 50);
            }
        };
    },

    /**
     * Show an info popup in the IDE, using dialog.info.
     * 
     * @param {String} message
     * @param {Number} [timeout]
     * @return {Object} result
     * @return {Function} result.hide   Hide the popup again
     */
    showInfo: function(message, timeout) {
        return this.showError(message, timeout, true);
    },
    
    /**
     * @ignore
     */
    asyncForEach: function(array, fn, callback) {
        worker.asyncForEach(array, fn, callback);
    },
    
    /**
     * Get a list of the current open files.
     * 
     * @return {String[]}
     */
    getOpenFiles: function() {
        var results = [];
        var set = worker.$lastWorker.$openDocuments;
        Object.keys(set).forEach(function(e) {
            results.push(set[e]);
        });
        return results;
    },
    
    
    /**
     * Refresh all language markers in open editors.
     */
    refreshAllMarkers: function() {
        worker.sender.emit("refreshAllMarkers");
    },
    
    /**
     * Gets the identifier string preceding the current position.
     * 
     * @param {String} line     The line to search in
     * @param {Number} offset   The offset to start
     * @param {RegExp} [regex]  The regular expression to use
     * @return {String}
     */
    getPrecedingIdentifier: function(line, offset, regex) {
        regex = regex || this.getIdentifierRegex(offset);
        return completeUtil.retrievePrecedingIdentifier(line, offset, regex);
    },
    
    /**
     * Retrieves the identifier string following the current position.
     * 
     * @param {String} line     The line to search in
     * @param {Number} offset   The offset to start
     * @param {RegExp} [regex]  The regular expression to use
     * @return {String}
     */
    getFollowingIdentifier: function(line, offset, regex) {
        regex = regex || this.getIdentifierRegex(offset);
        return completeUtil.retrieveFollowingIdentifier(line, offset, regex);
    },
    
    /**
     * Retrieves the identifier string at the current position.
     * 
     * @param {String} line     The line to search in
     * @param {Number} offset   The offset to start
     * @param {RegExp} [regex]  The regular expression to use
     * @return {String}
     */
    getIdentifier: function(line, offset, regex) {
        regex = regex || this.getIdentifierRegex(offset);
        return this.getPrecedingIdentifier(line, offset, regex)
            + this.getFollowingIdentifier(line, offset, regex);
    },
    
    /**
     * Gets all (matching) tokens for the current file.
     *
     * @param {Document} doc              The current document
     * @param {String[]} identifiers      If not null, only return tokens equal to one of these strings
     * @param {Function} callback
     * @param {String} callback.err
     * @param {Object[]} callback.result
     */
    getTokens: function(doc, identifiers, callback) {
        var id = msgId++;
        worker.sender.emit("getTokens", {
            path: worker.$lastWorker.$path,
            identifiers: identifiers,
            id: id,
            region: doc.region
        });
        worker.sender.on("getTokensResult", function onResult(event) {
            if (event.data.id !== id)
                return;
            worker.sender.off("getTokensResult", onResult);
            callback(event.data.err, event.data.results);
        });
    },
    
    getQuickfixKey: function() {
        return worker.$lastWorker.$keys.quickfix;
    },
    
    /**
     * Watch a directory for changes.
     * @internal
     * @ignore
     */
    $watchDir: function(path, plugin) {
        worker.sender.emit("watchDir", { path: path });
    },
    
    /**
     * Unwatch a directory watched for changes.
     * @internal
     * @ignore
     */
    $unwatchDir: function(path, plugin) {
        worker.sender.emit("watchDir", { path: path });
    },
    
    /**
     * Get notified when a watched directory changes.
     * @internal
     * @ignore
     */
    $onWatchDirChange: function(listener) {
        // TODO: remove { data: ... } container when making this public
        worker.sender.on("watchDirResult", listener);
    },
    
    /**
     * Stop getting notified when a watched directory changes.
     * @internal
     * @ignore
     */
    $offWatchDirChange: function(listener) {
        worker.sender.off("watchDirResult", listener);
    }
};

});