"use strict";

plugin.consumes = ["connect.static"];
plugin.provides = ["makestatic"];

module.exports = plugin;

function plugin(options, imports, register) {
    var async = require("async");
    var fs = require("fs");
    var spawn = require("child_process").spawn;
    var join = require("path").join;
    var uglify = require.resolve("uglify-js/bin/uglifyjs");
    var mkdirp = require("mkdirp");
    
    function execFile(cmd, args, callback) {
        var child = spawn(cmd, args);
        child.stderr.pipe(process.stderr);
        child.stdout.pipe(process.stdout);
        
        child.on("error", function(err) {
            return callback(err);
        });
        
        child.on("exit", function(code, signal) {
            if (code || signal)
                return callback(new Error("Process exited with exit code " + code + " and signal " + signal));
            
            callback();
        });
    }
    
    function main(dest, copy, callback) {
        var connectStatic = imports["connect.static"];
        var mounts = connectStatic.getMounts();
        async.series([
            function(next) {
                if (options.virtual)
                    return execFile("mkdir", ["-p", dest], next);
                async.forEachSeries(mounts, function(mount, next) {
                    var target = join(dest, mount.mount);
                    console.log(copy ? "copy" : "link", mount.path + "/* to", target);
                    if (target[0] !== "/")
                        target = target.replace(/\\/g, "/");
                    
                    fs.exists(mount.path, function(exists) {
                        if (!exists) {
                            console.warn("SKIP:", mount.path, "does not exists");
                            return next();
                        }
                        
                        async.series([
                            execFile.bind(null, "mkdir", ["-p", target]),
                            copy
                                ? execFile.bind(null, "find", [mount.path, "-maxdepth", "1", "-mindepth", "1", "-exec", "cp", "-a", "{}", target + "/", ";"])
                                : execFile.bind(null, "find", [mount.path, "-maxdepth", "1", "-mindepth", "1", "-exec", "ln", "-s", "{}", target + "/", ";"])
                        ], next);
                    });
                     
                }, next);
            },
            function(next) {
                fs.writeFile(dest + "/requirejs-config.json", JSON.stringify(connectStatic.getRequireJsConfig(), null, 2), "utf8", next);
            },
            function(next) {
                if (!options.compress || !copy)
                    return next();
                    
                console.log("Uglifying static files...");
                execFile(
                    "find", [dest, "-name", "*.js", "-not", "-path", "*node_modules*",
                    "-exec", uglify, "{}", "-o", "{}", ";"],
                    next
                );
                next();
            }
        ], callback);
    }
    
    function copy(dest, callback) {
        main(dest, true, callback);
    }
    
    function symlink(dest, callback) {
        main(dest, false, callback);
    }
    
    function getMounts(dest, callback) {
        var connectStatic = imports["connect.static"];
        callback(null, connectStatic);
    }
    
    register(null, {
        makestatic: {
            copy: copy,
            symlink: symlink,
            getMounts: getMounts
        }
    });
}
