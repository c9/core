// This module defines the `xform` function which is at the heart of OT.
define(function(require, exports, module) {
"use strict";

var ops = require("./operations");

// Pattern match on two edits by looking up their transforming function in
// the `xformTable`. Each function in the table should take arguments like
// the following:
//
//     xformer(editA, editB, next)
//
// and should return the results by calling the next
//
//     return next(editAPrime || null, editBPrime || null, newIndexA, newIndexB);

var xformTable = {};

function join (a, b) {
    return a + "," + b;
}

// Define a transformation function for when we are comparing two edits of
// typeA and typeB.
function defXformer (typeA, typeB, xformer) {
    xformTable[join(typeA, typeB)] = xformer;
}

defXformer("retain", "retain", function (editA, editB, k) {
    var retainBoth = Math.min(ops.val(editA), ops.val(editB));
    k(ops.retain(retainBoth), ops.retain(retainBoth), retainBoth, retainBoth);
});

defXformer("delete", "delete", function (editA, editB, k) {
    var valA = ops.val(editA);
    var valB = ops.val(editB);
    var toDelete;
    if (valA.length <= valB.length && valB.substring(0, valA.length) === valA)
        toDelete = valA.length;
    else if (valB.length < valA.length && valA.substring(0, valB.length) === valB)
        toDelete = valB.length;
    if (toDelete)
        k(null, null, toDelete, toDelete);
    else
        throw new TypeError("Document state mismatch: delete(" +
                            valA + ") !== delete(" + valB + ")");
});

defXformer("insert", "insert", function (editA, editB, k) {
    var lenA = editA.length - 1;
    k(editA, ops.retain(lenA), lenA, 0);
});

defXformer("retain", "delete", function (editA, editB, k) {
    var lenA = ops.val(editA);
    var lenB = editB.length - 1;
    if (lenA < lenB)
        k(null, ops.del(editB.substring(1, lenA + 1)), lenA, lenA);
    else
        k(null, editB, lenB, lenB);
});

defXformer("delete", "retain", function (editA, editB, k) {
    var lenA = editA.length - 1;
    var lenB = ops.val(editB);
    if (lenB < lenA)
        k(ops.del(editA.substring(1, lenB + 1)), null, lenB, lenB);
    else
        k(editA, null, lenA, lenA);
});

defXformer("insert", "retain", function (editA, editB, k) {
    var lenA = editA.length - 1;
    k(editA, ops.retain(lenA), lenA, 0);
});

defXformer("retain", "insert", function (editA, editB, k) {
    var lenB = editB.length - 1;
    k(ops.retain(lenB), editB, 0, lenB);
});

defXformer("insert", "delete", function (editA, editB, k) {
    var lenA = editA.length - 1;
    k(editA, ops.retain(lenA), lenA, 0);
});

defXformer("delete", "insert", function (editA, editB, k) {
    var lenB = editB.length - 1;
    k(ops.retain(lenB), editB, 0, lenB);
});

module.exports = function (operationA, operationB, k) {
    var operationAPrime = [];
    var operationBPrime = [];

    var opIndexA = 0;
    var opIndexB = 0;

    var editA = operationA[0];
    var editB = operationB[0];

    var xformer;

    // Continuation for the xformer.
    function kk (aPrime, bPrime, addIndexA, addIndexB) {
        editA = ops.split(editA, addIndexA)[1];
        if (!ops.length(editA))
            editA = operationA[++opIndexA];

        editB = ops.split(editB, addIndexB)[1];
        if (!ops.length(editB))
            editB = operationB[++opIndexB];

        if (aPrime)
            operationAPrime.push(aPrime);
        if (bPrime)
            operationBPrime.push(bPrime);
    }

    while (editA && editB) {
        xformer = xformTable[join(ops.type(editA), ops.type(editB))];
        if (xformer)
            xformer(editA, editB, kk);
        else
            throw new TypeError("Unknown combination to transform: " +
                                join(ops.type(editA), ops.type(editB)));
    }

    // If either operation contains more edits than the other, we just
    // pass them on to the prime version.

    while (editA) {
        operationAPrime.push(editA);
        operationBPrime.push(ops.retain(ops.length(editA)));
        editA = operationA[++opIndexA];
    }

    while (editB) {
        operationBPrime.push(editB);
        operationAPrime.push(ops.retain(ops.length(editB)));
        editB = operationB[++opIndexB];
    }

    return k(ops.pack(operationAPrime), ops.pack(operationBPrime));
};

});
