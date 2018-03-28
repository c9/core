"use strict";
"use mocha";

require("c9/inline-mocha")(module);
var assert = require("assert");
var faker = require("faker");
var skipAnalytics = require("c9/skip-analytics");

describe("skip-analytics", function() {

    it("returns true when user or user id undefined", function() {
        var user;

        assert.equal(true, skipAnalytics(null, user), "skipAnalytics should return true when user undefined");
    });

    it("returns true when user id is -1", function() {
        var user = {
            id: -1
        };

        assert.equal(true, skipAnalytics(user), "skipAnalytics should return true when user id is -1");
    });

    it("returns true when user uid is -1", function() {
        var user = {
            uid: -1
        };

        assert.equal(true, skipAnalytics(user), "skipAnalytics should return true when user uid is -1");
    });


    it("returns false when user does not have an internal test name and no email", function() {
        var user = {
            id: faker.random.uuid(),
            name: faker.name.firstName()
        };

        assert.equal(false, skipAnalytics(user), "skipAnalytics should return false when user does not have an internal test name and no email");
    });

    it("returns true when user has an internal test name and no email", function() {
        var user = {
            id: faker.random.uuid(),
            name: "c9test07"
        };

        assert.equal(true, skipAnalytics(user), "skipAnalytics should return true when user has an internal test name and no email");
    });

    it("returns false when user has no email", function() {
        var user = {
            id: faker.random.uuid()
        };

        assert.equal(false, skipAnalytics(user), "skipAnalytics should return false when user has no email");
    });

    it("returns true when user has internal email", function() {
        var user = {
            id: faker.random.uuid(),
            email: "test@c9.io"
        };

        assert.equal(true, skipAnalytics(user), "skipAnalytics should return true when user has internal email");

        user.email = "test@cloud9beta.com";
        assert.equal(true, skipAnalytics(user), "skipAnalytics should return true when user has internal beta email");
    });
    
    it("returns true when user is marked as blocked", function() {
        var user = {
            id: faker.random.uuid(),
            email: faker.internet.email(),
            blocked: "soft ban foo"
        };

        assert.equal(true, skipAnalytics(user), "skipAnalytics should return true when user is marked as blocked");
    });

    it("returns false when user is authorized and does not have intermal email", function() {
        var user = {
            id: faker.random.uuid(),
            email: faker.internet.email()
        };

        assert.equal(false, skipAnalytics(user), "skipAnalytics should return false when user is authorized and does not have internal email");
    });
});