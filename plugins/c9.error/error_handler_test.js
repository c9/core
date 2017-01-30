#!/usr/bin/env node
/*global describe it before after beforeEach afterEach */
"use strict";
"use server";

require("c9/inline-mocha")(module);
require("amd-loader");

var assert = require("assert-diff");
var sinon = require("sinon");
var error = require("http-error");

var errorHandlerPlugin = require("./error_handler");

describe(__filename, function() {
    this.timeout(2000);

    var errorHandler;
    var imports;
    var options = {
        scope: "ide",
        hostname: "fabian-dev"
    };

    beforeEach(function(done) {
        imports = {
            connect: {
                useError: sinon.stub(),
                useStart: sinon.stub()
            },
            "connect.static": {
                addStatics: sinon.stub()
            }
        };
        errorHandlerPlugin(options, imports, function(err, services) {
            errorHandler = imports.connect.useError.lastCall.args[0];
            done(err);
        });
    });

    afterEach(function () {
    });
    
    it("should only pass white listed keys", function(done) {
        var err = new error.PreconditionRequired("Resizing workspace; please retry later");
        err.projectState = 1;
        err.premium = true;
        err.retryIn = 2000;
        err.progress = {
            progress: 0,
            nextProgress: 0
        };
        err.FOO = "not me";

        var req = {
            headers: {
                accept: "application/json"
            }
        };
        
        var res = {
            json: function(err, body, code) {
                assert(!body);
                assert.equal(code, 428);
                assert.deepEqual(err, {
                    error: {
                        code: 428,
                        hostname: "fabian-dev",
                        scope: "ide",
                        stack: undefined,
                        message: "Resizing workspace; please retry later",
                        projectState: 1,
                        premium: true,
                        retryIn: 2000,
                        progress: {
                          progress: 0,
                          nextProgress: 0
                        }
                    }
                });
                done();
            }
        };
        
        errorHandler(err, req, res, function() {
            assert.fail();
            done();
        });
    });
    
});