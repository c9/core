"use strict";
"use server";


require("c9/inline-mocha")(module);

if (typeof process !== "undefined") {
    require("amd-loader");
    require("../../../test/setup_paths");
}


var assert = require("ace/test/assertions");
var operations = require("./operations");

var packedCs;

function testHandleUserChanges(original, changes, expected) {
    packedCs = [];
    if (original.length)
        packedCs.push("r" + original.length);

    changes.forEach(function (change) {
        packedCs = handleUserChanges(packedCs, change);
        console.log("packedCs:", packedCs);
    });

    assert.deepEqual(expected, packedCs, "expected != packedCs --> " + expected + " != " + packedCs);
}

function handleUserChanges (packedCs, data) {
    packedCs = packedCs.slice();
    var startOff = data.offset;

    var offset = startOff, opOff = 0;
    var op = packedCs[opOff];
    while (op) {
        if (operations.type(op) === "delete")
            ; // process next op
        else if (offset < operations.length(op))
            break;
        else
            offset -= operations.length(op);
        op = packedCs[++opOff];
    }

    if (offset !== 0) {
        var splitted = operations.split(op, offset);
        packedCs.splice(opOff, 1, splitted[0], splitted[1]);
        opOff++;
    }

    if (data.action === "insert") {
        var newText = data.text;
        packedCs.splice(opOff, 0, "i" + newText);
    }
    else if (data.action === "remove") {
        var removedText = data.text;
        var remainingText = removedText;
        var opIdx = opOff;
        var nextOp = packedCs[opIdx];
        while (remainingText.length) {
            var opLen = operations.length(nextOp);
            var toRem = Math.min(remainingText.length, opLen);
            switch (operations.type(nextOp)) {
            case "retain":
                packedCs[opIdx] = "d" + remainingText.substring(0, toRem);
                if (opLen > remainingText.length)
                    packedCs.splice(opIdx + 1, 0, "r" + (opLen - remainingText.length));
                remainingText = remainingText.substring(toRem);
                opIdx++;
                break;
            case "insert":
                packedCs.splice(opIdx, 1);
                if (opLen > remainingText.length)
                    packedCs.splice(opIdx, 0, operations.split(nextOp, toRem)[1]);
                remainingText = remainingText.substring(toRem);
                break;
            case "delete":
                opIdx++;
                break;
            }
            nextOp = packedCs[opIdx];
        }
    }
    return operations.pack(packedCs);
}

// Entry format
// original, array of actions, packed changeset
var handleChangesTests = [
    [
        "abc", [
            { action: "insert", offset: 1, text: "K" },
            { action: "remove", offset: 3, text: "c" }
        ], ["r1", "iK", "r1", "dc"]
    ],
    [
        "", [
            { action: "insert", offset: 0, text: "abc" },
            { action: "remove", offset: 1, text: "bc" }
        ], ["ia"]
    ],
    [
        "abc", [
            { action: "remove", offset: 0, text: "abc" }
        ], ["dabc"]
    ],
    [
        "abc", [
            { action: "insert", offset: 1, text: "K" },
            { action: "insert", offset: 3, text: "M" },
            { action: "remove", offset: 1, text: "Kb" }
        ], ["r1", "db", "iM", "r1"]
    ],
    [
        "abc", [
            { action: "remove", offset: 0, text: "ab" },
            { action: "insert", offset: 1, text: "de" }
        ], ["dab", "r1", "ide"]
    ],
    [
        "abc", [
            { action: "insert", offset: 1, text: "fg" },
            { action: "insert", offset: 1, text: "de" },
            { action: "remove", offset: 2, text: "ef" },
            { action: "remove", offset: 2, text: "gb" }
        ], ["r1", "id", "db", "r1"]
    ],
    [ "abc", [
            { action: "insert", offset: 1, text: "defg" },
            { action: "remove", offset: 0, text: "adef" }
        ], ["da", "ig", "r2"]
    ],
    [ "abc\ndef\nghi", [
            { action: "insert", offset: 1, text: "mn" },
            { action: "remove", offset: 7, text: "e" },
            { action: "remove", offset: 2, text: "nbc\nd" },
        ], ["r1", "im", "dbc\nde", "r5"],
    ]
];

describe(__filename, function() {
    handleChangesTests.forEach(function(test) {
        it("should handleUserChanges '" + test[0] + "' --> " + test[2].join(","), function() {
            testHandleUserChanges.apply(null, test);
        });
    });
});