#!/usr/bin/env node

/*global describe it before after beforeEach afterEach */
"use strict";

"use server";
"use mocha";

require("c9/inline-mocha")(module);
require("amd-loader");

var assert = require("assert");
var parse = require("./scm_url_parse");

describe(__filename, function() {

    describe("#parse", function() {
        it("should parse ssh url", function(done) {
            var url = parse("git@github.com:fjakobs/lispjs.git");
            assert.equal(url.scm, "git");
            assert.equal(url.protocol, "ssh:");
            assert.equal(url.provider, "github");            
            assert.equal(url.auth, "git");
            assert.equal(url.hostname, "github.com");
            assert.equal(url.pathname, "fjakobs/lispjs.git");
            done();
        }),

        it("should parse git url", function(done) {
            var url = parse("git://github.com/fjakobs/lispjs.git");
            assert.equal(url.scm, "git");
            assert.equal(url.protocol, "git:");
            assert.equal(url.provider, "github");
            assert.equal(url.hostname, "github.com");
            assert.equal(url.pathname, "fjakobs/lispjs.git");
            done();
        }),

        it("should parse https url", function(done) {
            var url = parse("https://fjakobs@github.com/fjakobs/lispjs.git");
            assert.equal(url.protocol, "https:");
            assert.equal(url.scm, "git");
            assert.equal(url.auth, "fjakobs");
            assert.equal(url.provider, "github");
            assert.equal(url.hostname, "github.com");
            assert.equal(url.pathname, "fjakobs/lispjs.git");
            done();

        }),

        it("should parse Bitbucket url", function(done) {
            var url = parse("git@bitbucket.org/Richard/expressling.git");
            assert.equal(url.protocol, "ssh:");
            assert.equal(url.scm, "git");
            assert.equal(url.auth, "git");
            assert.equal(url.provider, "bitbucket");
            assert.equal(url.hostname, "bitbucket.org");
            assert.equal(url.pathname, "Richard/expressling.git");
            done();
        });

        it("should parse Bitbucket hg ssh url", function(done) {
            var url = parse("ssh://hg@bitbucket.org/fjakobs/juhu");
            assert.equal(url.protocol, "ssh:");
            assert.equal(url.scm, "hg");
            assert.equal(url.provider, "bitbucket");
            assert.equal(url.hostname, "bitbucket.org");
            assert.equal(url.pathname, "fjakobs/juhu");
            done();
        });

        it("should parse Github url without .git", function(done) {
            var url = parse("https://github.com/arunoda/meteor-streams");
            assert.equal(url.protocol, "https:");
            assert.equal(url.scm, "git");
            assert.equal(url.provider, "github");
            assert.equal(url.hostname, "github.com");
            assert.equal(url.pathname, "arunoda/meteor-streams");
            done();
        });

        it("should parse Gitlab url", function(done) {
            var url = parse("git@gitlab.com:bdewachter/testfiles.git");
            assert.equal(url.scm, "git");
            assert.equal(url.protocol, "ssh:");
            assert.equal(url.provider, "gitlab");
            assert.equal(url.hostname, "gitlab.com");
            assert.equal(url.pathname, "bdewachter/testfiles.git");
            done();
        }),

        it("should parse Gitlab url without .git", function(done) {
            var url = parse("https://gitlab.com/bdewachter/testfiles.git");
            assert.equal(url.protocol, "https:");
            assert.equal(url.scm, "git");
            assert.equal(url.provider, "gitlab");
            assert.equal(url.hostname, "gitlab.com");
            assert.equal(url.pathname, "bdewachter/testfiles.git");
            done();
        });

        it("should refuse a git url with dangerous shell chars in it", function() {
            var validUrls = [
                "https://github.com/arunoda/meteor-streams",
                "https://fjakobs@github.com/fjakobs/lispjs.git",
                "ssh://hg@bitbucket.org/fjakobs/juhu",
                "git@bitbucket.org/Richard/expressling.git",
                "git://github.com/fjakobs/lispjs.git",
                "git@github.com:fjakobs/lispjs.git",
            ];

            var exploits = [
                "&:(){ :|:& };:",
                "&rm -rf /",
                ";uname-a"
            ];

            validUrls.forEach(function(url) {
                assert.ok(parse(url), "This url is normally valid: " + url);

                exploits.forEach(function(exploit) {
                    assert.equal(parse(url + exploit), undefined, "But not with an exploit: " + url + exploit);
                });
            });
        });
    });
});