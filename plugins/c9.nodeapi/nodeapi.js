/**
 * Server nodejs library files to the client
 *
 * @copyright 2010, Ajax.org B.V.
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */

"use strict";
    
main.consumes = ["connect.static"];
main.provides = ["c9.static.node"];
module.exports = main;

function main(options, imports, register) {
    var statics = imports["connect.static"];
    
    /***** Initialization *****/
    
    var fs = require("fs");

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
    
    register(null, {
        "c9.static.node": {}
    });
}