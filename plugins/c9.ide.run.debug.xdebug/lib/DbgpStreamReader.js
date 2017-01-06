define(function(require, exports, module) {
"use strict";

var inherits = require("util").inherits;
var Stream = require("stream").Stream;

module.exports = DbgpStreamReader;

function DbgpStreamReader() {
    Stream.call(this);
    this.writable = true;
    this._buffer = "";
}

inherits(DbgpStreamReader, Stream);

DbgpStreamReader.prototype.write = function(chunk) {
    this._buffer += chunk;

    var parts = this._buffer.split(/\u0000/g);

    // keep the last partial messages buffered
    this._buffer = parts.slice(parts.length - ((parts.length - 1) % 2) - 1).join("\u0000");
    parts = parts.slice(0, parts.length - ((parts.length - 1) % 2) - 1);

    for (var i = 0; i < parts.length; i += 2) {
        var len = parseInt(parts[i], 10);
        var data = parts[i + 1];

        if (len !== data.length) {
            var err = new Error("Invalid chunk: data length does not match header");
            this.emit("error", err);
            return;
        }

        this.emit("data", data);
    }
};

DbgpStreamReader.prototype.end = function() {
    this.emit("end");
};

});
