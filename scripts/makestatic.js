#!/usr/bin/env node
"use strict";

require("amd-loader");
require("c9/setup_paths.js");
var path = require("path");
var architect = require("architect");
var optimist = require("optimist");

module.exports = main;

if (!module.parent) {
    var options = optimist(process.argv)
        .usage("Usage: $0 [--help]")
        .alias("s", "settings")
        .default("settings", "local")
        .describe("settings", "Settings file to use")
        .alias("d", "dest")
        .default("dest", __dirname + "/../build/static")
        .describe("symlink", "Whether to symlink files instead of copying")
        .boolean("symlink")
        .describe("compress", "Compress output files")
        .boolean("compress")
        .describe("react-style", "compile react less CSS")
        .boolean("react-style")
        .describe("dest", "destination folder for the static files")
        .boolean("help")
        .describe("help", "Show command line options.");
        
    var argv = options.argv;
    
    if (argv.help) {
        options.showHelp();
        process.exit();
    }
    
    var config = argv._[2] || "ide";
    var settings = argv.settings;
    
    main(config, settings, argv, function(err) {
        if (err) {
            console.error(err);
            process.exit(1);
        }
        process.exit(0);
    });
}


function main(config, settings, options, callback) {
    
    if (config[0] !== "/")
        config = path.join(__dirname, "/../configs/", config);
   
    settings = require(path.join(__dirname, "/../settings", settings))();
    settings.pricing = {};
    
    var plugins = require(config)(settings, optimist(process.argv))
        .map(function(plugin) {
            if (typeof plugin == "string")
                plugin = { packagePath: plugin };
            plugin.packaging = true;
            
            if (plugin.packagePath == "connect-architect/connect") {
                plugin.packagePath = "./c9.static/connect";
            }
            else if (plugin.packagePath == "connect-architect/connect.static") {
                plugin.packagePath = "./c9.static/connect-static";
            }
            return plugin;
        })
        .concat({
            packagePath: "./c9.static/makestatic",
            compress: options.compress,
            virtual: options.virtual
        })
        .concat({
            consumes: [],
            provides: ["cdn.build", "db", "redis", "health"],
            setup: function(options, imports, register) {
                register(null, {
                    "cdn.build": {},
                    "db": {
                        "Vfs": {
                            findAllValidServers: function(maxVfsAge, purgeInvalid, callback) {
                                callback(null, [{}]);
                            }
                        },
                        "User": {}
                    }, 
                    "redis": {},
                    "health": { 
                        addCheck: function() {}
                    }
                });
            }
        })
        .filter(function(p) {
            var path = p.packagePath;
            return !path || path.indexOf("c9.db.redis/redis") == -1
                && path.indexOf("c9.static/build") == -1
                && path.indexOf("c9.api/health") == -1;
        });

    
    architect.resolveConfig(plugins, __dirname + "/../plugins", function(err, config) {
        if (err) return callback(err);
        
        var app = architect.createApp(config, function (err, app) {
            if (err) {
                return callback(err);
            }
            if (options.getMounts)
                app.services.makestatic.getMounts(options.dest, callback);
            else if (options.symlink)
                app.services.makestatic.symlink(options.dest, callback);
            else if (options["react-style"])
                app.services["react.style"].compile(function(err, code) {
                    if (err) return callback(err);
                    console.log(code);
                    callback();
                });
            else
                app.services.makestatic.copy(options.dest, callback);
        });
        
        app.on("service", function(name, plugin) {
            if (typeof plugin !== "function")
                plugin.name = name; 
        });
    });
        
}

