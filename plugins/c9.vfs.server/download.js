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
            var paths = req.uri.pathname.split(",").map(function(path) {
                return Path.join(root, Path.normalize(unescape(path).replace(/^(\/?\.\.)?\/?/, "")));
            });
            var path = paths[0];
            var name = Path.basename(path);
            
            var filename = req.uri.query.download;
            if (!filename) {
                filename = name;
                if (!req.uri.query.isfile) {
                    filename += (paths.length > 1 ? "[+" + (paths.length - 1) + "]" : "") + ".tar.gz";
                }
            }
            var filenameHeader = "attachment; filename*=utf-8''" + escape(filename);

            var proc;
            req.on("close", function() {
                if (proc) proc.kill();
            });
            
            if (req.uri.query.isfile) {
                vfs.readfile(path, {}, function(err, meta) {
                    if (err) {
                        if (err.code == "ENOENT")
                            return next(new error.NotFound("File '" + path + "' could not be found!"));
                        else
                            return next(err);
                    }
                    
                    // once we receive data on stdout pipe it to the response
                    meta.stream.once("data", function(data) {
                        if (res.headerSent)
                            return;
                            
                        res.writeHead(200, {
                            "Content-Type": "octet/stream",
                            "Content-Disposition": filenameHeader
                        });
                        res.write(data);
                        meta.stream.pipe(res);
                    });
                    
                    meta.stream.once("close", function() {
                        if (res.headerSent)
                            return;
                            
                        res.writeHead(200, {
                            "Content-Type": "octet/stream",
                            "Content-Disposition": filenameHeader
                        });
                        res.end();
                    });
                    
                    meta.stream.on("error", function(err) {
                        res.writeHead(500);
                        res.end(err.message);
                    });
                });
            }
            else {
                var executable, args, contentType;

                if (/\.zip$/.test(filename)) {
                    executable = "zip";
                    args = ["-r", "-", "--"];
                    contentType = "application/zip";
                }
                else {
                    executable = "tar";
                    args = ["-zcf", "-", "--"];
                    contentType = "application/x-gzip";
                }

                // Find the longest common parent directory of all the paths.
                var cwd = null;
                paths.forEach(function (path) {
                    if (!path) return;
                    var dir = Path.dirname(path);
                    if (!cwd) {
                        cwd = dir;
                    }
                    else {
                        var relative = Path.relative(cwd, dir).split(Path.sep);
                        var i = 0;
                        while (relative[i] === '..') {
                            cwd = Path.resolve(cwd, '..');
                            i++;
                        }
                    }
                });
                paths.forEach(function(path) {
                    if (!path) return;
                    path = Path.relative(cwd, path);
                    if (process.platform == "win32") {
                        // Quote the path to escape unusual characters and spaces.
                        // NB: Double quotes are illegal within the actual path on Windows.
                        path = '"' + path.replace(/"/g, "") + '"';
                    }
                    args.push(path);
                });

                vfs.spawn(executable, {
                    args: args,
                    cwd: cwd,
                    windowsVerbatimArguments: true // Prevents Node from escaping the double quotes added above.
                }, function (err, meta) {
                    if (err)
                        return next(err);

                    proc = meta.process;

                    // once we receive data on stdout pipe it to the response
                    proc.stdout.once("data", function (data) {
                        if (res.headerSent)
                            return;
                            
                        res.writeHead(200, {
                            "Content-Type": contentType,
                            "Content-Disposition": filenameHeader
                        });
                        res.write(data);
                        proc.stdout.pipe(res);
                    });
            
                    var stderr = "";
                    proc.stderr.on("data", function (data) {
                        stderr += data;
                    });

                    proc.on("exit", function(code, signal) {
                        if (res.headerSent)
                            return;
                            
                        var err;
                        if (code == 127) {
                            err = new error.PreconditionFailed(
                                "Your instance seems to be missing the '" + executable + "' utility\n" +
                                "If you are using an SSH workspace, please do:\n" +
                                "    'sudo apt-get install " + executable + "'");
                        } else if (code) {
                            err = new error.InternalServerError(
                                "'" + executable + "' utility failed with exit code " + code +
                                " and stderr:/n'" + stderr + "'");
                        } else if (signal) {
                            err = new error.InternalServerError(
                                "'" + executable + "' utility was terminated by signal " + signal
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
        
        register(null, { "vfs.download": plugin });
    }
});