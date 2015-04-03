/*global requirejs*/
define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "vfs", "fs", "plugin.loader", "c9", "ext", "watcher",
        "dialog.notification", "ui", "menus", "commands", "settings", "auth",
        "installer", "find", "util"
    ];
    main.provides = ["plugin.debug"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var vfs = imports.vfs;
        var watcher = imports.watcher;
        var ext = imports.ext;
        var util = imports.util;
        var find = imports.find;
        var ui = imports.ui;
        var menus = imports.menus;
        var installer = imports.installer;
        var settings = imports.settings;
        var commands = imports.commands;
        var fs = imports.fs;
        var c9 = imports.c9;
        var auth = imports.auth;
        var loader = imports["plugin.loader"];
        var notify = imports["dialog.notification"].show;
        
        var dirname = require("path").dirname;
        var join = require("path").join;
        var async = require("async");
        
        var architect;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        // var emit = plugin.getEmitter();
        
        var ENABLED = c9.location.indexOf("debug=2") > -1;
        var HASSDK = c9.location.indexOf("sdk=0") === -1;
        
        var reParts = /^(builders|keymaps|modes|outline|runners|snippets|themes)\/(.*)/
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            if (!HASSDK) return;
            
            menus.addItemByPath("Tools/~", new ui.divider(), 100000, plugin);
            menus.addItemByPath("Tools/Developer", null, 100100, plugin);
            menus.addItemByPath("Tools/Developer/Start in Debug Mode", new ui.item({
                onclick: function(){
                    var url = location.href + (location.href.indexOf("?") > -1
                      ? "&debug=2"
                      : "?debug=2");
                    window.open(url);
                }
            }), 100100, plugin);
            
            if (!ENABLED) return;
            
            notify("<div class='c9-readonly'>You are in <span style='color:rgb(245, 234, 15)'>Debug</span> Mode. "
                + "Don't forget to open the browser's dev tools to see any errors.", 
                false);
            
            // Insert relevant LESS libraries
            var theme = settings.get("user/general/@skin");
            
            ui.defineLessLibrary(require("text!../c9.ide.layout.classic/themes/default-" + theme + ".less"), plugin);
            ui.defineLessLibrary(require("text!../c9.ide.layout.classic/less/lesshat.less"), plugin);
            
            fs.readdir("~/.c9/plugins", function(err, list){
                if (err) return console.error(err);
                
                var names = loader.plugins;
                var toLoad = [];
                
                list.forEach(function(stat){
                    var name = stat.name;
                    // If the plugin doesn't exist
                    if (names.indexOf(name) == -1 && name.charAt(0) != "." && name.charAt(0) != "_")
                        toLoad.push(name);
                });
                
                loadPlugins(toLoad);
            });
            
            commands.addCommand({
                name: "restartplugin",
                group: "Plugins",
                bindKey: { 
                    mac: "Command-Enter", 
                    win: "Ctrl-Enter" 
                },
                exec: function(){ 
                    reloadPluginUI();
                }
            }, plugin);
            
            menus.addItemByPath("Tools/Developer/Restart Plugin", new ui.item({
                command: "restartplugin"
            }), 100100, plugin);
        }
        
        /***** Methods *****/
        
        function loadPlugins(list){
            if (!vfs.connected) {
                vfs.once("connect", loadPlugins.bind(this, config));
                return;
            }
            
            var config = [];
            var count = list.length;
            
            function next(name){
                if (!name) {
                    if (--count === 0) finish();
                    return;
                }
                
                // Fetch package.json
                async.parallel([
                    function(next){
                        fs.readFile("~/.c9/plugins/" + name + "/package.json", function(err, data){
                            if (err)
                                return next(err);
                            
                            try {
                                var options = JSON.parse(data); 
                                if (!options.plugins) 
                                    throw new Error("Missing plugins property in package.json of " + name);
                            }
                            catch(e){ 
                                return next(err);
                            }
                            
                            var host = vfs.baseUrl + "/";
                            var base = join(String(c9.projectId), 
                                "plugins", auth.accessToken);
                                
                            // Start the installer if one is included
                            if (options.installer) {
                                var version = options.installer.version;
                                var url = host + join(base, name, options.installer.main);
                                installer.createVersion(name, version, function(v, o){
                                    require([url], function(fn){
                                        fn(v, o);
                                    });
                                });
                            }
                            
                            // Add the plugin to the config
                            Object.keys(options.plugins).forEach(function(path){
                                var pluginPath = name + "/" + path + ".js";
                                
                                // Watch project path
                                watch("~/.c9/plugins/" + pluginPath);
                                
                                var cfg = options.plugins[path];
                                cfg.packagePath = host + join(base, pluginPath.replace(/^plugins\//, ""));
                                cfg.staticPrefix = host + join(base, name);
                                cfg.apikey = "0000000000000000000000000000=";
                                
                                config.push(cfg);
                            });
                            
                            next();
                        });
                    },
                    function(next){
                        var path = join(c9.home, "plugins", + name);
                        var rePath = new RegExp("^" + util.escapeRegExp(path), "g");
                        find.getFileList({ 
                            path: path, 
                            nocache: true, 
                            buffer: true 
                        }, function(err, data){ 
                            if (err)
                                return next(err);
                            
                            // Remove the base path
                            data = data.replace(rePath, "");
                            
                            // Process all the submodules
                            var parallel = processModules(path, data);
                            async.parallel(parallel, function(err, data){
                                if (err)
                                    return next(err);
                                
                                // Done
                                next();
                            });
                        });
                    }
                ], function(err, results){
                    if (err) console.error(err);
                    next();
                });
            }
            
            function finish(){
                if (!config.length) return;
                
                // Load config
                if (installer.sessions.length) {
                    installer.on("stop", function(err){
                        if (err) 
                            return console.error(err);
                        finish();
                    });
                    return;
                }
                
                architect.loadAdditionalPlugins(config, function(err){
                    if (err) console.error(err);
                });
            }
            
            list.forEach(next);
        }
        
        function processModules(path, data){
            var parallel = [];
            var services = architect.services;
            
            var placeholder = new Plugin();
            
            data.split("\n").forEach(function(line){
                if (!line.match(reParts)) return;
                    
                var type = RegExp.$1;
                var filename = RegExp.$2;
                if (filename.indexOf("/") > -1) return;
                
                parallel.push(function(next){
                    fs.readFile(join(path, filename), function(err, data){
                        if (err) {
                            console.error(err);
                            return next(err);
                        }
                        
                        switch (type) {
                            case "builders":
                                data = util.safeParseJson(data, next);
                                if (!data) return;
                                
                                services.build.addBuilder(filename, data, placeholder);
                                break;
                            case "keymaps":
                                data = util.safeParseJson(data, next);
                                if (!data) return;
                                
                                services["preferences.keybindings"].addCustomKeymap(filename, data, placeholder);
                                break;
                            case "modes":
                                data = util.safeParseJson(data, next);
                                if (!data) return;
                                
                                services.ace.defineSyntax({
                                    name: join(path, "modes", data.name),
                                    caption: data.caption,
                                    extensions: (data.extensions || []).join("|")
                                });
                                break;
                            case "outline":
                                data = util.safeParseJson(data, next);
                                if (!data) return;
                                
                                services.outline.addOutlinePlugin(filename, data, placeholder);
                                break;
                            case "runners":
                                data = util.safeParseJson(data, next);
                                if (!data) return;
                                
                                services.run.addRunner(filename, data, placeholder);
                                break;
                            case "snippets":
                                services.complete.addSnippet(data, plugin);
                                break;
                            case "themes":
                                services.ace.addTheme(data, placeholder);
                                break;
                            case "template":
                                services.newresource.addFileTemplate(data, placeholder);
                                break;
                        }
                        
                        next();
                    });
                });
            });
            
            return parallel;
        }
        
        // Check if require.s.contexts._ can help watching all dependencies
        function watch(path){
            watcher.watch(path);
            
            watcher.on("change", function(e){
                if (e.path == path)
                    reloadPackage(path.replace(/^~\/\.c9\//, ""));
            });
            watcher.on("delete", function(e){
                if (e.path == path)
                    reloadPackage(path.replace(/^~\/\.c9\//, ""));
            });
            watcher.on("failed", function(e){
                if (e.path == path) {
                    setTimeout(function(){
                        watcher.watch(path); // Retries once after 1s
                    });
                }
            });
        }
        
        function reloadPackage(path){
            var unloaded = [];
            
            function recurUnload(name){
                var plugin = architect.services[name];
                unloaded.push(name);
                
                // Find all the dependencies
                var deps = ext.getDependencies(plugin.name);
                
                // Unload all the dependencies (and their deps)
                deps.forEach(function(name){
                    recurUnload(name);
                });
                
                // Unload plugin
                plugin.unload();
            }
            
            // Recursively unload plugin
            var p = architect.lut[path];
            if (p.provides) { // Plugin might not been initialized all the way
                p.provides.forEach(function(name){
                    recurUnload(name);
                });
            }
            
            // create reverse lookup table
            var rlut = {};
            for (var packagePath in architect.lut) {
                var provides = architect.lut[packagePath].provides;
                if (provides) { // Plugin might not been initialized all the way
                    provides.forEach(function(name){
                        rlut[name] = packagePath;
                    });
                }
            }
            
            // Build config of unloaded plugins
            var config = [], done = {};
            unloaded.forEach(function(name){
                var packagePath = rlut[name];
                
                // Make sure we include each plugin only once
                if (done[packagePath]) return;
                done[packagePath] = true;
                
                var options = architect.lut[packagePath];
                delete options.provides;
                delete options.consumes;
                delete options.setup;
                
                config.push(options);
                
                // Clear require cache
                requirejs.undef(options.packagePath); // global
            });
            
            // Load all plugins again
            architect.loadAdditionalPlugins(config, function(err){
                if (err) console.error(err);
            });
        }
        
        function reloadPluginUI(){
            var list = [];
            Object.keys(architect.pluginToPackage).forEach(function(name){
                if (architect.pluginToPackage[name].isAdditionalMode)
                    list.push(architect.pluginToPackage[name].path);
            });
            
            var path = list[list.length - 1];
            reloadPackage(path.replace(/^~\/\.c9\//, ""));
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
            reloadPackage: reloadPackage
        });
        
        register(null, {
            "plugin.debug": plugin
        });
    }
});