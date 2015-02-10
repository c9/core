"use strict";

plugin.consumes = [];
plugin.provides = ["connect.static"];

module.exports = plugin;

function plugin(options, imports, register) {

    var prefix = options.prefix || "/static";
    var rjs = {
        "paths": {},
        "packages": [],
        "baseUrl": prefix,
    };
    
    var mounts = [];

    register(null, {
        "connect.static": {
            addStatics: function(statics) {
                mounts.push.apply(mounts, statics);
                
                statics.forEach(function(s) {
                    var libs = s.rjs || {};
                    for (var name in libs) {
                        if (typeof libs[name] === "string") {
                            rjs.paths[name] = join(prefix, libs[name]);
                        } else {
                            rjs.packages.push(libs[name]);
                        }
                    }
                });
            },

            getRequireJsPaths: function() {
                return rjs.paths;
            },

            getRequireJsPackages: function() {
                return rjs.packages;
            },

            getStaticPrefix: function() {
                return prefix;
            },
            
            getMounts: function() {
                return mounts;
            },
            
            getRequireJsConfig: function() {
                return rjs;
            },
            
            getWorkerPrefix: function() {
                return prefix;
            }
        }
    });

    function join(prefix, path) {
        return prefix.replace(/\/*$/, "") + "/" + path.replace(/^\/*/, "");
    }
}
