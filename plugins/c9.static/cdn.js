"use strict";

main.consumes = [
    "connect",
    "connect.cors",
    "cdn.build"
];
main.provides = [];

module.exports = main;

function main(options, imports, register) {
    var connect = imports.connect;
    var build = imports["cdn.build"];
    
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
    
    //section.use(foreverCache());
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
                res.statusCode = 200;
                res.end(code);
                
                if (!cacheFiles) return;
                
                mkdirp(path.dirname(filename), function(err) {
                    if (err)
                        console.error("Error caching file", filename, err);
                    
                    atomic.writeFile(filename, code, "utf8", function(err) {
                        if (err)
                            console.error("Caching file", filename, "failed", err);
                        else
                            console.log("File cached at", filename);
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

