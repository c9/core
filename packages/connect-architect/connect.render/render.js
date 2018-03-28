"use strict";

var http = require("http");
var error = require("http-error");
var path = require("path");
var fs = require("fs");
var extname = path.extname;
var exists = fs.exists || path.exists;
var async = require("async");

module.exports = function(options, imports, register) {

    var defaultTemplatePath = options.templatePath;

    var viewCache = {};
    var engines = {};
    function registerEngine(name, handler) {
        engines[name] = handler;
    }
    
    imports.connect.addResponseMethod("setTemplatePath", function(path) {
        this._templatePaths = this._templatePaths || [];
        this._templatePaths.push(path);
    });
    
    imports.connect.addResponseMethod("resetTemplatePath", function() {
        if (this._templatePaths)
            this._templatePaths.pop();
    });
        
    imports.connect.addResponseMethod("render", function(name, options, next) {
        var res = this;
        
        var paths = this._templatePaths || [];
        if (!paths.length && defaultTemplatePath)
            paths.push(defaultTemplatePath);
            
        var isAbsolute = path.sep === "/"
            ? name[0] === "/"
            : name[1] === ":";
        var key = isAbsolute 
            ? name
            : paths.join("&") + "&" + name;
            
        getView(function(err, view) {
            if (err) return next(err);
            
            view(res, res.getOptions(options), function(err, rendered) {
                if (err) return next(err);
                
                if (next && next.length == 2)
                    return next(null, rendered.body);
                
                var statusCode = options.statusCode || 200;
                res.writeHead(statusCode, rendered.headers || {});
                res.end(rendered.body);
            });
        });
        
        function getView(callback) {
            var view = viewCache[key];
            if (view)
                return callback(null, view);
            
            var ext = extname(name);
            if (!ext)
                return callback(new error.InternalServerError("View doesn't have an extension: " + name));
                
            var engine = engines[ext.slice(1)];
            if (!engine)
                return callback(new error.InternalServerError("Unsupported view type: " + ext));
            
            if (isAbsolute) {
                exists(name, function(exists) {
                    withPath(exists ? name : null);
                });
            }
            else {
                var fileName;
                async.each(paths, function(p, next) {
                    fileName = path.join(p, name);
                    exists(fileName, function(exists) {
                        if (exists)
                            withPath(fileName);
                        else 
                            next();
                    });
                }, function(exists) {
                    withPath(null);
                });
            }

            function withPath(fileName) {
                if (!fileName)
                    return callback(new error.NotFound("View not found: " + name));
                    
                engine(fileName, function(err, view) {
                    if (err) return callback(err);
                    
                    view = viewCache[key] = view;
                    return callback(null, view);
                });
            }
        }
    });

    register(null, {
        "connect.render": {
            registerEngine: registerEngine,
            setTemplatePath: function(path) {
                return function(req, res, next) {
                    res.setTemplatePath(path);
                    next();
                };
            },
            resetTemplatePath: function() {
                return function(req, res, next) {
                    res.resetTemplatePath();
                    next();
                };
            }
        }
    });
};