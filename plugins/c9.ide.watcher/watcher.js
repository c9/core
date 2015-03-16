define(function(require, exports, module) {
    main.consumes = ["c9", "Plugin", "fs"];
    main.provides = ["watcher"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var fs = imports.fs;
        var c9 = imports.c9;
        
        var basename = require("path").basename;
        var dirname = require("path").dirname;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var WAIT_FOR_SIGNAL = false; //c9.platform == "darwin";
        var IGNORE_TIMEOUT = WAIT_FOR_SIGNAL ? 60000 : 1000;
        
        var ignored = {};
        var handlers = {};
        var loaded = false;
        var cached;
        
        function load(){
            if (loaded) return false;
            loaded = true;
            
            function ignoreHandler(e) {
                if (!options || !options.testing)
                    ignore(e.path, 60000);
            }
            
            function doneHandler(e) {
                if (!options || !options.testing) {
                    clearTimeout(ignored[e.path]);
                    ignored[e.path] = setTimeout(function(){
                        unignore(e.path);
                    }, IGNORE_TIMEOUT);
                }
            }
            
            fs.on("beforeWriteFile", ignoreHandler, plugin);
            fs.on("afterWriteFile", doneHandler, plugin);
            fs.on("beforeRename", ignoreHandler, plugin);
            fs.on("afterRename", doneHandler, plugin);
            fs.on("beforeMkdir", ignoreHandler, plugin);
            fs.on("afterMkdir", doneHandler, plugin);
            fs.on("beforeMkdirP", ignoreHandler, plugin);
            fs.on("afterMkdirP", doneHandler, plugin);
            fs.on("beforeUnlink", ignoreHandler, plugin);
            fs.on("afterUnlink", doneHandler, plugin);
            fs.on("beforeRmfile", ignoreHandler, plugin);
            fs.on("afterRmfile", doneHandler, plugin);
            fs.on("beforeRmdir", ignoreHandler, plugin);
            fs.on("afterRmdir", doneHandler, plugin);
            
            c9.on("disconnect", function(){
                if (!cached)
                    cached = Object.keys(handlers);
                handlers = {};
            });
            
            c9.on("connect", function(){
                if (cached) {
                    handlers = {};
                    cached.forEach(function(path) {
                        watch(path);
                    });
                    cached = null;
                }
            });
        }
        
        /***** Methods *****/
        
        function handleError(err, path) {
            if (err.code === "EDISCONNECT")
                return false;
                
            // console.error("[watchers] error watching '" + path + "': " + JSON.stringify(err));
            if (typeof handlers[path] === "function")
                fs.unwatch(path, handlers[path]);
            delete handlers[path];
            
            emit("failed", { path : path });
            
            return false;
        }
        
        function ignore(path, timeout, skipParent) {
            if (!timeout) 
                timeout = IGNORE_TIMEOUT;
            
            if (ignored[path])
                clearTimeout(ignored[path]);
                
            ignored[path] = setTimeout(function(){
                unignore(path);
            }, timeout);
    
            if (skipParent)
                return;
                
            var parent = dirname(path);
            if (parent != path)
                ignore(parent, timeout, true);
        }
        
        function unignore(path) {
            var parent = dirname(path);
            
            clearTimeout(ignored[path]);
            clearTimeout(ignored[parent]);
            
            delete ignored[path];
            delete ignored[parent];
        }
        
        function watch(path, $refresh, $force) {
            // If we've started setting a watcher within the last minute, abort
            var handler = handlers[path];
            if (!$force && handler && (!(handler instanceof Date) 
              || handler.getTime() + 60000 > Date.now())) {
                // We already have a watcher for this file, or it's still initializing
                // let's just make sure no one tries to unwatch it right now
                handler.unwatchScheduled = false;
                return;
            }
            // console.log("[watchers] watching", path);
            
            if (!$force) {
                // Make sure a possible retry on this path is no longer used
                if (handler)
                    clearTimeout(handler.timeout);
                
                handlers[path] = handler = new Date();
                handlers[path].retries = 0;
            }
            
            fs.watch(path, function handler(err, event, filename, stat, files) {
                if (err) {
                    if (err.code == "ENOENT" && handlers[path] && handlers[path].retries < 1) {
                        handlers[path].retries++;
                        handlers[path].timeout = 
                            setTimeout(function(){ 
                                watch(path, $refresh, true); 
                            }, 1000);
                        return false;
                    }
                    return handleError(err, path);
                }

                // OSX sometimes doesn't know the filename
                if (!filename)
                    filename = basename(path);

                if (event == "init") {
                    if (handler.unwatchScheduled) {
                        fs.unwatch(path, handler);
                        emit("unwatch", { path: path });
                    }
                    else {
                        handlers[path] = handler;
                    }
                    
                    if ($refresh)
                        fs.readdir(path, function() {});
                    return;
                }
                
                if (ignored[path] || (!options.testing && stat.vfsWrite)) {
                    if (WAIT_FOR_SIGNAL)
                        ignore(path, 200);
                    // console.warn("[watchers] ignored event for", path, stat.vfsWrite ? "(was vfsWrite)" : "(was on ignore list)");
                    
                    fireWatcherEvent(".all");
                } else {
                    fireWatcherEvent("");
                    fireWatcherEvent(".all");
                }
                
                function fireWatcherEvent(eventSuffix) {
                    if (event == "error") {
                        // console.error("[watchers] received error for", path, err, stat);
                    }
                    else if (event == "delete") {
                        fs.unwatch(path, handler);
                        delete handlers[path];
                        // console.log("[watchers] received", event, "event for", path, stat);
                        emit("delete" + eventSuffix, { path : path });
                    }
                    else if (event == "directory") {
                        emit("directory" + eventSuffix, {
                            path: path,
                            files: files,
                            stat: stat
                        });
                    }
                    else {
                        // console.log("[watchers] received", event, "event for", path, stat);
                        emit("change" + eventSuffix, {
                            type: event,  // change || rename
                            filename: filename,
                            path: path,
                            stat: stat
                        });
                    }
                }
            });
        }
        
        function unwatch(path) {
            if (handlers[path]) {
                // console.log("[watchers] stopped watching", path);
                if (typeof handlers[path] == "function") {
                    fs.unwatch(path, handlers[path]);
                    emit("unwatch", { path: path });
                    delete handlers[path];
                } else {
                    handlers[path].unwatchScheduled = true;
                }
            }
        }
        
        function check(path, timestamp) {
            fs.stat(path, function(err, stat) {
                if (err) {
                    if (err.code == "EDISCONNECT")
                        return;
                    if (err.code == "ENOENT" || err.code == "EBADF") {
                        console.log("[watcher] sending artificial check event for", path, "(deleted)", stat);
                        emit("delete", { path : path });
                    }
                    else {
                        // console.error("[watchers] watcher.check received unknown error ", err);
                    }
                }
                else if (timestamp < stat.mtime) {
                    console.log("[watcher] sending artificial check event for", path,
                        "(expected mtime " + timestamp + ")", stat);
                    emit("change", {
                        type: "change",
                        filename: basename(path),
                        path: path,
                        stat: stat
                    });
                }
            });
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function(){
            load();
        });
        plugin.on("enable", function(){
            
        });
        plugin.on("disable", function(){
            
        });
        plugin.on("unload", function(){
            loaded = false;
        });
        
        /***** Register and define API *****/
        
        /**
         * Watches files and directories for changes
         * @singleton
         **/
        plugin.freezePublicAPI({
            _events: [
                /** 
                 * @event change Fires when a file is changed
                 * @param {Object} e
                 * @param {String} e.path      the path of the changed file
                 * @param {String} e.type      can take the value "change" or "rename". 
                 * @param {String} e.filename  the filename of the file that is 
                 *   changed (especially interesting when watcher a directory)
                 * @param {Object} e.stat      object containing information 
                 *   about the path. See {@link fs#stat}.
                 */
                "change",
                /** 
                 * @event delete Fires when a file is removed
                 * @param {Object} e
                 * @param {String} e.path  the path of the removed file
                 * @param {Object} e.stat  object containing information about 
                 *   the path. See {@link fs#stat}.
                 */
                "delete",
                /** 
                 * @event directory Fires when a directory contents is changed
                 * @param {Object} e
                 * @param {String} e.path   the path of the removed file
                 * @param {Array}  e.files  list of stat objects representing 
                 *   the new file listing of the directory. See {@link fs#stat}.
                 * @param {Object} e.stat   object containing information 
                 *   about the path. See {@link fs#stat}.
                 */
                "directory",
                /** 
                 * @event failed Fires when a watcher fails to be set
                 * @param {Object} e
                 * @param {String} e.path   the path
                 */
                "failed",
                /** 
                 * @event unwatch A watcher got removed for a path
                 * @param {Object} e
                 * @param {String} e.path   the path
                 */
                "unwatch",
            ],
            
            /**
             * Set a watcher for a path
             * @param {String} path the path of the file or directory to watch
             */
            watch: watch,
            
            /**
             * Remove a watcher for a path
             * @param {String} path the path of the file or directory to unwatch
             */
            unwatch: unwatch,
            
            /**
             * Checks whether a file has changed or is deleted
             * @param {String} path the path of the file to check
             */
            check: check,
            
            /**
             * Ignore watching a path for [timeout] milliseconds. This is useful
             * when the file operation occurs on this client.
             * @param {String} path    the path of the file or directory to ignore
             * @param {Number} timeout the amount of milliseconds to ignore the path
             * @private
             */
            ignore: ignore
        });
        
        register(null, {
            watcher: plugin
        });
    }
});