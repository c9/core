#!/usr/bin/env node
"use strict";

require("amd-loader");
try {
    require("heapdump");
} catch(e) {}

var path = require("path");
var architect = require("architect");
var os = require("os");
var urls = require("c9/urls");
var hostname = require("c9/hostname");
var child_process = require("child_process");
require("c9/setup_paths.js");

if (process.version.match(/^v0/) && parseFloat(process.version.substr(3)) < 10) {
    console.warn("You're using Node.js version " + process.version 
        + ". Version 0.10 or higher is recommended. Some features will not work.");
}

var DEFAULT_CONFIG = "s";
var DEFAULT_SETTINGS = getDefaultSettings();

var shortcuts = {
    "dev":       ["ide", "preview", "user-content", "vfs", "api", "sapi", "proxy", "redis", "profile", "oldclient", "homepage", "apps-proxy", "-s", "devel"],
    "onlinedev": ["ide", "preview", "user-content", "vfs", "api", "proxy", "oldclient", "homepage", "apps-proxy", "profile", "-s", "onlinedev"],
    "beta":      ["ide", "preview", "user-content", "vfs", "proxy", "-s", "beta"],
    "s":         ["standalone", "-s", "standalone"],
};
shortcuts.localdev = shortcuts.onlinedev.concat([
    "-s", "beta",
    "--ide.packed", "false",
    "--ide.cdn", "false",
    "--ide.forceDev", "true",
    "--homepage.cdn", "false",
    "--helpWithSudo",
    "--api.port", "8281",
    "--infra_port", "8282",
    "--api_url", "http://api.c9.local:8281",
    "--domains", "c9.local",
    "--cdn.abbreviateVersion", "true",
]);
shortcuts.odev = shortcuts.onlinedev; // For backwards compatibility, if you see this in 2016 remove this line
var delayLoadConfigs = [
    // Services that are usually not immediately needed
    "preview", "user-content", "apps-proxy", "worker", "homepage",
    // Services that are very slow to load, blocking others
    "profile",
];

module.exports = main;

if (!module.parent)
    main(process.argv.slice(2));

function getDefaultSettings() {
    var suffix = hostname.parse(os.hostname()).env;
    var modes = {
        "workflowstaging": "workflow-staging",
        "prod": "deploy",
        "beta": "beta",
        "dev": "devel",
        "onlinedev": "onlinedev",
        "test": "test"
    };
    return modes[suffix] || "devel";
}

module.exports.getDefaultSettings = getDefaultSettings;

function main(argv, config, onLoaded) {
    var inContainer = os.hostname().match(/-\d+$/);
    var optimist = require("optimist");
    var async = require("async");

    var options = optimist(argv)
        .usage("Usage: $0 [CONFIG_NAME] [--help]")
        .alias("s", "settings")
        .default("settings", DEFAULT_SETTINGS)
        .describe("settings", "Settings file to use")
        .describe("dump", "dump config file as JSON")
        .describe("domains", "Primary and any secondary top-level domains to use (e.g, c9.io,c9.dev)")
        .describe("exclude", "Exclude specified service")
        .describe("include", "Include only specified service")
        .describe("helpWithSudo", "Ask for sudo password on startup")
        .default("domains", inContainer && process.env.C9_HOSTNAME || process.env.C9_DOMAINS)
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

    if (options.argv.include)
        expanded = [].concat(options.argv.include);
    
    var delayed = expanded.filter(function(c) { return delayLoadConfigs.indexOf(c) !== -1 });
    var notDelayed = expanded.filter(function(c) { return delayLoadConfigs.indexOf(c) === -1 });
    
    if (options.argv.helpWithSudo)
        return child_process.execFile("sudo", ["echo -n"], main.bind(null, argv.filter(function(a) {
            return a !== "--helpWithSudo";
        }), config, onLoaded));
    
    startConfigs(notDelayed, function() {
        startConfigs(delayed, function() {
            console.log("Cloud9 is up and running");
        });
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

function loadSettings(settingsName) {
    var provider = hostname.parse(os.hostname()).provider;
    var candidates = [
        path.join(__dirname, "./settings", settingsName + "-" + provider),
        path.join(__dirname, "./settings", settingsName)
    ];

    var settings, settingsModule;
    
    for (var i = 0; i < candidates.length; i++) {
        var settingsPath = candidates[i];
        try {
            settingsModule = require(settingsPath);
        } catch (e) {
            continue;
        }
        settings = settingsModule();
        break;
        
    }
    if (!settings)
        throw new Error("No settings found");
        
    return settings;
}

module.exports.loadSettings = loadSettings;

function start(configName, options, callback) {
    console.log("Starting", configName);
    
    var argv = options.argv;
    var settingsName = argv.settings;
    
    if (typeof settingsName != "string")
        settingsName = settingsName.pop();
    
    var configPath = configName;
    if (configPath[0] !== "/")
        configPath = path.join(__dirname, "/configs/", configName);
   
    var settings = loadSettings(settingsName);
    
    argv.domains = argv.domains || settings.domains;
    if (settings.c9 && argv.domains)
        urls.replaceDomains(settings, argv.domains);

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
