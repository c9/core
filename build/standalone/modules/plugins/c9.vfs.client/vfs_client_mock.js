/*global localStorage*/
define(function(require, exports, module) {
    "use strict";
    
    main.consumes = ["Plugin"];
    main.provides = ["vfs", "vfs.ping", "vfs.log", "vfs.endpoint"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var plugin = new Plugin("Ajax.org", main.consumes);
        
        var id;
        var vfsBaseUrl;
        var serviceUrl;
        
        var fsData = {};
        
        var pathLib = require("path");
        var Stream = require("stream").Stream;
        var basename = require("path").basename;
        var EventEmitter = require("events").EventEmitter;
        var noop = function() { console.error("not implemented"); };
        var silent = function() {};
        var connection = {};
        
        function load() {
            // initialize mock fsData
            findNode("/README.md", true, [
                "# Welcome to Cloud9 offline demo!",
                "",
                "This is a demo of Cloud9 ui, with a mock vfs server working with localStorage",
                "Some features that need a real server have been disabled",
                "So be sure to try the real thing at https://c9.io!"
            ].join("\n"));
            findNode("~", true);
            if (options.storage != false) {
                // Try loading data from localStorage
                try {
                    fsData = JSON.parse(localStorage.fsData);
                } catch (e) {}
                window.addEventListener("beforeunload", function(e) {
                    localStorage.fsData = JSON.stringify(fsData);
                });
            }
        }
        function unload() {
            fsData = {};
        }
        
        function findNode(path, create, val) {
            if (!path) path = "/";
            var parts = path.split("/");
            if (!parts[parts.length - 1])
                parts.pop();
            var data = fsData;
            var prev = null;
            for (var i = 0; i < parts.length; i++) {
                prev = data;
                data = data["!" + parts[i]];
                if (data == null) {
                    if (create && !isFile(prev))
                        data = prev["!" + parts[i]] = {};
                    else
                        return;
                }
            }
            if (val != null)
                data = prev["!" + parts[parts.length - 1]] = { v: val, t: Date.now() };
            return data;
        }
        
        function ENOENT() {
            var err = new Error("ENOENT");
            err.code = "ENOENT";
            return err;
        }
        
        function isFile(node) {
            return typeof node == "string" || node && node.v != null;
        }
        
        function fileConets(node) {
            return typeof node == "string" ? node : node && node.v;
        }
        
        function sendStream(data, callback) {
            var stream = new Stream();
            stream.readable = true;
            callback(null, { stream: stream });
            if (Array.isArray(data)) {
                data.forEach(function(x) { 
                    stream.emit("data", x);
                });
            } else {
                stream.emit("data", data);
            }
            stream.emit("end");
        }
        
        function readStream(callback) {
            return function(err, meta) {
                if (err) return callback(err);
                var buffer = [];
                meta.stream.on("data", function(data) {
                    if (typeof data == "string")
                        buffer += data;
                    else
                        buffer = buffer.concat(data);
                });
                meta.stream.on("end", function() {
                    callback(null, buffer);
                });
            };
        }
        
        function readBlob(blob, callback) {
            var reader = new FileReader();
            reader.onload = function() {
                callback(null, reader.result);
            };
            reader.onerror = function(e) {
                callback(e);
            };
            reader.readAsText(blob);
        }
        
        var watcher = new EventEmitter();
        watcher.addChange = function(path) {
            plugin.stat(path, {}, function(err, stat) {
                var dir = pathLib.dirname(path);
                var name = pathLib.basename(path);
                plugin.readdir(dir, {}, readStream(function(e, stats) {
                    watcher.emit(dir, "directory", name, stat, stats);
                }));
                watcher.emit(path, err ? "delete" : "change", name, stat);
            });
        };
        watcher.watch = function(path, options, callback) {
            if (!callback) callback = options;
            setTimeout(function() {
                var w = new EventEmitter();
                var sendEvent = function(event, filename, stat, files) {
                    w.emit("change", event, filename, stat, files);
                };
                watcher.on(path, sendEvent);
                w.close = function() {
                    watcher.off(path, sendEvent);
                };
                callback(null, { watcher: w });
            });
        };
        watcher.unwatch = function(path, options, callback) {
            if (!callback) callback = options;
            watcher.removeAllListeners(path);
        };
        
        
        plugin.on("load", load);
        plugin.on("unload", unload);
        
        plugin.freezePublicAPI({
            on: function() {},
            once: function() {},
            
            get connection() { return connection; },
            get connecting() { return false; },
            get connected() { return true },
            
            get previewUrl() { throw new Error("gone"); },
            get serviceUrl() { return serviceUrl; },
            get id() { return id; },
            get baseUrl() { return vfsBaseUrl; },
            get region() { return ""; },
            
            rest: function(path, options, callback) {
                if (options.method == "PUT") {
                    if (typeof options.body == "object") {
                        return readBlob(options.body, function(e, value) {
                            if (e) return callback(e);
                            plugin.rest(path, {
                                method: "PUT",
                                body: value,
                            }, callback);
                        });
                    }
                    sendStream(options.body, function(err, stream) {
                        if (err) return callback(err);
                        plugin.mkfile(path, stream, callback);
                    });
                } else if (options.method == "GET") {
                    var result = findNode(path);
                    setTimeout(function() {
                        callback(null, result);
                    }, 20);
                }
            },
            download: function(path, filename, isfile) {
                // TODO use jszip for folders
                if (Array.isArray(path) && path.length > 1) {
                    return path.map(function(x) {
                        plugin.download(x);
                    });
                }
                var data = findNode(path);
                if (!isFile(data))
                    return console.error("not implemented");
                var a = document.createElement('a');
                a.href = URL.createObjectURL(new Blob([fileConets(data)], { type: "text/plain" }));
                a.download = filename || basename(path);
                
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            },
            url: noop,
            reconnect: noop,
            
            vfsUrl: noop,

            // File management
            resolve: noop,
            stat: function(path, options, callback) {
                var data = findNode(path);
                var name = path.split("/").pop();
                setTimeout(function() {
                    if (data == null)
                        return callback(ENOENT());
                    var value = fileConets(data);
                    var isFileNode = value != null;
                    var stat = {
                        name: name,
                        size: isFileNode ? value.length : 1,
                        mtime: data.t || 0,
                        ctime: data.ct || data.t || 0,
                        mime: isFileNode ? "" : "folder"
                    };
                    callback(null, stat);
                }, 20);
            },
            readfile: function(path, options, callback) {
                var data = findNode(path);
                setTimeout(function() {
                    var value = fileConets(data);
                    if (value == null)
                        return callback(ENOENT());
                    sendStream(value, callback);
                }, 20);
            },
            readdir: function(path, options, callback) {
                var data = findNode(path);
                setTimeout(function() {
                    if (!data || isFile(data))
                        return callback(ENOENT());
                    var stats = Object.keys(data).map(function(n) {
                        var value = fileConets(data[n]);
                        var isFile = value != null;
                        return {
                            name: n.substr(1),
                            size: isFile ? value.length : 1,
                            mtime: data[n].t || 0,
                            ctime: data[n].ct || data[n].t,
                            mime: isFile ? "" : "folder"
                        };
                    });
                    sendStream(stats, callback);
                });
            },
            mkfile: function(path, options, callback) {
                var parts = path.split("/");
                var name = "!" + parts.pop();
                var parent = findNode(parts.join("/"), true);
                var val = "";
                options.stream.on("data", function(e) {
                    if (e) val += e;
                });
                options.stream.on("end", function(e) {
                    if (e) val += e; 
                    setTimeout(function() {
                        if (!parent)
                            return callback(ENOENT());
                        if (parent[name] && !isFile(parent[name]))
                            return callback(new Error("EISDIR"));
                        parent[name] = { v: val, t: Date.now() };
                        watcher.addChange(path);
                        callback(null);
                    });
                });
            },
            mkdir: function(path, options, callback) {
                var data = findNode(path, true);
                setTimeout(function() {
                    if (!data)
                        return callback(ENOENT());
                    watcher.addChange(path);
                    callback();
                });
            },
            mkdirP: function(path, options, callback) {
                var data = findNode(path, true);
                setTimeout(function() {
                    if (!data)
                        return callback(ENOENT());
                    watcher.addChange(path);
                    callback();
                });
            },
            appendfile: noop,
            rmfile: function(path, options, callback) {
                var parts = path.split("/");
                var name = "!" + parts.pop();
                setTimeout(function() {
                    var parent = findNode(parts.join("/"));
                    if (!parent || !parent[name])
                        return callback(ENOENT());
                    if (!isFile(parent[name]))
                        return callback(new Error("EISDIR"));
                    delete parent[name];
                    watcher.addChange(path);
                    callback();
                });
            },
            rmdir: function(path, options, callback) {
                var parts = path.split("/");
                var name = "!" + parts.pop();
                setTimeout(function() {
                    var parent = findNode(parts.join("/"));
                    if (!parent || !parent[name])
                        return callback(ENOENT());
                    if (isFile(parent[name]))
                        return callback(new Error("EISFILE"));
                    delete parent[name];
                    watcher.addChange(path);
                    callback();
                });
            },
            rename: function(to, options, callback) {
                setTimeout(function() {
                    var from = options.from;
                    var overwrite = options.overwrite;
                    
                    var parts = to.split("/");
                    var toName = "!" + parts.pop();
                    var toParent = findNode(parts.join("/"), true);
                    
                    parts = from.split("/");
                    var fromName = "!" + parts.pop();
                    var fromParent = findNode(parts.join("/"));
                    if (toParent[toName] != null && !overwrite)
                        return callback(ENOENT());
                    
                    toParent[toName] = fromParent[fromName];
                    delete fromParent[fromName];
                    watcher.addChange(from);
                    watcher.addChange(to);
                    callback(null);
                });
            },
            copy: function(from, options, callback) {
                setTimeout(function() {
                    var to = options.to;
                    var overwrite = options.overwrite;
                    
                    var toParts = to.split("/");
                    var toName = "!" + toParts.pop();
                    var toParent = findNode(toParts.join("/"));
                    
                    var parts = from.split("/");
                    var fromName = "!" + parts.pop();
                    var fromParent = findNode(parts.join("/"));
                    var counter = 0;
                    var name = toName;
                    while (toParent[toName] != null && !options.overwrite)
                        toName = name + "." + (++counter);
                    
                    toParent[toName] = fromParent[fromName];
                    toParts.push(toName.substr(1));
                    watcher.addChange(to);
                    callback(null, { to: toParts.join("/") });
                });
            },
            chmod: noop,
            symlink: noop,

            // Save and retrieve Metadata
            metadata: function(path, value, sync, callback) {
                var parts = ("/.c9/metadata" + path).split("/");
                var name = "!" + parts.pop();
                var parent = findNode(parts.join("/"), true);
                if (sync) {
                    parent[name] = JSON.stringify(value);
                    return callback();
                }
                setTimeout(function() {
                    parent[name] = JSON.stringify(value);
                    callback();
                });
            },
            readFileWithMetadata: function(path, options, callback) {
                var data = findNode(path);
                var metadata = findNode("/.c9/metadata" + path);
                var timer = setTimeout(function() {
                    if (!isFile(data))
                        return callback(ENOENT());
                    callback(null, fileConets(data), fileConets(metadata));
                });
                return { abort: function() { clearTimeout(timer); } };
            },

            // Wrapper around fs.watch or fs.watchFile
            watch: watcher.watch,
            unwatch: watcher.unwatch,

            // Network connection
            connect: noop,

            // Process Management
            spawn: silent,
            pty: silent,
            tmux: silent,
            execFile: silent,
            killtree: silent,

            // Extending the API
            use: silent,
            extend: silent,
            unextend: silent,
            
            isIdle: function() { return true },
        });
        
        register(null, {
            "vfs": plugin,
            "vfs.ping": {},
            "vfs.log": {
                log: function() {}
            },
            "vfs.endpoint": {
                clearCache: function() {}
            }
        });
    }
});
