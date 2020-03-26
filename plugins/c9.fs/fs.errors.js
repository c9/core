/**
 * File System Error Reporting Module for the Cloud9
 *
 * @copyright 2013, Ajax.org B.V.
 */
define(function(require, exports, module) {
    main.consumes = ["fs", "dialog.error", "fs.cache", "Plugin"];
    main.provides = [];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var fs = imports.fs;
        var showError = imports["dialog.error"].show;
        var fsCache = imports["fs.cache"];
        
        var basename = require("path").basename;
        var uCaseFirst = require("c9/string").uCaseFirst;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        // var emit = plugin.getEmitter();
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
        }
        
        /***** Methods *****/
    
        // FS error reporting
        var m = {
            // "readFile"  : "Failed to read from {filename}. {error}.",
            "writeFile": "Failed to write to {filename}. {error}.",
            // "readdir"   : "Failed to read directory {filename}. {error}.",
            "rename": "Failed to rename {type} {filename} to {to}. {error}.",
            "mkdirP": "Failed to create folder(s) {path}. {error}.",
            "mkdir": "Failed to create folder {filename}. {error}.",
            "unlink": "Failed to delete {type} {filename}. {error}.",
            "rmfile": "Failed to delete {type} {filename}. {error}.",
            "rmdir": "Failed to delete {type} {filename}. {error}.",
            "copy": "Failed to copy {type} {filename} to {to}. {error}.",
            "symlink": "Failed to create symlink {filename} to {to}. {error}."
        };
        var errcode = {
            "ENOENT": "File or folder {filename} does not exist",
            "EISDIR": "{Totype|type} {to|filename} is a directory",
            "ENOTDIR": "{Totype|type} {to|filename} is not a directory",
            "EEXIST": "{Totype|type} {to|filename} already exists",
            "EACCES": "Access denied acccessing this {type}",
            "ENOSPC": "Your disk is full. Please create more space. Could not write {filename}",
            "EDISCONNECT": "The connection went away. Please try again.",
            "ENOTCONNECTED": "You are disconnected. "
                + "Please check your connection and try again"
        };
        var errmsg = {
            "away re-connect attempts exceeded": "You are disconnected. "
                + "Please check your connection and try again"
        };
        
        function parse(msg, options) {
            function replace(m, m1) {
                var value = options[m1.toLowerCase()];
                if (m1.charAt(0) != m1.charAt(0).toLowerCase())
                    value = uCaseFirst(value);
                return value;
            }
            
            options["totype|type"] = options.totype || options.type; // Will generalize when needed
            options["to|filename"] = options.to || options.filename; // Will generalize when needed
            options.error = errcode[options.error.code]
                ? errcode[options.error.code].replace(/\{(.*?)\}/g, replace)
                : (errmsg[options.error.message]
                    ? errmsg[options.error.message].replace(/\{(.*?)\}/g, replace)
                    : options.error.message || options.error);
            
            return msg && msg.replace && msg.replace(/\{(.*?)\}/g, replace) || "";
        }
        
        fs.on("userError", function(e) {
            if (!m[e.name]) return;
            if (e.error.code == "EEXIST") return;
            
            var args = e.args;
            var path = args[0];
            var node = fsCache.findNode(path);
            var type = node 
                ? (node.link ? "symlink" : node.isFolder ? "folder" : "file") 
                : "file or folder";
            var topath = typeof args[1] == "string" ? args[1] : null;
            var tonode, totype;
            
            if (topath) {
                tonode = fsCache.findNode(topath);
                totype = tonode 
                    ? (tonode.link ? "symlink" : tonode.isFolder ? "folder" : "file") 
                    : "file or folder";
            }
                
            var message = parse(m[e.name], {
                error: e.error,
                type: type,
                to: topath
                    ? "'<span title='" + topath.replace(/'/g, "&apos;") 
                        + "'>" + basename(topath) + "</span>'"
                    : "",
                totype: totype,
                path: path,
                filename: "'<span title='" + path.replace(/'/g, "&apos;") 
                    + "'>" + basename(path) + "</span>'"
            });
            
            showError({ html: message });
            // console.error(message.replace(/<.*?>/g, ""));
        });
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("enable", function() {
            
        });
        plugin.on("disable", function() {
            
        });
        plugin.on("unload", function() {
            loaded = false;
        });
        
        /***** Register and define API *****/
        
        /**
         * 
         **/
        plugin.freezePublicAPI({
            
        });
        
        register(null, { });
    }
});
