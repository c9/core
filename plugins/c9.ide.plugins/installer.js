define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "proc", "c9", "pubsub", "auth"
    ];
    main.provides = ["plugin.installer"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var c9 = imports.c9;
        var proc = imports.proc;
        var auth = imports.auth;
        var pubsub = imports.pubsub;
        
        var updates = options.updates;
        var architect;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        // var emit = plugin.getEmitter();
        
        var HASSDK = c9.location.indexOf("sdk=0") === -1;
        
        var queue = [];
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
            
            if (!config.length) return;
            
            var found = {};
            config.forEach(function(item){
                if (!found[item.packageName])
                    found[item.packageName] = true;
                else return;
                
                queue.push({ name: item.packageName, version: item.version });
                
                if (installing)
                    installing.push(item);
            });
            
            if (installing) return;
            installing = config;
            
            var i = 0;
            function next(err){
                if (err) console.log(err);
                
                if (!queue[i]) {
                    installing = false; queue = [];
                    architect.loadAdditionalPlugins(config, callback);
                    return;
                }
                
                installPlugin(queue[i].name, queue[i].version, next);
                i++;
            }
            
            next();
        }
        
        function installPlugin(name, version, callback){
            proc.spawn("bash", {
                args: ["-c", ["c9", "install", "--local", "--force", "--accessToken=" + auth.accessToken, name + "@" + version].join(" ")]
            }, function(err, process){
                if (err) return callback(err);
                
                process.stdout.on("data", function(c){
                    console.log(c);
                });
                process.stderr.on("data", function(c){
                    console.error(c);
                });
                
                process.on("exit", function(code){
                    if (code) {
                        var error = new Error(err);
                        error.code = code;
                        return callback(error);
                    }
                    callback();
                });
            });
        }
        
        function uninstallPlugin(name, callback){
            proc.spawn("c9", {
                args: ["remove", "--local", "--force", "--accessToken=" + auth.accessToken, name]
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
        plugin.on("enable", function() {
            
        });
        plugin.on("disable", function() {
            
        });
        plugin.on("unload", function() {
            loaded = false;
            installing = false;
            queue = [];
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