/**
 * Serve plugins on the static server
 *
 * @copyright 2013, Ajax.org B.V.
 */

"use strict";

main.consumes = [
    "connect.static"
];
main.provides = ["c9.static.plugins"];

module.exports = main;

function main(options, imports, register) {
    var statics = imports["connect.static"];
    var fs = require("fs");
    
    var whitelist = options.whitelist;
    var blacklist = options.blacklist;
    
    var requirePaths = {
        ace: "lib/ace/lib/ace",
        ace_tree: "lib/ace_tree/lib/ace_tree",
        treehugger: "lib/treehugger/lib/treehugger",
        acorn: "lib/treehugger/lib/treehugger/js",
        tern: "lib/tern",
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
            "treehugger",
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

    register(null, {
        "c9.static.plugins": {}
    });
}