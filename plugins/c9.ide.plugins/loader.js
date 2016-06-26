/*global requirejs*/
define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "vfs", "c9", "plugin.installer", "fs", "auth",
        "preferences.experimental"
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
        var experimental = imports["preferences.experimental"];
        
        var dirname = require("path").dirname;
        var join = require("path").join;
        var async = require("async");
        var _ = require("lodash");

        var architect;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        // var emit = plugin.getEmitter();
        
        var DEBUG_MODE = c9.location.indexOf("debug=2") > -1;
        var ENABLED = DEBUG_MODE || experimental.addExperiment("plugins", false, "SDK/Load Plugins From Workspace");
        var HASSDK = DEBUG_MODE || experimental.addExperiment("sdk", false, "SDK/Load Custom Plugins");
        
        var plugins = options.plugins;
        var loadFromDisk = options.loadFromDisk

        var names = [];
        
        function load() {
            if (!HASSDK) return;
            if (!ENABLED) return;
            
            loadPlugins(plugins);
        }
        
        /***** Methods *****/

        // TODO the resolution alghoritm used here is very inefficient
        // ideally we will use a simpler method that doesn't need to scan directories
        function loadPlugins(loaderConfig){
            if (!vfs.connected) {
                vfs.once("connect", loadPlugins.bind(this, loaderConfig));
                return;
            }
            
            if (!loaderConfig.length && !loadFromDisk)
                return;

            listAllPackages(function(err, resolved) {
                if (err) return console.error(err);
                
                var extraPackages = {};
                // convert old format from db to the new one
                loaderConfig.forEach(function(p) {
                    if (!extraPackages[p.packageName]) {
                        var path = "plugins/" + p.packageName;
                        extraPackages[path] = {
                            apikey: p.apikey,
                            packagePath: path,
                            version: p.version,
                            name: p.packageName
                        };
                    }
                });
                if (!loadFromDisk) {
                    // filter packages by config instead of loading
                    // everything from disk
                    resolved = resolved.filter(function(config) {
                        if (extraPackages[config.packagePath])
                            return true;
                            
                        console.warn("[c9.ide.loader] Not loading package "
                            + config.path + " because it is not installed, "
                            + "according to the database");
                        return false;
                    });
                }
                resolved.filter(function(config) {
                    if (extraPackages[config.packagePath]) {
                        _.assign(config, extraPackages[config.packagePath], function(x, y) { return x || y });
                        delete extraPackages[config.packagePath];
                    }
                });
                Object.keys(extraPackages).forEach(function(packagePath) {
                    console.warn("[c9.ide.loader] Package " 
                        + packagePath + " should be installed, according "
                        + "to the database, but was not found on the filesystem. "
                        + "Try reinstalling it.");
                });

                async.each(resolved, loadPackage, function(err) {
                    if (err) console.error(err);
                });
            });
        }

        /**
         * List all packages on disk by scanning `~/.c9` and resolve the
         * detected packages by order of override priority:
         *
         *  - Developer plugins in `~/.c9/dev/plugins` have the highest
         *    priority to allow local development of new functionality without
         *    the risk of having your changes overwritten by any update
         *    mechanism.
         *
         *  - Managed plugins in `~/.c9/managed/plugins` are pre-installed and
         *    updated by the Cloud9 system and have a higher priority that
         *    possibly outdated or unknown packages installed by the user.
         *
         *  - User-installed in `~/.c9/plugins` plugins installed plugins are
         *    the default priority have the lowest priority.
         *
         * @param {Function} callback
         * @param {Error=} callback.err
         */
        function listAllPackages(callback) {
            async.parallel({
                "plugins" : async.apply(listPackages, "~/.c9/plugins"),
                "managed" : async.apply(listPackages, "~/.c9/managed/plugins"),
                "dev"     : async.apply(listPackages, "~/.c9/dev/plugins"),
            }, function(err, packages) {
                if (err && err.code === "EDISCONNECT") {
                    c9.once("connect", function() {
                        listAllPackages(callback);
                    });
                    return;
                }

                if (err) return callback(err);

                var resolved = {};

                // default: ~/.c9/plugins
                packages.plugins.forEach(function(config) {
                    if (!config) return;
                    resolved[config.name] = config;
                });

                // high: ~/.c9/managed/plugins
                packages.managed.forEach(function(config) {
                    if (!config) return;
                    resolved[config.name] = config;
                });

                // higher: ~/.c9/dev/plugins
                packages.dev.forEach(function(config) {
                    if (!config) return;
                    resolved[config.name] = config;
                });

                callback(null, _.values(resolved));
            });
        }

        /**
         * List packages in the given directory
         *
         * @param {String} dirPath  Path to the directory to scan
         *
         * @param {Function} callback
         * @param {Error=} callback.err
         * @param {Object[]} callback.packages
         */
        function listPackages(dirPath, callback) {
            fs.readdir(dirPath, function(err, stats) {
                if (err && err.code === "ENOENT")
                    return callback(null, []);

                if (err)
                    return callback(err);

                async.map(stats, function(stat, done) {
                    // check for folder or symlink with folder target
                    if (stat.mime !== "inode/directory"
                        && (stat.mime === "inode/symlink" && stat.linkStat.mime !== "inode/directory")
                    ) {
                        return done();
                    }

                    // check folers not prefixed with [._]
                    if (stat.name[0] === "." || stat.name[0] === "_") {
                        return done();
                    }

                    // check and load package.json
                    var config = {
                        name: stat.name,
                        path: absolutePath([dirPath, stat.name].join("/")),
                        packagePath: ["plugins", stat.name].join("/"),
                        staticPrefix: stat.href.replace(/\/$/, ""),
                    };
                    done(null, config);
                }, callback);
            });
        }

        /**
         * Load a the `package.json` metadata of the given package
         *
         * @param {Object} config  The package configuration
         *
         * @param {Function} callback
         * @param {Error=} callback.err
         * @param {Object} callback.metadata
         */
        function loadPackageMetadata(config, callback) {
            fs.readfile([config.path, "package.json" ].join("/"), function(metadataStr) {
                var metadata;

                try {
                    metadata = JSON.parse(metadataStr);
                } catch (e) {
                    return callback(e);
                }

                callback(null, metadata);
            }, function(err) {
                callback(err);
            });
        }

        /**
         * Load a the `__installed__.js` definition of the given package
         *
         * @param {Object} config  The package configuration
         *
         * @param {Function} callback
         * @param {Error=} callback.err
         * @param {Array<String|Object>} callback.installed
         */
        function loadPackageInstalledJs(config, callback) {
            var paths = {};
            paths[config.packagePath] = config.staticPrefix;

            requirejs.config({ paths: paths });
            requirejs.undef(config.packagePath, true);

            require([[config.packagePath, "__installed__"].join("/")], function(installed) {
                callback(null, installed);
            }, function(err) {
                callback(err);
            });
        }

        /**
         * Load the given package by checking its `__installed__.js` file or
         * its `package.json#plugins`, then call `Architect#loadAdditionalPlugins()`.
         *
         * @param {Object} config  The package configuration
         *
         * @param {Function} callback
         * @param {Error=} callback.err
         */
        function loadPackage(config, callback) {
            loadPackageInstalledJs(config, function addToArchitect(err, installed) {
                var plugins = installed;
                if (err) {
                    return callback(err);
                    // TODO disbled since this doesn't handle bundles and breaks debug=2
                    // loadPackageMetadata(config, function(err, metadata) {
                    //     if (err) return callback(err);
                    //     config.metadata = metadata;
                    //     var plugins = _.map(config.metadata.plugins, function(value, key) {
                    //         return [ "plugins", config.name, key ].join("/");
                    //     });
                    //     addToArchitect(err, plugins);
                    // });
                }

                var architectConfig = plugins.map(function(plugin) {
                    if (typeof plugin == "string")
                        plugin = { packagePath: plugin };

                    plugin.staticPrefix = config.staticPrefix;

                    plugin.packageName = config.name;
                    plugin.packageMetadata = config.metadata;
                    plugin.packageDir = config.path;

                    plugin.apikey = config.apikey;
                    plugin.version = config.version;

                    return plugin;
                });
                
                names.push(config.name);

                architect.loadAdditionalPlugins(architectConfig, function(err) {
                    callback(err);
                });
            });
        }

        function absolutePath(fromPath) {
            var toPath = fromPath.replace(/^~/, c9.home);
            return toPath;
        }

        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("unload", function() {
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
