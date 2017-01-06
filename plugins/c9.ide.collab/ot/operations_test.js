"use strict";
"use server";


require("c9/inline-mocha")(module);
if (typeof process !== "undefined") {
    require("amd-loader");
    require("../../../test/setup_paths");
}

var assert = require("ace/test/assertions");
var operations = require("./operations");

describe(__filename, function() {
    it("should test operations operation constructs", function () {
        assert.equal(operations.insert("ab"), "iab");
        assert.equal(operations.del("ab"), "dab");
        assert.equal(operations.retain(3), "r3");
    });

    it("should test operations binary checks", function () {
        assert.equal(operations.type("r2"), "retain");
        assert.equal(operations.type("iab"), "insert");
        assert.equal(operations.type("dab"), "delete");
    });

    it("should test operations.length", function () {
        assert.equal(operations.length("r15"), 15);
        assert.equal(operations.length("iabc"), 3);
        assert.equal(operations.length("dkfc"), 3);
    });

    it("should test operations.split", function () {
        assert.deepEqual(operations.split("r15", 5), ["r5", "r10"]);
        assert.deepEqual(operations.split("iabcd", 2), ["iab", "icd"]);
        assert.deepEqual(operations.split("dabcd", 2), ["dab", "dcd"]);
    });

    it("should test operations.pack", function () {
        assert.deepEqual(operations.pack(["r5", "r10"]), ["r15"]);
        assert.deepEqual(operations.pack(["iab", "icd"]), ["iabcd"]);
        assert.deepEqual(operations.pack(["dab", "dcd"]), ["dabcd"]);
        // multiple edits
        assert.deepEqual(operations.pack(["iab", "icd", "ief", "r1", "r2", "r3", "dks"]),
            ["iabcdef", "r6", "dks"]);
    });

    it("should test operations.inverse", function () {
        assert.deepEqual(operations.inverse(["iab"]), ["dab"]);
        assert.deepEqual(operations.inverse(["dab"]), ["iab"]);
        assert.deepEqual(operations.inverse(["r3"]), ["r3"]);
        assert.deepEqual(operations.inverse(["iab", "icd", "r4", "dks", "dty"]), ["dab", "dcd", "r4", "iks", "ity"]);
    });
});