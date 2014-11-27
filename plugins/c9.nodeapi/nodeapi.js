/**
 * Server nodejs library files to the client
 *
 * @copyright 2010, Ajax.org B.V.
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */

"use strict";
    
main.consumes = ["Plugin", "connect.static"];
main.provides = ["c9.static.node"];
module.exports = main;

function main(options, imports, register) {
    var Plugin = imports.Plugin;
    var statics = imports["connect.static"];
    
    /***** Initialization *****/
    
    var fs = require("fs");
    var dirname = require("path").dirname;
    
    var plugin = new Plugin("Ajax.org", main.consumes);
    
    var loaded = false;
    function load(){
        if (loaded) return false;
        loaded = true;
        
        var modules = fs.readdirSync(__dirname)
            .filter(function(file) {
                return file.match(/\.js$/) && !file.match(/_test\.js$/) && file !== "nodeapi.js";
            })
            .map(function(file) {
                return file.slice(0, -3);
            });
            
        statics.addStatics([{
            path: __dirname,
            mount: "/lib",
            rjs: modules.reduce(function(map, module) {
                map[module] = {
                    "name": module,
                    "location": "lib",
                    "main": module + ".js"
                };
                return map;
            }, {})
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
        "c9.static.node": plugin
    });
}