"use strict";
"use server";


require("c9/inline-mocha")(module);
require("../../test/setup_paths");
if (typeof process !== "undefined") {
    require("amd-loader");
}

var assert = require("ace/test/assertions");
var Document = require("ace/document").Document;
var completer = require("plugins/c9.ide.language.html/html_completer");

describe(__filename, function() {
    
    it("basic snippet completion 1", function(next) {
        var doc = new Document("<bo");
        completer.complete(doc, null, { row: 0, column: 3 }, null, function(matches) {
            console.log("Matches:", matches);
            assert.equal(matches.length, 1);
            assert.equal(matches[0].name, "body");
            next();
        });
    });

    it("basic snippet completion 2", function(next) {
        var doc = new Document("link");
        completer.complete(doc, null, { row: 0, column: 3 }, null, function(matches) {
            console.log("Matches:", matches);
            assert.equal(matches.length, 1);
            assert.ok(matches[0].replaceText.match(/^<link .*stylesheet.*css.*\/>$/));
            next();
        });
    });

    it("Jade/Haml completion 1", function(next) {
        var doc = new Document("\n.breaty");
        completer.complete(doc, null, { row: 1, column: 7 }, null, function(matches) {
            console.log("Matches:", matches);
            assert.equal(matches.length, 1);
            assert.equal(matches[0].replaceText, '<div class="breaty">^^</div>');
            next();
        });
    });

    it("Jade/Haml completion 2", function(next) {
        var doc = new Document("<span>anything</span>table.cool<p>stuff</p>");
        completer.complete(doc, null, { row: 0, column: 31 }, null, function(matches) {
            console.log("Matches:", matches);
            assert.equal(matches.length, 1);
            assert.ok(matches[0].replaceText.match(/^<table/));
            assert.ok(matches[0].replaceText.match(/<\/table>$/));
            next();
        });
    });
});