"use server";

require("c9/inline-mocha")(module);

var ratelimit = require("./ratelimit");
var assert = require("assert");
var async = require("async");
var sinon = require("sinon");

describe("ratelimit", function() {
    
    it("Should limit based on key", function (done) {
        var limiter = ratelimit("username", 10, 1);
        limiter({params: {username: "super"}}, null, function (err) {
            assert(!err, err);
            limiter({params: {username: "super"}}, null, function (err) {
                assert(err);
                assert.equal(err.code, 429);
                done();
            });
        });
    });
    
    it("Should work with different keys", function (done) {
        var limiter = ratelimit("username", 10, 1);
        limiter({params: {username: "super"}}, null, function (err) {
            assert(!err, err);
            limiter({params: {username: "aloha"}}, null, function (err) {
                assert(!err, err);
                done();
            });
        });
    });
    
    it("Should work with deep keys", function (done) {
        var limiter = ratelimit("user.id", 100, 1);
        limiter({params: {user: {id: "hey"}}}, null, function (err) {
            assert(!err, err);
            limiter({params: {user: {id: "yay"}}}, null, function (err) {
                assert(!err, err);
                limiter({params: {user: {id: "hey"}}}, null, function (err) {
                    assert(err);
                    assert.equal(err.code, 429);
                    done();
                });
            });
        });
    });
    
    it("Should work with wildcard", function (done) {
        var limiter = ratelimit("*", 100, 1);
        limiter({params: {user: {id: "hey"}}}, null, function (err) {
            assert(!err, err);
            limiter({}, null, function (err) {
                assert(err);
                assert.equal(err.code, 429);
                done();
            });
        });
    });
    
    it("Should work with parameters directly on req, if req is specified as the first part of the deep key", function (done) {
        var limiter = ratelimit("req.user.id", 100, 1);
        limiter({user: {id: "hey"}}, null, function (err) {
            assert(!err, err);
            limiter({user: {id: "yay"}}, null, function (err) {
                assert(!err, err);
                limiter({user: {id: "hey"}}, null, function (err) {
                    assert(err);
                    assert.equal(err.code, 429);
                    done();
                });
            });
        });
    })
    
    it("Should work again after a delay", function (done) {
        var limiter = ratelimit("username", 10, 1);
        limiter({params: {username: "super"}}, null, function (err) {
            assert(!err, err);
            setTimeout(function() {
                limiter({params: {username: "super"}}, null, function (err) {
                    assert(!err, err);
                    done();
                });
            }, 25);
        });
    });
    
    it("Should work with many requests", function (done) {
        var MAX_REQUESTS = 5;
        var limiter = ratelimit("username", 10, MAX_REQUESTS);
        var successfulRequests = 0;
        async.times(10, function(n, next) {
            limiter({params: {username: "super"}}, null, function (err) {
                if (err) return next(err);
                successfulRequests++;
                next();
            });
        }, function (err) {
            assert.equal(successfulRequests, MAX_REQUESTS);
            setTimeout(function() {
                limiter({params: {username: "super"}}, null, function (err) {
                    assert(!err, err);
                    done();
                });
            }, 25);
        });
    });
    
    it("Should expire keys at the correct times", function (done) {
        var clock = sinon.useFakeTimers();
        var limiter = ratelimit("username", 50, 2);
        limiter({params: {username: "mario"}}, null, function(err) {
            assert(!err, err);
        });
        clock.tick(40);
        limiter({params: {username: "mario"}}, null, function(err) {
            assert(!err, err);
        });
        clock.tick(45);
        limiter({params: {username: "mario"}}, null, function(err) {
            assert(!err, err);
        });
        limiter({params: {username: "mario"}}, null, function(err) {
            assert(!err, err);
        });
        limiter({params: {username: "mario"}}, null, function(err) {
            assert(err);
            assert.equal(err.code, 429);
        });
        done();
    });
});