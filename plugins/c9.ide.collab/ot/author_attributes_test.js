"use strict";
"use server";


require("c9/inline-mocha")(module);
if (typeof process !== "undefined") {
    require("amd-loader");
    require("../../../test/setup_paths");
}

var assert = require("ace/test/assertions");

var AuthorAttributes = require("./author_attributes")(4, 8);
var insert = AuthorAttributes.insert;
var remove = AuthorAttributes.remove;
var apply = AuthorAttributes.apply;
var traverse = AuthorAttributes.traverse;
var valueAtIndex = AuthorAttributes.valueAtIndex;

describe(__filename, function() {

    it("should insert / delete sequence", function() {
        var auth = [5, null];
        insert(auth, 0, 5, "u1");
        assert.deepEqual(auth, [5, "u1", 5, null]);
        insert(auth, 4, 3, "u2");
        assert.deepEqual(auth, [ 4, 'u1', 3, 'u2', 1, 'u1', 5, null ]);
        insert(auth, 2, 3, "u3");
        assert.deepEqual(auth, [ 7, [ 2, 'u1', 3, 'u3', 2, 'u1' ], 9, [ 3, 'u2', 1, 'u1', 5, null ] ]);
        remove(auth, 5, 1);
        assert.deepEqual(auth, [ 6, [ 2, 'u1', 3, 'u3', 1, 'u1' ], 9, [ 3, 'u2', 1, 'u1', 5, null ] ]);
        remove(auth, 2, 3);
        assert.deepEqual(auth, [ 3, 'u1', 9, [ 3, 'u2', 1, 'u1', 5, null ] ]);
        remove(auth, 1, 4);
        assert.deepEqual(auth, [ 1, 'u1', 7, [ 1, 'u2', 1, 'u1', 5, null ] ]);
        insert(auth, 3, 1, "u1");
        assert.deepEqual(auth, [ 1, 'u1', 8, [ 1, 'u2', 2, 'u1', 5, null ] ]);
        remove(auth, 6, 3);
        assert.deepEqual(auth, [ 1, 'u1', 5, [ 1, 'u2', 2, 'u1', 2, null ] ]);
        remove(auth, 1, 4);
        assert.deepEqual(auth, [ 1, 'u1', 1, null ]);
        insert(auth, 2, 3, "u4");
        assert.deepEqual(auth, [ 1, 'u1', 1, null, 3, "u4" ]);

        auth = [1, "m"];
        insert(auth, 1, 1, "m");
        assert.deepEqual(auth, [2, "m"]);
        insert(auth, 0, 1, "m");
        assert.deepEqual(auth, [3, "m"]);
    });

    it("should sparse edits", function() {
        var auth = [10, null];
        insert(auth, 1, 2, "u1");
        assert.deepEqual(auth, [1, null, 2, "u1", 9, null]);
        insert(auth, 5, 2, "u2");
        assert.deepEqual(auth, [3, [1, null, 2, "u1"], 11, [2, null, 2, "u2", 7, null]]);
    });

    it("should applyAuthorAttributes", function() {
        var auth = [];
        apply(auth, ["iabc"], "m");
        assert.deepEqual(auth, [3, "m"]);
        apply(auth, ["r1", "ide", "db"], "n");
        assert.deepEqual(auth, [1, "m", 2, "n", 1, "m"]);
        apply(auth, ["r1", "dde", "r1"], "n");
        assert.deepEqual(auth, [2, "m"]);
        apply(auth, ["dac"], "m");
        assert.deepEqual(auth, []);
        apply(auth, ["ipqrst"], "m");
        assert.deepEqual(auth, [5, "m"]);
    });

    it("should traverse", function () {
        var auth = [ 7, [ 2, 'u1', 3, 'u3', 2, 'u1' ], 9, [ 3, 'u2', 1, 'u1', 5, null ] ];
        var checkI = 0;
        var records = [
            [0, 2, "u1"],
            [2, 3, "u3"],
            [5, 2, "u1"],
            [7, 3, "u2"],
            [10, 1, "u1"],
            [11, 5, null],
        ];
        traverse(auth, null, null, function (index, length, value) {
            assert.deepEqual(records[checkI++], [index, length, value]);
        });

        // partial traversal
        checkI = 0;
        records = [
            [4, 1, "u3"],
            [5, 2, "u1"],
            [7, 3, "u2"],
            [10, 1, "u1"],
            [11, 2, null],
        ];
        traverse(auth, 4, 13, function (index, length, value) {
            assert.deepEqual(records[checkI++], [index, length, value]);
        });
    });

    it("should many edits", function() {
        var auth = [];
        for (var i = 0;i < 10;i++)
            insert(auth, i, 1, "a");
        for (i = 0;i < 10;i++)
            insert(auth, 2 * i, 1, "z");
        var arr = [];
        traverse(auth, null, null, function (index, length, value) {
            arr.push(value);
        });
        assert.deepEqual(arr, new Array(11).join("za").split(""));
    });

    it("should get value at index", function() {
        var auth = [ 7, [ 2, 'u1', 3, 'u3', 2, 'u1' ], 9, [ 3, 'u2', 1, 'u1', 5, null ] ];
        assert.equal(valueAtIndex(auth, 0), "u1");
        assert.equal(valueAtIndex(auth, 1), "u1");
        assert.equal(valueAtIndex(auth, 2), "u3");
        assert.equal(valueAtIndex(auth, 3), "u3");
        assert.equal(valueAtIndex(auth, 4), "u3");
        assert.equal(valueAtIndex(auth, 5), "u1");
        assert.equal(valueAtIndex(auth, 6), "u1");
        assert.equal(valueAtIndex(auth, 7), "u2");
        assert.equal(valueAtIndex(auth, 8), "u2");
        assert.equal(valueAtIndex(auth, 9), "u2");
        assert.equal(valueAtIndex(auth, 10), "u1");
        assert.equal(valueAtIndex(auth, 11), null);
        assert.equal(valueAtIndex(auth, 12), null);
        assert.equal(valueAtIndex(auth, 13), null);
        assert.equal(valueAtIndex(auth, 14), null);
        assert.equal(valueAtIndex(auth, 15), null);
    });
});