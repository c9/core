"use strict";
"use mocha";

require("c9/inline-mocha")(module);
var assert = require("assert");
var isZuoraId= require("c9/is-zuora-id");

describe("iz-zuora-id-test", function() {

    it("returns false when account id undefined", function() {
        assert.equal(false, isZuoraId(undefined), "should return false when account id undefined");
    });
    
    it("returns false when account id null", function() {
        assert.equal(false, isZuoraId(null), "should return false when account id null");
    });
    
    it("returns false when account id is an empty string", function() {
        assert.equal(false, isZuoraId(""), "should return false when account id is an empty string");
    });
    
    it("returns false when account id contains only digits", function() {
        var accountId = "12345700674455";
        assert.equal(false, isZuoraId(accountId), "should return false when account id contains only digits");
    });
    
    it("returns false when account id contains only digits and has the correct length", function() {
        var accountId = "123456789101112131415161718192021";
        assert.equal(false, isZuoraId(accountId), "should return false when account id contains only digits and has the correct length");
    });

    it("returns false when account id contains both digits and letters but does not have the correct length", function() {
        var accountId = "78654hjfgf764674h87634876g7h89h";
        assert.equal(false, isZuoraId(accountId), "should return false");
    });
    
    it("returns true when account id has both letters and digits and correct length", function() {
        var accountId = "2c92a0f850a7a1b50150c672fa3a6ddd";
        
        assert.equal(true, isZuoraId(accountId), "should return true when account id has both letters and digits and correct length");
    });
});