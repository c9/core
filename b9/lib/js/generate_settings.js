#!/usr/bin/env node
"use strict";

var DEFAULT_SETTINGS = "deploy";
var ALWAYS_INCLUDE_SETTINGS = ["node", "mode", "manifest", "domains", "primaryDomain", "primaryBaseUrl", "baseUrlPattern"];

var fs = require("fs");
var optimist = require("optimist");
var loadManifest = require("c9/manifest").load;
var reJSON = require("c9/json-with-re");

module.exports = generateSettings;

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
        .describe("targetFile", "Target package.json")
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

    generateSettings(source, config, settingsName, function(err, contents) {
        if (err) return callback(err);
        
        if (argv.targetFile)
            fs.writeFileSync(argv.targetFile, contents);
        else
            console.log(contents);
    });
}

function generateSettings(source, config, settingsName, callback) {
    // Check if build already exists. 
    var manifest = loadManifest(source);
    manifest.hostname = "[%type%]-[%provider%]-[%region%]-[%index%]-[%env%]";

    var oldSettings;
    try {
        oldSettings = require(source + "/settings/" + settingsName)(manifest);
    } catch (e) {
        return callback(e);
    }
    
    var buildConfig = require(source + "/configs/" + config).buildConfig({mode: settingsName});
    
    if (buildConfig.settingsInclude == "*") {
        newSettings = oldSettings;
    }
    else {
        buildConfig.settingsInclude = buildConfig.settingsInclude.concat(ALWAYS_INCLUDE_SETTINGS);
        var newSettings =
            buildConfig.settingsInclude.reduce(function(settings, name) {
                settings[name] = oldSettings[name];
                return settings;
            }, {});
    }
    
    newSettings.node = oldSettings.node;
    
    var contents = 
        "var hostname = require('c9/hostname');\n" +
        "var reJSON = require('c9/json-with-re');\n" +
        "var fill = require('simple-template').fill;\n" +
        "module.exports = function() {\n" +
        "  var options = hostname.parse(hostname.get());\n" +
        "  options.root = __dirname + '/..';\n" +
        "  var template = " + reJSON.stringify(newSettings, 2).replace(new RegExp(source, "g"), "[%root%]") + ";\n" +
        "  return reJSON.parse(fill(JSON.stringify(template), options));\n" +
        "};";

    callback(null, contents);
}