"use strict";

"use server";

require("amd-loader");

var assert = require("assert");
var sinon = require("sinon");

var Route = require("./route");

module.exports = {
    "test router: simple route with argument": function() {
        var route = new Route("/user/:name", sinon.stub());
        
        var req = {};
        assert.equal(route.match(req, "/juhu"), false);
        assert.equal(route.match(req, "/juhu/12"), false);
        
        assert.equal(route.match(req, "/user/fabian"), true);
        assert.equal(req.match.name, "fabian");
    },
    
    "test router: simple route with number argument": function() {
        var route = new Route("/user/:id", {
            params: {
                id: {
                    type: "int"
                }
            }
        }, sinon.stub());
        
        var req = {};
        assert.equal(route.match(req, "/user/fabian"), false);
        assert.equal(route.match(req, "/user/123"), true);
        assert.equal(req.match.id, 123);
    },
    
    "test router: for params if the value is a string it is treated as the type": function() {
        var route = new Route("/user/:id", {
            params: {
                id: "int"
            }
        }, sinon.stub());
        
        var req = {};
        assert.equal(route.match(req, "/user/123"), true);
        assert.equal(req.match.id, 123);
    },
    
    "test router: complex route with wildcard arguments": function() {
        var route = new Route("/user/:name/:rest*", {
            params: {
                id: {
                    type: "int"
                }, 
                rest: {
                    type: "string"
                }
            }
        }, sinon.stub());
        
        var req = {};
        
        assert.equal(route.match(req, "/user/fabian"), false);
        assert.equal(route.match(req, "/user/fabian/"), true);
        assert.equal(req.match.name, "fabian");
        assert.equal(req.match.rest, "/");
        assert.equal(route.match(req, "/user/fabian/abc"), true);
        assert.equal(req.match.name, "fabian");
        assert.equal(req.match.rest, "/abc");
        assert.equal(route.match(req, "/user/fabian/abc/123"), true);
        assert.equal(req.match.name, "fabian");
        assert.equal(req.match.rest, "/abc/123");
    },
    
    "test router: complex route with multiple arguments": function() {
        var route = new Route("/user/:name/:id", {
            params: {
                id: {
                    type: "int"
                }
            }
        }, sinon.stub());
        
        var req = {};
        
        assert.equal(route.match(req, "/user/fabian"), false);
        assert.equal(route.match(req, "/user/123"), false);
        assert.equal(route.match(req, "/user/fabian/123"), true);
        assert.equal(req.match.id, 123);
        assert.equal(req.match.name, "fabian");
    },
    
    "test regexp types": function() {
        var route = new Route("/users/:uid", {
            params: {
                uid: /u\d+/
            }
        }, sinon.stub());
        
        var req = {};
        
        assert.ok(route.match(req, "/users/u123"));
        assert.ok(!route.match(req, "/users/_u123"));
    },
    
    "test custom type without register": function() {
        var DateType = {
            parse: function(string) {
                if (!/\d{13}/.test(string))
                    throw new Error("not a timestamp");
                    
                return new Date(parseInt(string, 10));
            },
            check: function(value) {
                return value instanceof Date;
            }
        };
        
        var route = new Route("/ts/:ts", {
            params: {
                ts: {
                    type: DateType
                }
            }
        }, sinon.stub());
        
        var req = {};
        
        assert.ok(route.match(req, "/ts/1353676299181"));
        assert.ok(req.match.ts instanceof Date);
        
        assert.ok(!route.match(req, "/ts/353676299181"));
        assert.ok(!route.match(req, "/ts/abc"));
    },
    
    "test router: decode parameter in body": function(next) {
        var route = new Route("/user", {
            params: {
                id: {
                    type: "int",
                    optional: true,
                    source: "body"
                }
            }
        }, sinon.stub());
        
        var req = {
            match: "match",
            parsedUrl: {
                query: ""
            },
            body: { id: 15 }
        };
        var res = {};
        
        // Note: usually optionals would say 'source: "body",'
        // but this should work
        route.decodeParams(req, res, function(err, result) {
            assert.equal(err, null);
            assert.equal(req.params.id, 15);
            next();
        });
    },
    
    "test router: decode parameter in body with defaults": function(next) {
        var route = new Route("/user", {
            params: {
                scm: {
                    type: /^(git|hg)?$/,
                    optional: true,
                    default: "git",
                    source: "body"
                }
            }
        }, sinon.stub());
        
        var req = {
            match: "match",
            parsedUrl: { query: "" },
            body: { }
        };
        var res = {};
        
        route.decodeParams(req, res, function(err, result) {
            assert.equal(err, null);
            assert.equal(req.params.scm, "git");
            
            req.body.scm = null; // should be treated the same as undefined
            route.decodeParams(req, res, function(err, result) {
                assert.equal(err, null);
                assert.equal(req.params.scm, "git");
                next();
            });
        });
    },
    
    "test router: optional number argument can be falsy": function(next) {
        var route = new Route("/user", {
            params: {
                id: {
                    type: "int",
                    optional: true,
                    source: "body"
                }
            }
        }, sinon.stub());
        
        var req = {
            match: "match",
            parsedUrl: {
                query: ""
            },
            body: { id: null }
        };
        var res = {};
        
        // Note: usually optionals would say 'source: "body",'
        // but this should work
        route.decodeParams(req, res, function(err, result) {
            assert.equal(err, null);
            assert.equal(req.params.id, null);
            next();
        });
    },
};

!module.parent && require("asyncjs").test.testcase(module.exports).exec();
