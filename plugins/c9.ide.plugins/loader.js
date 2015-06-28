/*global requirejs*/
define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "vfs", "c9", "plugin.installer", "fs", "auth"
    ];
    main.provides = ["plugin.loader"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var vfs = imports.vfs;
        var c9 = imports.c9;
        var fs = imports.fs;
        var auth = imports.auth;
        var installer = imports["plugin.installer"];
        
        var dirname = require("path").dirname;
        var join = require("path").join;
        var architect;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        // var emit = plugin.getEmitter();
        
        var ENABLED = c9.location.indexOf("plugins=0") == -1;
        var HASSDK = c9.location.indexOf("sdk=0") === -1;
        
        var plugins = options.plugins;
        var loadFromDisk = options.loadFromDisk
        var names = [];
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            if (!HASSDK) return;
            if (!ENABLED) return;
            
            loadPlugins(plugins);
        }
        
        /***** Methods *****/
        
        function loadPlugins(config){
            if (!vfs.connected) {
                vfs.once("connect", loadPlugins.bind(this, config));
                return;
            }
            
            var wait = 0;
            var host = vfs.baseUrl + "/";
            var base = join(String(c9.projectId), "plugins", auth.accessToken);
            var install = [];
            
            if (loadFromDisk) {
                fs.readdir("~/.c9/plugins", function handle(err, files){
                    if (err) {
                        if (err.code == "EDISCONNECT") {
                            c9.once("connect", function(){
                                fs.readdir("~/.c9/plugins", handle);
                            });
                        }
                        console.error(err);
                        return;
                    }
                    
                    files.forEach(function(f) {
                        if (!/^[_.]/.test(f.name)) {
                            fs.exists("~/.c9/plugins/" + f.name + "/__installed__.js", function(exists) {
                                if (exists) loadOne({packageName: f.name}, false);
                            });
                        }
                    });
                });
            }
            
            var packages = {};
            config.forEach(function(options){
                var name = options.packagePath.replace(/^plugins\/([^\/]*?)\/.*$/, "$1");
                if (!packages[name]) {
                    packages[name] = {
                        packageName: name,
                        apiKey: options.apiKey
                    };
                }
                names.push(name);
            });
            
            Object.keys(packages).forEach(function(key) {
                loadOne(packages[key], false);
            });
            
            function loadOne(packageConfig, forceInstall) {
                wait++;
                
                var packageName = packageConfig.packageName;
                var root = "plugins/" + packageName;
                var paths = {};
                paths[root] = host + base + "/" + packageName;
                requirejs.config({paths: paths});
                requirejs.undef(root + "/__installed__.js");
                require([root + "/__installed__"], function(plugins) {
                    var config = plugins.map(function(p) {
                        if (typeof p == "string")
                            p = { packagePath: p };
                        p.staticPrefix = paths[root];
                        return p;
                    });
                    
                    architect.loadAdditionalPlugins(config, function(err){
                        if (err) console.error(err);
                    });
                    
                    done();
                }, function(err) {
                    if (err && forceInstall) {
                        install.push(packageName);
                    }
                    done();
                });
            }
            
            function done(){
                if (!--wait) return;
                if (install.length) {
                    installer.installPlugins(install, function(err){
                        if (err) console.error(err);
                    });
                }
            }
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("unload", function() {
            loaded = false;
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
            get plugins(){ return names; }
        });
        
        register(null, {
            "plugin.loader": plugin
        });
    }
});
