/*global describe it before*/

"use client";

if (typeof define === "undefined") {
    require("c9/inline-mocha")(module);
    require("amd-loader");
    require("../../test/setup_paths");
}

define(function(require, exports, module) {
    var Document = require("ace/document").Document;
    var assert = require("lib/chai/chai").assert;
    var completer = require("./local_completer");
    
    function matchSorter(matches) {
        matches.sort(function(a, b) {
            if (a.score < b.score)
                return 1;
            else if (a.score > b.score)
                return -1;
            else
                return 0;
        });
    }
    
    function determineDistance(score) {
        return 1000000 - score;
    }
    
    describe("Local Completer", function() {
        it("test basic completion", function(next) {
            var doc = new Document("hel hello2 hello3  hello2 abc");
            completer.complete(doc, null, { row: 0, column: 3 }, null, function(err, matches) {
                if (err) return next(err);
                matchSorter(matches);
                // console.log("Matches:", matches);
                assert.equal(matches.length, 2);
                assert.equal(matches[0].name, "hello2");
                assert.equal(determineDistance(matches[0].score), 1);
                assert.equal(matches[1].name, "hello3");
                assert.equal(determineDistance(matches[1].score), 2);
                next();
            });
        });
    
        it("test basic completion 2", function(next) {
            var doc = new Document("assert.equal(matchers[0].name, matches[0].score);\nassert.eq(matches[0].name, mat[0].score);\n");
            completer.complete(doc, null, { row: 1, column: 9 }, null, function(err, matches) { // .eq|
                if (err) return next(err);
                matchSorter(matches);
                assert.equal(matches.length, 1);
                assert.equal(matches[0].name, "equal");
                assert.equal(determineDistance(matches[0].score), 8);
            });
    
            completer.complete(doc, null, { row: 1, column: 30 }, null, function(err, matches) {  // .mat|[0]
                if (err) return next(err);
                matchSorter(matches);
                assert.equal(matches.length, 2);
                assert.equal(matches[0].name, "matches");
                assert.equal(determineDistance(matches[0].score), 2);
                assert.equal(matches[1].name, "matchers");
                assert.equal(determineDistance(matches[1].score), 7);
            });
            next();
        });
    
        it("should handle multiline documents", function(next) {
            var doc = new Document("foo0 far0 faz0\nfoo1 fa faz1\nfoo2 far2 faz2");
            completer.complete(doc, null, { row: 1, column: 6 }, null, function(err, matches) { // f|
                if (err) return next(err);
                matchSorter(matches);
                assert.equal(matches.length, 8);
                assert.equal(matches[0].name, "foo1");
                assert.equal(determineDistance(matches[0].score), 0);
                assert.equal(determineDistance(matches[1].score), 1);
            });
    
            completer.complete(doc, null, { row: 1, column: 7 }, null, function(err, matches) {  // fa|
                if (err) return next(err);
                matchSorter(matches);
                assert.equal(matches.length, 5);
                assert.equal(matches[0].name, "faz0");
                assert.equal(determineDistance(matches[0].score), 1);
                assert.equal(matches[1].name, "faz1");
                assert.equal(determineDistance(matches[1].score), 1);
                assert.equal(matches[2].name, "far0");
                assert.equal(determineDistance(matches[2].score), 2);
            });
            next();
        });
    });
    onload && onload();
});
