/*global requirejs*/
define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "vfs", "fs", "plugin.loader", "c9", "ext", "watcher",
        "dialog.notification", "dialog.info", "ui", "menus", "commands", "settings", "auth",
        "installer", "find", "util", "preferences.experimental"
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
        var experimental = imports["preferences.experimental"];
        var showInfo = imports["dialog.info"].show;
        
        var dirname = require("path").dirname;
        var basename = require("path").basename;
        var join = require("path").join;
        var async = require("async");
        
        var architect;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var plugins = [];
        
        var ENABLED = c9.location.indexOf("debug=2") > -1;
        var HASSDK = ENABLED || experimental.addExperiment("sdk", false, "SDK/Load Custom Plugins");
        
        var reParts = /^(builders|keymaps|modes|outline|runners|snippets|themes|templates)\/(.*)/;
        var reModule = /(?:_highlight_rules|_test|_worker|_fold|_behaviou?r)\.js$/;
        var jsExtRe = /\.js$/;
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            if (!HASSDK) return;
            
            menus.addItemByPath("Tools/~", new ui.divider(), 100000, plugin);
            menus.addItemByPath("Tools/Developer", null, 100100, plugin);
            
            if (!ENABLED) {
                menus.addItemByPath("Tools/Developer/Start in Debug Mode", new ui.item({
                    onclick: function(){
                        var url = location.href + (location.href.indexOf("?") > -1
                          ? "&debug=2"
                          : "?debug=2");
                        window.open(url);
                    }
                }), 900, plugin);
            }
            
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
                name: "reloadCustomPlugin",
                group: "Plugins",
                bindKey: { 
                    mac: "Command-Enter", 
                    win: "Ctrl-Enter" 
                },
                exec: function(){ 
                    reloadPluginUI();
                }
            }, plugin);
            
            menus.addItemByPath("Tools/Developer/Reload Custom Plugin", new ui.item({
                command: "reloadCustomPlugin"
            }), 1000, plugin);
        }
        
        /***** Methods *****/
        
        function loadPlugins(list){
            if (!vfs.connected) {
                vfs.once("connect", loadPlugins.bind(this, config));
                return;
            }
            
            if (typeof list == "string")
                list = [list];
            
            var config = [];
            var loadConfig = function(){
                architect.loadAdditionalPlugins(config, function(err){
                    if (err) console.error(err);
                });
            };
            
            async.each(list, function(name, next){
                var resourceHolder = new Plugin();
                var resourceVersion = "";
                
                resourceHolder.on("load", function(){ 
                    if (inited) load();
                });
                
                resourceHolder.freezePublicAPI({
                    get version(){ return resourceVersion },
                    set version(v){ resourceVersion = v; }
                });
                
                var inited = false;
                function load(){
                    async.parallel([
                        function(next){
                            // Fetch package.json
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
                                
                                // Configure Require.js
                                var pathConfig = {};
                                pathConfig["plugins/" + name] = host + join(base, name);
                                requirejs.config({ paths: pathConfig });
                                
                                // Add the plugin to the config
                                Object.keys(options.plugins).forEach(function(path){
                                    var pluginPath = name + "/" + path;
                                    
                                    // Watch project path
                                    watch("~/.c9/plugins/" + pluginPath);
                                    var cfg = options.plugins[path];
                                    cfg.packagePath = "plugins/" + name + "/" + path;
                                    cfg.staticPrefix = host + join(base, name);
                                    cfg.apikey = "0000000000000000000000000000=";
                                    
                                    // Set version for package manager
                                    cfg.version = options.version;
                                    
                                    config.push(cfg);
                                    plugins.push(name + "/" + path);
                                });
                                
                                // Set version for package manager
                                resourceHolder.version = options.version;
                                
                                // Start the installer if one is included
                                if (options.installer) {
                                    addStaticPlugin("installer", name, options.installer,
                                        null, resourceHolder);
                                }
                                
                                next();
                            });
                        },
                        function(next){
                            var path = join("~/.c9/plugins", name);
                            var rePath = new RegExp("^" + util.escapeRegExp(path.replace(/^~/, c9.home) + "/"), "gm");
                            find.getFileList({ 
                                path: path, 
                                nocache: true, 
                                buffer: true 
                            }, function(err, data){ 
                                if (err)
                                    return next(err);
                                
                                // Remove the base path
                                data = data.replace(rePath, "");
                                
                                if (data.match(/^__installed__.js/))
                                    return next("installed");
                                
                                // Process all the submodules
                                var parallel = processModules(path, data, resourceHolder);
                                async.parallel(parallel, function(err, data){
                                    if (err)
                                        return next(err);
                                    
                                    if (!inited)
                                        resourceHolder.load(name + ".bundle");
                                    
                                    // Done
                                    next();
                                });
                            });
                        }
                    ], function(err, results){
                        if (err) console.error(err);
                        
                        if (!inited) {
                            next();
                            inited = true;
                        }
                    });
                }
                
                load();
            }, function(){
                emit.sticky("ready");
                
                if (!config.length) return;
                
                // Load config
                if (installer.sessions.length) {
                    installer.on("stop", function listen(err){
                        if (err) 
                            return console.error(err);
                        
                        if (!installer.sessions.length) {
                            loadConfig();
                            installer.off("stop", listen);
                        }
                    });
                    return;
                }
                
                loadConfig();
            });
        }
        
        function processModules(path, data, plugin){
            var parallel = [];
            
            data.split("\n").forEach(function(line){
                if (!line.match(reParts)) return;
                    
                var type = RegExp.$1;
                var filename = RegExp.$2;
                if (filename.indexOf("/") > -1) return;
                
                if (type == "modes" && (reModule.test(filename) || !jsExtRe.test(filename)))
                    return;
                
                if (type == "snippets") {
                    if (jsExtRe.test(filename)) {
                        var snippetPath = join("plugins", basename(path), type, filename).replace(jsExtRe, "");
                        require([snippetPath], function(m) {
                            architect.services["language.complete"].addSnippet(m, plugin);
                        });
                    }
                    if (!/\.snippets$/.test(filename))
                        return;
                }
                
                parallel.push(function(next){
                    fs.readFile(join(path, type, filename), function(err, data){
                        if (err) {
                            console.error(err);
                            return next(err);
                        }
                        
                        addStaticPlugin(type, basename(path), filename, data, plugin);
                        
                        next();
                    });
                });
            });
            
            return parallel;
        }
        
        function addStaticPlugin(type, pluginName, filename, data, plugin) {
            var services = architect.services;
            var path = "plugins/" + pluginName + "/" 
                + (type == "installer" ? "" : type + "/") 
                + filename.replace(/\.js$/, "");
            
            var bundleName = pluginName + ".bundle";
            if (!services[bundleName] && type !== "installer") {
                services[bundleName] = plugin;
                architect.lut["~/.c9/plugins/" + pluginName] = {
                    provides: []
                };
                architect.pluginToPackage[bundleName] = {
                    path: "~/.c9/plugins/" + pluginName,
                    package: pluginName,
                    version: plugin.version,
                    isAdditionalMode: true
                };
                if (!architect.packages[pluginName])
                    architect.packages[pluginName] = [];
                architect.packages[pluginName].push(name);
            }
            
            switch (type) {
                case "builders":
                    data = util.safeParseJson(data, function() {});
                    if (!data) return;
                    
                    services.build.addBuilder(filename, data, plugin);
                    break;
                case "keymaps":
                    data = util.safeParseJson(data, function() {});
                    if (!data) return;
                    
                    services["preferences.keybindings"].addCustomKeymap(filename, data, plugin);
                    break;
                case "modes":
                    var mode = {};
                    var firstLine = data.split("\n", 1)[0].replace(/\/\*|\*\//g, "").trim();
                    firstLine.split(";").forEach(function(n){
                        if (!n) return;
                        var info = n.split(":");
                        mode[info[0].trim()] = info[1].trim();
                    });
                    
                    services.ace.defineSyntax({
                        name: path,
                        caption: mode.caption,
                        extensions: (mode.extensions || "").trim()
                            .replace(/\s*,\s*/g, "|").replace(/(^|\|)\./g, "$1")
                    });
                    break;
                case "outline":
                    if (!data) return;
                    
                    services.outline.addOutlinePlugin(path, data, plugin);
                    break;
                case "runners":
                    data = util.safeParseJson(data, function() {});
                    if (!data) return;
                    
                    services.run.addRunner(data.caption || filename, data, plugin);
                    break;
                case "snippets":
                    services["language.complete"].addSnippet(data, plugin);
                    break;
                case "themes":
                    services.ace.addTheme(data, plugin);
                    break;
                case "templates":
                    services.newresource.addFileTemplate(data, plugin);
                    break;
                case "installer":
                    if (data) {
                        installer.createSession(pluginName, data, function(v, o){
                            require([path], function(fn){
                                fn(v, o);
                            });
                        });
                    }
                    else {
                        require([path], function(fn){
                            installer.createSession(pluginName, fn.version, function(v, o){
                                fn(v, o);
                            });
                        });
                    }
            }
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
            
            // Avoid confusion with "Reload Last Plugin"
            var href = document.location.href.replace(/[?&]reload=[^&]+/, "");
            window.history.replaceState(window.history.state, null, href);
            showInfo("Reloaded " + path + ".", 1000);
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
            get plugins(){ return plugins; },
            
            _events: [
                /**
                 * @event ready
                 */
                "ready"
            ],
            
            /**
             * 
             */
            addStaticPlugin: addStaticPlugin,
            
            /**
             * 
             */
            reloadPackage: reloadPackage,
            /**
             * 
             */
            loadPackage: loadPlugins
        });
        
        register(null, {
            "plugin.debug": plugin
        });
    }
});
