#!/usr/bin/env node
"use strict";
"use server";


require("c9/inline-mocha")(module);

describe(__filename, function() {
    it("should analyze 'nodejs.js'", require('./framework').buildTest("nodejs.js"));
});