#!/usr/bin/env node
"use strict";

require("amd-loader");
try {
    require("heapdump");
} catch(e) {}

var path = require("path");
var architect = require("architect");
var optimist = require("optimist");
var async = require("async");
var os = require("os");

if (process.version.match(/^v0/) && parseFloat(process.version.substr(3)) < 10) {
    console.warn("You're using Node.js version " + process.version 
        + ". Version 0.10 or higher is recommended. Some features will not work.");
}

var DEFAULT_CONFIG = "s";
var DEFAULT_SETTINGS = getDefaultSettings();

var shortcuts = {
    "dev"  : ["ide", "preview", "vfs", "api", "sapi", "proxy", "redis", "profile", "oldclient", "homepage", "apps-proxy", "-s", "devel"],
    "odev" : ["ide", "preview", "vfs", "api", "proxy", "oldclient", "homepage", "apps-proxy", "profile", "worker", "-s", "onlinedev"],
    "bill" : ["ide", "preview", "vfs", "api", "proxy", "oldclient", "homepage", "apps-proxy", "profile", "-s", "billing"],
    "beta" : ["ide", "preview", "vfs", "proxy", "-s", "beta"],
    "ci"   : ["ide", "preview", "vfs", "proxy", "-s", "ci"],
    "s"    : ["standalone", "-s", "standalone"]
};
var delayLoadConfigs = ["preview", "api", "oldclient", "apps-proxy", "worker"];

module.exports = main;

if (!module.parent)
    main(process.argv.slice(2));

function getDefaultSettings() {
    var hostname = os.hostname();
    
    var suffix = hostname.trim().split("-").pop() || "";
    var modes = {
        "prod": "deploy",
        "beta": "beta",
        "dev": "devel",
        "onlinedev": "onlinedev"
    };
    return modes[suffix] || "devel";
}

module.exports.getDefaultSettings = getDefaultSettings;

function main(argv, config, onLoaded) {
    var inContainer = os.hostname().match(/-\d+$/);
    
    var options = optimist(argv)
        .usage("Usage: $0 [CONFIG_NAME] [--help]")
        .alias("s", "settings")
        .default("settings", DEFAULT_SETTINGS)
        .describe("settings", "Settings file to use")
        .describe("dump", "dump config file as JSON")
        .describe("domain", "Top-level domain to use (e.g, c9.io)")
        .describe("exclude", "Exclude specified service")
        .default("domain", inContainer && process.env.C9_HOSTNAME)
        .boolean("help")
        .describe("help", "Show command line options.");

    var configs = options.argv._;
    if (!configs.length) 
        configs = [config || DEFAULT_CONFIG];
    if (options.argv.exclude && !Array.isArray(options.argv.exclude.length))
        options.argv.exclude = [options.argv.exclude];
    
    var expanded = expandShortCuts(configs);
    if (expanded.length > configs.length)
        return main(expanded.concat(argv.filter(function(arg) {
            return !shortcuts[arg];
        })), config, onLoaded);

    var delayed = expanded.filter(function(c) { return delayLoadConfigs.indexOf(c) !== -1 });
    var notDelayed = expanded.filter(function(c) { return delayLoadConfigs.indexOf(c) === -1 });
    
    startConfigs(notDelayed, function() {
        startConfigs(delayed, function() {});
    });
    
    function startConfigs(configs, done) {
        async.each(configs, function(config, next) {
            if (options.argv.exclude && options.argv.exclude.indexOf(config) > -1)
                return next();
            start(config, options, function(err, result, path) {
                onLoaded && onLoaded(err, result, path);
                next(err);
            });
        }, done);
    }
}
     
function expandShortCuts(configs) {
    var results = configs.slice();
    for (var i = 0; i < results.length; i++) {
        var expanded = shortcuts[results[i]];
        if (expanded) {
            results.splice.apply(results, [i, 1].concat(expanded));
            i += expanded.length - 1;
        }
    }
    return results;
}

function start(configName, options, callback) {
    console.log("Starting", configName);
    
    var argv = options.argv;
    var settingsName = argv.settings;
    
    if (typeof settingsName != "string")
        settingsName = settingsName.pop();
    
    var configPath = configName;
    if (configPath[0] !== "/")
        configPath = path.join(__dirname, "/configs/", configName);
   
    var settings = require(path.join(__dirname, "./settings", settingsName))();
    
    if (argv.domain && settings.c9) {
        settings.c9.domain = argv.domain;
        for (var s in settings) {
            if (settings[s] && settings[s].baseUrl)
                settings[s].baseUrl = replaceDomain(settings[s].baseUrl, argv.domain);
        }
    }

    var plugins = require(configPath)(settings, options);
    
    if (argv.help) {
        options.usage("Usage: $0 " + configName);
        options.showHelp();
    }
    
    if (!plugins)
        return;
    
    if (module.exports.onResolvePlugins)
        module.exports.onResolvePlugins(plugins, __dirname + "/plugins");
    
    architect.resolveConfig(plugins, __dirname + "/plugins", function(err, config) {
        if (err) {
            console.error(err);
            process.exit(1);
        }
        
        if (argv.dump) {
            console.log(JSON.stringify(config, null, 2));
            return callback && callback(null, config);
        }
        
        if (argv._getConfig)
            return callback && callback(null, config, configPath);

        var app = architect.createApp(config, function (err, app) {
            if (err) {
                console.trace("Error while starting '%s':", configPath);
                console.log(err, err.stack);
                process.exit(1);
            }
            console.log("Started '%s' with config '%s'!", configPath, settingsName);
            
            callback && callback(null, app);
        });
        
        app.on("service", function(name, plugin) {
            if (typeof plugin !== "function")
                plugin.name = name; 
        });
    });
}

function replaceDomain(url, domain) {
    return url.replace(/[^./]+\.[^./]+$/, domain).replace(/[^./]+\.[^.]+\//, domain + "/");
}