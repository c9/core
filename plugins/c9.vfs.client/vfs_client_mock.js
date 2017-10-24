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
        
        var Stream = require("stream").Stream;
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
                    if (create && typeof prev != "string")
                        data = prev["!" + parts[i]] = {};
                    else
                        return;
                }
            }
            if (val)
                data = prev["!" + parts[parts.length - 1]] = val;
            return data;
        }
        
        function ENOENT() {
            var err = new Error("ENOENT");
            err.code = "ENOENT";
            return err;
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
            
            rest: noop,
            download: noop,
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
                    var isFile = typeof data == "string";
                    var stat = {
                        name: name.substr(1),
                        size: isFile ? data.length : 1,
                        mtime: 0,
                        ctime: 0,
                        mime: isFile ? "" : "folder"
                    };
                    callback(null, stat);
                }, 20);
            },
            readfile: function(path, options, callback) {
                var data = findNode(path);
                setTimeout(function() {
                    if (typeof data != "string")
                        return callback(ENOENT());
                    sendStream(data, callback);
                }, 20);
            },
            readdir: function(path, options, callback) {
                var data = findNode(path);
                setTimeout(function() {
                    if (!data || typeof data == "string")
                        return callback(ENOENT());
                    var stats = Object.keys(data).map(function(n) {
                        var isFile = typeof data[n] == "string";
                        return {
                            name: n.substr(1),
                            size: isFile ? data[n].length : 1,
                            mtime: 0,
                            ctime: 0,
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
                        if (!parent || typeof parent[name] == "object")
                            return callback(ENOENT());
                        parent[name] = val;
                        callback(null);
                    });
                });
            },
            mkdir:  function(path, options, callback) {
                var data = findNode(path, true);
                setTimeout(function() {
                    if (!data)
                        return callback(ENOENT());
                    callback();
                });
            },
            mkdirP: function(path, options, callback) {
                var data = findNode(path, true);
                setTimeout(function() {
                    if (!data)
                        return callback(ENOENT());
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
                    if (typeof parent[name] != "string")
                        return callback(new Error("EISDIR"));
                    delete parent[name];
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
                    if (typeof parent[name] == "string")
                        return callback(new Error("EISFILE"));
                    delete parent[name];
                    callback();
                });
            },
            rename: function(to, options, callback) {
                setTimeout(function() {
                    var from = options.from;
                    var overwrite = options.overwrite;
                    
                    var parts = to.split("/");
                    var toName = "!" + parts.pop();
                    var toParent = findNode(parts.join("/"));
                    
                    parts = from.split("/");
                    var fromName = "!" + parts.pop();
                    var fromParent = findNode(parts.join("/"));
                    if (toParent[toName] != null && !overwrite)
                        return callback(ENOENT());
                    
                    toParent[toName] = fromParent[fromName];
                    delete fromParent[fromName];
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
                    callback(null, {to: toParts.join("/")});
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
                setTimeout(function() {
                    if (typeof data != "string")
                        return callback(ENOENT());
                    // TODO metadata
                    callback(null, data, metadata);
                });
                return { abort: function() {} };
            },

            // Wrapper around fs.watch or fs.watchFile
            watch: silent,

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
