#!/usr/bin/env node
"use strict";
"use server";


require("c9/inline-mocha")(module);

describe(__filename, function() {
    this.timeout(20000);
    it("should analyze 'aceeditor.js'", require('./framework').buildTest("aceeditor.js"));
});