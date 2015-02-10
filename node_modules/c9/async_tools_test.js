"use strict";

"use server";

var assert = require("assert");
var sinon = require("sinon");
var async_tools = require("./async_tools");

module.exports = {
    
    "test operation doesn't timeout": function() {
        var clock = sinon.useFakeTimers();
        var cb = sinon.stub();
        
        async_tools.timeout(function(cb) {
            setTimeout(function() {
                cb(null, "foo", "bar");
            }, 100);
        }, {
            timeout: 200
        }, cb);
        
        sinon.assert.callCount(cb, 0);
        clock.tick(90);
        sinon.assert.callCount(cb, 0);
        clock.tick(20);
        sinon.assert.callCount(cb, 1);
        sinon.assert.calledWith(cb, null, "foo", "bar");
        
        clock.restore();
    },
    
    "test timed out operation should return a timeout error": function() {
        var clock = sinon.useFakeTimers();
        var cb = sinon.stub();
        
        async_tools.timeout(function(cb) {
            setTimeout(function() {
                cb(null, "foo");
            }, 300);
        }, {
            timeout: 200
        }, cb);
        
        sinon.assert.callCount(cb, 0);
        clock.tick(190);
        sinon.assert.callCount(cb, 0);
        clock.tick(20);
        sinon.assert.callCount(cb, 1);
        assert.equal(cb.args[0][0].code, "ETIMEOUT");

        clock.tick(100);
        sinon.assert.callCount(cb, 1);
        
        clock.restore();
    },
    
    "test customize timeout error reporting": function() {
        var clock = sinon.useFakeTimers();
        var cb = sinon.stub();
        
        async_tools.timeout(function(cb) {
            setTimeout(function() {
                cb(null, "foo");
            }, 300);
        }, {
            timeout: 200,
            error: function() {
                return {
                    my: "custom error"
                };
            }
        }, cb);
        
        clock.tick(210);
        assert.equal(cb.args[0][0].my, "custom error");
        
        clock.restore();
    },
    
    "test timeout should call cancel function": function() {
        var clock = sinon.useFakeTimers();
        var cb = sinon.stub();
        var cancel = sinon.stub();
        
        async_tools.timeout(function(cb) {
            setTimeout(function() {
                cb(null, "foo");
            }, 300);
        }, {
            timeout: 200,
            cancel: cancel
        }, cb);
        
        clock.tick(210);
        sinon.assert.called(cancel);
        
        clock.restore();
    },
    
    "test callback should be called max every 2sec": function() {
        var clock = sinon.useFakeTimers();
        
        var cb = sinon.stub();
        var throttle = async_tools.throttle(2000, cb);
        
        sinon.assert.callCount(cb, 0);
        
        throttle();
        sinon.assert.callCount(cb, 1);
        
        throttle();
        sinon.assert.callCount(cb, 1);
        
        clock.tick(1000);
        throttle();
        sinon.assert.callCount(cb, 1);
        
        clock.tick(999);
        throttle();
        sinon.assert.callCount(cb, 1);
        
        clock.tick(2);
        throttle();
        sinon.assert.callCount(cb, 2);
        
        clock.tick(2000);
        throttle();
        sinon.assert.callCount(cb, 3);
        
        clock.restore();
    },
    
    "test once should be called exactly once": function() {
        var cb = sinon.stub();
        
        var o = async_tools.once(cb);
        
        o(1, 2, 3);
        sinon.assert.callCount(cb, 1);
        sinon.assert.calledWith(cb, 1, 2, 3);
        
        o();
        sinon.assert.callCount(cb, 1);
        
        o();
        sinon.assert.callCount(cb, 1);
    }
    
};

!module.parent && require("asyncjs").test.testcase(module.exports).exec();