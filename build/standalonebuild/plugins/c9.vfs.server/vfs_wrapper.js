"use strict";

var path = require("path");
var error = require("http-error");

module.exports = function(vfs, options) {
    var root = options.root || "";
    var methods = options.methods || Object.keys(vfs);
    var readonly = "readonly" in options ? options.readonly : false;
    var blocked = !!options.blocked;

    var roMethods = {
        resolve: 1,
        stat: 1,
        readfile: 1,
        readdir: 1,
        watch: 1,
        on: 1,
        off: 1,
        extend: 1,
        unextend: 1,
        use: 1
    };
    
    var noWrap = {
        connect: true,
        spawn: true,
        pty: true,
        execFile: true,
        on: true,
        off: true,
        emit: true,
        extend: true,
        unextend: true,
        use: true,
        killtree: true
    };
    
    var wrapper = methods.reduce(function(wrapper, method) {
        var vfsMethod = vfs[method];
        if (typeof vfsMethod !== "function") return wrapper;
        
        if (blocked)
            wrapper[method] = wrapReadOnly(method);
        else if (readonly && !roMethods[method])
            wrapper[method] = wrapReadOnly(method);
        else if (noWrap[method] || !root)
            wrapper[method] = vfsMethod.bind(vfs);
        else
            wrapper[method] = wrapSandbox(vfsMethod);
            
        return wrapper;
    }, {});
    
    function wrapSandbox(vfsMethod) {
        return function(path, options, callback) {
            options.sandbox = root;
            vfsMethod.call(vfs, path, options, callback);
        };
    }
    
    function wrapReadOnly(vfsMethod) {
        return function(path, options, callback) {
            return callback(new error.Forbidden("VFS method " + vfsMethod + " is blocked in read only mode"));
        };
    }
    
    var extendDirectory = path.normalize(options.extendDirectory || "");
    var extendOptions = options.extendOptions || {};

    wrapper.extend = function(name, options, callback) {
        for (var key in extendOptions) {
            options[key] = extendOptions[key];
        }
        
        if (readonly) {
            var whitelist = {
                "c9.ide.collab/server/collab-server.js": true,
                "c9.ide.pubsub/pubsub-service.js": true,
                "c9.vfs.client/ping-service.js": true,
            };
            if (!options.file || !whitelist[options.file])
                return callback(new error.Forbidden("VFS extend: " + name + " is not authorized in read only mode"));
        }
        
        // localfs extend checks for file, then code, then stream
        if (!options.file) {
            if (options.code || options.stream)
                return vfs.extend(name, options, callback);
            
            return callback(new error.Forbidden("Option 'file' is missing"));
        }
        
        if (typeof options.file != "string")
            return callback(new error.Forbidden("Invalid option 'file'"));

        if (extendDirectory) {
            var file = options.file = path.normalize(path.join(extendDirectory, options.file));

            var dir = path.dirname(file);
            if (dir.indexOf(extendDirectory) !== 0)
                return callback(new error.Forbidden("Option 'file' in VFS extend must be in the white listed directory"));
        }

        return vfs.extend(name, options, callback);
    };
    
    wrapper.readonly = readonly;
    wrapper.root = root;

    return wrapper;
};