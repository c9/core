#!/usr/bin/env node
/*global describe it before after beforeEach afterEach */
"use strict";
"use server";

require("c9/inline-mocha")(module);

var assert = require("assert-diff");
var async = require("async");
var sinon = require("sinon");
var vfs = require("vfs-local");
var vfsProxy = require("./vfs_proxy");

describe(__filename, function(){

    var proxy, home, workspace;
    
    before(function() {
        home = vfs({
            root: __dirname,
            testing: true,
            checkSymlinks: true
        });
        home.root = __dirname;
        
        workspace = vfs({
            root: __dirname + "/views",
            testing: true,
            checkSymlinks: true
        });
    });
    
    beforeEach(function() {
        proxy = vfsProxy(Object.keys(home), home, workspace);
    });

    it("should use home for files starting with ~ ", function(done) {
        home.readfile = sinon.stub().callsArgWith(2, null, "home");
        workspace.readfile = sinon.stub().callsArgWith(2, null, "workspace");
        
        proxy.readfile("~/foo.txt", {}, function(err, data) {
            assert(!err, err);
            assert.equal(data, "home");
            done();
        });
    });
    
    it("should use workspace for files not starting with ~ ", function(done) {
        home.readfile = sinon.stub().callsArgWith(2, null, "home");
        workspace.readfile = sinon.stub().callsArgWith(2, null, "workspace");
        
        proxy.readfile("foo.txt", {}, function(err, data) {
            assert(!err, err);
            assert.equal(data, "workspace");
            done();
        });
    });
    
    it("should expand ~ to paths relative to 'home'", function(done) {
        home.readfile = function(path, options, callback) {
            assert.equal(path, "/foo.txt");
            callback(null, "home");
        };
        
        proxy.readfile("~/foo.txt", {}, function(err, data) {
            assert(!err, err);
            assert.equal(data, "home");
            done();
        });
    });
    
    it("should expand ~ in options", function(done) {
        home.readfile = function(path, options, callback) {
            assert.equal(path, "/foo.txt");
            assert.equal(options.target, "/bar");
            assert.equal(options.to, "/juhu");
            assert.equal(options.from, "/kinners");
            
            assert.equal(options.stuff, "~/stuff");
            
            callback(null, "home");
        };
        
        proxy.readfile("~/foo.txt", {
            target: "~/bar",
            to: "~/juhu",
            from: "~/kinners",
            stuff: "~/stuff"
        }, function(err, data) {
            assert(!err, err);
            assert.equal(data, "home");
            done();
        });
    });
    
    it("should expand some commands to absolute paths", function(done) {
        home.execFile = function(path, options, callback) {
            assert.equal(path, __dirname + "/foo.txt");
            callback(null, "home");
        };
        
        proxy.execFile("~/foo.txt", {}, function(err, data) {
            assert(!err, err);
            assert.equal(data, "home");
            done();
        });
    });

    it("should not wrap some commands", function(done) {
        async.eachSeries([
            "connect",
            "on",
            "off",
            "emit",
            "extend",
            "unextend",
            "use",
            "killtree"
        ], function(cmd, next) {
            workspace[cmd] = function(path, options, callback) {
                assert.equal(path, "~/foo.txt");
                callback(null, "workspace");
            };
            
            proxy[cmd]("~/foo.txt", {}, function(err, data) {
                assert(!err, err);
                assert.equal(data, "workspace");
                next();
            });
            
        }, done);
    });

    it("bad execFile arguments should not break the server", function(done) {
        workspace.execFile = sinon.stub().callsArgWith(2, null, "done");
        proxy.execFile(['ls', '-a'], {encoding: "utf8"}, function(err, data) {
            assert(!err, err);
            assert.equal(data, "done");
            done();
        });
    });
}); 
