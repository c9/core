/* global describe it before after beforeEach afterEach define */

"use strict";
"use client";


if (typeof define === "undefined") {
    require("c9/inline-mocha")(module);
    require("amd-loader");
    require("../../../test/setup_paths");
}

define(function(require, exports, module) {

var expect = require("lib/chai/chai").expect;

// begin test ////

var parseXml = require("../lib/util").parseXml;

describe("util.parseXml()", function() {
    it("should read well-formed XML", function() {
        var xmlDoc = parseXml("<foo><bar/></foo>");
        expect(xmlDoc).to.be.instanceOf(Document);
        expect(xmlDoc.documentElement.tagName).to.equal("foo");
        expect(xmlDoc.documentElement.childNodes[0].tagName).to.equal("bar");
    });

    it("should read well-formed XML with a declaration", function() {
        var xmlDoc = parseXml('<?xml version="1.0" encoding="UTF-8"?><foo><bar/></foo>');
        expect(xmlDoc).to.be.instanceOf(Document);
        expect(xmlDoc.documentElement.tagName).to.equal("foo");
    });

    it("should fail with invalid XML", function() {
        expect(function() {
            parseXml("<foo>&such; this is not xml!");
        }).to.throw(Error, /Entity 'such' not defined|Invalid XML message:/);

        expect(function() {
            parseXml("<foo>incomplete doc");
        }).to.throw(Error, /Extra content at the end of the document|Invalid XML message:/);

        // expect(function() {
        //     parseXml();
        // }).to.throw(Error, /empty/);
    });
});

var xmlToObject = require("../lib/util").xmlToObject;

describe("util.xmlToObject()", function() {
    var mockInput, mockOutput;

    before(function() {
        mockInput = require("text!../mock/jxon.xml");
        mockOutput = require("../mock/jxon.js");
    });

    it("should convert well-formed XML", function() {
        var obj = xmlToObject(mockInput);
        expect(obj).to.deep.equal(mockOutput);
    });
});

// end test ////

if (typeof onload !== "undefined")
    onload();

});

