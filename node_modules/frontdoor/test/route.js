"use strict";

var sinon = require("sinon");
var frontdoor = require('../frontdoor');
var Route = frontdoor.Route;
var test = require('tape');

test("test router: simple route with argument", function(assert) {
    var route = new Route("/user/:name", sinon.stub());

    var req = {};
    assert.equal(route.match(req, "/juhu"), false);
    assert.equal(route.match(req, "/juhu/12"), false);

    assert.equal(route.match(req, "/user/fabian"), true);
    assert.equal(req.match.name, "fabian");

    assert.end();
});

test("test router: simple route with number argument", function(assert) {
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

    assert.end();
});

test("test router: for params if the value is a string it is treated as the type", function(assert) {
    var route = new Route("/user/:id", {
        params: {
            id: "int"
        }
    }, sinon.stub());

    var req = {};
    assert.equal(route.match(req, "/user/123"), true);
    assert.equal(req.match.id, 123);

    assert.end();
});

test("test router: complex route with wildcard arguments", function(assert) {
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

    assert.end();

});

test("test router: complex route with multiple arguments", function(assert) {
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

    assert.end();

});

test("test regexp types", function(assert) {
    var route = new Route("/users/:uid", {
        params: {
            uid: /u\d+/
        }
    }, sinon.stub());

    var req = {};

    assert.ok(route.match(req, "/users/u123"));
    assert.ok(!route.match(req, "/users/_u123"));

    assert.end();

});

test("test custom type without register", function(assert) {
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


    assert.end();
});