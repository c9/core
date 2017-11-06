#!/usr/bin/env node
"use strict";

var path = require("path");
var spawn = require("child_process").spawn;
var phantomjs = require("phantomjs-prebuilt");
var binPath = phantomjs.path;
var argv = require("optimist").usage("Usage: $0 ", {
  "help": {alias: "h", description: "Display the usage", required: false},
  "branch": {description: "github branch for stacktrace", required: false},
  "filter": {description: "test pattern", required: false},
  "host": {description: "url of the test server", required: false},
}).argv;

var phantomRunner = path.join(__dirname, "client-integration/run-client-integration.phantom.js");

var args = [phantomRunner, argv.host || "", argv.filter || "", argv.branch || ""];

console.log("executing: %s %s", binPath, args.join(" "));

var child = spawn(binPath, args);


child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);
child.on("exit", function(code) {
    process.exit(code);
});
