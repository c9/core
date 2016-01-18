#!/usr/bin/env node
/*global describe it before after beforeEach afterEach */
"use strict";
"use server";

require("c9/inline-mocha")(module);

var assert = require("assert-diff");
var path = require("path");
var vfs = require("vfs-local");
var vfsWrapper = require("./vfs_wrapper");

describe(__filename, function(){

    describe("#extend", function() {
        
        var wrapper;
        
        beforeEach(function() {
            var home = vfs({
                root: path.normalize(__dirname + "/.."),
                testing: true,
            });

            wrapper = vfsWrapper(home, {
                root: __dirname
            });
        });
        
        it("should return an error if file is not passed", function(done) {
            wrapper.extend('foo', { file: {} ,encoding: "utf8"}, function(err, data) {
                assert(err);
                assert.equal(err.message, "Invalid option 'file'");
                done();
            });
        });
    });
}); 
