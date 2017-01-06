/*
 * Cloud9 Language Foundation
 *
 * @copyright 2013, Ajax.org B.V.
 */
define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "c9", "language", "proc", "fs", "tabManager", "save",
        "watcher", "tree", "dialog.error", "dialog.info"
    ];
    main.provides = ["language.worker_util_helper"];
    return main;

    function main(options, imports, register) {
        var c9 = imports.c9;
        var Plugin = imports.Plugin;
        var plugin = new Plugin("Ajax.org", main.consumes);
        var language = imports.language;
        var proc = imports.proc;
        var fs = imports.fs;
        var tabs = imports.tabManager;
        var save = imports.save;
        var watcher = imports.watcher;
        var tree = imports.tree;
        var showError = imports["dialog.error"].show;
        var showInfo = imports["dialog.info"].show;
        var hideError = imports["dialog.error"].hide;
        var async = require("async");
        var syntaxDetector = require("plugins/c9.ide.language.core/syntax_detector");

        var readFileQueue = [];
        var readFileBusy = false;
        var worker;
        var watched = {};
        
        var loaded;
        function load() {
            if (loaded) return;
            loaded = true;
    
            language.getWorker(function(err, _worker) {
                if (err)
                    return console.error(err);
                
                worker = _worker;
                worker.on("watchDir", watchDir);
                worker.on("unwatchDir", unwatchDir);
                watcher.on("unwatch", onWatchRemoved);
                watcher.on("directory.all", onWatchChange);
                worker.on("refreshAllMarkers", language.refreshAllMarkers.bind(language));
                
                worker.on("execFile", function(e) {
                    e.data.options.cwd = e.data.options.cwd || c9.workspaceDir;
                    ensureConnected(
                        proc.execFile.bind(proc, e.data.path, e.data.options),
                        function(err, stdout, stderr) {
                            worker.emit("execFileResult", { data: {
                                id: e.data.id,
                                err: err,
                                stdout: stdout,
                                stderr: stderr
                            }});
                        }
                    );
                });
                
                worker.on("spawn", function(e) {
                    var id = e.data.id;
                    e.data.options.cwd = e.data.options.cwd || c9.workspaceDir;
                    ensureConnected(
                        function(next) {
                            proc.spawn(e.data.path, e.data.options, next);
                        },
                        function(err, child) {
                            if (err)
                                return worker.emit("spawnResult", { data: { id: id, err: err, }});
                            
                            forwardEvents(child, "child", ["exit", "error", "close", "disconnect", "message"]);
                            forwardEvents(child.stdout, "stdout", ["close", "data", "end", "error", "readable"]);
                            forwardEvents(child.stderr, "stderr", ["close", "data", "end", "error", "readable"]);
                            worker.on("spawn_kill$" + id, kill);
                            child.on("exit", function gc() {
                                worker.off("spawn_kill$" + id, kill);
                            });
                            worker.emit("spawnResult", { data: { id: id, pid: child.pid }});
                            
                            function kill(e) {
                                child.kill(e.signal);
                            }
                            
                            function forwardEvents(source, sourceName, events) {
                                events.forEach(function(event) {
                                    source.on(event, function(e) {
                                        worker.emit("spawnEvent$" + id + sourceName + event, { data: e });
                                    });
                                });
                            }
                        }
                    );
                });
                
                worker.on("readFile", function tryIt(e) {
                    readTabOrFile(e.data.path, e.data.options, function(err, value) {
                        if (err && err.code === "EDISCONNECT")
                            return ensureConnected(tryIt.bind(null, e));
                        worker.emit("readFileResult", { data: {
                            id: e.data.id,
                            err: err && JSON.stringify(err),
                            data: value
                        }});
                    });
                });
                
                worker.on("stat", function(e) {
                    ensureConnected(function tryIt() {
                        fs.stat(e.data.path, function(err, value) {
                            if (err && err.code === "EDISCONNECT")
                                return ensureConnected(tryIt);
                            worker.emit("statResult", { data: {
                                id: e.data.id,
                                err: err && JSON.stringify(err),
                                data: value
                            }});
                        });
                    });
                });

                worker.on("showError", function(e) {
                    var token = e.data.info
                        ? showInfo(e.data.message, e.data.timeout)
                        : showError(e.data.message, e.data.timeout);
                    worker.emit("showErrorResult", { data: { token: token }});
                });

                worker.on("hideError", function(e) {
                    hideError(e.data.token);
                });
                
                worker.on("getTokens", function tryGetTokens(e) {
                    var path = e.data.path;
                    var identifiers = e.data.identifiers;
                    var region = e.data.region;
                    
                    var tab = tabs.findTab(path);
                    if (!tab || !tab.editor || !tab.editor.ace)
                        return done("Tab is no longer open");
                    
                    var session = tab.editor.ace.getSession();
                    if (session.bgTokenizer.running)
                        return setTimeout(tryGetTokens.bind(null, e), 20);
                    
                    var results = [];
                    for (var i = 0, len = session.getLength(); i < len; i++) {
                        if (region && !(region.sl <= i && i <= region.el))
                            continue;
                        var offset = 0;
                        session.getTokens(i).forEach(function(t) {
                            var myOffset = offset;
                            offset += t.value.length;
                            if (identifiers && identifiers.indexOf(t.value) === -1)
                                return;
                            if (region && region.sl === i && myOffset < region.sc)
                                return;
                            if (region && region.el === i && myOffset > region.ec)
                                return;
                            var result = {
                                row: i,
                                column: myOffset
                            };
                            if (region)
                                result = syntaxDetector.posToRegion(region, result);
                            result.type = t.type;
                            result.value = t.value;
                            results.push(result);
                        });
                    }
                    done(null, results);
                    
                    function done(err, results) {
                        worker.emit("getTokensResult", { data: {
                            id: e.data.id,
                            err: err,
                            results: results
                        }});
                    }
                });
            });
        }
        
        function ensureConnected(f, callback, timeout) {
            timeout = timeout || 200;
            if (!c9.NETWORK) {
                return c9.once("stateChange", function(e) {
                    setTimeout(
                        ensureConnected.bind(null, f, callback, timeout * 2),
                        timeout
                    );
                });
            }
            f(function(err) {
                if (err && err.code === "EDISCONNECT")
                    return ensureConnected(f, callback, timeout);
                callback.apply(null, arguments);
            });
        }
        
        function readTabOrFile(path, options, callback) {
            if (typeof options === "string")
                options = { encoding: options };
            var allowUnsaved = options.allowUnsaved;
            delete options.allowUnsaved;
            
            var tab = tabs.findTab(path);
            if (tab) {
                if (allowUnsaved) {
                    var unsavedValue = tab.value
                        || tab.document && tab.document.hasValue && tab.document.hasValue()
                           && tab.document.value;
                    if (unsavedValue)
                        return callback(null, unsavedValue);
                }
                else {
                    var saved = save.getSavingState(tab) === "saved";
                    var value = saved
                        ? tab.value || tab.document && tab.document.value
                        : tab.document.meta && typeof tab.document.meta.$savedValue === "string"
                          && tab.document.meta.$savedValue;
                    if (value)
                        return callback(null, value);
                }
                
            }
            
            if (!options.encoding)
                options.encoding = "utf8"; // TODO: get from c9?

            if (readFileBusy)
                return readFileQueue.push(startDownload);
            
            readFileBusy = true;
            startDownload();

            function startDownload() {
                ensureConnected(
                    function(next) {
                        fs.exists(path, function(exists) {
                            if (!exists) {
                                var err = new Error("Does not exist: " + path);
                                err.code = "ENOENT";
                                return next(err);
                            }
                            fs.readFile(path, options, next);
                        });
                    },
                    function(err, result) {
                        callback(err, result);
                        
                        if (!readFileQueue.length)
                            return readFileBusy = false;
                        var task = readFileQueue.pop();
                        task();
                    }
                );
            }
        }
    
        function watchDir(e) {
            var path = e.data.path;
            watcher.watch(path);
            watched[path] = true;
            
            // Send initial directory listing
            async.parallel([
                fs.stat.bind(fs, path),
                function(callback) {
                    fs.readdir(path, function(err, results) {
                        // We have to use the elaborate callback form here
                        // because of argument-counting "magic" in the callback caller
                        callback(err, results);
                    });
                }
            ],
                function(err, results) {
                    worker.emit("watchDirResult", { data: {
                        initial: true,
                        path: path,
                        err: err && { message: err.message },
                        stat: results[0],
                        files: results[1] || [],
                    }});
                }
            );
        }
        
        function unwatchDir(e) {
            var path = e.data.path;
            watched[path] = false;
            // HACK: don't unwatch if visible in tree
            if (tree.getAllExpanded().indexOf(path) > -1)
                return;
            watcher.unwatch(path);
        }
        
        function onWatchRemoved(e) {
            // HACK: check if someone removed my watcher
            if (watched[e.path])
                watchDir({ data: { path: e.path }});
        }
        
        function onWatchChange(e) {
            if (watched[e.path])
                worker.emit("watchDirResult", { data: e });
        }
        
        plugin.on("load", function() {
            load();
        });
        
        plugin.freezePublicAPI({
            readTabOrFile: readTabOrFile
        });
        
        register(null, {
            "language.worker_util_helper": plugin
        });
    }

});