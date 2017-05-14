"use strict";

module.exports = function(methods, vfsHome, vfsWorkspace) {
    var proxy = {};
    var homeDir = vfsHome.root.replace(/\/?$/, "/");
    
    /** VFS command options that contain paths. */
    var PATH_OPTIONS = ["from", "to", "target"];
    
    var absoluteWrap = {
        spawn: true,
        pty: true,
        execFile: true,
    };
        
    var noWrap = {
        connect: true,
        on: true,
        off: true,
        emit: true,
        extend: true,
        unextend: true,
        use: true,
        killtree: true
    };
    
    methods.forEach(function(name) {
        var vfsMethod = vfsWorkspace[name];
        if (typeof vfsMethod !== "function") 
            return;
        
        proxy[name] = wrap(name, noWrap[name]);
    });
    
    function wrap(name, excluded) {
        if (excluded) {
            return function() {
                vfsWorkspace[name].apply(vfsWorkspace, arguments);
            };
        }
        
        return function(path, options) {
            var args = Array.prototype.slice.call(arguments);
            
            PATH_OPTIONS.forEach(function(o) {
                if (options[o] && typeof options[o] == "string")
                    options[o] = substituteTilde(options[o]);
            });
            args[1] = options;
            
            if (typeof path == "string" && path.charAt(0) == "~") {
                args[0] = substituteTilde(path);
                    
                vfsHome[name].apply(vfsHome, args);
            }
            else
                vfsWorkspace[name].apply(vfsWorkspace, args);
        };
        
        function substituteTilde(path) {
            return (absoluteWrap[name])
                ? path.replace(/^~/, homeDir.substr(0, homeDir.length - 1))
                : path.replace(/^~/, "");
        }
    }
    
    proxy.readonly = vfsWorkspace.readonly;
    proxy.root = vfsWorkspace.root;

    return proxy;
};