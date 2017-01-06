define(function(require, exports, module) {
"use strict";

var DMP = require("../../c9.ide.threewaymerge/diff_match_patch_amd");
var diff_match_patch = DMP.diff_match_patch;
var DIFF_EQUAL = DMP.DIFF_EQUAL;
var DIFF_INSERT = DMP.DIFF_INSERT;
var DIFF_DELETE = DMP.DIFF_DELETE;

/**
 * Get a diff operation to transform a text document from: `fromText` to `toText`
 *
 * @param {String} fromText
 * @param {String} toText
 * @return {Operation} op
 */
function operation(fromText, toText) {
    var dmp = new diff_match_patch();
    var diffs = dmp.diff_main(fromText, toText);
    dmp.diff_cleanupSemantic(diffs);
    var d, type, val;
    var op = [];
    for (var i = 0; i < diffs.length; i++) {
        d = diffs[i];
        type = d[0];
        val = d[1];
        switch (type) {
            case DIFF_EQUAL:
                op.push("r" + val.length);
            break;
            case DIFF_INSERT:
                op.push("i" + val);
            break;
            case DIFF_DELETE:
                op.push("d" + val);
            break;
        }
    }
    return op;
}

// Simple edit constructors.

function insert(chars) {
    return "i" + chars;
}

function del(chars) {
    return "d" + chars;
}

function retain(n) {
    return "r" + String(n);
}

/**
 * Return the type of a sub-edit
 *
 * @param  {String} edit
 * @return {String} type of the operation
 */
function type(edit) {
    switch (edit[0]) {
    case "r":
        return "retain";
    case "d":
        return "delete";
    case "i":
        return "insert";
    default:
        throw new TypeError("Unknown type of edit: ", edit);
    }
}

/**
 * Return the value of a sub-edit
 *
 * @param  {String} sub-edit
 * @return the value of the operation
 *   - Retain: the number of characters to retain
 *   - Insert/Delete: the text to insert or delete
 */
function val(edit) {
    return type(edit) === "retain" ? ~~edit.slice(1) : edit.slice(1);
}

/**
 * Return the length of a sub-edit
 *
 * @param  {String} edit
 * @return {Number} the length of the operation
 *   - Retain: the number of characters to retain
 *   - Insert/Delete: the text length to insert or delete
 */
function length(edit) {
    return type(edit) === "retain" ? ~~edit.slice(1) : edit.length - 1;
}

/**
 * Split a sub-edit on a index: idx
 *
 * @param  {String} edit
 * @return [{String}] an array of length 2 of the sub-operaion splitted to 2 operaions
 */
function split(edit, idx) {
    if (type(edit) === "retain") {
        var rCount = ~~edit.slice(1);
        return [
            "r" + idx,
            "r" + (rCount - idx)
        ];
    }
    else {
        return [
            edit[0] + edit.substring(1, idx + 1),
            edit[0] + edit.substring(idx + 1)
        ];
    }
}

/**
 * Pack an operation to a minimal operation
 *
 * @param  {Operation} op
 * @return {Operation} packed
 */
function pack(op) {
    var packed = op.slice();
    var i = 0;
    while (i < packed.length - 1) {
        if (packed[i][0] === packed[i + 1][0])
            packed.splice(i, 2, packed[i][0] + (val(packed[i]) + val(packed[i + 1])));
        else
            i++;
    }
    return packed;
}

/**
 * Inverse an operation to undo revert its effect on a document
 *
 * @param  {Operation} op
 * @return {Operation} inversed
 */
function inverse(op) {
    var edit, t, v, inversed = new Array(op.length);
    for (var i = 0, el = op.length; i < el; i++) {
        edit = op[i];
        t = type(edit);
        v = val(edit);
        switch (t) {
            case "retain":
                inversed[i] = op[i];
                break;
            case "insert":
                inversed[i] = del(v);
                break;
            case "delete":
                inversed[i] = insert(v);
                break;
        }
    }
    return inversed;
}

module.exports = {
    insert: insert,
    del: del,
    retain: retain,
    type: type,
    val: val,
    length: length,
    split: split,
    pack: pack,
    operation: operation,
    inverse: inverse
};

});
