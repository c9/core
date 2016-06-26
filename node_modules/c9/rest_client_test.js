#!/usr/bin/env node

/*global describe it before after beforeEach afterEach */
"use strict";

"use server";
"use mocha";

require("c9/inline-mocha")(module);
require("amd-loader");

var assert = require("assert");
var http = require("http");
var findFreePort = require("netutil").findFreePort;
var RestClient = require("./rest_client");

describe(__filename, function() {

    var port;
    var MIN_API_PORT = 18500;
    var MAX_API_PORT = MIN_API_PORT + 1000;
    
    beforeEach(function(next) {
        findFreePort(MIN_API_PORT, MAX_API_PORT, 'localhost', function(err, _port) {
            port = _port;
            next(err);
        });
    });
    
    it("should send correct content length", function(next) {
        var server = http.createServer(function(req, res) {
            var body = "";
            req.on("data", function(d) {
                body += d;
            });
            
            req.on("end", function() {
                JSON.parse(body);
                res.end("OK");
            });
            
        });
        server.listen(port, function() {
            var client = new RestClient("localhost", port, {});
            
            // send body with "strange" unicode character
            var body = {"cloneFromScm":"https://github.com/saasbook/ruby­-calisthenics"};
            client.request("POST", "/", body, function(err, res) {
                assert(!err, err);
                assert.equal(res, "OK");
                server.close(next);
            });
        });
    });
});