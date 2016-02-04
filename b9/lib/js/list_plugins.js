#!/usr/bin/env node
"use strict";

var DEFAULT_SETTINGS = "deploy";

var optimist = require("optimist");
var loadManifest = require("c9/manifest").load;

module.exports = listPlugins;

if (!module.parent) {
    main(process.argv.slice(2), function(err) {
        if (err) {
            console.error(err);
            console.error("Stacktrace: ", err.stack);
            process.exit(1);
        }
    });
}

function main(argv, callback) {
    var options = optimist(argv)
        .usage("Usage: $0 [CONFIG_NAME] [--help]")
        .alias("s", "settings")
        .default("settings", DEFAULT_SETTINGS)
        .describe("settings", "Settings file to use")
        .default("source", __dirname + "/../../..")
        .describe("source", "Source directory")
        .boolean("help")
        .describe("help", "Show command line options.");

    argv = options.argv;
    if (argv.help) {
        options.showHelp();
        return callback();
    }

    if (argv._.length != 1) {
        options.showHelp();
        return callback();
    }
    var config = argv._[0];
    var settingsName = argv.settings;
    var source = argv.source;

    listPlugins(source, config, settingsName).forEach(function(line) {
        console.log(line);
    });
}

function listPlugins(source, configName, settingsName) {
    var manifest = loadManifest(source);
    manifest.hostname = "[%type%]-[%provider%]-[%region%]-[%index%]-[%env%]";

    var settings = require(source + "/settings/" + settingsName)(manifest);
    var config = require(source + "/configs/" + configName)(settings, optimist([]));
    
    var plugins = Object.keys(config.reduce(function(processedPlugins, plugin) {
        var packagePath = plugin.packagePath || plugin;
        if (packagePath.indexOf("./") === 0) {
            var pluginDir = packagePath.slice(2, packagePath.indexOf("/", 2));
            processedPlugins[pluginDir] = true;
        }
        
        return processedPlugins;
    }, {}));
    
    return plugins;
}