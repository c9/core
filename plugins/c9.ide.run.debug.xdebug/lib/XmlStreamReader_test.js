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

var Stream = require("stream").Stream;
var XmlStreamReader = require("../lib/XmlStreamReader");

describe("XmlStreamReader", function() {
    var stream;

    beforeEach(function() {
        stream = new XmlStreamReader();
    });

    describe("implements stream", function() {
        it("should be a Stream", function() {
            expect(stream).to.be.instanceOf(Stream);
        });
        it("should be a writable", function() {
            expect(stream.writable).to.be.true;
        });
    });

    describe("reading data", function() {
        it("should read valid xml", function(done) {
            stream.once("data", function(data) {
                expect(data).to.be.an.object;
                expect(data).to.have.deep.property("init.@appid", 17664);
                expect(data).to.have.deep.property("init.engine.$", "Xdebug");
                done();
            });

            stream.write(require("text!../mock/init.xml"));
        });

        it("should emit error for invalid xml", function(done) {
            stream.on("data", function() {
                done(new Error("should not emit data"));
            });

            stream.once("error", function(err) {
                expect(err).to.be.instanceOf(Error);
                expect(err.message).to.match(/Invalid XML message/);
                done();
            });

            stream.write("<foo>malformed xml");
        });
    });
});

// end test ////

if (typeof onload !== "undefined")
    onload();

});

