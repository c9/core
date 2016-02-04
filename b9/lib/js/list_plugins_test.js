#!/usr/bin/env node

/*global describe it before after beforeEach afterEach */
"use strict";
"use server";

require("c9/inline-mocha")(module, null, { globals: ["define"]});

var assert = require("assert-diff");
var listPlugins = require("./list_plugins");

describe(__filename, function() {

    it("should filter node modules for docker", function() {
        var list = listPlugins(__dirname + "/../../..", "docker", "deploy");

        assert(list.indexOf("c9.docker") >= 0);
        assert(list.indexOf("c9.mq") >= 0);
        
        assert(list.indexOf("c9.db.redis") == -1);
    });
});