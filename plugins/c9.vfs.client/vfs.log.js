/** Sends client side logs to vfs via the websocket connection **/

define(function (require, exports, module) {
    "use strict";
    
    main.consumes = ["Plugin", "ext", "c9"];
    main.provides = ["vfs.log"];
    return main;
    
    function main(options, imports, register) {
        var Plugin = imports.Plugin; 
        var c9 = imports.c9;
        var ext = imports.ext;
        var plugin = new Plugin("Ajax.org", main.consumes);
        
        var loaded = false;
        var server = null;
        
        function load() {
            if (loaded) return false;
            loaded = true;
            
            if (c9.readonly) return false;
            
            ext.loadRemotePlugin("log", {
                code: require("text!./log-service.js"),
                redefine: true
            }, function(err, remote) {
                if (err) return console.error(err);
                
                server = remote;
            });
            
            c9.on("stateChange", function(e) {
                if (e.state & c9.NETWORK) {
                    load();
                }
                else {
                    loaded = false;
                    server = null;
                }
            }, plugin);
            
        }
        
        
        function log() {
            if (!server) return console.error("Cannot log, client is offline");
            var callback = function(){};
            
            var args = Array.prototype.slice.call(arguments);
            if (typeof args[args.length-1] === "function") {
                callback = args.splice(args.length-1, 1);
            }
            
            var message = "";
            args.forEach(function (arg) {
                if (typeof arg === "object") {
                    return message += JSON.stringify(arg);
                }
                message += arg;
            });
                
            server.log(message, callback);
        }
        
        plugin.on("load", function() {
            load();
        });
        
        plugin.on("unload", function() {
            loaded = false;
            server = null;
        });
        
        plugin.freezePublicAPI({
            log: log
        });
        
        register(null, {
            "vfs.log": plugin
        });
    }
})