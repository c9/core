define(function (require, exports, module) {
"use strict";

return function(_request) {
    
    function request(method, path, body, callback, progress, sync, headers) {
        return _request(path, {
            method: method,
            body: body,
            headers: headers,
            progress: progress,
            sync: sync,
            timeout: 60000
        }, callback);
    }
    
    function _readFile(path, encoding, callback, progress, metadata) {
        if (typeof encoding == "function") {
            progress = callback;
            callback = encoding;
            encoding = null;
        }
        // Make sure the path doesn't have a trailing /
        // It would then be interpreted as a directory
        if (path.substr(-1) == "/")
            path = path.substr(0, path.length - 1);
        
        if (!path) {
            var err = new Error("Cannot read root as file");
            err.code = "EISDIR";
            return callback(err);
        }
        
        var headers = metadata ? { "x-request-metadata": "true" } : null;
        return request("GET", path, "", function(err, data, res) {
            if (err)
                return metadata ? callback(err, null, null, res) : callback(err, null, res);
            var hasMetadata = res.headers["x-metadata-length"] != undefined;            
            if (metadata || hasMetadata) {
                var ml = parseInt(res.headers["x-metadata-length"], 10) || 0;
                var ln = data.length;
                if (!metadata) {
                    var $reqHeaders = res.$reqHeaders;
                    var message = "Unexpected metadata ";
                    if ($reqHeaders)
                        message += ($reqHeaders == headers) + $reqHeaders["x-request-metadata"];
                    console.error($reqHeaders, headers, message);
                    // setTimeout(function() { throw new Error(message); });
                    return callback(err, data.substr(0, ln - ml), res);
                }
                callback(err, data.substr(0, ln - ml), ml && data.substr(-1 * ml) || "", res);
            } else {
                callback(err, data, res);
            }
        }, progress, false, headers);
    }
    
    function readFile(path, encoding, callback, progress, _metadata) {
        // TODO remove this debugging code once we find why metadata was shown as file contents
        if (_metadata != undefined)
            throw new Error("attempt to call readfile with metadata");
        return _readFile(path, encoding, callback, progress, false);
    }
    
    function readFileWithMetadata(path, encoding, callback, progress) {
        return _readFile(path, encoding, callback, progress, true);
    }
    
    function writeFile(path, data, sync, callback, progress) {
        if (typeof sync == "function") {
            progress = callback;
            callback = sync;
            sync = false;
        }
        
        // Make sure the path doesn't have a trailing /
        // It would then be interpreted as a directory
        if (path.substr(-1) == "/")
            path = path.substr(0, path.length - 1);
    
        return request("PUT", path, data, callback, progress, sync);
    }
    
    function readdir(path, callback, progress) {
        // Make sure the path has a trailing /
        // It would otherwise be interpreted as a file
        if (path.substr(-1) != "/")
            path += "/";
    
        return request("GET", path, "", function(err, data) {
            if (err) return callback(err);
            
            try { var files = JSON.parse(data); }
            catch (e) { return callback(e); }
            
            callback(null, files, progress);
        });
    }
    
    function exists(path, callback) {
        return request("HEAD", path, "", function(err) {
            callback(err ? false : true);
        });
    }
    
    function stat(path, callback) {
        callback(new Error("stat is unsupported via XHR"));
    }
    
    function rename(from, to, options, callback) {
        if (typeof options == "function") {
            callback = options;
            options = {};
        }
        
        return request("POST", to, JSON.stringify({
            renameFrom: from, 
            overwrite: options.overwrite
        }), callback);
    }
    
    function mkdirHandler(callback) {
        return function(err) {
            if (err && err.message.indexOf("exists") > -1)
                callback({ "code": "EEXIST", "message": err.message });
            else
                callback();
        };
    }
    
    function mkdirP(path, mode, callback) {
        callback(new Error("mkdirP is unsupported via XHR"));
    }
    
    function mkdir(path, callback) {
        // Make sure the path has a trailing /
        // It would otherwise be interpreted as a file
        if (path.substr(-1) != "/")
            path += "/";
    
        return request("PUT", path, "", callback);
    }
    
    function rmfile(path, callback) {
        // Make sure the path doesn't have a trailing /
        // It would then be interpreted as a directory
        if (path.substr(-1) == "/")
            path = path.substr(0, path.length - 1);
    
        return request("DELETE", path, "", callback);
    }
    
    function rmdir(path, options, callback) {
        if (typeof options == "function") {
            callback = options;
            options = {};
        }
        
        // Make sure the path doesn't have a trailing /
        // It would then be interpreted as a directory
        if (path.substr(-1) == "/")
            path = path.substr(0, path.length - 1);
    
        return request("DELETE", path, JSON.stringify(options), callback);
    }
    
    function copy(path, to, options, callback) {
        if (typeof options == "function") {
            callback = options;
            options = {};
        }
        
        return request("POST", to, JSON.stringify({
            copyFrom: path, 
            overwrite: (options.overwrite !== undefined 
                ? options.overwrite 
                : true),
            recursive: options.recursive
        }), callback);
    }
    
    function symlink(path, target, callback) {
        return request("POST", path, JSON.stringify({ linkTo: target }), callback);
    }
    
    function metadata(path, data, sync, callback) {
        if (typeof sync == "function") {
            callback = sync;
            sync = false;
        }
        
        return request("POST", path, JSON.stringify({ metadata: data }), callback, null, sync);
    }
    
    function watch(path, callback) {
        callback(new Error("watch is unsupported via XHR"));
    }
    
    function unwatch(path, callback) {
        callback(new Error("unwatch is unsupported via XHR"));
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
        metadata: metadata,
        readFileWithMetadata: readFileWithMetadata
    };
};

});