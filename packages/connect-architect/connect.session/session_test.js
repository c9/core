#!/usr/bin/env node

/*global describe it before after beforeEach afterEach */
"use strict";
"use server";

require("c9/inline-mocha")(module);
require("c9/setup_paths");

var assert = require("assert");
var ConnectCookie = require("./session/cookie");
var Cookie = require("cookie");
var session = require("./session");
var EventEmitter = require("events").EventEmitter;
var sinon = require("sinon");

var Store = require("connect").session.MemoryStore;

var encrypt = require("./encrypt");
var decrypt = require("./decrypt");
var hash = require("./session/hash");

describe("lib/session", function() {

    function mockReq() {
        var req = new EventEmitter();
        req.originalUrl = "/";
        req.cookies = {};
        req.signedCookies = {};
        req.headers = {};
        req.connection = {};

        return req;
    }

    function mockRes() {
        var res = new EventEmitter();
        res.setHeader = function(key, value) {};
        sinon.spy(res, "setHeader");
        return res;
    }

    it("Returns a middleware", function() {
        var middleware = session({
            store: new Store()
        });

        assert.equal(middleware.length, 3, "Has an arity of 3");
    });

    it("Encrypts a cookie", function(done) {
        var middleware = session({
            store: new Store(),
            secret: "limecat"
        });

        var res = mockRes();

        middleware(mockReq(), res, function() {
            res.emit("header");

            assert.ok(res.setHeader.calledOnce);
            var args = res.setHeader.args[0];

            assert.equal(args[0], "Set-Cookie");
            assert.ok(/connect.sid=.+?; Path=\/; HttpOnly/.test(args[1]));
            done();
        });
    });

    it("Does not create a new cookie if the secret remains the same", function(done) {
        var sessionID = "123";
        var secret = "limecat";

        var cookieVal = encrypt(sessionID, "connect.sid", new ConnectCookie({}), secret);

        var req = mockReq();
        var res = mockRes();
        var store = new Store();

        var mw = session({
            secret: ["newsecret", secret],
            store: store
        });

        sinon.stub(hash, "hash", function() {
            return;
        });

        req.cookies = Cookie.parse(cookieVal);

        mw(req, res, function() {
            var sessionCalled = 0;
            var sessionCookie = new ConnectCookie({});

            // force the code down a certain path
            sessionCookie.expires = new Date(Date.now() + 1000);

            Object.defineProperty(req, "session", {
                get: function() {
                    sessionCalled++;
                    return {
                        cookie: sessionCookie
                    };
                }
            });

            res.emit("header");

            assert.ok(hash.hash.calledOnce, "we know the hash got called (asserts the code path)");
            assert.equal(sessionCalled, 4, "session was accessed, this asserts the code-path");
            hash.hash.restore();
            assert.ok(res.setHeader.notCalled);
            done();
        });
    });

    it("Rotates the secret: it encrypts using the new secret", function(done) {
        var sessionID = Math.random().toString(36);
        var secret = [Math.random().toString(36), Math.random().toString(36), Math.random().toString(36)];

        // use the encryption funciton used in session to create a fake cookie
        var cookie = encrypt(sessionID, "connect.sid", new ConnectCookie({}), secret[2]);
        var req = mockReq();
        var res = mockRes();

        var mw = session({
            secret: secret,
            store: new Store()
        });

        req.sessionID = sessionID;
        req.cookies = Cookie.parse(cookie);
        
        var decryptSpy = sinon.spy(decrypt, "decrypt");

        // forces code down the path in L262
        sinon.stub(hash, "hash", function() {
            return;
        });

        mw(req, res, function() {
            // The cookie must have been decrypted by know, using one of the
            // available secrets.
            assert.deepEqual(decryptSpy.returnValues[0], {
                unsignedCookie: sessionID,
                usedSecret: secret[2]
            }, "our cookie was decrypted");
            
            // in the "header" listener we check for the cookie.
            var sessionCookie = new ConnectCookie({});
            
            // forces the if on L259
            sessionCookie.expires = new Date(Date.now() + 1000);

            // we need to mock req.session. The listener assumes this to be
            // set in a later code path.
            req.session = {
                cookie: sessionCookie
            };
            
            // kick of the listener
            res.emit("header");

            // check that L262 was NOT executed
            assert.ok(hash.hash.notCalled, "hash should be called on L262");

            // we expect we got a fresh cookie
            assert.ok(res.setHeader.calledOnce, "we expect a new cookie");

            var cookie = res.setHeader.args[0][1];
            var parsed = Cookie.parse(cookie);

            var val = decrypt.decrypt(secret[1], parsed["connect.sid"]);

            assert.deepEqual(val, {
                unsignedCookie: req.sessionID,
                usedSecret: secret[1]
            });
            
            hash.hash.restore();
            done();
        });
    });

});