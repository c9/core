"use strict";
"use mocha";

require("c9/inline-mocha")(module);
var assert = require("assert");
var faker = require("faker");
var hasInternalTestName= require("c9/has-internal-test-name");

describe("has-internal-test-name", function() {

    it("returns false when undefined name", function() {
        var name;
        
        assert.equal(false, hasInternalTestName(name), "should return false when name undefined");
    });
    
    it("returns true when name contains c9test", function() {
        var name = "c9testregnjkdfkfd";
        assert.equal(true, hasInternalTestName(name), "should return true when name contains c9test");
        
        name = "c9test01";
        assert.equal(true, hasInternalTestName(name), "should return true when name contains c9test");
        
        name = "c9testjhrrj ffjh";
        assert.equal(true, hasInternalTestName(name), "should return true when name contains c9test");
    });

    it("returns true when name contains c9 test", function() {
        var name = "c9 test dkjfdgjhfgdfk";
        assert.equal(true, hasInternalTestName(name), "should return true when name contains c9 test");
        
        name = "c9 test07";
        assert.equal(true, hasInternalTestName(name), "should return true when name contains c9 test");
        
        name = "c9 testdkjfdgjhfgdfk";
        assert.equal(true, hasInternalTestName(name), "should return true when name contains c9 test");
    });
    
    it("returns false when not internal user test name", function() {
        var name = faker.name.firstName();
        
        assert.equal(false, hasInternalTestName(name), "should return false when name is not for internal testing");
    });
});