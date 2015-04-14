define(function(require, exports, module) {
"use strict";

var Params = require("./params");
var flatten = require("./utils").flatten;
var error = require("http-error");

function prepareParams( options, types, parent ){
    var params = Params.normalize(options.params, types );

    if ( parent ){
        for ( var key in parent.params ){
            if ( params[key] ) continue;
            params[key] = parent.params[key];
        }
    }

    return params;
}


module.exports = function Route(route, options, handler, types, parent ) {

    // options is optional
    if (typeof options == "function" || Array.isArray(options)) {
        types = handler;
        handler = options;
        options = {};
    }
    

    options.route = route;
    
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
    
    var params = prepareParams( options, types, parent );
    var routeRe = normalizePath(options.route, keys, params);

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
        path = path
            .concat("/?")
            .replace(/\/:([\w\.\-\_]+)(\*?)/g, function(match, key, wildcard) {
                keys.push(key);

                // Implicit params: part of path definition but not defined as
                // { params }, created here on the fly.
                if (!params[key]) 
                    params[key] = Params.param( key );

                var param = params[key];

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

            if ( keys.indexOf(key) === -1 && param.source == 'url' )
                continue;

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
                        isValid = type.check(value);
                        break;
                    case "query":
                        if (param.optional && !(key in query))
                            break;
                            
                        try {
                            value = type.parse(query[key]);
                        } catch(e) {
                            isValid = false;
                        }
                        isValid = isValid === false ? false : type.check(value);
                        break;
                    case "url":
                        if (param.optional && !(key in urlParams))
                            break;

                        value = urlParams[key]; // is already parsed and checked
                        isValid = true;
                        break;
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

});