define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "proc", "c9", "pubsub", "auth", "util"
    ];
    main.provides = ["plugin.installer"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var c9 = imports.c9;
        var util = imports.util;
        var proc = imports.proc;
        var auth = imports.auth;
        var pubsub = imports.pubsub;
        
        var async = require("async");
        
        var escapeShell = util.escapeShell;
        var updates = options.updates;
        var architect;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var HASSDK = c9.location.indexOf("sdk=0") === -1;
        
        var installing;
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            if (!HASSDK) return;
            
            pubsub.on("message", function(message) {
                if (message.type != "package")
                    return;
                    
                console.log("PubSub package API message", message);
                var action = message.action;
                var body = message.body;
                
                // Only accept packages that are installed for this project
                if (body.pid && body.pid != c9.projectId)
                    return;
                
                // Only accept packages that are installed for this user
                if (body.uid && body.uid != c9.uid)
                    return;
                
                if (action == "install") {
                    installPlugins([body.config], function(){});
                }
                else if (action == "uninstall") {
                    uninstallPlugin(body.name, function(){});
                }
            });
            
            installPlugins(updates);
        }
        
        /***** Methods *****/
        
        function installPlugins(config, callback){
            // if (!vfs.connected) {
            //     vfs.once("connect", loadPackages.bind(this, config));
            //     return;
            // }
            
            if (!config.length) 
                return callback && callback();
            
            // Only run one installer at a time
            if (installing) {
                return plugin.once("finished", function(){
                    installPlugins(config, callback);
                });
            }
            
            installing = true;
            
            var found = {}, packages = [];
            config.forEach(function(item){
                if (!found[item.name])
                    found[item.name] = true;
                else return;
                
                packages.push({ name: item.name, version: item.version });
            });
            
            async.eachSeries(packages, function(pkg, next){
                installPlugin(pkg.name, pkg.version, next);
            }, function(err){
                installing = false;
                emit("finished");
                
                if (err) {
                    console.error(err.message);
                    return callback && callback(err);
                }
                
                architect.loadAdditionalPlugins(config, callback);
            });
        }
        
        function installPlugin(name, version, callback){
            proc.spawn("bash", {
                args: ["-c", ["c9", "install", "--local", "--force", "--accessToken=" + auth.accessToken, escapeShell(name) + "@" + escapeShell(version)].join(" ")]
            }, function(err, process){
                if (err) return callback(err);
                
                var output = "";
                process.stdout.on("data", function(c){
                    output += c;
                });
                process.stderr.on("data", function(c){
                    output += c;
                });
                
                process.on("exit", function(code){
                    if (code) {
                        var error = new Error(output);
                        error.code = code;
                        return callback(error);
                    }
                    callback();
                });
            });
        }
        
        function uninstallPlugin(name, callback){
            proc.spawn("c9", {
                args: ["remove", "--local", "--force", "--accessToken=" + auth.accessToken, escapeShell(name)]
            }, function(err, process){
                if (err) return callback(err);
                
                var res = null;
                process.stdout.on("data", function(c){
                    res = c.toString("utf8");
                });
                process.stderr.on("data", function(c){
                    err = c.toString("utf8");
                });
                
                process.on("exit", function(code){
                    if (code) {
                        var error = new Error(err);
                        error.code = code;
                        return callback(error);
                    }
                    callback(null, res);
                });
            });
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("unload", function() {
            loaded = false;
            installing = false;
        });
        
        /***** Register and define API *****/
        
        /**
         * 
         **/
        plugin.freezePublicAPI({
            /**
             * 
             */
            get architect(){ throw new Error(); },
            set architect(v){ architect = v; },
            
            /**
             * 
             */
            installPlugins: installPlugins,
            
            /**
             * 
             */
            uninstallPlugin: uninstallPlugin
        });
        
        register(null, {
            "plugin.installer": plugin
        });
    }
});