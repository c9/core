define(function(require, exports, module) {
    "use strict";

    main.consumes = ["Plugin", "vfs.cache", "connect"];
    main.provides = ["vfs.filelist"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var cache = imports["vfs.cache"];
        
        var error = require("http-error");
        var Path = require("path");

        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);

        var compress = imports.connect.getModule().compress();
        
        cache.registerExtension(function(vfs, callback) {
            var restful = vfs.restful.home;
            
            vfs.restful.home = function(req, res, next) {
                var path = unescape(req.uri.pathname);
                
                if (req.method == "GET" && path == "/.c9/file.listing") {
                    compress(req, res, function(err) {
                        if (err) return next(err);
                        
                        filelist(vfs.vfs, vfs.workspaceDir, vfs.vfsOptions, req, res, next);
                    });
                }
                else
                    restful(req, res, next);
            };
            
            callback();
        });
        
        function filelist(vfs, root, vfsOptions, req, res, next) {
            var query = req.uri.query;
            var path = query && query.path + "";
            var nakBin = vfsOptions.nakBin;
            var nodeBin = vfsOptions.nodeBin && vfsOptions.nodeBin[0];

            if (!path)
                return next(new error.BadRequest("path query must be set"));
                
            if (!nakBin)
                return next(new error.InternalServerError("nak binary not configured"));
                
            // sandbox path to workspaceDir
            path = Path.normalize(path);
            // if (path.indexOf(root) !== 0)
            //     return next(new error.Forbidden("Can't list files outside of the workspace"));
            
            query.list = true;
            query.follow = true;
            query.path = path;
            
            vfs.spawn(nodeBin, { 
                stdoutEncoding: "utf8",
                stderrEncoding: "utf8",
                args: [nakBin, "--json", JSON.stringify(query)]
            }, function(err, meta) {
                if (err) return next(err);

                var process = meta.process;
                // once we receive data on stdout pipe it to the response        
                process.stdout.once("data", function (data) {
                    if (res.headerSent)
                        return;
                        
                    res.writeHead(200, { "Content-Type": "text/plain" });
                    res.write(data);
                    process.stdout.pipe(res);
                });
                
                req.on("close", function () {
                    process && process.kill();
                });
                
                var stderr = "";
                process.stderr.on("data", function (data) {
                    stderr += data;
                });
                
                process.on("exit", function(code, signal) {
                    if (res.headerSent)
                        return;
                        
                    var err;
                    if (code == 127) {
                        err = new error.PreconditionFailed(
                            "Your instance seems to be missing the 'nak' utility\n" + 
                            "Please re-install nak.");
                    } else if (code) {
                        err = new error.InternalServerError(
                            "'nak' utility failed with exit code " + code + 
                            " and stderr: '" + stderr + "'");
                    } else if (signal) {
                        err = new error.InternalServerError(
                            "'nak' utility was terminated by signal " + signal
                        );
                    }
                    
                    if (err) {
                        next(err);
                    }
                });
            });
        }

        plugin.freezePublicAPI({
            // for testing only
            filelist: filelist
        });
        
        register(null, { "vfs.filelist": plugin });
    }
});