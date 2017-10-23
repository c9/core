define(function(require, exports, module) {
    
var Stream = require("stream").Stream;
var PATH = require("path");

return function(vfs, base, baseProc, cli) {

    var resolvePath = function(path, basePath) { 
        if (path.charAt(0) == "~") {
            if (cli && typeof process != "undefined" && process.env)
                return process.env.HOME + "/" + path.substr(1);
            return path;
        }

        if (!basePath)
            basePath = base;
        
        if (!basePath) return path;
        
        if (path.substring(0, basePath.length) === basePath) {
            return path;
        }
        return PATH.join(basePath, path);
    };

    function readFile(path, encoding, callback) {
        if (!callback || typeof encoding == "function") {
            callback = encoding;
            encoding = null;
        }

        var options = {};
        if (encoding)
            options.encoding = encoding;
            
        vfs.readfile(resolvePath(path), options, function(err, meta) {
            if (err)
                return callback(err);

            var data = "";
            meta.stream.on("data", function(d) {
                data += d;
            });

            var done;
            meta.stream.on("error", function(e) {
                if (done) return;
                done = true;
                callback(e);
            });

            meta.stream.on("end", function() {
                if (done) return;
                done = true;
                callback(null, data);
            });
        });
    }

    function writeFile(path, data, encoding, callback) {
        if (!callback || typeof encoding == "function") {
            callback = encoding;
            encoding = null;
        }

        var options = {};
        if (encoding)
            options.encoding = encoding;

        var stream = options.stream = new Stream();
        stream.readable = true;

        vfs.mkfile(resolvePath(path), options, function(err, meta) {
            if (err)
                return callback(err);
            callback(null);
        });

        stream.emit("data", data);
        stream.emit("end");
    }

    function appendFile(path, data, encoding, callback) {
        if (!callback) {
            callback = encoding;
            encoding = null;
        }

        var options = {};
        if (encoding)
            options.encoding = encoding;

        options.data = data;

        vfs.appendfile(resolvePath(path), options, function(err, meta) {
            if (err)
                return callback(err);
            callback(null);
        });
    }

    function readdir(path, callback) {
        vfs.readdir(resolvePath(path), { encoding: null }, function(err, meta) {
            if (err)
                return callback(err);

            var stream = meta.stream;
            var files = [];
            
            stream.on("data", function(stat) {
                files.push(stat);
            });

            var called;
            stream.on("error", function(err) {
                if (called) return;
                called = true;
                callback(err);
            });

            stream.on("end", function() {
                if (called) return;
                called = true;
                callback(null, files);
            });
        });
    }

    function exists(path, callback) {
        vfs.stat(resolvePath(path), {}, function(err, stat) {
            return callback(stat && !stat.err ? true : false, stat);
        });
    }

    function stat(path, callback) {
        vfs.stat(resolvePath(path), {}, callback);
    }

    function chmod(path, mode, callback) {
        vfs.chmod(resolvePath(path), { mode: mode }, callback);
    }

    function rename(from, to, options, callback) {
        if (typeof options == "function") {
            callback = options;
            options = {};
        }
        
        vfs.rename(resolvePath(to), {
            from: resolvePath(from), 
            overwrite: options.overwrite
        }, callback);
    }

    function mkdirHandler(callback) {
        return function(err) {
            if (err && err.message.indexOf("exists") > -1)
                callback({ "code": "EEXIST", "message": err.message });
            else
                callback(err);
        };
    }

    function mkdirP(path, mode, callback) {
        if (!callback) {
            callback = mode;
            mode = null;
        }
        //vfs.execFile("mkdir", {args: ["-p", resolvePath(path, baseProc)]}, 
        //    mkdirHandler(callback));
        vfs.mkdirP(resolvePath(path), {
            mode: mode
        }, mkdirHandler(callback));
    }

    function mkdir(path, callback) {
        //vfs.execFile("mkdir", {args: [resolvePath(path, baseProc)]}, 
        //    mkdirHandler(callback));
        vfs.mkdir(resolvePath(path), {}, mkdirHandler(callback));
    }

    function rmfile(path, callback) {
        vfs.rmfile(resolvePath(path), {}, callback || function() {}); // shouldn't vfs handle callback == null?
    }

    function rmdir(path, options, callback) {
        if (typeof options == "function") {
            callback = options;
            options = {};
        }
        vfs.rmdir(resolvePath(path), options, callback || function() {});
    }
    
    function copy(path, to, options, callback) {
        if (typeof options == "function") {
            callback = options;
            options = {};
        }
        
        vfs.copy(resolvePath(path), {
            to: resolvePath(to), 
            overwrite: (options.overwrite !== undefined 
                ? options.overwrite 
                : true),
            recursive: options.recursive
        }, callback);
    }
    
    function symlink(path, target, callback) {
        vfs.symlink(resolvePath(path), { target: resolvePath(target) }, callback);
    }
    
    function watch(path, callback) {
        vfs.watch(resolvePath(path), {}, function (err, meta) {
            if (err) return callback(err);
            
            var watcher = meta.watcher;
            watcher.on("change", function (event, filename, stat, files) {
                callback(null, event, filename, stat, files);
            });
            watcher.on("error", function(err) {
                callback(err || true);
            });
            
            if (callback[path]) callback[path]();
            callback[path] = function() {
                watcher.removeAllListeners();
                watcher.close();
            };
            
            callback(null, "init", path);
        });
    }
    
    function unwatch(path, callback) {
        if (callback[path]) callback[path]();
    }

    return {
        readFile: readFile,
        writeFile: writeFile,
        appendFile: appendFile,
        readdir: readdir,
        exists: exists,
        stat: stat,
        rename: rename,
        mkdirP: mkdirP,
        mkdir: mkdir,
        unlink: rmfile,
        rmfile: rmfile,
        rmdir: rmdir,
        copy: copy,
        chmod: chmod,
        symlink: symlink,
        watch: watch,
        unwatch: unwatch,
        vfs: vfs,
        metadata: vfs.metadata,
        readFileWithMetadata: vfs.readFileWithMetadata
    };
};

});
