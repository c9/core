//@TODO look at jasmine instead

require(["lib/architect/architect", "lib/chai/chai", "/vfs-root"], function() {

mocha.setup('bdd');
        mocha.bail(false);
        mocha.ignoreLeaks(true);
mocha.run(done)
/*global Mocha, mocha*/
        mocha.reporter(function(runner) {
            Mocha.reporters.Base.call(this, runner);
            Mocha.reporters.HTML.call(this, runner);
            
            var tests = [];
            var stats = this.stats;
            mocha.report = { stats: stats, tests: tests };
        
            runner.on('test end', function(test) {
                stats.percent = stats.tests / runner.total * 100 | 0;
                tests.push(clean(test));
            });

            runner.on('end', function() {
                console.log(JSON.stringify(mocha.report, null, 4));
            });
            
            function parseError(err) {
                var str = err.stack || err.toString();
    
                // FF / Opera do not add the message
                if (!~str.indexOf(err.message)) {
                    str = err.message + '\n' + str;
                }
    
                // <=IE7 stringifies to [Object Error]. Since it can be overloaded, we
                // check for the result of the stringifying.
                if ('[object Error]' == str) str = err.message;
    
                // Safari doesn't give you a stack. Let's at least provide a source line.
                if (!err.stack && err.sourceURL && err.line !== undefined) {
                    str += "\n(" + err.sourceURL + ":" + err.line + ")";
                }
                return str;
            }
            function clean(test) {
                return {
                    title: test.title,
                    duration: test.duration,
                    error: test.err && parseError(test.err),
                    speed: test.speed,
                    state: test.state
                };
            }
        });

/*global requirejs*/
define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "vfs", "fs", "plugin.loader", "c9", "ext", "watcher",
        "dialog.notification"
    ];
    main.provides = ["plugin.editor"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var vfs = imports.vfs;
        var watcher = imports.watcher;
        var ext = imports.ext;
        var fs = imports.fs;
        var c9 = imports.c9;
        var loader = imports["plugin.loader"];
        var notify = imports["dialog.notification"].show;
        
        var dirname = require("path").dirname;
        
        var architect;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        // var emit = plugin.getEmitter();
        
        var ENABLED = c9.location.indexOf("debug=2") > -1;
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            if (!ENABLED) return;
            
            notify("<div class='c9-readonly'>You are in <span style='color:rgb(245, 234, 15)'>Debug</span> Mode. "
                + "Don't forget to open the browser's dev tools to see any errors.", 
                false);
            
            fs.readdir("~/.c9/plugins", function(err, list){
                if (err) return console.error(err);
                
                var names = loader.plugins;
                var toLoad = [];
                
                list.forEach(function(stat){
                    var name = stat.name;
                    // If the plugin doesn't exist
                    if (names.indexOf(name) == -1 && name.charAt(0) != ".")
                        toLoad.push(name);
                });
                
                loadPlugins(toLoad);
            });
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
                fs.readFile("~/.c9/plugins/" + name + "/package.json", function(err, data){
                    if (err) {
                        console.error(err);
                        return next();
                    }
                    
                    try{ 
                        var options = JSON.parse(data); 
                        if (!options.plugins) 
                            throw new Error("Missing plugins property in package.json of " + name);
                    }
                    catch(e){ 
                        console.error(err);
                        return next();
                    }
                    
                    options.plugins.forEach(function(path){
                        var pluginPath = "~/.c9/plugins/" + name + "/" + path + ".js";
                        var url = vfs.url(pluginPath);
                        
                        // Watch project path
                        watch(pluginPath);
                        
                        config.push({
                            packagePath: url,
                            staticPrefix: dirname(url),
                            apikey: "00000000-0000-4000-y000-" + String(config.length).pad(12, "0")
                        });
                    });
                    
                    next();
                });
            }
            
            function finish(){
                // Load config
                architect.loadAdditionalPlugins(config, function(err){
                    if (err) console.error(err);
                });
            }
            
            list.forEach(next);
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
            "plugin.editor": plugin
        });
    }
});
});