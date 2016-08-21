#!/usr/bin/env node
/*global describe it*/
"use strict";

"use server";


require("amd-loader");
require("c9/inline-mocha")(module);

var assert = require("assert");
var fs = require("fs");

describe("client config consistency", function(){
    // this.timeout(60000);
    
    var fileCache = Object.create(null);
    var clientOptions;
    var root = __dirname + "/../";
    
    it("should get clientOptions from server", function(next) {
        fetchClientOptions(function(err, clientOptions) {
            assert(!err && clientOptions);
            next();
        }); 
    });
    
    fs.readdirSync(root + "/configs").forEach(function(name) {
        if (!/client-(workspace|ssh|default)/.test(name)) return;
        
        it("should not have missing plugins in config " + name, function(next) {
            fetchClientOptions(function(err, clientOptions) {
                if (err) return next();
                checkConfig(name, clientOptions, next);
            });
        });
    });
    
    function fetchClientOptions(callback) {
        if (clientOptions)
            return callback(null, JSON.parse(JSON.stringify(clientOptions)));
        var server = require(root + "/server.js");
        server(["--_getConfig", "-l", "localhost", "--collab=true"], "", function(e, plugins) {
            clientOptions = plugins.filter(function(p) {
                return /standalone[\\\/]standalone/.test(p.packagePath);
            })[0].options;
            fetchClientOptions(callback);
        });
    }
        
    function checkConfig(name, clientOptions, next) {
        var hasError = false;
        var configPath = root + "/configs/" + name;
        var configPathReal = fs.realpathSync(configPath);
        var clientPlugins = require(configPath)(clientOptions);
        
        clientPlugins = clientPlugins.map(function(p, i) {
            if (typeof p == "string")
                return {packagePath: p};
            return p;
        });
        clientPlugins.forEach(function(p) {
            if (p.packagePath) {
                if (!fileCache[p.packagePath]) {
                    
                    var filePath;
                    try {
                        filePath = require.resolve(p.packagePath);
                    } 
                    catch (e) {
                        try { 
                            filePath = require.resolve(p.packagePath.replace(/^plugins\//, ""));
                        } catch (e) {
                            // TODO instead of quessing we need a simple way of getting pathmap
                            if (configPath != configPathReal)
                                filePath = require.resolve(configPathReal + "/../../node_modules/" + p.packagePath.replace(/^plugins\//, ""));
                        }
                    }
                    if (!filePath.match(/\.js$/))
                        filePath += ".js";

                    fileCache[p.packagePath] = fs.readFileSync(filePath, "utf8");
                }
                var source = fileCache[p.packagePath];
                p.provides = getDeps("provides", source);
                p.consumes = getDeps("consumes", source);
            }
        });
        
        var provides = {"auth.bootstrap": 1, "hub": 1};
        var paths = {};
        clientPlugins.forEach(function(p) {
            if (paths[p.packagePath]) {
                console.error(name, paths[p.packagePath].packagePath, p.packagePath);
                hasError = true;
            }
            paths[p.packagePath] = p;
            p.provides && p.provides.forEach(function(name) {
                if (provides[name]) {
                    // console.warn(name, p.packagePath, provides[name]);
                }
                provides[name] = p.packagePath;
            });
        });
        var unresolved = [];
        clientPlugins.forEach(function(p) {
            var missing = (p.consumes || []).filter(function(name) {
                return !provides[name];
            });
            if (missing.length) {
                unresolved.push({
                    packagePath: p.packagePath,
                    missing: missing
                });
            }
        });
        
        if (unresolved.length) {
            // not throwing an error to check all configs
            hasError = true;
        }
        
        function getDeps(type, source) {
            var re = new RegExp(type + /\s*=\s*(\[[^\[\]]*\])/.source);
            var m = source.match(re);
            if (!m) return [];
            m = m[1].replace(/\/\/.*|\/\*[\s\S]*?\*\//g, "")
                .replace(/,\s*\]/g, "]")
                .replace(/'/g, "\"");
            return JSON.parse(m);
        }
        assert(!unresolved.length, (
                "unresolved plugins in /configs/" + name + 
                JSON.stringify(unresolved, null, 4)
            ).replace(/^/gm, "\t")
        );
        next();
    }
    
});
