"use strict";
"use server";

var assert = require("assert");
var blocked = require("./blocked");

module.exports = {
    
    "test normal run should return low blocked time": function(next) {
        blocked(function(time) {
            assert(time < 10);
            next();
        });
    },
    "test busy loop should report high blocked time": function(next) {
        blocked(function(time) {
            assert(time >= 100);
            next();
        });
        
        var start = Date.now();
        while (Date.now() - start < 100) {}
    },
    "test busy loop in setTimeout should report high blocked time": function(next) {
        setTimeout(function() {
            var start = Date.now();
            while (Date.now() - start < 100) {}
        }, 0);
        
        blocked(function(time) {
            assert(time >= 100);
            next();
        });
    },
    "test busy loop in setInterval should report high blocked time": function(next) {
        var interval = setInterval(function() {
            clearInterval(interval);
            var start = Date.now();
            while (Date.now() - start < 100) {}
        });
        
        blocked(function(time) {
            assert(time >= 100);
            next();
        });
    },
    "test busy loop in setImmediate should report high blocked time": function(next) {
        setImmediate(function() {
            var start = Date.now();
            while (Date.now() - start < 100) {}
        });
        
        blocked(function(time) {
            assert(time >= 100);
            next();
        });
    }
};

!module.parent && require("asyncjs").test.testcase(module.exports).exec();