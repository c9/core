/**
 * JSON (de-)serializer with support for encosing regular expressions
 */
"use strict";

exports.replacer = function(key, value) {
    if (value instanceof RegExp)
        return ("__REGEXP " + value.toString());
    else
        return value;
};

exports.reviver = function(key, value) {
    if ((value + "").indexOf("__REGEXP ") == 0) {
        var m = value.match(/__REGEXP \/(.*)\/(.*)?/);
        return new RegExp(m[1], m[2]);
    }
    else
        return value;
};

exports.stringify = function(value, space) {
    return JSON.stringify(value, exports.replacer, space);
};

exports.parse = function(rext) {
    return JSON.parse(rext, exports.reviver);
};