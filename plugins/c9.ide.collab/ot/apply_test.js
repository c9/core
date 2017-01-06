"use strict";
"use server";


require("c9/inline-mocha")(module);
if (typeof process !== "undefined") {
    require("amd-loader");
    require("../../../test/setup_paths");
}

var Document = require("ace/document").Document;
var assert = require("ace/test/assertions");

var operations = require("./operations");
var applyContents = require("./apply").applyContents;
var applyAce = require("./apply").applyAce;

function test(str, result) {
    var op = operations.operation(str, result);
    console.log("OP:", op);
    var resultContents = applyContents(op, str);
    assert.equal(resultContents, result, "applyContents failed");
    var doc = new Document(str);
    applyAce(op, doc);
    var resultAce = doc.getValue();
    assert.equal(resultAce, result, "applyContents failed");
}

describe(__filename, function() {
    it("should test different apply cases", function() {
        test("abc", "abcd");
        test("abc", "abdef");
        test("abc-def", "c-efiy");
        test("abc-def", "");
        test("", "fly");
        test("abc\ndef\njhi", "def\nabc\njhi");
    });
});
