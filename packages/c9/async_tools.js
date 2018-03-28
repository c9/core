"use strict";

exports.throttle = function(timeout, callback) {
    var blocked = false;
    return function() {

        if (blocked)
            return;

        blocked = true;
        setTimeout(function() {
            blocked = false;
        }, timeout);

        callback();
    };
};

exports.once = function(callback) {
    var called = false;
    return function() {
        if (called) return;

        called = true;
        return callback.apply(this, arguments);
    };
};

exports.retry = function(fn, minDelay, maxDelay, maxTries, callback) {
    var delay = minDelay;
    var tries = 0;

    tryNext();

    function tryNext() {
        fn(function(err) {
            if (!err) return callback.apply(null, arguments);

            if (++tries >= maxTries)
                return callback(new Error("Operation timed"));

            setTimeout(tryNext, delay);
            delay = Math.min(delay * delay, maxDelay);
        });
    }
};

exports.timeout = function(fn, options, callback) {
    if (arguments.length == 2)
        return exports.timeout(fn, {}, options);
        
    var cancel = options.cancel || function() {};
    var timeout = options.timeout || 2000;
    var error = options.error || function() {
        var err = new Error("Operation timed out");
        err.code = "ETIMEOUT";
        err.timeout = timeout;
        return err;
    };

    var done = false;
    var timer = setTimeout(function() {
        if (done) return;
        done = true;
        
        var err = error();
        cancel();
        callback(err);
    }, timeout);
    
    fn(function() {
        if (done) return;
        done = true;
        clearTimeout(timer);
        callback.apply(this, arguments);
    });
};