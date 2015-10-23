"use strict";
"use mocha";

require("c9/inline-mocha")(module);
var assert = require("assert");
var faker = require("faker");
var hasInternalDomain= require("c9/has-internal-domain");

describe("has-internal-domain", function() {

    it("returns false when undefined email", function() {
        var email;
        
        assert.equal(false, hasInternalDomain(email), "should return false when email undefined");
    });
    
    it("returns true when email has c9.io domain", function() {
        var email = "test@c9.io";
        
        assert.equal(true, hasInternalDomain(email), "should return true when email has c9.io domain");
    });
    
    it("returns true when has cloud9beta.com domain", function() {
        var email = "test@cloud9beta.com";
        
        assert.equal(true, hasInternalDomain(email), "should return true when email has cloud9beta.com domain");
    });
    
    it("returns false when not internal email", function() {
        var email = faker.internet.email();
        
        assert.equal(false, hasInternalDomain(email), "should return false when email is not internal");
    });
});