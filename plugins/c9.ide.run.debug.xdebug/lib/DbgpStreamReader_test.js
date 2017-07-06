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
var DbgpStreamReader = require("../lib/DbgpStreamReader");

describe("DbgpStreamReader", function() {
    var stream;

    beforeEach(function() {
        stream = new DbgpStreamReader();
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
        it("should read a single message in one chunk", function(done) {
            stream.once("data", function(data) {
                expect(data).to.equal("test");
                done();
            });

            stream.write("4\u0000test\u0000");
        });

        it("should read multiple messages in one chunk", function(done) {
            stream.once("data", function(data) {
                expect(data).to.equal("test");
                stream.once("data", function(data) {
                    expect(data).to.equal("foo");
                    done();
                });
            });

            stream.write("4\u0000test\u00003\u0000foo\u0000");
        });

        it("should read multiple messages in partial chunks", function(done) {
            stream.once("data", function(data) {
                expect(data).to.equal("test");

                stream.once("data", function(data) {
                    expect(data).to.equal("foo");
                    done();
                });

                stream.write("o\u0000");
            });

            stream.write("4\u0000test\u00003\u0000fo");
        });

        it("should stream partial length chunks", function(done) {
            stream.once("data", function(data) {
                expect(data).to.equal("xxxxxxxxxx");
                done();
            });

            stream.write("1");
            stream.write("0\u0000xxxxxxxxxx\u0000");
        });

        it("should stream partial data chunks", function(done) {
            stream.once("data", function(data) {
                expect(data).to.equal("test");
                done();
            });

            stream.write("4\u0000te");
            stream.write("st\u0000");
        });

        it("should emit error if length header and data size do not match", function(done) {
            stream.on("data", function() {
                done(new Error("should not emit data"));
            });

            stream.once("error", function(err) {
                expect(err).to.be.instanceOf(Error);
                expect(err.message).to.match(/data length does not match header/);
                done();
            });

            stream.write("8\u0000test\u0000");
        });
    });
});

// end test ////

if (typeof onload !== "undefined")
    onload();

});

