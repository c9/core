/**
 * Additional static files for the the smith.io client plugin
 *
 * @copyright 2013, Ajax.org B.V.
 */

main.consumes = ["Plugin", "connect.static"];
main.provides = ["smithio.server"];

module.exports = main;

function main(options, imports, register) {
    var Plugin = imports.Plugin;
    var statics = imports["connect.static"];
    
    var fs = require("fs");
    var dirname = require("path").dirname;
    
    /***** Initialization *****/
    
    var plugin = new Plugin("Ajax.org", main.consumes);
    
    var loaded = false;
    function load(){
        if (loaded || options.disableUnpackagedClient) return false;
        loaded = true;
        
        // TODO: big hack. Patch engine.io client to disable 'withCredentials"
        var eioClient = require.resolve("engine.io-client/engine.io.js");
        try {
            fs.writeFileSync(eioClient, fs.readFileSync(eioClient, "utf8").replace("xhr.withCredentials = true;", "xhr.__withCredentials = true;"));
        } catch (e) {
            console.warn("unable to patch engine.io");
        }
      
        statics.addStatics([{
            path: dirname(eioClient),
            mount: "/engine.io",
            rjs: [{
                "name": "engine.io",
                "location": "engine.io",
                "main": "engine.io.js"
            }]
        }]);

        statics.addStatics([{
            path: dirname(require.resolve("kaefer/lib/client")),
            mount: "/kaefer",
            rjs: [{
                "name": "kaefer",
                "location": "kaefer",
                "main": "client.js"
            }]
        }]);
        
        statics.addStatics([{
            path: dirname(require.resolve("smith")),
            mount: "/smith",
            rjs: [{
                "name": "smith",
                "location": "smith",
                "main": "smith.js"
            }]
        }]);
        
        statics.addStatics([{
            path: dirname(require.resolve("vfs-socket/consumer")),
            mount: "/vfs-socket",
            rjs: [{
                "name": "vfs-socket",
                "location": "vfs-socket"
            }]
        }]);

        statics.addStatics([{
            path: dirname(require.resolve("msgpack-js-browser")),
            mount: "/msgpack-js",
            rjs: [{
                "name": "msgpack-js",
                "location": "msgpack-js",
                "main": "msgpack.js"
            }]
        }]);
        
    }
    
    /***** Lifecycle *****/
    
    plugin.on("load", function(){
        load();
    });
    
    /***** Register and define API *****/
    
    plugin.freezePublicAPI({});
    
    register(null, {
        "smithio.server": plugin
    });
}