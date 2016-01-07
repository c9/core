"use struct";
"use server";

require("c9/inline-mocha")(module);

var sanitize = require("./sanitize-path-param");
var async = require("async");
var format = require("util").format;
var assert = require("assert");

describe(__filename, function() {
    it("should sanitize params", function(done) {

        //https://preview.new-mvhenten.c9.io/mvhenten/demo-project/%2e%2e/foo.txt


        var cases = [{
            path: "%2e%2e/foo.txt",
            expect: "foo.txt"
        }, {
            path: "%2e%2e/%2e%2e/foo.txt",
            expect: "foo.txt"
        }, {
            path: "%2e%2e/%2e%2e/%2e%2e/foo.txt",
            expect: "foo.txt"
        }, {
            path: "foo/bar/%2e%2e/%2e%2e/xoo.txt",
            expect: "xoo.txt"
        }, {
            path: "../foo.txt",
            expect: "foo.txt"
        }, {
            path: "foo/../../foo.txt",
            expect: "foo.txt"
        }, {
            path: "%7E/foo/../../foo.txt",
            expect: "foo.txt"
        }, {
            path: "~/foo.txt",
            expect: "~/foo.txt"
        }, {
            path: "%7E/../foo.txt",
            expect: "foo.txt"
        }];


        async.each(cases, function(testCase, next) {
            var mockReq = {
                params: {
                    path: testCase.path
                }
            };

            sanitize(mockReq, null, function() {
                assert.equal(mockReq.params.path, testCase.expect, format("Expect %s to become %s", testCase.path, testCase.expect));
                next();
            });
        }, done);
    });
});
