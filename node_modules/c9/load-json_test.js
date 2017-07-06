"use strict";
"use server";

require("c9/inline-mocha")(module);

var assert = require("assert");
var json = require("./load-json");
var fs = require("fs");

describe("parse", function() {
    it("parses valid json", function(done) {
        var input = {
            hello: ["world"]
        };

        json.parse(JSON.stringify(input), function(err, parsed) {
            assert.ok(!err, "No error: " + err);
            assert.deepEqual(parsed, input);
            done();
        });
    });

    it("gives an error when input is not valid json", function(done) {
        json.parse("!@$%", function(err) {
            assert.ok(err, "Returned an error");
            assert.ok(err.toString(), "SyntaxError: Unexpected token !");
            done();
        });
    });
});

describe("load", function() {
    function writetmp(data) {
        var path = ["/tmp/tmpfile", Date.now().toString(36), (Math.random() * 10e16).toString(36)].join("-");
        fs.writeFileSync(path, data);
        return path;
    }


    it("returns an error if does not exist", function(done) {
        json.load("doesnotexsit", function(err) {
            assert.ok(err, "Returned an error");
            assert.equal(err.toString(), "Error: ENOENT: no such file or directory, open 'doesnotexsit'");
            done();
        });
    });

    it("loads and parses a given file", function(done) {
        var input = {
            hello: ["world"]
        };

        var tmpfile = writetmp(JSON.stringify(input));

        json.load(tmpfile, function(err, result) {
            assert.ok(!err, "no err: " + err);
            assert.deepEqual(result, input);
            fs.unlinkSync(tmpfile);
            done();
        });

    });

    it("returns error if the file contains bad json", function(done) {
        var tmpfile = writetmp("!@#$");

        json.load(tmpfile, function(err, result) {
            assert.ok(err, "Returned an error");
            assert.ok(err.toString(), "SyntaxError: Unexpected token !");
            fs.unlinkSync(tmpfile);
            done();
        });
    });
});
