define(function(require, exports, module) {
"use strict";

module.exports = XmlStreamReader;

var inherits = require("util").inherits;
var Stream = require("stream").Stream;

var parseXml = require("./util").parseXml;
var xmlToObject = require("./util").xmlToObject;

function XmlStreamReader() {
    Stream.call(this);
    this.writable = true;
}

inherits(XmlStreamReader, Stream);

XmlStreamReader.prototype.write = function(data) {
    var xml;

    try {
        xml = parseXml(data);
    } catch (err) {
        this.emit("error", err);
        return;
    }

    var obj = xmlToObject(xml);
    this.emit("data", obj);

    return true;
};

XmlStreamReader.prototype.end = function() {
    this.emit("end");
};

});
