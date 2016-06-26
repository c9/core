define(function(require, exports, module) {
    "use strict";

    main.consumes = ["Plugin", "vfs.cache", "connect"];
    main.provides = ["vfs.fetchcache"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var cache = imports["vfs.cache"];
        
        var error = require("http-error");
        var Path = require("path");
        var async = require("async");

        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);

        var compress = imports.connect.getModule().compress();
        
        cache.registerExtension(function(vfs, callback) {
            var restful = vfs.restful.home;
            
            vfs.restful.home = function(req, res, next) {
                var path = unescape(req.uri.pathname);
                
                if (req.method == "GET" && path.indexOf("/.c9/cache") === 0) {
                    compress(req, res, function(err) {
                        if (err) return next(err);
                        
                        fetchcache(vfs.vfs, vfs.vfs.env.HOME, vfs.vfsOptions, req, res, next);
                    });
                }
                else
                    restful(req, res, next);
            };
            
            callback();
        });
        
        function readFile(vfs, path, callback) {
            vfs.readfile(path, { encoding: "utf8" }, function(err, meta) {
                if (err)
                    return callback(err);
    
                var data = "";
                meta.stream.on("data", function(d) {
                    data += d;
                })
    
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
        
        function fetchcache(vfs, root, vfsOptions, req, res, next) {
            var path = unescape(req.uri.pathname);

            // sandbox path to workspaceDir
            path = Path.join(root, path);
            // if (path.indexOf(root) !== 0)
            //     return next(new error.Forbidden("Can't list files outside of the workspace"));
            
            // Fetch index
            readFile(vfs, Path.join(path, "index"), function(err, list){
                if (err) {
                    var httpErr = new error.NotFound(err.message);
                    return next(httpErr);
                }
                
                // Fetch each file in the index
                async.mapLimit(list.split("\n"), 50, function(p, callback){
                    readFile(vfs, Path.join(path, p.replace(/\//g, "\\")), function(ignore, data){
                        var json;
                        try { json = JSON.parse(data); }
                        catch(e) { json = { type: "file", path: p } }
                        
                        callback(null, json);
                    });
                }, function(ignore, results){
                    res.writeHead(200, { "Content-Type": "text/json" });
                    res.write(JSON.stringify(results));
                    res.end();
                });
            });
        }

        plugin.freezePublicAPI({
            // for testing only
            fetchcache: fetchcache
        });
        
        register(null, { "vfs.fetchcache" : plugin });
    }
});