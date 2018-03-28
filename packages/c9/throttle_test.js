/*global describe it beforeEach afterEach*/
"use strict";
"use server";
"use mocha";

require("c9/inline-mocha")(module);

var throttle = require("./throttle");
var sinon = require("sinon");
var assert = require("assert");
var async = require("async");

describe("urls", function() {

    this.timeout(15000);

    it("calls first invocation with no delay", function(done) {
        var tpms = 10;
        var throttler = throttle(tpms);

        var start = Date.now();

        throttler(function() {
            var end = Date.now() - start;
            assert.ok(end < tpms, "invocation was immediate");
            done();
        });
    });

    it("calls second invocation delayed by tpms", function(done) {
        var tpms = 10;
        var throttler = throttle(tpms);

        var start = Date.now();
        var first = sinon.stub();

        throttler(first);

        throttler(function() {
            var end = Date.now() - start;
            assert(first.calledOnce);
            assert.ok(end >= tpms);
            done();
        });
    });

    it("calls third invocation delayed by 2 * tpms", function(done) {
        var tpms = 10;
        var throttler = throttle(tpms);

        var start = Date.now();
        var first = sinon.stub();
        var second = sinon.stub();

        throttler(first);
        throttler(second);

        throttler(function() {
            var end = Date.now() - start;
            assert(first.calledOnce);
            assert(second.calledOnce);

            assert.ok(end >= tpms * 2);
            done();
        });
    });

    it("does not delay after enough time has passed", function(done) {
        var tpms = 10;
        var throttler = throttle(tpms);

        var first = sinon.stub();
        var second = sinon.stub();

        throttler(first);
        throttler(second);

        setTimeout(function() {
            var start = Date.now();

            assert(first.calledOnce);
            assert(second.calledOnce);

            throttler(function() {
                var end = Date.now() - start;

                assert.ok(end < tpms, "third call was not delayed at all");

                done();
            });
        }, tpms * 3);

    });

    it("delays callback chains", function(done) {
        var tpms = 30;
        var throttler = throttle(tpms);

        var start = Date.now();

        async.each([1, 2, 3, 4], function(a, next) {
            throttler(next);
        }, function() {
            var end = Date.now() - start;
            assert.ok(end >= tpms * 3, "End result was delayed");
            done();
        });
    });

    it("delays a .series", function(done) {
        var tpms = 30;
        var throttler = throttle(tpms);

        var start = Date.now();

        async.series([
            throttler,
            throttler,
            function(next) {
                var end = Date.now() - start;
                assert.ok(end >= tpms, "got delayed");
                throttler(next);
            }

        ], function() {
            var end = Date.now() - start;
            assert.ok(end >= tpms * 2, "delayed 2 times");
            done();
        });

    });



});