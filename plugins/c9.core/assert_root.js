"use strict";

var assert = require("assert");

plugin.consumes = [];
plugin.provides = ["assert.root"];

module.exports = plugin;

function plugin(options, imports, register) {
    assert.equal(process.getuid(), 0, "You need to be root to run this config");
    register(null, {
        "assert.root": {}
    });
}