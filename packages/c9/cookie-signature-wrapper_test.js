"use strict";
"use server";

require("c9/inline-mocha")(module);

var assert = require("assert");
var wrapper = require("./cookie-signature-wrapper");
var cookieSignature = require("cookie-signature");

describe("c9/cookie-signature-wrapper", function() {
    it("should sign a hash", function() {
        var hash = Math.random().toString(16);
        var secret = Math.random().toString(16);
        assert.equal(wrapper.sign(hash, secret), cookieSignature.sign(hash, secret));
    });

    it("should sign a hash with the first secret from an array", function() {
        var secrets = ["swordfish", "baseball", "foobar"];
        var hash = Math.random().toString(16);

        assert.equal(wrapper.sign(hash, secrets), cookieSignature.sign(hash, secrets[1]));
        assert.ok(wrapper.sign(hash, secrets), cookieSignature.sign(hash, secrets[0]));
        
    });
    
    it("should unsign a hash signed with any of the known secrets", function() {
        var secrets = ["swordfish", "baseball", "foobar"];
        var hash = Math.random().toString(16);

        secrets.forEach(function(secret) {
            var signed = cookieSignature.sign(hash, secret);
            assert.equal(wrapper.unsign(signed, secrets), hash);
            assert.equal(wrapper.unsign(signed, secret), hash);
        });
    });
    
    
});
