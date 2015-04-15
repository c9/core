"use strict";
"use server";

require("amd-loader");

var assert = require("assert");
var sinon = require("sinon");
var http = require("http");

var frontdoor = require("../frontdoor");
var createClient = require("./api-client");

require("c9/inline-mocha")(module);
require("amd-loader");

it("test client/server integration", function(next){
    this.getUsers = function(params, callback) {
        callback(null, [{
            id: 1,
            name: "fjakobs",
            first: params.first
        }]);
    };

    this.addUser = sinon.stub();

    this.getUser = function(params, callback) {
        callback(null, {
            id: params.uid,
            name: "fjakobs"
        });
    };

    var api = frontdoor();
    api.section("users")
        .get("/", {
            name: "getAll",
            params: {
                first: {
                    type: "int",
                    source: "query",
                    optional: true
                }
            }
        }, this.getUsers)
        .get("/:uid", this.getUser)
        .post("/:uid", {
            params: {
                name: {
                    source: "body"
                }
            }
        }, this.addUser);
        
    api.get("/describe.json", {
        name: "describe"
    }, frontdoor.middleware.describeApi(api));

    var port = process.env.PORT || 8383;
    this.server = http.createServer(api.handle).listen(port, function() {
        createClient("http://localhost:" + port + "/describe.json", function(err, client) {
            assert.equal(err, null);
            
            client.users.get({ uid: 123}, function(err, user) {
                assert.equal(user.id, 123);
                assert.equal(err, null);
                
                client.users.getAll({ first: 100}, function(err, users) {
                    assert.equal(err, null);
                    assert.equal(users[0].first, 100);
                    
                    next();
                });
            });
        });
    });
});

