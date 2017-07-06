/*global describe it before*/

"use server";


if (typeof process !== "undefined")
    require("amd-loader");

define(function(require, exports, module) {
    var assert = require("chai").assert;
    var Heap = require("./heap");
    
    describe("Heap", function() {
        it ("test heap array", function(next) {
            var h = new Heap([10, 5, 20, 1, 3]);
            assert.equal(h.pop(), 1);
            assert.equal(h.pop(), 3);
            assert.equal(h.pop(), 5);
            assert.equal(h.pop(), 10);
            assert.equal(h.pop(), 20);
            next();
        });
    
        it ("test heap functions", function (next) {
            var h = new Heap();
            h.push(1250); h.push(410); h.push(150);
            h.push(400); h.push(150);
            assert.equal(h.N, 5);
            assert.equal(h.pop(), 150);
            assert.equal(h.pop(), 150);
            assert.equal(h.pop(), 400);
            assert.equal(h.pop(), 410);
            assert.equal(h.pop(), 1250);
            assert.equal(h.N, 0);
            next();
        });
    });
});