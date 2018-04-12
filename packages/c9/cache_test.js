"use strict";
"use server";


var assert = require("assert");
var Cache = require("./cache");

require("c9/inline-mocha")(module);

describe("Cache", function() {
    var cache;
    var maxSize = 5;
    var age = 10;

    beforeEach(function() {
        cache = new Cache(maxSize, age) ;
    });
    
    describe("set", function() {
        it("should add the item to the cache", function(){
            var item = { a: 1 };
            var key = "foo/bar";

            cache.set(key, item);
            var cachedItem = cache.get(key);
            assert.equal(cachedItem, item);
        });   
        it("should increment size", function() {
            var item = { a: 1 };

            cache.set("foo/bar", item);
            cache.set("foo/baz", item);
            cache.set("foo/bir", item);
            cache.set("foo/biz", item);
            cache.set("foo/bur", item);

            assert(cache.size(), 5);
        });
    }); 
    
    describe("get", function() {
        it("should return item when called within age", function() {
            var item = { a: 1 };
            var key = "foo/bar";

            cache.set(key, item);
            var cachedItem = cache.get(key);
            assert.equal(cachedItem, item);
        });
        it("should return `null` if item expired", function(done) {
            var item = { a: 1 };
            var key = "foo/bar";

            var cache = new Cache(maxSize, 0) ;
            cache.set(key, item);

            // Do we use sinon to make this sync?
            setTimeout(function() {
                var cachedItem = cache.get(key);
                assert.equal(cachedItem, null);
                done();
            }, 0);
        });
    });
    
    describe("delete", function() {
        it("should remove item from cache", function() {
            var item = { a: 1 };
            var key = "foo/bar";

            cache.set(key, item);
            cache.delete(key);
            var cachedItem = cache.get(key);
            assert.equal(cachedItem, null);
        });
        
        it("should decrement size", function() {
            var item = { a: 1 };
            var key = "foo/bar";

            cache.set(key, item);
            cache.delete(key);
            assert.equal(cache.size(), 0);
        });
    });
    
    describe("purge", function() {
        it("should not purge when maxSize is not reached", function() {
            var item = { a: 1 };

            var cache = new Cache(7) ;

            cache.set("foo/bar", item);
            cache.set("foo/baz", item);
            cache.set("foo/bir", item);
            cache.set("foo/biz", item);

            assert.equal(cache.size(), 4);
        });
        
        it("should purge when maxSize is reached", function() {
            var item = { a: 1 };

            var cache = new Cache(10) ;

            cache.set("1", item);
            cache.set("2", item);
            cache.set("3", item);
            cache.set("4", item);
            cache.set("5", item);
            cache.set("6", item);
            cache.set("7", item);
            cache.set("8", item);
            cache.set("9", item);
            cache.set("10", item);
            cache.set("11", item);

            assert.equal(cache.size(), 7);
        });
        
        it("should purge the least recently used items", function(done) {
            var item = { a: 1 };

            var cache = new Cache(10, 0) ;

            cache.set("1", item);
            cache.set("2", item);
            cache.set("3", item);
            cache.set("4", item);
            cache.set("5", item);
            cache.set("6", item);
            cache.set("7", item);
            cache.set("8", item);
            cache.set("9", item);
            cache.set("10", item);

            // New cache hits
            setTimeout(function() {
                cache.get("1");
                cache.get("2");
                cache.get("10");
                cache.get("4");
                cache.get("5");
                cache.get("6");

                // Trigger purge
                cache.set("11", item);

                var cachedItem = cache.get("7");
                assert.equal(cachedItem, null);
                cachedItem = cache.get("8");
                assert.equal(cachedItem, null);
                cachedItem = cache.get("9");
                assert.equal(cachedItem, null);
                cachedItem = cache.get("3");
                assert.equal(cachedItem, null);

                done();
            }, 1);
        });
        
        it("should purge expired items", function(done) {
            var item = { a: 1 };

            var cache = new Cache(5, 0) ;

            cache.set("1", item);
            cache.set("2", item);
            cache.set("3", item);
            cache.set("4", item);

            setTimeout(function() {
                cache.set("5", item);

                var cachedItem = cache.get("1");
                assert.equal(cachedItem, null);
                cachedItem = cache.get("2");
                assert.equal(cachedItem, null);
                cachedItem = cache.get("3");
                assert.equal(cachedItem, null);
                cachedItem = cache.get("4");
                assert.equal(cachedItem, null);

                done();
            }, 2);
        });
    });
});