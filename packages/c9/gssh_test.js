#!/usr/bin/env node

/*global describe it before after beforeEach afterEach */
"use strict";
"use server";

require("c9/setup_paths.js");
require("c9/inline-mocha")(module);

var assert = require("assert");
var sinon = require("sinon");

var childProcess = require("child_process");
var gssh = require("./gssh").gssh;
var gscp = require("./gssh").gscp;

describe(__filename, function() {

    describe("gssh", function() {
        it("it executes scripts/gssh with expected arguments", function(done) {
            var options = {};
            
            sinon.stub(childProcess, "execFile", function(path, args, opts, done) {
                done();
            });

            gssh([], options, function(err, stdout, sderr) {
                assert.ok(!err, "no err");
                assert.ok(childProcess.execFile.calledOnce);
                assert.deepEqual(childProcess.execFile.args[0][1], ["-q", "--cache-only"]);
                childProcess.execFile.restore();
                done();
            });    
        });
        
        it("sets --no-cache if prepareCache is set", function(done) {
            var options = {
                prepareCache: true
            };
            
            sinon.stub(childProcess, "execFile", function(path, args, opts, done) {
                done();
            });

            gssh([], options, function(err, stdout, sderr) {
                assert.ok(!err, "no err");
                assert.ok(childProcess.execFile.calledOnce);
                assert.deepEqual(childProcess.execFile.args[0][1], ["-q", "--no-cache"]);
                childProcess.execFile.restore();
                done();
            });    
        });
        
        it("it waits for a timeout", function(done) {
            var options = {
                timeout: 20
            };
            
            sinon.stub(childProcess, "execFile", function(path, args, opts, done) {
                // we will never be done    
            });

            gssh([], options, function(err, stdout, sderr) {
                assert.ok(err, "We received an error");
                assert.equal(err.message, "Timeout during gssh for one or more servers");
                childProcess.execFile.restore();
                done();
            });    
        });
    });
    
    
    describe("gscp", function() {
        it("it executes scripts/gscp with expected arguments", function(done) {
            sinon.stub(childProcess, "execFile", function(path, args, opts, done) {
                done();
            });
            
            var args = ["source", "target"];

            gscp(args, {}, function(err, stdout, sderr) {
                assert.ok(!err, "no err");
                assert.ok(childProcess.execFile.calledOnce);
                assert.deepEqual(childProcess.execFile.args[0][1], args);
                childProcess.execFile.restore();
                done();
            });    
        });
        
        it("it executes scripts/gscp with optional options expected arguments", function(done) {
            sinon.stub(childProcess, "execFile", function(path, args, opts, done) {
                done();
            });
            
            var args = ["source", "target"];

            gscp(args, function(err, stdout, sderr) {
                assert.ok(!err, "no err");
                assert.ok(childProcess.execFile.calledOnce);
                assert.deepEqual(childProcess.execFile.args[0][1], args);
                childProcess.execFile.restore();
                done();
            });    
        });
        
        
        it("it waits for a timeout", function(done) {
            var options = {
                timeout: 20
            };
            
            sinon.stub(childProcess, "execFile", function(path, args, opts, done) {
                // we will never be done    
            });

            gscp([], options, function(err, stdout, sderr) {
                assert.ok(err, "We received an error");
                assert.equal(err.message, "Timeout during gscp for one or more servers");
                childProcess.execFile.restore();
                done();
            });    
        });
    });
    
});