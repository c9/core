"use strict";

var UAParser = require("ua-parser-js");

module.exports = function(options, imports, register) {
    imports.connect.useSetup(csp());
    register(null, {
        "connect.csp": {
            csp: function(varargs) {
                var args = arguments;
                return function(req, res, next) {
                    res.csp.apply(res, args);
                    next();
                };
            }
        }
    });
};

function csp() {
    
    return function(req, res, next) {
        res._csp_policy = {
            "default-src": "'self'",
            "script-src": {},
            "object-src": {},
            "img-src": {},
            "media-src": {},
            "frame-src": {},
            "font-src": {},
            "connect-src": {},
            "style-src": {},
            "report-uri": ""
        };
        res._csp_has_policy = false;

        var keywords = {
            "none": 1,
            "self": 1,
            "unsafe-inline": 1,
            "unsafe-eval": 1
        };
        
        var presets = {
            "facebook": {
                "frame-src": "https://www.facebook.com",
                "style-src": "unsafe-inline"
            },
            "twitter": {
                "script-src": "https://platform.twitter.com",
                "frame-src": "http://platform.twitter.com",
                "style-src": "unsafe-inline"
            }
        };
        
        res.csp = function(directive, value) {
            if (arguments.length === 1) {
                if (Array.isArray(directive)) {
                    directive.forEach(function(arg) {
                        res.csp(arg);
                    });
                }
                else if (typeof directive === "string" && presets[directive]) {
                    return res.csp(presets[directive]);
                }
                else if (typeof directive == "object") {
                    for (var key in directive)
                        res.csp(key, directive[key]);
                }
                else {
                    throw new TypeError("Invalid argument 'directive'");
                }
                return;
            }
            
            if (arguments.length == 2) {
                if (Array.isArray(value)) {
                    value.forEach(res.csp.bind(res, directive));
                    return;
                }
            }
            
            res._csp_has_policy = true;
            
            if (keywords[value])
                value = "'" + value + "'";

            if (directive === "report-uri" || directive === "default-src")
                res._csp_policy[directive] = value;
            else
                res._csp_policy[directive][value] = 1;
        };

        res.on("header", function() {
            if (!res._csp_has_policy)
                return;
                
            var parser = new UAParser();
            var uaHeader = req.headers['user-agent'];
            parser.setUA(uaHeader);
            var ua = parser.getBrowser();
            var browser = ua.browser || {};
            var engine = ua.engine || {};

            if (
                // old firefox doesn't support CSP properly
                engine.name == "Gecko" && parseInt(engine.version, 10) <= 23 ||
                (uaHeader || "").indexOf("Googlebot") >= 0
            ) {
                return;
            }
    
            var policyValue = Object.keys(res._csp_policy)
                .map(function(key) {
                    var value = res._csp_policy[key];
                    if (value) {
                        if (typeof value !== "string") {
                            if (value["noself"])
                                delete value["noself"];
                            else
                                value["'self'"] = 1;
                            value = Object.keys(value).join(" ");
                        }
                        
                        if (value) {
                            return key + " " + value;
                        }
                    }
                    return null;
                })
                .filter(function(chunk) {
                    return !!chunk;
                })
                .join("; ");
                
            res.setHeader("Content-Security-Policy", policyValue);
            if (
                ua.engine == "Gecko" && parseInt(ua.engine.version, 10) <= 23 ||
                browser.name == "Chrome" && parseInt(browser.major, 10) >= 25 ||
                browser.name == "Safari" && parseInt(browser.major, 10) >= 7
            ) {
                return;
            }
            
            res.setHeader("X-Content-Security-Policy", policyValue);
            res.setHeader("X-WebKit-CSP", policyValue);
        });
        next();
    };
}