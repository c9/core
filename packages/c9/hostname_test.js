/*global describe it before after beforeEach afterEach define*/
"use strict";
"use server";
"use mocha";

require("c9/inline-mocha")(module);

var assert = require("assert-diff");
var hostname = require("./hostname");

describe(__filename, function() {
    
    function assertServerName(sn, type, provider, region, index, env) {
        assert.equal(sn.type, type);
        assert.equal(sn.provider, provider);
        assert.equal(sn.region, region);
        assert.equal(sn.index, index);
        assert.equal(sn.env, env);
    }
    
    it("parse hostname", function() {
        assertServerName(hostname.parse("fabian-gce-eu-04-dev"), "fabian", "gce", "eu", "04", "dev");
        assertServerName(hostname.parse("newclient-gce-eu-prod-d4fg"), "newclient", "gce", "eu", "d4fg", "prod");
        assertServerName(hostname.parse("ide-old-gce-usw-02-prod"), "ide-old", "gce", "usw", "02", "prod");
        assertServerName(hostname.parse("docker-premium-eu-115-prod"), "docker", "premium", "eu", "115", "prod");
        assertServerName(hostname.parse("docker-c9admin-usw-389-prod"), "docker", "c9admin", "usw", "389", "prod");
    });
});
