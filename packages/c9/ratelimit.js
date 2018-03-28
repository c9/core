var error = require("http-error");
var RateLimiter = require('limiter').RateLimiter;

var MAX_EXPIRE_INTERVAL = 5000;

/**
 * In memory rate limiter as connect middleware
 */
module.exports = ratelimit;

function ratelimit(key, duration, max) {
    
    var buckets = Object.create(null); // in case there handles like 'constructor'
    var rootKey = "params"; 
    if (/^req\./.test(key)) {
        rootKey = null;
        key = key.replace(/^req\./, "");
    } 
    
    // Returns a deep value from an object. E.g. resolveValue({user: {id: 5}}, "user.id") === 5
    function resolveValue(obj, path) {
        if (path === "*")
            return "*";
            
        return path.split('.').reduce(function(prev, curr) {
            return prev ? prev[curr] : undefined;
        }, obj);
    }

    // cleanup empty buckets
    setInterval(function() {
        Object.keys(buckets).forEach(function(handle) {
            var bucket = buckets[handle];
            if (bucket.tokenBucket.content === 0) {
                delete buckets[handle];
            }
        });
    }, 5 * 1000);
    
    return function(req, res, next) {
        var root = rootKey ? req[rootKey] : req;
        var handle = resolveValue(root, key);

        buckets[handle] = buckets[handle] || new RateLimiter(max, duration, true);
        var removed = buckets[handle].tryRemoveTokens(1);
        if (!removed) {
            var err = new error.TooManyRequests("Rate limit exceeded");
            err.retryIn = Math.min(duration, 5000);
            return next(err);
        }
    
        return next();
    };
}
