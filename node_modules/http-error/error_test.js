"use strict";

var HttpError = require("./error");
var assert = require("assert");


describe("HttpError", function() {
    it("Should return an error object", function() {
        var err = new HttpError.NotFound("Ding Boom Bats");

        assert.equal(err.code, 404);
        assert.equal(err.defaultMessage, "Not Found");
        assert.equal(err.message, "Ding Boom Bats");
    });

    it("Should blow up in your face when not called as constructor", function() {
        assert.throws(function() {
            HttpError.NotFound("foo");
        }, "Must be called as constructor", "You must call as a constructor");
    });
})