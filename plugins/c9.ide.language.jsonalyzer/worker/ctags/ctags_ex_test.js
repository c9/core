/*global describe it before after beforeEach afterEach */
"use server";

if (typeof define === "undefined") {
    require("amd-loader");
    require("../../../../test/setup_paths");
    require("c9/inline-mocha")(module);
}

define(function(require, exports, module) {
"use strict";

var assert = require("ace/test/assertions");
var ctags_ex = require("./ctags_ex");
var worker = require("plugins/c9.ide.language.core/worker");

worker.$lastWorker = {};

describe("ctags_ex", function() {

    it("can parse simple .js", function(done) {
        var contents = "function hello() {}\nfunction thar() {}";
        ctags_ex.analyze("dir/ctags_test.js", contents, {}, function(err, result) {
            assert(!err, err);
            assert(result.properties._hello, "Should have property hello");
            done();
        });
    });
    it("can still parse a file with the same name twice", function(done) {
        var contents = "function hello() {}\nfunction thar() {}";
        ctags_ex.analyze("dir/ctags_test.js", contents, {}, function(err, result) {
            assert(!err, err);
            assert(result.properties._hello, "Should first have property hello");
            contents = "function goodbyte() {}";
            ctags_ex.analyze("dir/ctags_test.js", contents, {}, function(err, result) {
                assert(!err, err);
                assert(!result.properties._hello, "Should not still have property hello");
                assert(result.properties._goodbyte, "Should have property goodbyte");
                done();
            });
        });
    });
    it.skip("can parse a .md file", function(done) {
        var contents = "# hello thar";
        ctags_ex.analyze("dir/ctags_test.md", contents, {}, function(err, result) {
            assert(!err, err);
            done();
        });
    });
    it(" fails with an error with a .unknown extension", function(done) {
        var contents = "# hello thar";
        ctags_ex.analyze("dir/ctags_test.unknown", contents, {}, function(err, result) {
            assert(err);
            done();
        });
    });

    if (typeof onload !== "undefined")
        onload();
});

});