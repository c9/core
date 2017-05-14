/*global describe it before after beforeEach afterEach define*/
"use strict";
"use server";
"use mocha";

require("c9/inline-mocha")(module);

var assert = require("assert");
var passcrypt = require('./passcrypt');
var bcrypt = require('bcrypt');

describe("c9/passcrypt", function(){
    this.timeout(2000);
    
    describe("encrypt", function() {
        it("Should md5 then bcrypt a password, not just straight bcrypt", function(done) {
            var pass = "password";
            passcrypt.encrypt(pass, function (err, encrypted) {
                if (err) return done(err);
                assert.equal(encrypted.length, 60);
                bcrypt.compare(pass, encrypted, function (err, result) {
                    if (err) return done(err);
                    assert.equal(result, false); // We want to ensure normal bcrypt compare doesn't work as it's md5'd then encrypted
                    done();
                });
            });
        });
        
        it("Should work with compare", function (done) {
            var pass = "password";
            passcrypt.encrypt(pass, function (err, encrypted) {
                if (err) return done(err);
                passcrypt.compare(pass, encrypted, function(err, result) {
                    if (err) return done(err);
                    assert.equal(result, true);
                    done();
                });
            });
        });
    });
    
    describe("compare", function() {
        it("Should work when the encrypted password is still only a md5 hash", function (done) {
            var pass = "password";
            var encrypted = "5f4dcc3b5aa765d61d8327deb882cf99";
            passcrypt.compare(pass, encrypted, function (err, result) {
                if (err) return done(err);
                assert.equal(result, true);
                done();
            });
        });
        
        it("Should work when the encrypted password is bcrypt encrypted", function (done) {
            var pass = "password";
            var encrypted = "$2a$08$RYLeOqfDc3KSkdUpvQhpTe8HdlbcQmzTx8E61cXQTXgtGsrB9A1tS";
            passcrypt.compare(pass, encrypted, function (err, result) {
                if (err) return done(err);
                assert.equal(result, true);
                done();
            });
        });
    });
});

if (typeof onload !== "undefined") onload();
