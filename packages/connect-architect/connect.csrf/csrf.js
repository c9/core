"use strict";

var assert = require("assert");
var url = require("url");
var error = require("http-error");

module.exports = function(options, imports, register) {
    assert(options.allowedHosts, "option 'allowedHosts' is required");

    register(null, {
        "connect.csrf": {
            csrf: function() {
                return csrf(options.allowedHosts);
            }
        }
    });
};

function csrf(allowedHosts) {
    if (typeof allowedHosts == "string")
        return csrf([allowedHosts]);
    
    allowedHosts = allowedHosts.reduce(function(map, host) {
        map[host] = true;
        return map;
    }, {});

    return function(req, res, next) {
        if (req.method !== "POST") return next();
        
        var origin;
        if ("origin" in req.headers) {
            origin = req.headers.origin;
        } else {
            var referrer = req.headers.referrer;
            if (referrer) {
                referrer = url.parse(referrer, false, false);
                origin = referrer.protocol + "//" + referrer.host + (referrer.port ? ":" + referrer.port : "");
            }
        }

        if (!origin) return forbidden();
        if (!allowedHosts[origin]) return forbidden();
        
        next();
        
        function forbidden() {
            next(new error.Forbidden("Request not allowed from " + origin));
        }
    };
}