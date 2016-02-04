#!/usr/bin/env node

/*global describe it before after beforeEach afterEach */
"use strict";
"use server";

require("c9/inline-mocha")(module, null, { globals: ["define"]});

var assert = require("assert-diff");
var vm = require("vm");
var generateSettings = require("./generate_settings");

describe(__filename, function() {

    it("should filter settings file", function(done) {
        generateSettings(__dirname + "/../../..", "docker", "deploy", function(err, settings) {
            assert(!err, err);
            
            settings = eval(settings)();
            
            assert(settings.docker);
            assert(settings["docker-daemon"]);
            assert(settings.aws);
            assert(settings.sapi);
            assert(settings.rabbitmq);
            
            assert(!settings.c9);
            assert(!settings.auth);
            assert(!settings.worker);
            assert(!settings.captcha);
            assert(!settings.sendgrid);
            assert(!settings.redis);
            assert(!settings["redis-slave"]);
            assert(!settings.sessionredis);
            assert(!settings["sessionredis-slave"]);
            assert(!settings.github);
            assert(!settings.bitbucket);
            assert(!settings.salesforce);
            assert(!settings.google);
            assert(!settings.c9_auth);
            assert(!settings.services);
            assert(!settings.mailer);
            assert(!settings.zuora);
            assert(!settings.pricing);
            assert(!settings.catalog);
            assert(!settings.minfraud);
            assert(!settings.support);

            done();
        });
    });
});