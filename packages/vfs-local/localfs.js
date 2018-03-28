var fs = require("fs");
var net = require("net");
var childProcess = require("child_process");
var constants = require("constants");
var join = require("path").join;
var pathResolve = require("path").resolve;
var pathNormalize = require("path").normalize;
var pathBasename = require("path").basename;
var dirname = require("path").dirname;
var basename = require("path").basename;
var Stream = require("stream").Stream;
var getMime = (function(simpleMime) {
    // workaround for a bug in simple-mime
    return function(path) {
        var mime = simpleMime(path);
        if (typeof mime != "string")
            return "application/octet-stream"
        return mime;
    }
})(require("simple-mime")());
var vm = require("vm");
var exists = fs.exists || require("path").exists;
var crypto = require("crypto");
var os = require("os");
var pathSep = require("path").sep;
var transformPath;
var isWin = pathSep == "\\";

// node 0.6 does not have domain support
var domain;
try {
    domain = require("domain");
} catch(e) {}

//////////////////// windows support ///////////////////////////////////////////
if (isWin) {
    var _pathNormalize = pathNormalize;
    var _join = join;
    var _pathResolve = pathResolve;
    pathNormalize = function(p) {
        return _pathNormalize(p).replace(/[\\]/g, "/");
    };
    join = function() {
        return _join.apply(null, arguments).replace(/[\\]/g, "/");
    };
    transformPath = function(path) {
        if (path[0] == "/") {
            var m = /^\/+(\w):[\/\\]*/.exec(path);
            if (m) {
                var device = m ? m[1] : "";
                path = device + ":/" + path.substr(m[0].length).replace(/[:*?"<>|]/g, "_");
            }
        }
        return path;
    };
    pathResolve = function(path, link) {
        path = _pathResolve(path, link);
        if (path[0] !== "/") {
            path = "/" + path.replace(/[\\]/g, "/");
        }
        return path;
    };
}

// For debugging only
function logToFile(message){
    fs.appendFile('/tmp/vfs.log', new Date().getTime() + " " + message + "\n", function (err) {
    
    });
}

////////////////////////////////////////////////////////////////////////////////

module.exports = function setup(fsOptions) {
    var pty;
    if (fsOptions.nodePath) {
        process.env.NODE_PATH = fsOptions.nodePath;
        require("module")._initPaths();
    }
    if (!fsOptions.nopty) {
        // on darwin trying to load binary for a wrong version crashes the process
        [(fsOptions.nodePath || process.env.HOME + "/.c9/node_modules") + "/pty.js",
            "pty.js", "pty.nw.js"].some(function(p) {
            try {
                pty = require(p);
                return true;
            } catch(e) {
                console.warn(e, p);
            }
        });
        if (!pty)
            console.warn("unable to initialize pty.js:");
    }
    if (!pty) {
        pty = function(command, options, callback) {
            console.log("PTY is not supported.");
        };
        pty.spawn = pty;
    }

    var TMUX       = fsOptions.tmuxBin || "tmux";
    var BASH       = fsOptions.bashBin || process.env.C9_BASH_BIN || (isWin ? "bash.exe" : "bash");
    var METAPATH   = fsOptions.metapath;
    var WSMETAPATH = fsOptions.wsmetapath;
    var TESTING    = fsOptions.testing;
    var TMUXNAME   = "cloud9";
    var noTmux;
    var tmuxWarned;

    // Check and configure options
    var root = fsOptions.root;
    if (!root) throw new Error("root is a required option");
    root = pathNormalize(root);
    
    if (pathSep == "/" && root[0] !== "/") throw new Error("root path must start in /");
    if (root[root.length - 1] !== "/") root += "/";
    
    var base = root.substr(0, root.length - 1);
    
    // Fetch umask
    var umask = 022;
    _execFile(BASH, ["-c", "umask"], function(error, stdout, stderr) {
        if (!error && !stderr && stdout) 
            umask = parseInt(stdout, 8);
    });
    
    // Fetch tmux version
    _execFile(TMUX, ["-V"], function(err, stdout) {
        if (err) stdout = "tmux 1.9";
        noTmux = err && err.code === "ENOENT";
        TMUXNAME = "cloud9" + parseFloat(stdout.replace(/tmux([-\d.]*) /, ""), 10);
    });
    
    if (fsOptions.hasOwnProperty('defaultEnv')) {
        fsOptions.defaultEnv.__proto__ = process.env;
    } else {
        fsOptions.defaultEnv = process.env;
    }
    
    // Fetch environment variables from the login shell
    var waitForEnv = null;
    if (!isWin) {
        waitForEnv = [];
        // using timeout because bash initialization may open a prompt blocking this call
        _execFile(BASH, ["-lc", "printenv -0"], { timeout: 1500 }, function(error, stdout, stderr) {
            var pending = waitForEnv;
            waitForEnv = null;
            if (!error && !stderr && stdout) {
                var env = fsOptions.defaultEnv;
                stdout.split("\x00").forEach(function(entry) {
                    var i = entry.indexOf("=");
                    if (i != -1)
                        env[entry.slice(0, i)] = entry.slice(i + 1);
                });
            }
            pending.forEach(function(x) { x(); });
        });
    }
    
    // Storage for extension APIs
    var apis = {};
    // Storage for event handlers
    var handlers = {};
    
    var fileWatchers = {};

    // Export the API
    var vfs = wrapDomain({
        fsOptions: fsOptions,
        
        // File management
        resolve: resolve,
        stat: stat,
        readfile: readfile,
        readdir: readdir,
        mkfile: mkfile,
        mkdir: mkdir,
        mkdirP: mkdirP,
        appendfile: appendfile,
        rmfile: rmfile,
        rmdir: rmdir,
        rename: rename,
        copy: copy,
        symlink: symlink,
        chmod: chmod,

        // Set/Retrieve Metadata
        metadata: metadata,
        getMetadata: getMetadata,

        // Wrapper around fs.watch or fs.watchFile
        watch: watch,

        // Network connection
        connect: connect,

        // Process Management
        spawn: spawn,
        pty: ptyspawn,
        tmux: process.platform == "win32" ? bashspawn : tmuxspawn,
        execFile: execFile,
        killtree: killtree,

        // Basic async event emitter style API
        on: on,
        off: off,
        emit: emit,

        // Extending the API
        extend: extend,
        unextend: unextend,
        use: use,
        
        // Internal
        writeToWatchedFile: writeToWatchedFile,
        workspaceDir: fsOptions.projectDir,

        // State
        env: {},
    });
    
    function wrapDomain(api) {
        if (!domain)
            return api;
            
        for(var func in api) {
            if (typeof api[func] !== "function")
                continue;
                
            (function(func) {
                var call = api[func];
                api[func] = function() {
                    var args = Array.prototype.slice.apply(arguments);
                    var d = domain.create();
                    d.on("error", function(e) {
                        console.error("VFS Exception in function '" + func + "':\n", (e.stack || e));
                        vfs.emit("error", {
                            message: e.message,
                            func: func,
                            stack: e.stack + "",
                            node: process.version
                        });
                        console.log("Scheduling process exit");
                        setTimeout(function() {
                            console.log("Exiting after uncaught exception in '" + func + "':\n", (e.stack || e))
                            process.exit(1);
                        }, 2000);
                    });
                    d.run(function() {
                        call.apply(api, args);
                    });
                };
            })(func);
        }
        return api;
    }

////////////////////////////////////////////////////////////////////////////////
    if (isWin) {
        var readSpecialDir = function(path, callback) {
            if (path == "/") {
                execFile("cmd", { args: ["/c", "wmic logicaldisk get deviceid"] }, function(err, result) {
                    if (result && result.stdout) {
                        var drives = result.stdout.match(/ *\w:/g).map(function(x){return x.trim()});
                        var meta = {};
                        var stat = {
                            isFile: function() {return false},
                            size: 0,
                            mtime: Date.now()
                        };
                        // meta.notModified = true;
                        meta.etag = calcEtag(stat);
                        calcEtag(stat);
                        meta.stream = new Stream();
                        meta.stream.readable = true;
                        callback(null, meta);
                        drives.forEach(function(d) {
                            meta.stream.emit("data", {
                                mime: "drive/directory",
                                mtime: stat.mtime,
                                name: d,
                                size: 0
                            });
                        });
                        meta.stream.emit("end");
                    }
                });
                return true;
            }
        };
        var isSpecialPath = function(path) {
            return path == "/";
        };
    }
////////////////////////////////////////////////////////////////////////////////

    function _execFile() {
        var callback = arguments[arguments.length-1];
        try {
            return childProcess.execFile.apply(childProcess, arguments);
        } catch(e) {
            callback(e);
        }
    }

    // Realpath a file and check for access
    // callback(err, path)
    function resolvePath(path, options, callback) {
        if (!callback) {
            callback = options;
            options = {};
        }
        
        var alreadyRooted = options.alreadyRooted;
        var checkSymlinks = options.checkSymlinks;
        var sandbox = options.sandbox;
        
        if (checkSymlinks === undefined)
            checkSymlinks = true;
            
        if (!alreadyRooted) {
            if (sandbox)
                path = join(sandbox, path);
                
            path = join(root, path);
        }
        
        if (!options.nocheck) {
            var localRoot = sandbox ? join(root, sandbox) : root;
            var base = root.substr(0, localRoot.length - 1);
            var testPath = path.substr(0, localRoot.length);
            
            if (isWin) {
                testPath = testPath.toLowerCase();
                base = base.toLowerCase();
                localRoot = localRoot.toLowerCase();
            }
            
            if (!(path === base || testPath === localRoot)) {
                var isError = true;
                
                if (isError) {
                    var err = new Error("EACCES: '" + path + "' not in '" + localRoot + "'");
                    err.code = "EACCES";
                    return callback(err);
                }
            }
        }
        
        if (transformPath)
            path = transformPath(path);
        
        if ((checkSymlinks && fsOptions.checkSymlinks || checkSymlinks == 2) && !alreadyRooted)
            fs.realpath(path, callback);
        else
            callback(null, path);
    }
    
    // A wrapper around fs.open that enforces permissions and gives extra data in
    // the callback. (err, path, fd, stat)
    function open(path, flags, mode, options, callback) {
        resolvePath(path, options, function (err, path) {
            if (err) return callback(err);
            fs.open(path, flags, mode, function (err, fd) {
                if (err) return callback(err);
                fs.fstat(fd, function (err, stat) {
                    if (err) return callback(err);
                    callback(null, path, fd, stat);
                });
            });
        });
    }

    // This helper function doesn't follow node conventions in the callback,
    // there is no err, only entry.
    function createStatEntry(file, fullpath, callback, _loop) {
        fs.lstat(fullpath, function (err, stat) {
            var entry = {
                name: file
            };

            if (err) {
                entry.err = err;
                return callback(entry);
            } else {
                entry.size = stat.size;
                entry.mtime = stat.mtime.valueOf();
                entry.ctime = stat.ctime.valueOf();

                if (stat.isDirectory()) {
                    entry.mime = "inode/directory";
                } else if (stat.isBlockDevice()) entry.mime = "inode/blockdevice";
                else if (stat.isCharacterDevice()) entry.mime = "inode/chardevice";
                else if (stat.isSymbolicLink()) entry.mime = "inode/symlink";
                else if (stat.isFIFO()) entry.mime = "inode/fifo";
                else if (stat.isSocket()) entry.mime = "inode/socket";
                else {
                    entry.mime = getMime(fullpath);
                }

                if (!stat.isSymbolicLink()) {
                    return callback(entry);
                }
                fs.readlink(fullpath, function (err, link) {
                    if (err) {
                        entry.linkErr = err.stack;
                        return callback(entry);
                    }
                    var fullLinkPath = pathResolve(dirname(fullpath), link);
                    if (!_loop) {
                        _loop = {fullLinkPath: fullpath, max: 100};
                    }
                    if (fullLinkPath.toLowerCase() == _loop.fullLinkPath.toLowerCase() || _loop.max --< 0) {
                        entry.linkErr = "ELOOP: recursive symlink";
                        return callback(entry);
                    }
                    entry.link = link;
                    resolvePath(fullLinkPath, {alreadyRooted: true}, function (err, newpath) {
                        if (err) {
                            entry.linkErr = err;
                            return callback(entry);
                        }
                        createStatEntry(basename(newpath), newpath, function (linkStat) {
                            entry.linkStat = linkStat;
                            linkStat.fullPath = newpath.substr(base.length) || "/";
                            return callback(entry);
                        }, _loop);
                    });
                });
            }
        });
    }

    // Common logic used by rmdir and rmfile
    function remove(path, fn, options, callback) {
        var meta = {};
        resolvePath(path, options, function (err, realpath) {
            if (err) return callback(err);
            fn(realpath, function done(err) {
                if (err) {
                    if (err.code == "ENOENT") {
                        return fs.exists(realpath, function(exists) {
                            if (exists) err.code = "EACCES";
                            callback(err);
                        });
                    } else {
                        return callback(err);
                    }
                }
                
                // Remove metadata
                resolvePath(WSMETAPATH + path, options, function (err, realpath) {
                    if (err) return callback(null, meta);
                    
                    fn(realpath, function(){
                        return callback(null, meta);
                    });
                });
            });
        });
    }

////////////////////////////////////////////////////////////////////////////////

    function resolve(path, options, callback) {
        resolvePath(path, options, function (err, path) {
            if (err) return callback(err);
            callback(null, { path: path });
        });
    }

    function stat(path, options, callback) {
        // Make sure the parent directory is accessable
        resolvePath(dirname(path), options, function (err, dir) {
            if (err) return callback(err);
            var file = basename(path);
            path = join(dir, file);
            createStatEntry(file, path, function (entry) {
                if (entry.err) {
                    return callback(entry.err);
                }
                callback(null, entry);
            });
        });
    }
    
    function metadata(path, options, callback) {
        if (path.charAt(0) == "~")
            path = join(process.env.HOME, path.substr(1));
        
        var dirpath = (path.substr(0,5) == "/_/_/" 
            ? METAPATH + dirname(path.substr(4))
            : WSMETAPATH + "/" + dirname(path));
            
        resolvePath(dirpath, options, function (err, dir) {
            if (err) return callback(err);
            
            var file = basename(path);
            path = join(dir, file);
            if (pathSep === "\\")
                dir = dir.replace(/\\/g, "/");
                
            execFile("mkdir", { args: ["-p", dir] }, function(err){
                if (err) return callback(err);
                fs.writeFile(path, JSON.stringify(options.metadata), {}, function(err){
                    if (err) return callback(err);
                    callback(null, {});
                });
            });
        });
    }

    function getMetadata(path, options, callback){
        if (path.charAt(0) == "~")
            path = join(process.env.HOME, path.substr(1));
        
        var metaPath = join(WSMETAPATH, path);
        
        resolvePath(metaPath, options, function (err, path) {
            if (err) return callback(err);
            fs.readFile(path, callback);
        });
    }

    function readfile(path, options, callback) {
        var meta = {};
        var originalPath = path;

        open(path, "r", 0666 & ~umask, options, function (err, path, fd, stat) {
            if (err) return callback(err);
            if (stat.isDirectory()) {
                fs.close(fd);
                err = new Error("EISDIR: Requested resource is a directory");
                err.code = "EISDIR";
                return callback(err);
            }

            // Basic file info
            meta.mime = getMime(path);
            meta.size = stat.size;
            meta.etag = calcEtag(stat);

            // ETag support
            if ((TESTING || stat.mtime % 1000) && options.etag === meta.etag) {
                meta.notModified = true;
                fs.close(fd);
                return callback(null, meta);
            }

            // Range support
            if (options.hasOwnProperty('range') && !(options.range.etag && options.range.etag !== meta.etag)) {
                var range = options.range;
                var start, end;
                if (range.hasOwnProperty("start")) {
                    start = range.start;
                    end = range.hasOwnProperty("end") ? range.end : meta.size - 1;
                }
                else {
                    if (range.hasOwnProperty("end")) {
                        start = meta.size - range.end;
                        end = meta.size - 1;
                    }
                    else {
                        meta.rangeNotSatisfiable = "Invalid Range";
                        fs.close(fd);
                        return callback(null, meta);
                    }
                }
                if (end < start || start < 0 || end >= stat.size) {
                    meta.rangeNotSatisfiable = "Range out of bounds";
                    fs.close(fd);
                    return callback(null, meta);
                }
                options.start = start;
                options.end = end;
                meta.size = end - start + 1;
                meta.partialContent = { start: start, end: end, size: stat.size };
            }
            
            var metaData;
            if (options.hasOwnProperty("metadata") && originalPath.indexOf(WSMETAPATH) == -1) {
                getMetadata(originalPath, options, function (err, data) {
                    if (err)
                        return done();
                    try {
                        meta.metadataSize = data.length;
                        meta.metadataStringLength = data.toString("utf8").length;
                        metaData = data;
                        done(true);
                    } catch (e) {
                        fs.close(fd);
                        done();
                    }
                });
            }
            else {
                done();
            }

            function done(fakeStream){
                // HEAD request support
                if (options.hasOwnProperty("head")) {
                    fs.close(fd);
                    return callback(null, meta);
                }
    
                // Read the file as a stream
                try {
                    options.fd = fd;
                    meta.stream = new fs.ReadStream(path, options);
                } catch (err) {
                    fs.close(fd);
                    return callback(err);
                }
                
                if (fakeStream) {
                    var readStream = meta.stream;
                    meta.stream = new Stream();
                    meta.stream.readable = true;
                    meta.stream.writable = true;
                    meta.stream.write = function (data) {
                      meta.stream.emit("data", data);
                      return true;
                    };
                    meta.stream.end = function (data) {
                      meta.stream.emit("end", data);
                    };
                    readStream.pipe(meta.stream, { end : false });
                    readStream.on("end", function(){
                        meta.stream.write(metaData);
                        meta.stream.end();
                    });
                    meta.stream.destroy = function () {
                        readStream.destroy();
                    };
                }
                
                callback(null, meta);
            }
        });
    }

    function readdir(path, options, callback) {
        var meta = {};
        
        resolvePath(path, options, function (err, path) {
            if (err) return callback(err);
            if (isWin && readSpecialDir) {
                if (readSpecialDir(path, callback))
                    return;
            }
            fs.stat(path, function (err, stat) {
                if (err) return callback(err);
                if (!stat.isDirectory()) {
                    err = new Error("ENOTDIR: Requested resource is not a directory");
                    err.code = "ENOTDIR";
                    return callback(err);
                }

                // ETag support
                meta.etag = calcEtag(stat);
                if ((TESTING || stat.mtime % 1000) && options.etag === meta.etag) {
                    meta.notModified = true;
                    return callback(null, meta);
                }

                fs.readdir(path, function (err, files) {
                    if (err) return callback(err);
                    if (options.head) {
                        return callback(null, meta);
                    }
                    var stream = new Stream();
                    stream.readable = true;
                    var paused;
                    stream.pause = function () {
                        if (paused === true) return;
                        paused = true;
                    };
                    stream.resume = function () {
                        if (paused === false) return;
                        paused = false;
                        getNext();
                    };
                    meta.stream = stream;
                    callback(null, meta);
                    var index = 0;
                    stream.resume();
                    function getNext() {
                        if (index === files.length) return done();
                        var file = files[index++];
                        var fullpath = join(path, file);

                        createStatEntry(file, fullpath, function onStatEntry(entry) {
                            stream.emit("data", entry);

                            if (!paused) {
                                getNext();
                            }
                        });
                    }
                    function done() {
                        stream.emit("end");
                    }
                });
            });
        });
    }
    
    // This is used for creating / overwriting files.  It always creates a new tmp
    // file and then renames to the final destination.
    // It will copy the properties of the existing file is there is one.
    function mkfile(path, options, realCallback) {
        var meta = {};
        var called;
        var callback = function (err) {
            if (called) {
                if (err) {
                    if (meta.stream) meta.stream.emit("error", err);
                    else console.error(err.stack);
                }
                else if (meta.stream) meta.stream.emit("saved");
                return;
            }
            called = true;
            return realCallback(err, meta);
        };

        if (options.stream && !options.stream.readable) {
            return callback(new TypeError("options.stream must be readable."));
        }

        // Pause the input for now since we're not ready to write quite yet
        var readable = options.stream;
        if (readable) {
            if (readable.pause) readable.pause();
            var buffer = [];
            readable.on("data", onData);
            readable.on("end", onEnd);
        }
        
        var tempPath;
        var resolvedPath = "";
        var mode = options.mode || 0666 & ~umask;
        
        var createParents = options.parents;

        start();

        function onData(chunk) {
            buffer.push(["data", chunk]);
        }
        function onEnd() {
            buffer.push(["end"]);
        }
        function error(err) {
            if (!options.bufferWrite)
                resume();
            if (tempPath) {
                fs.unlink(tempPath, callback.bind(null, err));
            }
            else
                return callback(err);
        }
        
        function resume() {
            if (readable) {
                // Stop buffering events and playback anything that happened.
                readable.removeListener("data", onData);
                readable.removeListener("end", onEnd);

                buffer.forEach(function (event) {
                    readable.emit.apply(readable, event);
                });
                // Resume the input stream if possible
                if (readable.resume) readable.resume();
            }
        }

        function start() {
            resolve();
        }

        // Make sure the user has access to the directory and get the real path.
        function resolve() {
            options.checkSymlinks = 2;
            resolvePath(path, options, function (err, _resolvedPath) {
                if (err) {
                    if (err.code !== "ENOENT") {
                        return error(err);
                    }
                    // If checkSymlinks is on we'll get an ENOENT when creating a new file.
                    // In that case, just resolve the parent path and go from there.
                    resolvePath(dirname(path), options, function (err, dir) {
                        if (err && err.code === "ENOENT" && createParents) {
                            createParents = false;
                            return mkdirP(dirname(path), options, function(err) {
                                if (err) return error(err);
                                resolve();
                            });
                        }
                        if (err) return error(err);
                        resolvedPath = join(dir, basename(path));
                        createTempFile();
                    });
                    return;
                }
                
                resolvedPath = _resolvedPath;
                createTempFile();
            });
        }
        
        function createTempFile() {
            // Buffer in memory when the bufferWrite option is set to true
            if (options.bufferWrite)
                return bufferAndWrite();
            
            tempPath = tmpFile(dirname(resolvedPath), "." + basename(resolvedPath) + "-", "~");
            
            fs.stat(resolvedPath, create);
            
            function create(err, stat, isParent) {
                if (err) {
                    if (err.code === "ENOENT")
                        return fs.stat(dirname(resolvedPath), function(err, stat){
                            create(err, stat, true);
                        });
                    return error(err);
                }
                
                var uid = process.getuid ? process.getuid() : 0;
                var gid = process.getgid ? process.getgid() : 0;
                
                if (stat) {
                    gid = stat.gid;
                    if (!isParent) {
                        mode = stat.mode & 0777;
                        uid = stat.uid;
                    }
                }
                
                // node 0.8.x adds a "wx" shortcut, but since it's not in 0.6.x we use the
                // longhand here.
                var flags = constants.O_CREAT | constants.O_WRONLY | constants.O_EXCL;
                fs.open(tempPath, flags, mode, options, function (err, fd) {
                    if (err)
                        return pipe();
                    
                    fchown(fd, uid, gid, function(err) {
                        fs.close(fd);
                        if (err) {
                            fs.unlink(tempPath);
                            return pipe();
                        }

                        pipe(new fs.WriteStream(tempPath, {
                            encoding: options.encoding || null,
                            mode: mode
                        }));
                    });
                });
                
                function fchown(fd, uid, gid, callback) {
                    fs.fstat(fd, function (err, stat) {
                        if (err) return callback(err);
                        
                        if (stat.uid == uid && stat.gid == gid)
                            return callback();
                        
                        fs.fchown(fd, uid, gid, callback);
                    });
                }
            }
        }
        
        function bufferAndWrite(){
            var buffers = [];
            var hadError;
            
            readable.on("data", function(chunk){
                buffers.push(new Buffer(chunk));
            });
            
            readable.on("error", function(err){
                hadError = err;
                error(err);
            });
            
            readable.on("end", function(chunk){
                if (hadError) return;
                
                writeToWatchedFile(resolvedPath, function(afterWrite) {
                    fs.writeFile(resolvedPath, Buffer.concat(buffers), function(err) {
                        afterWrite(function() {
                            if (err) return error(err);
                            callback();
                        });
                    });
                });
            });
            
            resume();
        }

        function pipe(writable) {
            var hadError;
            var swap = true;
            
            if (!writable) {
                swap = false;
                writable = new fs.WriteStream(resolvedPath, {
                    encoding: options.encoding || null,
                    mode: mode
                });
            }
            
            if (readable) {
                readable.pipe(writable);
            }
            else {
                writable.on('open', function () {
                    if (hadError) return;
                    meta.stream = writable;
                    callback();
                });
            }
            writable.on('error', function (err) {
                hadError = true;
                error(err);
            });

            // intercept the first close event and perform the swap            
            var emit = writable.emit;
            writable.emit = function(name) {
                var args = arguments;
                
                if (name !== "close")
                    return emit.apply(writable, args);
                    
                writable.emit = emit;
                    
                if (!hadError) {
                    if (!swap) {
                        emit.apply(writable, args);
                        callback();
                    }
                    else {
                        writeToWatchedFile(resolvedPath, function(afterWrite) {
                            fs.rename(tempPath, resolvedPath, function(err) {
                                afterWrite(function() {
                                    if (err) return error(err);
                                    emit.apply(writable, args);
                                    callback();
                                });
                            });
                        });
                    }
                }
                else {
                    emit.apply(writable, args);
                }
                
                return true;
            };

            resume();
        }
    }

    function mkdirP(path, options, callback) {
        resolvePath(path, { checkSymlinks: false, sandbox: options.sandbox }, function(err, dir) {
            if (err) return callback(err);
            
            exists(dir, function(exists) {
                if (exists) return callback(null, {});
                if (pathSep === "\\")
                    dir = dir.replace(/\\/g, "/");
        
                execFile("mkdir", { args: ["-p", dir] }, function(err) {
                    if (err && err.message.indexOf("exists") > -1)
                        callback({"code": "EEXIST", "message": err.message});
                    else
                        callback(null, {});
                });
            });
        });
    }

    function mkdir(path, options, callback) {
        var meta = {};
        
        if (options.parents)
            return mkdirP(path, options, callback);
            
        // Make sure the user has access to the parent directory and get the real path.
        resolvePath(dirname(path), options, function (err, dir) {
            if (err) return callback(err);
            path = join(dir, basename(path));
            fs.mkdir(path, function (err) {
                if (err) return callback(err);
                callback(null, meta);
            });
        });
    }

    function appendfile(path, options, callback) {
        resolvePath(path, options, function (err, resolvedPath) {
            if (err) return callback(err);
            fs.appendFile(resolvedPath, options.data, options, function (err) {
                if (err) return callback(err);
                callback(null, {});
            });
        });
    }

    function rmfile(path, options, callback) {
        remove(path, fs.unlink, options, callback);
    }

    function rmdir(path, options, callback) {
        if (options.recursive) {
            remove(path, function(path, callback) {
                spawn("rm", {args: ["-rf", path], stdio: 'ignore'}, function(err, child) {
                    if (err) return callback(err);
                    child.process.on("close", function(code) {
                        if (code) {
                            var err = new Error("Permission denied.");
                            err.code = "EACCES";
                            return callback(err);
                        }
                        callback();
                    });
                });
            }, options, callback);
        }
        else {
            remove(path, fs.rmdir, options, callback);
        }
    }

    function rename(path, options, callback) {
        var from, to;
        if (options.from) {
            from = options.from; to = path;
        }
        else if (options.to) {
            from = path; to = options.to;
        }
        else {
            return callback(new Error("Must specify either options.from or options.to"));
        }
        var meta = {};
        // Resolve path to source
        resolvePath(from, options, function (err, frompath) {
            if (err) return callback(err);
            // Resolve path to target dir
            resolvePath(dirname(to), options, function (err, dir) {
                if (err) return callback(err);
                var topath = join(dir, basename(to));
                
                exists(topath, function(exists) {
                    // Determine if paths are the same on a case-insensitive file system
                    // (fs.realpath and fs.stat->ino don't help here)
                    var isSamePath = /darwin|^win/.test(os.platform())
                        && frompath.toLowerCase() === topath.toLowerCase();
                    
                    if (!exists || options.overwrite || isSamePath) {
                        // Rename the file
                        renameWatchedFile(frompath, topath, function (err) {
                            if (err) {
                                if (err.code == 'ENOENT' && options.mkdirP != false) {
                                    options.mkdirP = false;
                                    return mkdirP(dir, {}, function(err) {
                                        if (err) return callback(err);
                                        rename(path, options, callback);
                                    });
                                }
                                return callback(err);
                            }
                            
                            if (options.metadata === false) {
                                return callback(null, meta);
                            }

                            // Rename metadata
                            var metaPath = WSMETAPATH;
                            rename(metaPath + from, {
                                to: metaPath + to,
                                metadata: false
                            }, function(err){
                                callback(null, meta);
                            });
                        });
                    }
                    else {
                        var err = new Error("File already exists.");
                        err.code = "EEXIST";
                        callback(err);
                    }
                });
            });
        });
    }

    function copy(path, options, callback) {
        var from, to;
        if (options.from) {
            from = options.from; to = path;
        }
        else if (options.to) {
            from = path; to = options.to;
        }
        else {
            return callback(new Error("Must specify either options.from or options.to"));
        }
        
        if (!options.overwrite) {
            resolvePath(to, options, function(err, path){
                if (err) {
                    if (err.code == "ENOENT")
                        return innerCopy(from, to);
                    
                    return callback(err);
                }
                
                fs.stat(path, function(err, stat){
                    if (!err && stat && !stat.err) {
                        // TODO: this logic should be pushed into the application code
                        var path = to.replace(/(?:\.([\d]+))?(\.[^\.\/\\]*)?$/, function(m, d, e){
                            return "." + (parseInt(d, 10)+1 || 1) + (e ? e : "");
                        });
                        
                        copy(from, {
                            to        : path, 
                            overwrite : false, 
                            recursive : options.recursive,
                            sandbox   : options.sandbox
                        }, callback);
                    }
                    else {
                        innerCopy(from, to);
                    }
                });
            });
        }
        else {
            innerCopy(from, to);
        }
        
        function innerCopy(from, to) {
            if (options.recursive) {
                resolvePath(from, options, function(err, rFrom){
                    resolvePath(to, options, function(err, rTo){
                        spawn("cp", {
                            args: [ "-a", rFrom, rTo ],
                            stdoutEncoding : "utf8",
                            stderrEncoding : "utf8",
                            stdinEncoding : "utf8"
                        }, function(err, child){
                            if (err) return callback(err);
                            
                            var proc = child.process;
                            var hasError;
                            
                            proc.stderr.on("data", function(d){
                                if (d) {
                                    hasError = true;
                                    callback(new Error(d));
                                }
                            });
                            proc.stdout.on("end", function() {
                                if (!hasError)
                                    callback(null, { to: to, meta: null });
                            });
                        });
                    });
                });
            }
            else {
                readfile(from, { sandbox: options.sandbox }, function (err, meta) {
                    if (err) return callback(err);
                    mkfile(to, {stream: meta.stream, sandbox: options.sandbox}, function (err, meta) {
                        callback(err, {
                            to: to,
                            meta: meta
                        });
                    });
                });
            }
        }
    }

    function symlink(path, options, callback) {
        if (!options.target) return callback(new Error("options.target is required"));
        var meta = {};
        // Get real path to target dir
        resolvePath(dirname(path), options, function (err, dir) {
            if (err) return callback(err);
            path = join(dir, basename(path));
            
            resolvePath(options.target, options, function (err, target) {
                if (err) return callback(err);
                fs.symlink(target, path, function (err) {
                    if (err) return callback(err);
                    callback(null, meta);
                });
            });
        });
    }

    function WatcherWrapper(path, options, callback) {
        var listeners  = [];
        var persistent = options.persistent;
        var timer, isDir, watcher, _self = this;
        
        function watch(callback) {
            function sendError(e) {
                if (callback)
                    return callback(e);
                else {
                    throw new Error("File does not exist");
                }
            }
            
            try {
                removeFromList();
                fileWatchers[path] = fileWatchers[path] || [];
                fileWatchers[path].push(_self);
                
                if (options.file) {
                    watcher = fs.watchFile(path, { persistent: false }, onWatchEvent);
                    watcher.close = function() {
                        removeFromList();
                        fs.unwatchFile(path);
                    };
                }
                else {
                    watcher = fs.watch(path, { persistent: false }, onWatchEvent);
                    var close = watcher.close.bind(watcher);
                    watcher.close = function() {
                        removeFromList();
                        close();
                    };
                }
                
                // without this deleting folder on windows was crashing server sometimes with EPERM error
                watcher.on("error", function(e) {
                    console.error("[Watcher error]", e, path);
                });
                
                function removeFromList() {
                    if (fileWatchers[path]) {
                        fileWatchers[path] = fileWatchers[path].filter(function(w) {
                            return w !== _self;
                        });
                        if (!fileWatchers[path].length)
                            delete fileWatchers[path];
                    }
                }
                
            } catch(e) {
                return sendError(e);
            }
            
            callback && callback(null, _self);
        }
        
        function close() {
            watcher && watcher.close();
        }
        
        // Receives watch results, uses buffering
        function onWatchEvent(event, filename) {
            // No need to buffer if we can't expect more events
            if (persistent === false)
                return handleWatchEvent(event, filename);
            
            // 350ms buffer to see if a new event comes in,
            // and grace period where we don't rely on the watchers
            clearTimeout(timer);
            timer = setTimeout(function() {
                handleWatchEvent(event, filename);
            }, 350);
            
            // Continue listening
            // This timeout fixes an eternal loop that can occur with watchers
            // But we should be save the next 350ms anyway per the above
            if (event != "delete") {
                close();
                setTimeout(function() {
                    try {
                        watch(); 
                    } catch(e) {
                        if (e.code == "ENOENT") {
                            event = "delete";
                            sendToAllListeners(event, filename);
                            clearTimeout(timer);
                        }
                    }
                }, 15);
            }
        }
        
        var handleWatchEvent = this.handleWatchEvent = function(event, filename, isVfsWrite) {
            // it is a temp file
            if (filename && filename.substr(-1) == "~" 
              && filename.charAt(0) == ".")
                return;
                
            createStatEntry(pathBasename(path), path, function(entry) {
                entry.vfsWrite = isVfsWrite || false;
                
                if (entry.err) {
                    event = "delete";
                    close();
                }
                else if (isDir) {
                    event = "directory";
                    
                    // This timeout helps when (for instance git) updates
                    // many files in a folder at the same time.
                    fs.readdir(path, function (err, files) {
                        if (err) {
                            event = "error";
                            return sendToAllListeners(event, filename, entry, err);
                        }
                        
                        var latest, i = 0;
                        function statFiles() {
                            var file = files[i];
                            if (!file) return done();
                            
                            var fullpath = join(path, file);
                            createStatEntry(file, fullpath, function(entry) {
                                files[i++] = entry;
                                
                                if (!latest || entry.mtime > latest.mtime)
                                    latest = entry;
                                
                                statFiles();
                            });
                        }
                        
                        function done() {
                            // Ignore if files is tmp file
                            if (latest && (latest.name.substr(-1) == "~" || latest.name[1] === "~")
                              && latest.name.charAt(0) == ".")
                                return;
                            
                            sendToAllListeners(event, filename, entry, files);
                        }
                        
                        statFiles();
                    });
                    return;
                }
                
                sendToAllListeners(event, filename, entry);
            });
        }

        var sendToAllListeners = this.sendToAllListeners = function(event, filename, entry, files) {
            listeners.forEach(function(fn) {
                fn(event, filename, entry, files);
            });
        };
        
        this.close = function(){
            listeners  = [];
            if (watcher) {
                watcher.removeListener("change", handleWatchEvent);
                watcher.close();
            }
        };
        
        this.on = function(name, fn){
            if (name != "change")
                watcher.on.apply(watcher, arguments);
            else {
                listeners.push(fn);
            }
        };
        
        this.removeListener = function(name, fn){
            if (name != "change")
                watcher.removeListener.apply(watcher, arguments);
            else {
                listeners.splice(listeners.indexOf(fn), 1);
            }
        };
        
        this.pause = function() {
            close();
        };
        
        this.resume = function(callback, newPath) {
            if (newPath)
                path = newPath;
            if (!listeners.length)
                return callback();
            watch(callback);
        };
        
        fs.stat(path, function (err, stat) {
            if (err) {
                callback(err);
                return sendToAllListeners("delete");
            }
            
            if (isDir === undefined)
                isDir = stat && stat.isDirectory();
            
            watch(callback);
        });
    }

    function watch(path, options, callback) {
        resolvePath(path, options, function (err, path) {
            if (isWin && isSpecialPath(path)) return callback(true);
            if (err) return callback(err);
            
            new WatcherWrapper(path, options, function(err, watcher){
                if (err) return callback(err);
                callback(null, { watcher: watcher });
            });
        });
    }
    
    /**
     * Write to a file that may be watched by a file watcher,
     * making sure its file watching events are properly sent.
     * 
     * @param {String} path                            Path of our file
     * @param {Function} callback                      Function writing to path
     * @param {Function} callback.afterWrite           Function to call when done writing
     * @param {Function} callback.afterWrite.callback  Callback of afterWrite()
     */
    function writeToWatchedFile(path, callback) {
        if (!fileWatchers[path])
            return callback(function(c) { c(); });
            
        var watchers = fileWatchers[path].slice();
        var parentDir = dirname(path) + "/";
        var dirWatchers = (fileWatchers[parentDir] || []).slice();

        watchers.forEach(function(w) {
            w.pause();
        });
        callback(done);
        
        function done(callback) {
            if (!watchers.length)
                return callback();
            
            // Notify each watcher of changes and reactivate it
            var watcher = watchers.pop();
            fs.stat(path, function(err, stat) {
                if (err || !stat) return;
                stat.vfsWrite = true;
                watcher.sendToAllListeners("change", basename(path), stat);
            });
            watcher.resume(function() {
                done(callback);
            });
        }
    }
    
    function renameWatchedFile(frompath, topath, callback) {
        var removed = [];
        Object.keys(fileWatchers).forEach(function(path) {
            if (path.slice(0, frompath.length) == frompath && (path[frompath.length] == "/" || !path[frompath.length])) {
                var watchers = fileWatchers[path].slice();
                watchers.forEach(function(w) {
                    w.pause();
                });
                removed.push({
                    relpath: path.slice(frompath.length),
                    watchers: watchers
                });
            }
        });
        fs.rename(frompath, topath, function(err) {
            var root = err ? frompath : topath;
            removed.forEach(function(x) {
                var path = root + x.relpath;
                x.watchers.forEach(function(w) {
                    w.resume(function() {
                    }, path);
                });
            });
            callback(err);
        });
    }

    function connect(port, options, callback) {
        var retries = options.hasOwnProperty('retries') ? options.retries : 5;
        var retryDelay = options.hasOwnProperty('retryDelay') ? options.retryDelay : 50;
        tryConnect();
        function tryConnect() {
            var called = false;
            var socket = net.connect(port, "127.0.0.1", function() {
                if (called) return;
                called = true;
                
                if (options.hasOwnProperty('encoding')) {
                    socket.setEncoding(options.encoding);
                }
                callback(null, {stream:socket});
            });
            socket.once("error", function (err) {
                if (err.code === "ECONNREFUSED" && retries) {
                    setTimeout(tryConnect, retryDelay);
                    retries--;
                    retryDelay *= 2;
                    return;
                }
                
                if (called) return;
                called = true;
                return callback(err);
            });
        }
    }

    function chmod(path, options, callback) {
        resolvePath(path, options, function(err, path){
            if (err) return callback(err);
            
            _execFile("chmod", [options.mode, path], {}, 
              function (err, stdout, stderr) {
                if (err) {
                    err.stderr = stderr;
                    err.stdout = stdout;
                    return callback(err);
                }
    
                callback(null, {});
            });
        });
    }
    
    function spawn(executablePath, options, callback) {
        if (waitForEnv)
            return waitForEnv.push(spawn.bind(null, executablePath, options, callback));
            
        var args = options.args || [];
        
        _setDefaultEnv(options);
        
        resolvePath(executablePath, { 
            nocheck       : 1,
            alreadyRooted : true
        }, function(err, path){
            if (err) return callback(err);
            
            var child;
            try {
                child = childProcess.spawn(path, args, options);
            } catch (err) {
                return callback(err);
            }
            if (options.resumeStdin) child.stdin.resume();
            if (options.hasOwnProperty('stdoutEncoding')) {
                child.stdout && child.stdout.setEncoding(options.stdoutEncoding);
            }
            if (options.hasOwnProperty('stderrEncoding')) {
                child.stderr && child.stderr.setEncoding(options.stderrEncoding);
            }
            
            // node 0.10.x emits error events if the file does not exist
            child.on("error", function(err) {
                child.emit("exit", 127);
            });
    
            callback(null, {
                process: child
            });
        });
    }
    
    function ptyspawn(executablePath, options, callback) {
        var args = options.args || [];
        delete options.args;
        
        _setDefaultEnv(options);
        delete options.env.TMUX;
            
        if (options.testing) {
            args.forEach(function(arg, i){
                args[i] = arg.replace(/^~/, process.env.HOME);
            });
        }
        
        resolvePath(executablePath, { 
            nocheck       : 1,
            alreadyRooted : true
        }, function(err, path){
            if (err) return callback(err);
            
            if (options.validatePath)
                fs.exists(path, check);
            else
                check(true);
                
            function check(exists){
                if (!exists) {
                    var err = new Error("ENOENT: file not found " + path);
                    err.code = "ENOENT";
                    return callback(err);
                }
                
                var proc;
                try {
                    proc = pty.spawn(path, args, options);
                    proc.on("error", function(){
                        // Prevent PTY from throwing an error;
                        // I don't know how to test and the src is funky because
                        // it tests for .length < 2. Who is setting the other event?
                    });
                    proc.resizeOrig = proc.resize;
                    proc.resize = function(cols, rows) {
                        try {
                            proc.resizeOrig(cols, rows);
                        } catch(e) {
                            console.error("error when resizing terminal", e);
                            return;
                        }
                        // todo add resize event    
                        proc.emit("data", {rows: rows, cols: cols});
                        
                        if (!tmuxWarned && !isWin) {
                            if (/v0\.([123456789]\..*|10\.(0|1|2[0-7]))/.test(process.version)) {
                                proc.emit("data", {
                                    message: "Wrong Node.js version: " + process.version, 
                                    code: "EINSTALL"
                                });
                            }
                            else if (TMUXNAME == "cloud91.6") {
                                proc.emit("data", {
                                    message: "Wrong TMUX version: 1.6", 
                                    code: "EINSTALL"
                                });
                            }
                            else if (noTmux) {
                                proc.emit("data", {
                                    message: "Please make sure TMUX is installed", 
                                    code: "EINSTALL"
                                });
                            }
                            tmuxWarned = true;
                        }
                    };
                } catch (err) {
                    return callback(err);
                }
                
                callback(null, {
                    pty: proc
                });
            }
        });
    }
    
    function escapeRegExp(str) {
        return str.replace(/[-[\]{}()*+?.,\\^$|#\s"']/g, "\\$&");
    }
    
    /**
     * @param {Boolean}   [options.kill]         First kill an existing session
     * @param {Boolean}   [options.attach]       Attach if the session exists
     * @param {Boolean}   [options.detach]       Detach immediately after starting the process. This will return a pid instead of a pty.
     * @param {Boolean}   [options.detachOthers] Detach other clients immediately after starting the process
     * @param {Boolean}   [options.fetchpid]     Return the pid of the process started in the tmux session, or -1 if it's no longer running
     * @param {Boolean}   [options.output]       Act like an output pane
     * @param {Boolean}   [options.base]         The base path to store the watch files
     */
    function tmuxspawn(ignored, options, callback) {
        var tmuxName = options.tmuxName || TMUXNAME;
        var session = options.session;
        
        _setDefaultEnv(options);
        delete options.env.TMUX;
        
        function getFormatString(map) {
            return Object.keys(map).filter(function(x) {
                return x[0] == "#";
            }).join("\x01");
        }
        
        function getFormatObject(map, str) {
            var data = str.split("\x01");
            var result = {};
            Object.keys(map).forEach(function(key, i) {
                if (key[0] != "#") return;
                var val = data[i];
                if (i >= map.numberDataIndex)
                    val = parseInt(val, 10) || 0;
                result[map[key]] = val;
            });
            return result;
        }
        
        function fetchPid(callback, retries) {
            if (!retries) retries = 0;
            _execFile(TMUX, [
                "-u2", "-L", tmuxName, "-C",
                "list-panes", "-F", "c9-pid-#{pane_pid}-#{pane_dead}-#{pane_status}",
                "-t", session
            ], {
                maxBuffer: 1000 * 1024,
                env: options.env,
            }, function(err, stdout) {
                var matches = /c9-pid-(\d+)-(\d)-/.exec(stdout);
                var isDead = parseInt(matches && matches[2], 10);
                var pid = isDead ? 0 : parseInt(matches && matches[1], 10);
                
                if (!pid && !isDead && retries < 10) {
                    setTimeout(fetchPid.bind(null, callback, ++retries), 30);
                    return;
                }
                
                callback(err, { 
                    pid: pid || -1
                });
            });
        }
        
        // Fetch PID of a running process and return it
        if (options.fetchpid)
            return fetchPid(callback);
        
        
        // Capture the scrollback of a pane
        if (options.capturePane) {
            options = options.capturePane;
            args = [
                "-u2", // force utf and 256 color
                "-L", tmuxName,
                "capture-pane", options.joinLines !== false ? "-peJ" : "-pe",
                "-S", options.start, 
                "-E", options.end, 
                "-t", options.pane
            ];
            
            var child;
            try {
                child = childProcess.spawn(TMUX, args, options);
            } catch (err) {
                return callback(err);
            }
            child.stdout.setEncoding("utf8");
            child.stderr.setEncoding("utf8");
            
            // node 0.10.x emits error events if the file does not exist
            child.on("error", function(err) {
                child.emit("exit", 127);
            });
    
            callback(null, {
                process: child
            });
            
            return;
        }
        
        if (options.listSessions) {
            args = ["-u2", "-L", tmuxName];
            
            var sessionFormat = {
                "#S": "name",
                "#{session_id}": "id",
                "#{session_attached}": "clientCount",
                "#{session_activity}": "activity",
                "#{session_created}": "created",
                "#{session_height}": "height",
                "#{session_width}": "width",
                numberDataIndex: 2,
            };

            args.push("list-sessions", "-F", getFormatString(sessionFormat));
            
            return _execFile(TMUX, args, options, function(e, data) {
                var sessions = [];
                (data || "").split("\n").forEach(function(str) {
                    if (!str)
                        return;
                    var session = getFormatObject(sessionFormat, str);
                    sessions.push(session);
                });
                callback(e, {sessions: sessions});
            });
        }
        
        else if (options.getStatus) {
            options = options.getStatus;
            var sessionId = options.id;
            var args = ["-u2", "-L", tmuxName];
            
            var paneFormat = {
                "#S"                        : "session",
                "#{pane_current_path}"      : "path",
                "#{pane_current_command}"   : "command",
                "#{pane_width}"             : "width",
                "#{pane_height}"            : "height",
                "#{history_limit}"          : "length",
                "#{history_size}"           : "line",
                "#{cursor_x}"               : "x",
                "#{cursor_y}"               : "y",
                "#{saved_cursor_x}"         : "savedX",
                "#{saved_cursor_y}"         : "savedY",
                "#{scroll_region_lower}"    : "scrollRegionLower",
                "#{scroll_region_upper}"    : "scrollRegionUpper",
                numberDataIndex             : 3,
            };
            
            var clientFormat = {
                "#{client_session}"  : "session",
                "#{client_created}"  : "created",
                "#{client_activity}" : "activity",
                "#{client_width}"    : "width",
                "#{client_height}"   : "height",
                numberDataIndex      : 1,
            };
            
            args.push("list-panes", "-F", getFormatString(paneFormat));
            if (sessionId)
                args.push("-t", sessionId);
            else
                args.push("-a");
            
            if (options.listClients !== false) {
                args.push(";", "list-clients", "-F", "\n" + getFormatString(clientFormat));
                if (sessionId)
                    args.push("-t", sessionId);
            }
            
            return _execFile(TMUX, args, options, function(e, data) {
                var panes = {};
                var clientsSection = false;
                (data || "").split("\n").forEach(function(str) {
                    if (!str)
                        return (clientsSection = true);
                        
                    var pane;
                    if (clientsSection) {
                        var client = getFormatObject(clientFormat, str);
                        pane = panes[client.session];
                        if (pane)
                            pane.clients.push(client);
                    } else {
                        pane = getFormatObject(paneFormat, str);
                        panes[pane.session] = pane;
                        pane.clients = [];
                    }
                });
                // panes.raw = data;
                if (sessionId)
                    panes = panes[sessionId];
                callback(e, {status: panes});
            });
        }
        
        // Kill the session with the same name before starting a new one
        else if (options.kill) {
            if (!options.session)
                return callback(new Error("Missing session name"));

            // logToFile("Kill: " + options.session);
            
            _execFile(TMUX, 
                ["-L", tmuxName, "-C", "kill-session", "-t", options.session], 
                options,
                function(err) {
                    if (!options.command)
                        return callback(err, {});
                    
                    start(); 
                });
        }
        // Attach to a session with the same name if it exists
        else if (options.attach) {
            if (!options.session)
                return callback(new Error("Missing session name"));
            
            (function findSession(retries){
                _execFile(TMUX, ["-u2", "-L", tmuxName, "list-sessions"], options, function(err, stdout) {
                    if (err) stdout = ""; // This happens when the tmux server has not been started yet
                
                    var re = new RegExp("^" + escapeRegExp(options.session) + ":", "m");
                    if (stdout.match(re))
                        start(true);
                    else if (options.output && retries < 100) {
                        setTimeout(findSession.bind(null, ++retries), 10);
                    }
                    else {
                        // var error = new Error("Session doesn't exist: " + options.session);
                        // error.code = "ENOSESSIONFOUND";
                        // callback(error);
                        start(false);
                    }
                });
            })(0);
        }
        // Just start a new session. This will fail if a session with that name already exists
        else 
            start();
        
        function start(attach){
            var args = [];
            
            if (!options.env) options.env = {};
            
            if (attach) {
                // logToFile("Attach: " + options.session);
                
                args = ["-u2", "-L", tmuxName, "attach", "-t", options.session];
                if (options.detachOthers) {
                    // Work around https://github.com/chjj/pty.js/issues/68
                    if (/v0\.([123456789]\..*|10\.(0|1|2[0-7]))/.test(process.version))
                        console.log("detachOthers not supported, ignoring");
                    else
                        args.push("-d");
                }
            }
            else {
                // logToFile("New: " + options.session);
                
                args = ["-u2", "-L", tmuxName, "new", "-s", options.session];
                
                if (options.terminal) {
                    args.push("export ISOUTPUTPANE=0;"
                        + (options.defaultEditor
                            ? " export EDITOR='`which c9` open --wait'; "
                            : "")
                        + BASH + " -l");
                }
                else if (options.idle) {
                    args.push(BASH + " -l -c 'printf \"\\e[01;34m[Idle]\\e[0m\\n\""
                        + "; sleep 0.1;'");
                }
                else if (options.command) {
                    args.push(BASH + " -l -c '"
                        + (
                            'trap \'printf "\\e[01;30m\\n\\nProcess exited with code: $?\\e[0m\\n"\' EXIT\n'
                            + options.command
                        ).replace(/'/g, "'\\''")
                        + "'");
                }
                
                args.push(
                    ";", "set", "-q", "-g", "status", "off",
                    ";", "set", "-q", "destroy-unattached", "off",
                    ";", "set", "-q", "mouse-select-pane", "on",
                    ";", "set", "-q", "set-titles", "on",
                    ";", "set", "-q", "quiet", "on",
                    ";", "set", "-q", "-g", "prefix", "C-b",
                    ";", "set", "-q", "-g", "default-terminal", "xterm-256color",
                    ";", "setw", "-q", "-g", "xterm-keys", "on"
                );
                
                // disable buffering of tmux output
                // old versions of tmux skip parts of output without this flag
                if (parseFloat(TMUXNAME.substr("cloud9".length)) < 2.1)
                    args.push(";", "setw", "-q", "c0-change-trigger", "0");
                
                if (options.output) {
                    args.push(
                        ";", "set", "-q", "remain-on-exit", "on",
                        ";", "setw", "-q", "-g", "aggressive-resize", "on"
                    );
                }
                
                
                if (options.detach && options.output) {
                    args.unshift("-C");
                    args.push(";", "list-panes", "-F", "c9-pid#{pane_pid}-");
                }
                if (options.detach)
                    args.push(";", "detach");
                
                // Prevent welcome message
                options.env["ISOUTPUTPANE"] = "1";
            }
            
            run();
            
            function run(err){
                if (err) return callback(err);
                
                // HACK: workaround for tmux 2.2 bug: 
                // tmux passes PATH to new sessions breaking rvm
                var sep = isWin ? ";" : ":";
                options.env.PATH = options.env.PATH.split(sep).filter(function(p) {
                    return !/\/rvm\//.test(p);
                }).join(sep);
                // ENDHACK
                
                if (options.detach && options.output) {
                    
                    return _execFile(TMUX, args, {
                        args: args,
                        name: options.name,
                        cwd: options.cwd,
                        resolve: options.resolve,
                        env: options.env
                    }, function(err, stdout) {
                        var m = /c9-pid(\d+)-/.exec(stdout);
                        var pid = parseInt(m && m[1], 10);
                        callback(err, {pid: pid});
                    });
                }
                
                ptyspawn(TMUX, {
                    args: args,
                    name: options.name,
                    cols: options.cols,
                    rows: options.rows,
                    cwd: options.cwd,
                    resolve: options.resolve,
                    env: options.env
                }, function(err, meta){
                    if (err) {
                        logToFile("TMUX ERROR: " + err.message);
                        return callback(err);
                    }
                    
                    if (!attach) {
                        meta.pty.on("data", function wait(data){
                            if (data)
                                meta.pty.removeListener("data", wait);
                            // Look for error states in plain text from tmux
                            if (data.indexOf("can't create socket") > -1) {
                                var err = new Error(data);
                                err.type = "exception";
                                err.code = "EPERM";
                                meta.pty.emit("data", err);
                            }
                        });
                    }
                    
                    // Return the pty
                    callback(null, meta);
                    
                    if (attach)
                        meta.pty.emit("data", { started: true });
                });
            }
        }
    }
    
    function PtyStream(pty, isOutput, old){
        if (old) {
            return old.attachTo(pty, isOutput);
        }
        var exited = false;
        var killed = false;
        
        this.readable = true;
        this.writable = true;
        
        this.__defineGetter__("pid", function(){
            return exited ? -1 : pty.pid; 
        });
        
        function exit(){
            if (exited) return;
            
            exited = true;
            emit("data", ["\n\x1b[1mPane is dead\x1b[H"]);
            pty.kill();
            pty.kill = function() {};
        }
        
        this.attachTo = function(newPty) {
            pty = newPty;
            exited = false;
            killed = false;
        
            this.readable = true;
            this.writable = true;

            Object.keys(events).forEach(forwardEvent);
            return this;
        }
        
        this.killtree = 
        this.kill = isOutput ? function(signal){
            // We dont want to really kill, just stop the process
            if (signal == -1) {
                if (exited)
                    emit("kill");
                else {
                    exit();
                    
                    pty.on("exit", function(){
                        emit("kill");
                    });
                }
                pty.suspended = true;
                return;
            }
            
            killed = true;
            
            // Otherwise we really kill this pty
            emit("end");
            emit("exit");
        } : function(){
            pty.kill();
            // sometimes this can be called twice from worker and from options.kill
            // pty.js doesn't like that
            pty.kill = function() {};
        };
        
        this.destroy = function(){
            return pty.destroy.apply(pty, arguments);
        };
        
        this.end = function(){
            return pty.end.apply(pty, arguments);
        };
        
        this.write = function() {
            return pty.write.apply(pty, arguments);
        };
        
        this.resize = function() {
            if (!exited)
                return pty.resize.apply(pty, arguments);
        };
        
        // this.acknowledgeWrite = function(callback) {
        //     setTimeout(callback, 50); // 50ms time to ack input, per Winstein and Balakrishnan, 2013
        // };
        
        var events = {};
        function forwardEvent(name){
            events[name] = events[name] || [];
            
            if (isOutput && (name == "exit" || name == "close" || name == "end")) {
                if (name != "exit") return;
                
                pty.on("exit", function(){
                    exit();
                });
            }
            else {
                pty.on(name, function(){
                    emit(name, arguments);
                });
            }
        }
        
        function emit(name, args){
            if (!events[name]) 
                return;
                
            events[name].forEach(function(fn){ fn.apply(pty, args); });
        }
        
        this.on = 
        this.addListener = function(name, fn){
            if (!events[name]) forwardEvent(name);
            events[name].push(fn);
        };
        
        this.off = 
        this.removeListener = function(name, fn){
            var idx = events[name].indexOf(fn);
            if (idx > -1) events[name].splice(idx, 1);
        };
        
        this.emit = emit;
    }
    
    // Same as tmuxspawn but than spawns bash or other shell, for windows
    var sessions = {};
    function bashspawn(ignored, options, callback) {
        var session;
        
        function getSessionId(){
            var id = "session" + Math.round(Math.random() * 1000);
            return sessions[id] ? getSessionId() : id;
        }
        
        // Fetch PID of a running process and return it
        if (options.fetchpid) {
            session = sessions[options.session];
            setTimeout(function() {
                callback(null, { pid: session && session.pty ? session.pty.pid : -1 });
            }, 100); // workaround for late exit message from winpty
            return;
        }
        
        // Capture the scrollback of a pane
        if (options.capturePane)
            return callback(new Error("Not Supported on Windows"));
        
        // Kill the session with the same name before starting a new one
        if (options.kill) {
            session = sessions[options.session];
            if (session && session.pty)
                session.pty.kill();
            
            if (!options.command)
                return callback(session ? null : new Error("No Session Found"), {});
            
            start(); 
        }
        // Attach to a session with the same name if it exists
        else if (options.attach) {
            if (!options.session)
                return callback(new Error("Missing session name"));
            
            session = sessions[options.session];
            if (session) {
                if (session.wait)
                    session.wait.push(callback);
                else if (session.pty && !session.pty.suspended)
                    callback(null, { pty: session.pty });
            }
            else
                start();
        }
        // Just start a new session. This will fail if a session with that name already exists
        else {
            if (options.session && sessions[options.session]) {
                callback(new Error("Session Already Started"));
            }
            
            start();
        }
        
        function start() {
            if (!options.session)
                return callback(new Error("Missing session name"));

            var args = ["-l", "-i"];
            var name = options.session || getSessionId();
            
            var session    = sessions[name] || {};
            sessions[name] = session;
            if (!session.wait) session.wait = [];
            
            if (options.idle) {
                options.command = "echo '\033[2J\033[1;1H\033[01;34m[Idle]\033[0m'";
            } else if (options.command) {
                options.command = "echo '\033[2J\033[1;1H';" + options.command
                    + ';printf "\033[01;30m\n\nProcess exited with code: $?\033[0m\n"';
            }
            
            if (options.command) {
                args.push("-c", (isWin ? "nodosfilewarning=1;": "") + options.command);
            }
            
            run();
            
            function run(err){
                if (err) return callback(err);

                // Start PTY with TMUX
                ptyspawn(options.BASH || BASH, {
                    args: args,
                    name: options.name,
                    cols: options.cols,
                    rows: options.rows,
                    cwd: options.cwd,
                    resolve: options.resolve,
                    env: options.env || {}
                }, function(err, meta){
                    if (err) return callback(err);
                    
                    session.pty = meta.pty = 
                        new PtyStream(meta.pty, options.output, session.pty);
                    
                    var wait = session.wait;
                    delete session.wait;
                    wait.forEach(function(cb){ 
                        cb(null, { pty: session.pty }); 
                    });
                    
                    // Clear Session when pty ends
                    meta.pty.on("exit", function(){
                        delete sessions[name];
                    });
                    
                    // Fetch the PID if appropriate
                    if (options.detach && options.output) {
                        session.pty.on("data", function wait(data){
                            // if (data.indexOf("aggressive-resize") > -1) {
                            
                            session.pid = meta.pid = session.pty.pid;
                            callback(null, meta);
                                
                            session.pty.removeListener("data", wait);
                            // }
                        });
                        return;
                    }
                    
                    // Return the pty
                    callback(null, meta);
                });
            }
        }
    }

    function execFile(executablePath, options, callback) {
        if (waitForEnv)
            return waitForEnv.push(execFile.bind(null, executablePath, options, callback));
        
        if (isWin && execFileWin(executablePath, options, callback))
            return;
        
        _setDefaultEnv(options);
        
        resolvePath(executablePath, {
            nocheck       : 1,
            alreadyRooted : true
        }, function(err, path){
            if (err) return callback(err);
            
            _execFile(path, options.args || [], 
              options, function (err, stdout, stderr) {
                if (err) {
                    err.stderr = stderr;
                    err.stdout = stdout;
                    return callback(err);
                }
    
                callback(null, {
                    stdout: stdout,
                    stderr: stderr
                });
            });
        });
    }
    
    function execFileWin(executablePath, options, callback) {
        if (executablePath == "kill") {
            var pid = options.args && options.args[0];
            
            Object.keys(sessions).some(function(key) {
                if (sessions[key].pid == pid && sessions[key].pty) {
                    sessions[key].pty.killtree(-1);
                    return true;
                }
            });
            callback();
            return true;
        }
    }
    
    function _setDefaultEnv(options) {
        if (options.hasOwnProperty("env"))
            options.env.__proto__ = fsOptions.defaultEnv;
        else
            options.env = fsOptions.defaultEnv;
        
        // Pty is only reading from the object itself;
        var env = {};
        for (var prop in options.env)
            env[prop] = options.env[prop];
        options.env = env;
        
        if (options.cwd && options.cwd.charAt(0) == "~")
            options.cwd = options.env.HOME + options.cwd.substr(1);
        
        if (transformPath && options.cwd)
            options.cwd = transformPath(options.cwd);
    }

    function killtree(pid, options, callback) {
        var code = options.code || options.graceful ? "SIGTERM" : "SIGKILL";
        
        childrenOfPid(pid, function killList(err, pidlist){
            if (err)
                return callback(err);
            
            pidlist.forEach(function (pid) {
                // if asked to kill ourselves do that only after killing all the children
                if (pid == process.pid) {
                   return setTimeout(function() {
                       process.kill(pid, code);
                   });
                }
                try {
                    process.kill(pid, code);
                } catch(e) {
                    if (e.code == "ESRCH")
                        return; // kill may throw if the pid does not exist.
                    // todo try killing with sudo in case of "EPERM"
                }
            });
            if (options.graceful && code != "SIGKILL") {
                code = "SIGKILL";
                setTimeout(function() {
                    killList(null, pidlist);
                }, options.timeout || 800);
            } else {
                callback(null, {});
            }
        });
    }

    function childrenOfPid(pid, callback) {
        if (isWin)
            return callback(null, [pid]);
        
        _execFile("ps", ["-A", "-oppid,pid"], function(err, stdout, stderr) {
            if (err)
                return callback(err);

            var parents = {};
            stdout.split("\n").slice(1).forEach(function(line) {
                var col = line.trim().split(/\s+/g);
                (parents[col[0]] || (parents[col[0]] = [])).push(parseInt(col[1]));
            });

            function search(roots) {
                var res = roots.concat();
                for (var i = 0; i < roots.length; i++) {
                    var c = parents[roots[i]];
                    if (c) res.push.apply(res, search(c));
                }
                return res;
            }
            callback(null, search([pid]));
        });
    }

    function on(name, handler, callback) {
        if (!handlers[name]) handlers[name] = [];
        handlers[name].push(handler);
        callback && callback();
    }

    function off(name, handler, callback) {
        var list = handlers[name];
        if (list) {
            var index = list.indexOf(handler);
            if (index >= 0) {
                list.splice(index, 1);
            }
        }
        callback && callback();
    }

    function emit(name, value, callback) {
        var list = handlers[name];
        if (list) {
            for (var i = 0, l = list.length; i < l; i++) {
                list[i](value);
            }
        }
        callback && callback();
    }

    function extend(name, options, callback) {
        if (!name) {
            var err = new Error("EACCES: Invalid extension name");
            err.code = "EACCES";
            return callback(err);
        }

        var meta = {};
        // Pull from cache if it's already loaded.
        if (!options.redefine && apis.hasOwnProperty(name)) {
            var err = new Error("EEXIST: Extension API already defined for " + name);
            err.code = "EEXIST";
            return callback(err, { api: apis[name] });
        }
        
        if (options.redefine && apis[name] && apis[name].destroy)
            apis[name].destroy();

        var fn;

        // The user can pass in a path to a file to require
        if (options.file) {
            try { fn = require(options.file); }
            catch (err) { return callback(err); }
            exec(fn);
        }

        // User can pass in code as a pre-buffered string
        else if (options.code) {
            try { fn = evaluate(options.code, name); }
            catch (err) { return callback(err); }
            exec(fn);
        }

        // Or they can provide a readable stream
        else if (options.stream) {
            consumeStream(options.stream, function (err, code) {
                if (err) return callback(err);
                var fn;
                try {
                    fn = evaluate(code);
                } catch(err) {
                    return callback(err);
                }
                exec(fn);
            });
        }

        else {
            return callback(new Error("must provide `file`, `code`, or `stream` when cache is empty for " + name));
        }

        function exec(fn) {
            delete options.code;
            delete options.stream;
            delete options.file;

            fn(vfs, options, function(err, exports) {
                if (err) {
                    return callback(err);
                }
                exports.names = Object.keys(exports);
                exports.name = name;
                
                wrapDomain(exports);
                
                if (exports.on)
                    console.warn("Warning: " + name + " exports 'on' symbol that will be overwritten");
                apis[name] = exports;
                meta.api = exports;
                callback(null, meta);
            });
        }

    }

    function unextend(name, options, callback) {
        if (apis[name] && apis[name].destroy)
            apis[name].destroy();
            
        delete apis[name];
        callback(null, {});
    }

    function use(name, options, callback) {
        var api = apis[name];
        if (!api) {
            var err = new Error("ENOENT: There is no API extension named " + name);
            err.code = "ENOENT";
            return callback(err);
        }
        callback(null, {api:api});
    }

////////////////////////////////////////////////////////////////////////////////
    
    if (fsOptions.extendApi) {
        for (var i in fsOptions.extendApi) {
            extend(i, fsOptions.extendApi[i], function() {});
        }
    }
    
    return vfs;

};

// Consume all data in a readable stream and call callback with full buffer.
function consumeStream(stream, callback) {
    var chunks = [];
    stream.on("data", onData);
    stream.on("end", onEnd);
    stream.on("error", onError);
    function onData(chunk) {
        chunks.push(chunk);
    }
    function onEnd() {
        cleanup();
        callback(null, chunks.join(""));
    }
    function onError(err) {
        cleanup();
        callback(err);
    }
    function cleanup() {
        stream.removeListener("data", onData);
        stream.removeListener("end", onEnd);
        stream.removeListener("error", onError);
    }
}

// node-style eval
function evaluate(code, name) {
    var exports = {};
    var module = { exports: exports };
    var fn = vm.runInThisContext(
        "(function(require, exports, module, __dirname, __filename) {"
            + code
            + "})"
        , name || "dynamic-" + Date.now().toString(36));
    fn(require, exports, module, "", "");
    return module.exports;
}

// Calculate a proper etag from a nodefs stat object
function calcEtag(stat) {
  return (stat.isFile() ? '': 'W/') + '"' + (stat.ino || 0).toString(36) + "-" + stat.size.toString(36) + "-" + stat.mtime.valueOf().toString(36) + '"';
}

function uid(length) {
    return (crypto
        .randomBytes(length)
        .toString("base64")
        .slice(0, length)
        .replace(/[+\/]+/g, "")
    );
}

function tmpFile(baseDir, prefix, suffix) {
    return join(baseDir, [prefix || "", uid(20), suffix || ""].join(""));
}
