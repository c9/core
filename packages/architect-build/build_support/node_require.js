// Simple require shim for packaged node apps
(function () {

if (global.define) return;

var fs = require("fs");
var path = require("path");
var Module = require("module");

var fp = Module._findPath;
Module._findPath = function(request, paths) {
    if (Module._cache[request])
        return request;
    var id = path.resolve(paths[0], request);
    if (Module._cache[id])
        return id;
    return fp(request, paths);
} 

var moduleStack = [];
var defaultCompile = module.constructor.prototype._compile;

module.constructor.prototype._compile = function(content, filename){  
    moduleStack.push(this);
    try {        
        return defaultCompile.call(this, content, filename);
    }
    finally {
        moduleStack.pop();
    }
};

global.define = function(id, injects, factory) {
    var DEFAULT_INJECTS = ["require", "exports", "module"];

    // infer the module
    var currentModule = moduleStack[moduleStack.length-1];
    var mod = currentModule || module.parent || require.main;

    // assign arguments
    if (arguments.length === 1) {
        factory = id;
        injects = DEFAULT_INJECTS;
        id = null;
    }
    else if (arguments.length === 2) {
        factory = injects;
        injects = id;
        id = null;
    }
    
    if (injects.length == 0) {
        injects = DEFAULT_INJECTS;
    }

    if (typeof id === "string" && id !== mod.id) {
        var fullId = path.resolve(__filename, id);
        mod = new Module(fullId, mod);
        mod.filename = fullId;
        Module._cache[id] = Module._cache[fullId] = mod;
    }

    var req = function(module, relativeId, callback) {
        if (Array.isArray(relativeId)) {
            // async require
            return callback.apply(this, relativeId.map(req))
        }
        
        var chunks = relativeId.split("!");
        var prefix;
        if (chunks.length >= 2) {
            prefix = chunks[0];
            relativeId = chunks.slice(1).join("!");
        }
        
        var fileName = Module._resolveFilename(relativeId, module);
        if (Array.isArray(fileName))
            fileName = fileName[0];
        
        if (prefix && prefix.indexOf("text") !== -1) {
            return fs.readFileSync(fileName, "utf8");
        } else
            return require(fileName);
    }.bind(this, mod);
    
    id = mod.id;
    if (typeof factory !== "function") {
        // we can just provide a plain object
        return mod.exports = factory;
    }
    
    var returned = factory.apply(mod.exports, injects.map(function (injection) {
        switch (injection) {
            // check for CommonJS injection variables
            case "require": return req;
            case "exports": return mod.exports;
            case "module": return mod;
            default:
                // a module dependency
                return req(injection);
        }
    }));
    
    if (returned) {
        // since AMD encapsulates a function/callback, it can allow the factory to return the exports.
        mod.exports = returned;
    }
};

}());
