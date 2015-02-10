define(function(require, exports, module) {
    "use strict";

    main.consumes = ["Plugin", "vfs.cache"];
    main.provides = ["vfs.download"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var cache = imports["vfs.cache"];
        
        var error = require("http-error");
        var Path = require("path");

        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);

        cache.registerExtension(function(vfs, callback) {
            
            var restful = vfs.restful.workspace;
            
            vfs.restful.workspace = function(req, res, next) {
                if (req.method == "GET" && "download" in req.uri.query)
                    download(vfs.vfs, vfs.workspaceDir, req, res, next);
                else
                    restful(req, res, next);
            };
            
            callback();
        });
        
        function download(vfs, root, req, res, next) {
            var path = Path.join(root, Path.normalize(decodeURI(req.uri.pathname).replace(/^(\/?\.\.)?\/?/, "")));
            var dir = Path.dirname(path);
            var name = Path.basename(path).replace(/\/*$/, "");
            
            var filename;
            if (req.uri.query.download)
                filename = req.uri.query.download;
            else
                filename = name + ".tar.gz";
            
            var process;

            req.on("close", function() {
                if (process) process.kill();
            });
            
            if (req.uri.query.isfile) {
                vfs.readfile(path, {}, function(err, meta){
                    if (err) {
                        if (err.code == "ENOENT")
                            return next(new error.NotFound("File '" + path + "' could not be found!"));
                        else
                            return next(err);
                    }
                    
                    // once we receive data on stdout pipe it to the response        
                    meta.stream.once("data", function (data) {
                        if (res.headerSent)
                            return;
                            
                        res.writeHead(200, {
                            "Content-Type": "octet/stream",
                            "Content-Disposition": "attachment; filename=" + name
                        });
                        res.write(data);
                        meta.stream.pipe(res);
                    });
                    
                    meta.stream.on("error", function(err){
                        res.writeHead(500);
                        res.end(err.message);
                    });
                });
            }
            else {
                vfs.spawn("tar", {
                    args: ["-zcf", "-", name],
                    cwd: dir
                }, function (err, meta) {
                    if (err)
                        return next(err);
                        
                    process = meta.process;
    
                    // once we receive data on stdout pipe it to the response        
                    process.stdout.once("data", function (data) {
                        if (res.headerSent)
                            return;
                            
                        res.writeHead(200, {
                            "Content-Type": "application/x-gzip",
                            "Content-Disposition": "attachment; filename=" + filename
                        });
                        res.write(data);
                        process.stdout.pipe(res);
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
                                "Your instance seems to be missing the 'tar' utility\n" + 
                                "If you are using an SSH workspace, please do:\n" +
                                "    'sudo apt-get install tar'");
                        } else if (code) {
                            err = new error.InternalServerError(
                                "'tar' utility failed with exit code " + code + 
                                " and stderr:/n'" + stderr + "'");
                        } else if (signal) {
                            err = new error.InternalServerError(
                                "'tar' utility was terminated by signal " + signal
                            );
                        }
                        
                        if (err) {
                            next(err);
                        }
                    });
                });
            }
        }

        plugin.freezePublicAPI({
            // for testing only
            download: download
        });
        
        register(null, { "vfs.download" : plugin });
    }
});