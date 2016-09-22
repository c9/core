#!/usr/bin/env node

/*global describe it before after beforeEach afterEach */
"use strict";

"use server";

require("c9/inline-mocha")(module);
require("c9/setup_paths");

var Cookie = require("cookie");
var assert = require("assert");
var ConnectCookie = require("./session/cookie");

var encrypt = require("./encrypt");
var decrypt = require("./decrypt");

describe("decrypt", function() {
    
    it("Should decrypt when secret is a string", function(){
        var sessionID = Math.random().toString(36);
        var secret = Math.random().toString(36);
        var cookieVal = encrypt(sessionID, "connect.sid", new ConnectCookie({}), secret);
        var cookie = Cookie.parse(cookieVal);
        var val = decrypt.decrypt(secret, cookie["connect.sid"]);
        
        assert.deepEqual(val, { unsignedCookie: sessionID, usedSecret: secret });
    });

    it("Should decrypt when secret is an array", function(){
        var sessionID = Math.random().toString(36);
        var secret = [Math.random().toString(36), Math.random().toString(36), Math.random().toString(36)];
        var cookieVal = encrypt(sessionID, "connect.sid", new ConnectCookie({}), secret[1]);
        var cookie = Cookie.parse(cookieVal);
        var val = decrypt.decrypt(secret, cookie["connect.sid"]);
        
        assert.deepEqual(val, { unsignedCookie: sessionID, usedSecret: secret[1] });
    });
});