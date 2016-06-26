( // Module boilerplate to support browser globals, node.js and AMD.
  (typeof module !== "undefined" && function (m) { module.exports = m(require('stream'), require('events'), require('smith')); }) ||
  (typeof define === "function" && function (m) { define(["smith", "stream"], m); }) ||
  (function (m) { window.consumer = m(window.stream, window.events, window.smith); })
)(function (stream, events, smith) {
"use strict";
    
var PATH = { 
    join : function(){
        return Array.prototype.join.apply(arguments, ["/"]).replace(/\/\/+/, "/");
    }
};

var Stream = stream.Stream;

var exports = function(vfs, base, baseProc) {

    var resolvePath = function(path, basePath) { 
        if (!basePath)
            basePath = base;
        
        if (!basePath) return path;
        
        if (path.substring(0, basePath.length) === basePath) {
            return path;
        }
        return PATH.join(basePath, path);
    };

    function readFile(path, encoding, callback) {
        if (!callback) {
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
        if (!callback) {
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

    function readdir(path, callback) {
        vfs.readdir(resolvePath(path), {encoding: null}, function(err, meta) {
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

    function rename(from, to, options, callback) {
        vfs.rename(resolvePath(to), {
            from      : resolvePath(from), 
            overwrite : (options || 0).overwrite
        }, callback);
    }

    function mkdirHandler(callback){
        return function(err){
            if (err && err.message.indexOf("exists") > -1)
                callback({"code": "EEXIST", "message": err.message});
            else
                callback();
        };
    }

    function mkdirP(path, mode, callback) {
        if (!callback) {
            callback = mode;
            mode = null;
        }
        vfs.execFile("mkdir", {args: ["-p", resolvePath(path, baseProc)]}, 
            mkdirHandler(callback));
    }

    function mkdir(path, callback) {
        vfs.execFile("mkdir", {args: [resolvePath(path, baseProc)]}, 
            mkdirHandler(callback));
    }

    function rmfile(path, callback) {
        vfs.rmfile(resolvePath(path), {}, callback || function(){}); // shouldn't vfs handle callback == null?
    }

    function rmdir(path, options, callback) {
        if (typeof options == "function") {
            callback = options;
            options = {};
        }
        vfs.rmdir(resolvePath(path), options, callback || function(){});
    }
    
    function copy(path, to, options, callback){
        if (typeof options == "function") {
            callback  = options;
            options = {};
        }
        
        vfs.copy(resolvePath(path), {
            to        : resolvePath(to), 
            overwrite : (options.overwrite !== undefined 
                ? options.overwrite 
                : true),
            recursive : options.recursive
        }, callback);
    }
    
    function symlink(path, target, callback){
        vfs.symlink(resolvePath(path), {target: resolvePath(target)}, callback);
    }
    
    function watch(path, callback) {
        vfs.watch(resolvePath(path), {}, function (err, meta) {
            if (err) return callback(err);
            
            var watcher = meta.watcher;
            watcher.on("change", function (event, filename) {
                callback(null, event, filename);
            });
            watcher.on("error", function(err){
                callback(err || true);
            });
            
            if (callback[path]) callback[path]();
            callback[path] = function(){
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
        symlink: symlink,
        watch: watch,
        unwatch: unwatch,
        vfs: vfs
    };
};

return exports;

});
