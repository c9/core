"use strict";
"use server";

require("c9/inline-mocha")(module);

var assert = require("assert");
var crypt = require("./crypt");

describe("c9/crypt", function() {
    it("encrpyt and decrypt should return input", function() {
        var sessionId = "vOcRVvhaBBauiYexVvWyJpPb.AqmabaXkhpmlR8AUkORJHu%2FB7WA57EsDqzled0VoKAg";
        var secret = "geheim";

        assert.equal(crypt.crypt(sessionId, secret), "C+kRJ4UWhmjgqo7DVv31cJLfZ9LIPLZB7OuMdN8i07ZdZHKlusCClMKaqBEwHDiKH3uFKf8IUZOxoVHU6+eNrkLArr32HrBDLr8qfnKfAgY");

        assert.equal(
            crypt.decrypt(crypt.crypt(sessionId, secret), secret),
            sessionId
        );
    });


    it("Should accept an array for decrypt", function() {
        var message = Math.random().toString(36);
        var secret = "swordfish";

        var crypted = crypt.crypt(message, secret);
        var plaintext = crypt.decrypt(crypted, [Math.random().toString(36), Math.random().toString(36), secret]);

        assert.equal(plaintext, message, "Got message back");
    });

    it("Should accept an array for crypt", function() {
        var message = Math.random().toString(36);
        var secret = ["letmein", "swordfish"];

        var crypted = crypt.crypt(message, secret);
        var plaintext = crypt.decrypt(crypted, secret);

        assert.equal(plaintext, message, "Got message back");
    });

    it("Should prefer the #1st secret", function() {
        var message = Math.random().toString(36);
        var secret = ["letmein", "swordfish", "princess"];

        var crypted = crypt.crypt(message, secret);

        assert.ok(!crypt.decrypt(crypted, secret[0]), "String was not encrypted with the #1st secret");
        assert.ok(!crypt.decrypt(crypted, secret[2]), "String was not encrypted with the #3rd secret");
        assert.equal(crypt.decrypt(crypted, secret[1]), message, "Got message back");
    });
});
