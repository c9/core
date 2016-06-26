define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "proc", "c9", "pubsub", "auth", "util", "installer",
        "preferences.experimental"
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
        var installer = imports.installer;
        var experimental = imports["preferences.experimental"];
        
        var async = require("async");
        
        var escapeShell = util.escapeShell;
        var updates = options.updates;
        var architect;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var DEBUG_MODE = c9.location.indexOf("debug=2") > -1;
        var HASSDK = DEBUG_MODE || experimental.addExperiment("sdk", false, "SDK/Load Custom Plugins");
        
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
                if (typeof item === "string") {
                    item = { name: item, version: null };
                }
                
                if (found[item.name]) return;
                found[item.name] = true;
                
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
            // Headless installation of the plugin
            installer.createSession(name, version, function(session, options){
                var cmd = [
                    "c9",
                    "install",
                    "--local",
                    "--force",
                    "--accessToken=" + auth.accessToken,
                ];
                
                if (version == null)
                    cmd.push(escapeShell(name));
                else
                    cmd.push(escapeShell(name + "@" + version));
                
                session.install({
                    "bash": cmd.join(" ")
                });
                
                // Force to start immediately
                session.start(callback, true);
            }, function(){}, 2); // Force to not be administered
        }
        
        function uninstallPlugin(name, callback){
            // Headless uninstallation of the plugin
            installer.createSession(name, -1, function(session, options){
                session.install({
                    "bash": "c9 remove --local --force --accessToken=" + auth.accessToken
                        + " " + escapeShell(name)
                });
                
                // Force to start immediately
                session.start(callback, true);
            }, function(){}, 2); // Force to not be administered
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
            installPlugin: installPlugin,
            
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