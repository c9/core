"use strict";

var url = require("url");
var Types = require("./types").Types;
var Route = require("./route");
var flatten = require("./utils").flatten;

module.exports = function Section(name, description, types) {

    types = types || new Types();
    var routes = [];
    var sections = {};
    var self = this;
    
    this.middlewares = [];
    this.globals = [];
    this.errorHandlers = [];
    this.name = name;

    var methods = ["head", "get", "put", "post", "delete", "patch", "upgrade", "options"];
    methods.forEach(function(method) {
        routes[method] = [];
        
        self[method] = (function(method, route, options, handler) {
            // options is optional
            if (typeof options == "function" || Array.isArray(options)) {
                handler = options;
                options = {};
            }
            options.method = method;
            return self._route(route, options, handler);
        }).bind(self, method);
    });
    this.del = this["delete"];

    this.registerType = types.register.bind(types);
    
    this.all = function(method, route, options, handler) {
        var self = this;
        var args = arguments;
        
        methods.forEach(function(method) {
            self[method].apply(self, args); 
        });
    };
    
    /**
     * Insert global middleware(s) for this section: The parent section is
     * always an empty container that delegates to it's sub-sections, and
     * executes all the middelwares for that section.
     * 
     * This method allows us to inject a "global" middleware that is inserted
     * *after* decodeParams and *before* all other middelwares.
     */
    this.global = function( middleware ){
        this.globals.push.apply(this.globals, flatten(middleware));
    };
    
    this.use = function(middleware) {
        this.middlewares.push.apply(this.middlewares, flatten(middleware));
    };

    this.error = function(middleware) {
        this.errorHandlers.push.apply(this.errorHandlers, flatten(middleware));
    };

    this._route = function(route, options, handler) {
        route = new Route(route, options, handler, types);
        route.parent = this;
        routes[route.method].push(route);
        return this;
    };
    
    this.section = function(name, description) {
        var section = new Section(name, description, types);
        section.parent = this;
        if (!sections[name])
            sections[name] = [];
            
        sections[name].push(section);
        return section;
    };
    
    this.getRoutes = function(){
        return routes;
    };
    
    /**
     * Mount an existing section on this instance.
     * 
     * Note that when the first argument is omitted, the section's routes will
     * be copied onto this instance's routing table.
     * 
     * @param {string} mountpoint Where to mount this secion, e.g. "/capture/"
     * @param {Section} section A frontdoor section
     */

    this.mount = function(name, section) {
        var that = this;
        
        if (arguments.length == 1) {
            section = arguments[0];
        
            if (!(section instanceof Section))
                throw new Error("Single argument to mount must be a Section!");
        
            var addRoutes = section.getRoutes();
        
            Object.keys(addRoutes).forEach(function(method) {
                var r = addRoutes[method];
                r.forEach(function(route) {
                    route.parent = that;
                })
                routes[method] = [].concat(routes[method], r);
            });
        
            return;
        }
        
        if (!sections[name])
            sections[name] = [];
        
        section.parent = this;
        sections[name].push(section);
    };
    
    /**
     * Sortcut for client-side routing without a `next`
     * 
     * Allows you to omit the third argument, "next" and avoid special 
     * treatment in router.js (see "wrapHandler").
     * 
     * Has a variable number of argumnets: no need to wrap handlers in an array
     */ 
    this.on = function(path, handler){
        var middlewares = Array.prototype.slice.call(arguments, 1);
        handler = middlewares.shift();

        middlewares.unshift(function(req, res, next) {
            handler(req, res, next);
        });

        this._route(path, {
            method: "get"
        }, middlewares);
    };
    
    this._rootHandler = function(req, res) {
        this.handle(req, res, function(err) {
            if (err) {
                res.statusCode = err.code || err.statusCode || 500;
                res.end(err.message || err.toString);
            } else {
                res.statusCode = 404;
                res.end("cannot " + req.method);
            }
        });
    };
    
    this.handle = (function(path, req, res, next) {
        var that = this;
        
        if (arguments.length == 2) {
            return this._rootHandler.apply(this, arguments);
        }
        
        if (arguments.length === 3) {
            req = arguments[0];
            res = arguments[1];
            next = arguments[2];
            
            if (!req.parsedUrl)
                req.parsedUrl = url.parse(req.url, true);
                
            path = req.parsedUrl.pathname;
        }
        
        req.params = req.params || {};
        
        var method = req.method.toLowerCase();
        if (methods.indexOf(method) == -1)
            return next();

        var handler = this.match(req, path, method);
        if (!handler)
            return next();
            
        var middleware = [];
        var errorHandlers = [];
        while (handler) {
            middleware.unshift.apply(middleware, handler.middlewares || []);
            errorHandlers.unshift.apply(errorHandlers, handler.errorHandlers || []);
            handler = handler.parent;
        }
        
        if (this.globals.length)
            middleware.splice.apply( middleware, [1, 0].concat( this.globals ) );

        var i = 0;
        function processNext() {
            handler = middleware[i++];
            if (!handler || i > middleware.length)
                return next();
                
            handler(req, res, function(err) {
                if (err)
                    return that.handleError(errorHandlers, err, req, res, next);
                
                processNext();
            });
        }

        processNext();
    }).bind(this);
    
    this.handleError = function (errorHandlers, err, req, res, next) {
        var i = 0;
        function processNext(err) {
            if (!err)
                return next();
                
            var handler = errorHandlers[i++];
            if (!handler || i > errorHandlers.length)
                return next(err);
                
            handler(err, req, res, processNext);
        }
        
        processNext(err);
    };
    
    this.match = function(req, path, method) {
        var splitPath = path.split("/");
        if (!splitPath[0])
            splitPath.shift();

        if (splitPath.length && sections.hasOwnProperty(splitPath[0])) {
            var section = sections[splitPath[0]];
            if (section && section.length) {
                var subPath = "/" + splitPath.slice(1).join("/");
                for (var i = 0; i < section.length; i++) {
                    var handler = section[i].match(req, subPath, method);
                    if (handler)
                        return handler;
                }
            }
        }

        var methodRoutes = routes[method];
        for (var i = 0; i < methodRoutes.length; i++) {
            var route = methodRoutes[i];
            if (route.match(req, path))
                return route;
        }
    };
    
    this.describe = function() {
        // sections and routes
        var api = {};
        
        if (name)
            api.name = name;
            
        if (description)
            api.description = description;
        api.sections = [];
        for (var key in sections) {
            for (var i=0; i < sections[key].length; i++) {
                api.sections.push(sections[key][i].describe());
            }
        }
        if (!api.sections.length)
            delete api.sections;

        api.routes = [];
        for (var method in routes) {
            for (var i=0; i < routes[method].length; i++) {
                api.routes.push(routes[method][i].describe());
            }
        }
        if (!api.routes.length)
            delete api.routes;

        return api;
    };
};