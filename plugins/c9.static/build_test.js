#!/usr/bin/env node
/*global describe it before after beforeEach afterEach */
"use strict";

"use server";


require("c9/inline-mocha")(module);

var expect = require("chai").expect;
var assert = require("assert");
var sinon = require("sinon");

var buildPlugin = require("./build");

require("amd-loader");

var build, options, pathConfig;

describe("The Module", function(){
    this.timeout(60000);

    beforeEach(function(next) {

        options = {
            version: "testing",
            compress: false,
            baseUrl: "https://cdn.c9.io/static/abcd1234"
        };
        
        buildPlugin(options, {
            "Plugin": function() {
                this.freezePublicAPI = function(api) {
                    for (var key in api) this[key] = api[key];
                };
            }
        }, function(err, services) {
            if (err) return next(err);
            
            build = services["cdn.build"];
            
            build.getPathConfig("testing", function(err, _pathConfig) {
                if (err) return next(err);
                
                pathConfig = _pathConfig;
                next();
            });
        });
    });

    afterEach(function () {
    });
    
    it("should compile the default config", function(done) {
        build.buildConfig("default", pathConfig, function(err, result) {
            if (err) return done(err);
            
            var code = result.code;
            assert(code.indexOf("<a:style><![CDATA[]]></a:style>" >= 0), "should have at least one stripped style");
            assert(!code.match(/<a:style><!\[CDATA\[[^\]]/), "should only have stripped styles");
            
            done();
        });
    });
    
    it("test compile less", function(done) {
        build.buildSkin("ssh", "dark", pathConfig, function(err, result) {
            if (err) return done(err);
            
            var code = result.code;
            assert(code);
            done(err);
        });
        
    });
});