// This module defines functions to apply an edit on a document representation
define(function(require, exports, module) {
"use strict";

var operations = require("./operations");
var Range = require("ace/range").Range;


function OTError(expected, actual) {
    var err = new Error("OT removed text mismatch");
    err.expected = expected;
    err.actual = actual;
    err.code = "EMISMATCH";
    return err;
}

/**
 * Apply an operation on a string document and return the resulting new document text.
 *
 * @param  {Opeartion} op - e.g. ["r2", "iabc", "r12"]
 * @param  {String} doc
 * @return {String} newDoc
 */
exports.applyContents = function(op, doc) {
    var val, newDoc = "";
    for (var i = 0, len = op.length; i < len; i += 1) {
        val = op[i].slice(1);
        switch (op[i][0]) {
        case "r": // retain
            val = Number(val);
            if (doc.length < val)
                throw new Error("Could not call retain in ApplyContents doc length: " + doc.length + ", retain length: " + val);
            newDoc += doc.slice(0, val);
            doc = doc.slice(val);
            break;
        case "i": // insert
            newDoc += val;
            break;
        case "d": // delete
            if (doc.indexOf(val) !== 0)
                throw new OTError(val, doc.slice(0, 10));
            else
                doc = doc.slice(val.length);
            break;
        default:
            throw new TypeError("Unknown operation: " + operations.type(op[i]));
        }
    }
    return newDoc;
};

/**
 * Apply an operation on an Ace document
 *
 * @param  {Opeartion} op - e.g. ["r2", "iabc", "r12"]
 * @param  {String} doc
 */
exports.applyAce = function(op, editorDoc) {
    var i, len, index = 0, text = "";
    for (i = 0, len = op.length; i < len; i += 1) {
        switch (operations.type(op[i])) {
        case "retain":
            index += operations.val(op[i]);
            break;
        case "insert":
            text = operations.val(op[i]);
            editorDoc.insert(editorDoc.indexToPosition(index, false, true), text);
            index += text.length;
            break;
        case "delete":
            text = operations.val(op[i]);
            var startDel = editorDoc.indexToPosition(index, false, true);
            var endDel = editorDoc.indexToPosition(index + text.length, false, true);
            var range = Range.fromPoints(startDel, endDel);
            var docText = editorDoc.getTextRange(range);
            if (docText !== text) {
                throw new OTError(text, docText);
            }
            editorDoc.remove(range);
            break;
        default:
            throw new TypeError("Unknown operation: " + operations.type(op[i]));
        }
    }
};

});
