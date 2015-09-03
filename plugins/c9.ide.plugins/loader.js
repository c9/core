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
        var async = require("async");
        var _ = require("lodash");

        var architect;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        // var emit = plugin.getEmitter();
        
        var ENABLED = (c9.location.indexOf("plugins=0") === -1);
        var HASSDK = (c9.location.indexOf("sdk=0") === -1);
        
        var plugins = options.plugins;
        var loadFromDisk = options.loadFromDisk

        var names = [];
        
        function load() {
            if (!HASSDK) return;
            if (!ENABLED) return;
            
            loadPlugins(plugins);
        }
        
        /***** Methods *****/

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
                        path: absolutePath([ dirPath, stat.name ].join("/")),
                        packagePath: [ "plugins", stat.name ].join("/"),
                        staticPrefix: stat.href.replace(/\/$/, ""),
                    };

                    loadPackageMetadata(config, function(err, metadata) {
                        if (err) return done(err);
                        config.metadata = metadata;
                        done(null, config);
                    });
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
            var paths = {};
            paths[config.packagePath] = config.staticPrefix;

            requirejs.config({ paths: paths });
            requirejs.undef([config.packagePath, "package.json"].join("/"));

            require([("text!" + [config.packagePath, "package.json" ].join("/"))], function(metadataStr) {
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
            requirejs.undef([config.packagePath, "__installed__.js"].join("/"));

            require([[config.packagePath, "__installed__" ].join("/")], function(installed) {
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
            loadPackageInstalledJs(config, function(err, installed) {
                var plugins;

                if (err) {
                    plugins = _.map(config.metadata.plugins, function(value, key) {
                        return [ "plugins", config.name, key ].join("/");
                    });
                } else {
                    plugins = installed;
                }

                var architectConfig = installed.map(function(plugin) {
                    if (typeof plugin == "string")
                        plugin = { packagePath: plugin };

                    plugin.staticPrefix = config.staticPrefix;

                    plugin.packageName = config.name;
                    plugin.packageMetadata = config.metadata;
                    plugin.packageDir = config.path;

                    plugin.apiKey = null; // FIXME

                    return plugin;
                });

                architect.loadAdditionalPlugins(architectConfig, function(err) {
                    callback(err);
                });
            });
        }

        function loadPlugins(loaderConfig){
            if (!vfs.connected) {
                vfs.once("connect", loadPlugins.bind(this, loaderConfig));
                return;
            }

            listAllPackages(function(err, resolved) {
                if (err) return console.error(err);
                
                if (!loadFromDisk) {
                    // filter packages by config instead of loading
                    // everything from disk

                    resolved = resolved.filter(function(config) {
                        var extraConfig = _.find(loaderConfig, { packagePath: config.packagePath });

                        if (!extraConfig) {
                            console.warn("[c9.ide.loader] Not loading package "
                                + config.path + " because it is not installed, "
                                + "according to the database");

                            return false;
                        }

                        config.apiKey = extraConfig.apiKey;

                        return true;
                    });
                }

                loaderConfig.forEach(function(extraConfig) {
                    // warn about missing packages which are supposed to be installed

                    if (!_.find(resolved, { packagePath: extraConfig.packagePath })) {
                        console.warn("[c9.ide.loader] Package "
                            + extraConfig.packagePath + " should be installed, according "
                            + "to the database, but was not found on the filesystem. "
                            + "Try reinstalling it.");
                    }
                });

                names = _.pluck(resolved, "name");

                async.each(resolved, loadPackage, function(err) {
                    if (err) console.error(err);
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
