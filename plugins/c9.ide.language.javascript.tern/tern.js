define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "language",
        "language.tern.architect_resolver", // implicit worker-side dependency
        "settings"
    ];
    main.provides = ["language.tern"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var language = imports.language;
        var settings = imports.settings;
        var builtinDefs = JSON.parse(require("text!lib/tern_from_ts/defs/__list.json")).defs;
        var builtinTrusted = [
            "meteor"
        ];
        var builtinsBroken = [
            /mocha.*/, /jquery.*/, /[\.-]/
        ];
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var defaultPlugins = options.plugins;
        var defaultDefs = options.defs || [];
        
        var defs = {};
        var preferenceDefs = {};
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            language.registerLanguageHandler("plugins/c9.ide.language.javascript.tern/worker/tern_worker");

            for (var def in builtinDefs) {
                if (builtinsBroken.some(function(b) {
                    return b.test(def);
                }))
                    continue;
                registerDef(
                    def,
                    "lib/tern_from_ts/defs/" + builtinDefs[def].main,
                    // TODO: register "extra" defs?
                    {
                        experimental: builtinTrusted.indexOf(def) == -1,
                        url: builtinDefs[def].url
                    }
                );
            }
                   
            getPlugins(function(err, plugins) {
                if (err) return console.error(err);
                
                setPlugins(plugins.concat(defaultPlugins));
            });

            language.getWorker(function(err, worker) {
                if (err) return console.error(err);
                
                var config = settings.getJson("project/language/tern_defs");
                var resetConfig = !config;
                if (resetConfig)
                    config = {};
                
                // TODO: add these plugins as options to the preferences
                // registerDef("angular", "tern/plugin/angular", { url: "https://angularjs.org/", isPlugin: true });
                // registerDef("node", "tern/plugin/angular", { url: "https://angularjs.org/", isPlugin: true });
                // registerDef("requirejs", "tern/plugin/angular", { url: "https://angularjs.org/", isPlugin: true });
                
                // var defsToAdd = [];
                defaultDefs.forEach(function(def) {
                    if (resetConfig && def.enabled)
                        config[def.name] = { enabled: true };
                    else
                        def.enabled = config[def.name] && config[def.name].enabled;
                    def.default = true;
                    
                    if (defs[def.name]) // skip builtins already added
                        return;
    
                    registerDef(def.name, def.path, def);
                });
                for (var key in config) {
                    if (config[key].enabled && defs[key] && !defs[key].default)
                        setDefEnabled(key, true);
                }
                settings.setJson("project/language/tern_defs", config);
                emit.sticky("ready");
            });
        }
                    
        function registerDef(name, def, options) {
            options = options || {};
            options.name = name;
            defs[name] = def;
            preferenceDefs[name] = options;
            if (options.enabled)
                setDefEnabled(name, true, options);
        }

        function setDefEnabled(name, enabled, options) {
            if (!defs[name] && !defaultPlugins[name])
                throw new Error("Definition " + name + " not found");
            
            language.getWorker(function(err, worker) {
                if (err) return console.error(err);
                
                worker.emit("tern_set_def_enabled", { data: {
                    name: name,
                    def: defs[name],
                    enabled: enabled !== false,
                    options: options,
                }});
            });
        }
        
        function setPluginEnabled(plugin, enabled) {
            plugin.enabled = plugin;
            getPlugins(function(err, plugins) {
                if (err) return console.error(err);
                
                setPlugins(plugins.filter(function(p) {
                    return p.name !== plugin;
                }).concat(plugin));
            });
        }
        
        function setTernServerOptions(ternServerOptions) {
            language.getWorker(function(err, worker) {
                if (err) return console.error(err);
                worker.emit("tern_set_server_options", { data: ternServerOptions });
            });
        }
        
        function getPlugins(callback) {
            language.getWorker(function(err, worker) {
                if (err) return console.error(err);
                worker.on("tern_read_plugins", function tern_read_plugins(e) {
                    var backupPluginStatus;
                    worker.off("tern_read_plugins", tern_read_plugins);
                    backupPluginStatus = JSON.stringify(e.data);
                    callback(null, e.data);
                    
                    // FIXME: remove this strange implicit setter behavior of getPlugins()
                    if (JSON.stringify(e.data) != backupPluginStatus) {
                        // state of plugins have changed, update ternWorker
                       setPlugins(e.data);
                    }
                });
                worker.emit("tern_get_plugins", { data: null });
            });
        }
        
        function setPlugins(plugins) {
            language.getWorker(function(err, worker) {
                if (err) return console.error(err);
                worker.emit("tern_update_plugins", { data: plugins });
            });
        }
        
        function setTernRequestOptions(ternRequestOptions) {
            language.getWorker(function(err, worker) {
                if (err) return console.error(err);
                worker.emit("tern_set_request_options", { data: ternRequestOptions });
            });

        }
        
        function getDefs() {
            return preferenceDefs;
        }
        
        plugin.on("load", load);
        plugin.on("unload", function() {
            loaded = false;
            defs = {};
            preferenceDefs = {};
        });
        
        /**
         * Tern code completion plugin.
         */
        plugin.freezePublicAPI({
            /**
             * Callback function for getting tern definition list from directly tern server
             * @typedef {Object} pluginInfo
             * @property {String} name - name of the plugin
             * @property {boolean} enabled - Setting it false marks plugin for removal
             * @property {String} path - Parameter to provide while loading a new plugin
             *
             * This callback is to retrieve names of definitions
             * @callback getTernDefNamesCallback
             * @param {Array.String} names Array of names
             */

            /**
             * Add a tern definition that users can enable.
             * @param {String} name
             * @param {String|Object} def              The definition or a URL pointing to the definiton
             * @param {Object} [options]
             * @param {Boolean} [options.enabled]      Whether to enable this definition by default
             * @param {Boolean} [options.hidden]       Hide this definition from the preferences UI
             */
            registerDef: registerDef,
            
            /**
             * Enable or disable a definition.
             * @param name
             * @param {Boolean} enabled
             * @param {Object} [options]
             * @param {Boolean} [options.firstClass]
             *       Treat as if these were built-in types,
             *       showing nicer icons and hiding the library name.
             */
            setDefEnabled: setDefEnabled,
            
            /**
             * Sets tern server options
             * @param {Object} ternServerOptions
             */
            setTernServerOptions: setTernServerOptions,
             
             /**
              * Gets list of loaded tern plugins.
              * 
              * @param {Function} callback required function to process status of plugins
              * @param {Object} callback.err
              * @param {Object[]} callback.results
              */
            getPlugins: getPlugins,
             
             /**
              * Sets list of loaded tern plugins.
              * 
              * @param {Object[]} plugins
              */
            setPlugins: setPlugins,
            
            /**
             * Enable or disable a plugin.
             * @param name
             * @param {Boolean} enabled
             */
             setPluginEnabled: setPluginEnabled,
            
            /**
             * Sets tern request options
             * @param {Object} ternRequestOptions
             */
            setTernRequestOptions: setTernRequestOptions,
            
            /**
             * Get a list of all definitions.
             * @return {String[]}
             */
            getDefs: getDefs
        });
        
        register(null, {
            "language.tern": plugin
        });
    }

});