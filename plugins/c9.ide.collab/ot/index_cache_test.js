"use strict";
"use server";


require("c9/inline-mocha")(module);
if (typeof process !== "undefined") {
    require("amd-loader");
    require("../../../test/setup_paths");
}

var Document = require("ace/document").Document;
var assert = require("ace/test/assertions");
var IndexCache = require("./index_cache");

var doc = null;
function createDoc(str) {
    doc = new Document(str);
    IndexCache(doc);
}

function test(pos, index) {
    var cachedIndex = doc.positionToIndex(pos);
    var cachedPos = doc.indexToPosition(index);

    assert.equal([
        cachedIndex, cachedPos.row, cachedPos.column
    ].join("|"), [
        index, pos.row, pos.column
    ].join("|"));
}

describe(__filename, function() {
    it("should index to position", function() {
        createDoc("par\na\na");
        assert.equal(doc.getNewLineCharacter().length, 1);
        test({ row: 1, column: 0 }, 4);
        test({ row: 1, column: 1 }, 5);
        test({ row: 2, column: 0 }, 6);
        doc.insert({ row: 0, column: 1 }, "\n");
        test({ row: 0, column: 1 }, 1);
        test({ row: 1, column: 1 }, 3);
        doc.removeNewLine(0);
        test({ row: 2, column: 0 }, 6);
        test({ row: 1, column: 0 }, 4);
    });
    it("should document with \\r\\n", function() {
        createDoc("par\r\na\r\na");
        assert.equal(doc.getNewLineCharacter().length, 2);
        test({ row: 1, column: 0 }, 5);
        test({ row: 1, column: 1 }, 6);
        test({ row: 2, column: 0 }, 8);
        doc.insert({ row: 0, column: 1 }, "\n");
        test({ row: 0, column: 1 }, 1);
        test({ row: 1, column: 1 }, 4);
        doc.removeNewLine(0);
        test({ row: 2, column: 0 }, 8);
        test({ row: 1, column: 0 }, 5);
    });
});