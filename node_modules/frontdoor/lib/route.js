"use strict";

var RegExpType = require("./types").RegExp;
var Types = require("./types").Types;
var flatten = require("./utils").flatten;
var error = require("http-error");

module.exports = function Route(route, options, handler, types) {

    // options is optional
    if (typeof options == "function" || Array.isArray(options)) {
        types = handler;
        handler = options;
        options = {};
    }

    options.route = route;
    types = types || new Types();
    
    this.middlewares = flatten(handler);

    this.middlewares = this.middlewares.map(function(handler) {
        if (handler.length == 2) {
            handler = wrapHandler(handler);
        }        
        return handler;
    });

    this.middlewares.unshift(decodeParams);
        
    this.method = (options.method || "GET").toLowerCase();

    var self = this;
    var keys = [];
    var params = options.params || {};
    var routeRe = normalizePath(options.route, keys, params);
    params = normalizeParams(params);

    function wrapHandler(handler) {
        return function(req, res, next) {
            handler(req.params || {}, function(err, json, headers, code) {
                if (err) return next(err);
                
                res.json(json, headers, code);
            });
        };
    }

    /**
     * Creates a rgular expression to match this route.
     * Url param names are stored in `keys` and the `params` are completed with
     * the default values for url parameters.
     */
    function normalizePath(path, keys, params) {
        for (var name in params) {
            var param = params[name];
            if (typeof param == "string" || param instanceof RegExp)
                params[name] = { type: param};
        }
        
        path = path
            .concat("/?")
            .replace(/\/:([\w\.\-\_]+)(\*?)/g, function(match, key, wildcard) {
                keys.push(key);
                if (!params[key]) {
                    params[key] = {};
                }
                // url params default to type string and optional=false
                var param = params[key];
                param.type = param.type || "string";
                param.optional = false;
                
                if (!param.source)
                    param.source = "url";
                
                if (param.source !== "url")
                    throw new Error("Url parameters must have 'url' as source but found '" + param.source + "'");
                    
                if (wildcard)
                    return "(/*)";
                else 
                    return "/([^\\/]+)";
            })
            .replace(/([\/.])/g, '\\$1')
            .replace(/\*/g, '(.*)');

        return new RegExp('^' + path + '$');
    }
        
    function normalizeParams(params) {
        for (var name in params) {
            var param = params[name];

            if (param.source == "query") {
                // query params default to string
                param.type = param.type || "string";
            } 
            else if (!param.source || param.source == "body") {
                // body params default to json
                param.type = param.type || "json";
                param.source = "body";
            }
            else if (param.source === "url") {
                param.type = param.type || "string";
            }
            else {
                throw new Error("parameter source muste be 'url', 'query' or 'body'");
            }
            
            // optional defaults to false
            param.optional = !!param.optional;
                
            // allow regular expressions as types
            if (param.type instanceof RegExp)
                param.type = new RegExpType(param.type);
                
            // convert all types to type objects
            param.type = types.get(param.type);
        }
        
        return params;
    }
        
    /**
     * Check if the given path matched the route regular expression. If
     * the regular expression doesn't match or parsing fails `match` will
     * return `false`
     **/
    this.match = function(req, path) {
        var m = path.match(routeRe);
        if (!m) return false;
        
        var match = {};
        for (var i = 0; i < keys.length; i++) {
            var value = m[i+1];
            var key = keys[i];
            var param = params[key];
            var type = param.type;
            if (param.optional && value == null) {
                match[key] = value;
                continue;
            }
            try {
                value = type.parse(value);
            } catch (e) {
                return false;
            }
            if (!type.check(value)) {
                return false;
            }
            match[key] = value;
        }
        req.match = match;
        return true;
    };

    /**
     * Middleware to validate the parameters. It will take `req.match` for
     * url params, decode the query and body parameters. If validation passes
     * the decoded and validated parameters are stored in `req.params` 
     * otherwhise an error is returned.
     */
    this.decodeParams = decodeParams;
    function decodeParams(req, res, next) {
        var urlParams = req.match;
        if (!urlParams) return;
        
        var body = req.body || {};
        var query = req.parsedUrl.query;

        req.params = req.params || {};
        var errors = [];
        
        // marker object
        var EMPTY = {};
        
        // 1. check if all required params are there
        for (var key in params) {
            var param = params[key];
            if (
                (!param.optional) && (
                    (param.source == "body" && !(key in body)) ||
                    (param.source == "query" && !(key in query)) ||
                    (param.source == "url" && !(key in urlParams))
                )
            ) {
                errors.push({
                    "resource": self.name || "root",
                    "field": key,
                    "source": param.source,
                    "code": "missing_field"
                });
            }
            else {
                var type = param.type;
                var value = EMPTY;
                var isValid = true;
                switch (param.source) {
                    case "body":
                        if (param.optional && !(key in body))
                            break;
                            
                        value = body[key]; // body is already JSON parsed
                        if (param.optional && value == null) {
                            value = EMPTY;
                            break;
                        }
                        
                        isValid = type.check(value);
                        break;
                        
                    case "query":
                        if (param.optional && query[key] == null) {
                            value = EMPTY;
                            break;
                        }
                            
                        try {
                            value = type.parse(query[key]);
                        } catch(e) {
                            isValid = false;
                        }
                        isValid = isValid === false ? false : type.check(value);
                        break;
                        
                    case "url":
                        if (param.optional && urlParams[key] == null) {
                            value = EMPTY;
                            break;
                        }

                        value = urlParams[key]; // is already parsed and checked
                        isValid = true;
                        break;
                        
                    default:
                        throw new Error("Invalid source: " + params.source);
                }
                
                if (!isValid) {
                    errors.push({
                        "resource": self.name || "root",
                        "field": key,
                        "type_expected": type.toString(),
                        "code": "invalid"
                    });
                }
                else {
                    if (value !== EMPTY)
                        req.params[key] = value;
                    else if ("default" in param)
                        req.params[key] = param.default;
                }
            }
        }

        if (errors.length) {
            var err = new error.UnprocessableEntity("Validation failed");
            err.errors = errors;
            return next(err);
        }
        next();
    }
    
    this.describe = function() {
        var route = {
            route: options.route,
            method: this.method
        };
        
        if (options.name)
            route.name = options.name;
            
        if (options.description)
            route.description = options.description;

        route.params = {};
        for (var name in params) {
            var param = params[name];
            route.params[name] = {
                name: param.name,
                type: param.type.toString(),
                source: param.source,
                optional: param.optional
            };
            if (param.description)
                route.params[name].description = param.description;
        }
        
        if (!Object.keys(route.params).length)
            delete route.params;
            
        return route;
    };
};