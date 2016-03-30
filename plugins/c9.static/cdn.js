"use strict";

main.consumes = [
    "connect",
    "connect.cors",
    "connect.static",
    "cdn.build"
];
main.provides = [];

module.exports = main;

function main(options, imports, register) {
    var connect = imports.connect;
    var build = imports["cdn.build"];
    var connectStatic = imports["connect.static"];
    
    var fs = require("fs");
    var path = require("path");
    var send = require("send");
    var mkdirp = require("mkdirp");
    var atomic = require("c9/atomic");
    var error = require("http-error");
    var frontdoor = require("frontdoor");
    
    var cacheFiles = options.cacheFiles;

    var api = frontdoor();
    connect.use(api);
    
    var section = api.section("static");
    
    var resolveModulePath = require("architect-build/module-deps").resolveModulePath;
    connectStatic.getRequireJsConfig().useCache = options.useBrowserCache;
    section.post("/__check__", [function(req, res, next) {
        req.params.hash = "any";
        next();
    }, prepare, function(req, res, next) {
        function FsQ() {
            this.buffer = [];
            this.process = function() {};
            this.active = 0;
            this.ended = false;
            this.maxActive = 100;
        }
        FsQ.prototype.write = function(arr) {
            this.buffer.push.apply(this.buffer, arr);
            this.take();
        };
        FsQ.prototype.take = function(arr) {
            while (this.buffer.length && this.active < this.maxActive) {
                this.process(this.buffer.pop());
                this.active++;
            }
        };
        FsQ.prototype.oneDone = function() {
            this.active--;
            if (!this.active)
                this.take();
            if (!this.active && this.ended)
                this.end();
        };

        res.writeHead(200, {
            "Content-Type": "application/javascript",
            "Cache-Control": "no-cache, no-store"
        });
        req.setEncoding("utf8");
        
        var buffer = "";
        var t = Date.now();
        var q = new FsQ();
        var lastCssChange = 0;
        var compiledSkins = {};
        q.process = function(e) {
            var parts = e.split(" ");
            var id = parts[1];
            var etag = parts[0];
            if (!id || /^https?:\/\//.test(id))
                return q.oneDone();
            var path = resolveModulePath(id, req.pathConfig.pathMap);
            
            if (path == id && !/^(\/|\w:)/.test(path)) {
                path = build.cacheDir + "/" + path;
                if (/^\w+\/skin\//.test(id)) {
                    compiledSkins[id] = -1;
                }
            }
            
            fs.stat(path, function(err, s) {
                if (!err) {
                    var mt = s.mtime.valueOf();
                    var etagNew = '"' + s.size +"-" +  mt + '"';
                    if (etag !== etagNew) {
                        err = true;
                    }
                } 
                
                if (compiledSkins[id]) {
                    compiledSkins[id] = mt || -1;
                }
                else if (err) {
                    if (/\.(css|less)/.test(id))
                        lastCssChange = Math.max(lastCssChange, s ? s.mtime.valueOf() : Infinity);
                    res.write(id + "\n");
                }
                q.oneDone();
            });
        };
        q.end = function() {
            if (!q.buffer.length && !q.active) {
                if (compiledSkins) {
                    Object.keys(compiledSkins).forEach(function(key) {
                        if (compiledSkins[key] < lastCssChange) {
                            res.write(key + "\n");
                            fs.unlink(build.cacheDir + "/" + key, function() {
                                console.info("Deleting old skin", key);
                            });
                        }
                    });
                }
                res.write("\n");
                res.end();
                console.info("Checking cache state took:", t - Date.now(), "ms");
            }
            else {
                q.ended = true;
            }
        };
        function onData(e) {
            var parts = (buffer + e).split("\n");
            buffer = parts.pop();
            q.write(parts);
            // console.log(i++);
        }
        function onEnd(e) {
            console.log("end", t - Date.now());
            q.end();
        }
        
        if (req.body) {
            // TODO disable automatic buffering in connect
            onData(Object.keys(req.body)[0]);
            onEnd();
        } else {
            req.on("end", onEnd);
            req.on("data", onData);
        }
    }]);
    
    // section.use(foreverCache());
    section.use(imports["connect.cors"].cors("*"));
    section.use(connect.getModule().compress());
    
    section.get("/:hash/config/:name", [prepare, function(req, res, next) {
        var name = req.params.name.replace(/\.js$/, "");
        var file = path.join(build.cacheDir, req.params.hash, "config", name + ".js");
        sendCached(file, req, res, next, function(callback) {
            build.buildConfig(name, req.pathConfig, function(err, result) {
                callback(err, result && result.code || "");
            });
        });
    }]);
    
    section.get("/:hash/skin/:name/:color", [prepare, function(req, res, next) {
        var color = req.params.color.replace(/\.css$/, "");
        var file = path.join(build.cacheDir, req.params.hash, "skin", req.params.name, color + ".css");
        sendCached(file, req, res, next, function(callback) {
            build.buildSkin(req.params.name, color, req.pathConfig, function(err, result) {
                callback(err, result && result.code || "");
            });
        });
    }]);
    
    section.get("/:hash/modules/:module*", [prepare, function(req, res, next) {
        var module = req.params.module.replace(/^\//, "").replace(/\.js$/, "");
        var file = path.join(build.cacheDir, req.params.hash, "modules", module + ".js");
        sendCached(file, req, res, next, function(callback) {
            build.buildModule(module, req.pathConfig, function(err, result) {
                callback(err, result && result.code || "");
            });
        });
    }]);
    
    section.get("/:hash/worker/:module*", [prepare, function(req, res, next) {
        var module = req.params.module.replace(/^\//, "").replace(/\.js$/, "");
        var file = path.join(build.cacheDir, req.params.hash, "worker", module + ".js");
        sendCached(file, req, res, next, function(callback) {
            build.buildWorker(module, req.pathConfig, function(err, result) {
                callback(err, result && result.code || "");
            });
        });
    }]);
    
    section.get("/:hash/static/:path*", [prepare, function(req, res, next) {
        send(req, req.params.path.replace(/^\//, ""))
            .root(path.join(build.cacheDir, req.params.hash, "static"))
            .on('error', onSendError(next))
            .pipe(res);
    }]);

    register();

    function sendCached(filename, req, res, next, loader) {
        console.log("cache", filename);
        fs.exists(filename, function(exists) {
            if (exists && cacheFiles) {
                console.log("cache hit", filename);
                var transfer = send(req, filename);
                if (path.sep === "/")
                    transfer.root("/");
                transfer
                    .on("error", onSendError(next))
                    .pipe(res);
                return;
            }
            
            loader(function(err, code) {
                if (err) return next(err);

                var type = "text/javascript";
                if (filename.match(/\.css$/))
                    type = "text/css";
                
                res.setHeader("Content-Type", type);
                var mtime = Math.floor(Date.now() / 1000) * 1000;
                res.setHeader("ETAG", '"' + Buffer.byteLength(code) + "-" + mtime + '"');
                res.statusCode = 200;
                res.end(code);
                
                if (!cacheFiles) return;
                
                mkdirp(path.dirname(filename), function(err) {
                    if (err)
                        console.error("Error caching file", filename, err);
                    
                    atomic.writeFile(filename, code, "utf8", function(err) {
                        if (err)
                            return console.error("Caching file", filename, "failed", err);
                        
                        console.log("File cached at", filename);
                        // set utime to have consistent etag
                        fs.utimes(filename, mtime/1000, mtime/1000, function(e) {
                            if (e) console.error(e);
                        });
                    });
                });
            });
        });
    }
    
    function onSendError(next) {
        return function(err) {
            if (err.status == 404)
                next(new error.NotFound());
            else 
                next(err);
        };
    }

    function prepare(req, res, next) {
        var hash = req.params.hash;
        if (!hash.match(/^[a-z0-9]+$/))
            return next(new error.NotFound());
        
        build.getPathConfig(hash, function(err, pathConfig) {
            if (err) return next(err); 
            
            req.pathConfig = pathConfig;
            next();
        });
    }
    
    function foreverCache() {
        return function(req, res, next) {
            res.setHeader("Cache-Control", "public, max-age=31556926");
            next();
        };
    }
}

