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
var DbgpStreamWriter = require("../lib/DbgpStreamWriter");

describe("DbgpStreamWriter", function() {
    var stream;

    beforeEach(function() {
        stream = new DbgpStreamWriter();
    });

    describe("implements stream", function() {
        it("should be a Stream", function() {
            expect(stream).to.be.instanceOf(Stream);
        });
        it("should be a writable", function() {
            expect(stream.writable).to.be.true;
        });
    });

    describe("writing data", function() {
        it("should write a valid message without data", function(done) {
            stream.on("error", done);

            stream.once("data", function(data) {
                expect(data).to.equal("property_get -i 100 -n \"$foo\"\u0000");
                done();
            });

            stream.write({ seq: 100, command: "property_get", args: { n: "$foo" }});
        });

        it("should write a valid message with data", function(done) {
            stream.on("error", done);

            stream.once("data", function(data) {
                expect(data).to.equal("property_set -i 100 -n \"$foo\" -l 10 -- eHh4eHh4eHh4eA==\u0000");
                done();
            });

            stream.write({ seq: 100, command: "property_set", args: { n: "$foo", l: 10 }, data: "xxxxxxxxxx" });
        });

        it("should accept message if seq is zero", function(done) {
            stream.on("error", done);
            stream.once("data", function(data) { done(); });
            stream.write({ seq: 0, command: "status" });
        });

        it("should skip argument if value is undefined", function(done) {
            stream.on("error", done);

            stream.once("data", function(data) {
                expect(data).to.equal("property_set -i 100 -l 10\u0000");
                done();
            });

            stream.write({ seq: 100, command: "property_set", args: { l: 10, o: undefined }});
        });

        it("should not skip argument if value is zero", function(done) {
            stream.on("error", done);

            stream.once("data", function(data) {
                expect(data).to.equal("property_set -i 100 -l 10 -o 0\u0000");
                done();
            });

            stream.write({ seq: 100, command: "property_set", args: { l: 10, o: 0 }});
        });

        it("should escape quotes in arguments", function(done) {
            stream.on("error", done);

            stream.once("data", function(data) {
                expect(data).to.equal("property_get -i 100 -n \"$x[\\\"a b\\\"]\"\u0000");
                done();
            });

            stream.write({ seq: 100, command: "property_get", args: { n: "$x[\"a b\"]" }});
        });

        it("should emit error if seq is missing", function(done) {
            stream.on("data", function() {
                done(new Error("should not emit data"));
            });

            stream.once("error", function(err) {
                expect(err).to.be.instanceOf(Error);
                expect(err.message).to.match(/seq/);
                done();
            });

            stream.write({ command: "property_set", args: { n: "$foo", l: 10 }, data: "xxxxxxxxxx" });
        });

        it("should emit error if command is missing", function(done) {
            stream.on("data", function() {
                done(new Error("should not emit data"));
            });

            stream.once("error", function(err) {
                expect(err).to.be.instanceOf(Error);
                expect(err.message).to.match(/command/);
                done();
            });

            stream.write({ seq: 100, args: { n: "$foo", l: 10 }, data: "xxxxxxxxxx" });
        });

        it("should emit error if an argument key is invalid", function(done) {
            stream.on("data", function() {
                done(new Error("should not emit data"));
            });

            stream.once("error", function(err) {
                expect(err).to.be.instanceOf(Error);
                expect(err.message).to.match(/argument key/i);
                done();
            });

            stream.write({ seq: 100, command: "foo", args: { "not valid!": 10 }});
        });
    });
});

// end test ////

if (typeof onload !== "undefined")
    onload();

});

