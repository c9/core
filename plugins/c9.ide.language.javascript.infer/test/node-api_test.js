#!/usr/bin/env node
"use strict";
"use server";


require("c9/inline-mocha")(module);

describe(__filename, function() {
    it("should analyze node API'", require('./framework').buildTest("node-api.js"));
});