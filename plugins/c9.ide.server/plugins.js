/**
 * Serve plugins on the static server
 *
 * @copyright 2013, Ajax.org B.V.
 */

define(function(require, exports, module) {
    "use strict";
        
    main.consumes = ["Plugin", "connect.static"];
    main.provides = ["c9.static.plugins"];
    return main;


    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var statics = imports["connect.static"];
        var fs = require("fs");
        
        var whitelist = options.whitelist;
        var blacklist = options.blacklist;
        var externalPlugins = options.externalPlugins || [];
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        
        var loaded = false;
        function load(){
            if (loaded) return false;
            loaded = true;
            
            var requirePaths = {
                ace: "lib/ace/lib/ace",
                ace_tree: "lib/ace_tree/lib/ace_tree",
                treehugger: "lib/treehugger/lib/treehugger",
                acorn: "lib/treehugger/lib/acorn",
                jsonm: "lib/jsonm",
                tern: "lib/tern",
                tern_from_ts: "lib/tern_from_ts",
                ui: "lib/ui",
                c9: "lib/c9",
                frontdoor: "lib/frontdoor",
            };
            
            if (whitelist === "*") {
                statics.addStatics([{
                    path: __dirname + "/../../node_modules",
                    mount: "/lib"
                }]);
    
                statics.addStatics([{
                    path: __dirname + "/../../plugins",
                    mount: "/plugins",
                    rjs: requirePaths
                }]); 
            } else {
                [
                    "ace_tree", 
                    "acorn",
                    "tern",
                    "tern_from_ts",
                    "treehugger",
                    "jsonm",
                    "pivottable",
                    "architect",
                    "source-map",
                    "rusha",
                    "c9",
                    "ui",
                    "emmet",
                    "frontdoor",
                    "mocha", // TESTING
                    "chai",  // TESTING
                ].forEach(function(name) {
                    statics.addStatics([{
                        path: __dirname + "/../../node_modules/" + name,
                        mount: "/lib/" + name
                    }]);
                });
                
                statics.addStatics([{
                    path: __dirname + "/../../node_modules/ace",
                    mount: "/lib/ace",
                    rjs: requirePaths
                }]);

                statics.addStatics(externalPlugins.map(function(plugin) {
                    if (typeof plugin == "string")
                        plugin = { path: plugin, mount: plugin};
                    return {
                        path: __dirname + "/../../node_modules/" + plugin.path,
                        mount: "/plugins/" + plugin.mount
                    };
                }));
                
                statics.addStatics(fs.readdirSync(__dirname + "/../")
                    .filter(function(path) {
                        if (path in blacklist)
                            return false;
                        else if (path in whitelist)
                            return true;
                        else if (path.indexOf("c9.ide.") === 0)
                            return true;
                        else if (path.indexOf("c9.account") === 0)
                            return true;
                        else
                            return false;
                    })
                    .map(function(path) {
                       return {
                            path: __dirname + "/../../plugins/" + path,
                            mount: "/plugins/" + path
                        };
                    })
                );
            }
            
            statics.addStatics([{
                path: __dirname + "/www",
                mount: "/"
            }]);
            
            statics.addStatics([{
                path: __dirname + "/../../docs",
                mount: "/docs"
            }]);

        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function(){
            load();
        });
        plugin.on("unload", function(){
            loaded = false;
        });
        
        /***** Register and define API *****/
        
        plugin.freezePublicAPI({});
        
        register(null, {
            "c9.static.plugins": plugin
        });
    }
});
