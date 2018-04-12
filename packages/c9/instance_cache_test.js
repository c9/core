"use strict";

"use server";

var assert = require("assert");

var InstanceCache = require("./instance_cache");


module.exports = {
    //"test lazy create "

    "test lazy create should not call factory if object is in cache": function(next) {
        InstanceCache.lazyCreate("foo", {foo: "bar"}, {}, null, function(err, item) {
            assert.equal(err, null);
            assert.equal(item, "bar");
            next();
        });
    },

    "test lazy create should call factory if object is not in the cache": function(next) {
        InstanceCache.lazyCreate("foo", {}, {}, function(callback) {
            callback(null, "bar");
        }, function(err, item) {
            assert.equal(err, null);
            assert.equal(item, "bar");
            next();
        });
    },

    "test lazy create should call factory only once": function(next) {
        var called = false;
        var factory = function(callback) {
            assert.equal(called, false);
            called = true;
            setTimeout(function() {
                callback(null, "bar");
            }, 10);
        };
        var cache = {};
        var callbackStore = {};

        InstanceCache.lazyCreate("foo", cache, callbackStore, factory, function(err, item) {
            assert.equal(err, null);
            assert.equal(item, "bar");

            InstanceCache.lazyCreate("foo", cache, callbackStore, factory, function(err, item) {
                assert.equal(err, null);
                assert.equal(item, "bar");
                next();
            });
        });
    },

    "test failed create should not be stored in the cache": function(next) {
        var cache = new InstanceCache(0, function(callback) {
            return callback("error");
        });

        cache.get("id1", [], function(err) {
            assert.equal(err, "error");
            assert.equal(arguments.length, 1);

            assert.ok(!cache.has("id1"));

            next();
        });
    }
};

!module.parent && require("asyncjs").test.testcase(module.exports).exec();