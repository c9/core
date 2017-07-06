define(function(require, exports, module) {
"use strict";

module.exports = DbgpStreamWriter;

var inherits = require("util").inherits;
var Stream = require("stream").Stream;

var base64Encode = require("./util").base64Encode;

function DbgpStreamWriter() {
    Stream.call(this);
    this.writable = true;
}

inherits(DbgpStreamWriter, Stream);

DbgpStreamWriter.prototype.write = function(data) {
    try {
        this.emit("data", this.format(data));
    } catch (err) {
        this.emit("error", err);
    }
};

DbgpStreamWriter.prototype.format = function(data) {
    if (typeof data !== "object")
        throw new TypeError("Expected data to be an object");

    if (!data.seq && data.seq !== 0)
        throw new TypeError("Expected data to contain seq");

    if (!data.command)
        throw new TypeError("Expected data to contain command");

    var parts = [ data.command ];

    parts.push("-i");
    parts.push(escapeValue(data.seq));

    if (data.args) {
        for (var key in data.args) {
            var value = data.args[key];

            if ([ "", null, undefined ].indexOf(value) !== -1)
                continue;

            parts.push("-" + escapeKey(key));
            parts.push(escapeValue(value));
        }
    }

    if (data.data) {
        parts.push("--");
        parts.push(base64Encode(data.data));
    }

    return parts.join(" ") + "\u0000";
};

DbgpStreamWriter.prototype.end = function() {
    this.emit("end");
};

function escapeKey(key) {
    if (!key.match(/^[a-z]+$/))
        throw new Error("Argument key invalid format");

    return key;
}

function escapeValue(value) {
    return JSON.stringify(value);
}

});
