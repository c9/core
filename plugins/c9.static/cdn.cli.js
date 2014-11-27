define(function(require, exports, module) {
    "use strict";
    
    main.consumes = ["cdn.build"];
    return main;

    function main(options, imports, register) {
        var build = imports["cdn.build"];
        
        var fs = require("fs");
        var path = require("path");
        var mkdirp = require("mkdirp");
        var async = require("async");

        var root = path.join(build.cacheDir, build.version);
        
        var cache = {};
        build.setCache(cache);

        build.getPathConfig(build.version, function(err, pathConfig) {
            if (err) return done(err);
            var pending = 1;
            
            if (options.skin && options.config) {
                build.buildSkin(options.config, options.skin, pathConfig, save(["skin", options.config, options.skin + ".css"]));
            } else if (options.config) {
                var configs = options.config.split(/,\s*/);
                var configCache = options.skipDuplicates && {duplicates: []};
                var usedPlugins = options.copyStaticResources && Object.create(null);
                
                (function buildConfig() {
                    var config = configs.shift();
                    if (!config) {
                        var series = [];
                        if (usedPlugins)
                            series.push(copyStaticResources.bind(null, usedPlugins, pathConfig));
                        if (configCache && configCache.duplicates.length)
                            series.push(fs.writeFile.bind(fs, path.join(root, "config", "duplicates"), configCache.duplicates.join(" "), "utf8"));
                        series.push(done.bind(null, null));
                        return async.series(series);
                    }
                    var skins = options.withSkins;
                    if (skins === true || skins === "all")
                        skins = ["dark", "light", "dark-gray", "light-gray", "flat-light"];
                    else
                        skins = skins ? skins.split(/,\s*/) : [];
                    
                    build.buildConfig(config, pathConfig, save(["config", path.basename(config) + ".js"], function next() {
                        var skin = skins.pop();
                        if (!skin) return buildConfig();
                        build.buildSkin(config, skin, pathConfig, save(["skin", config, skin + ".css"], next));
                    }), function(configName, data) {
                        var pluginPaths = data.map(function(p) {
                            return typeof p == "string" ? p : p.packagePath;
                        }).filter(Boolean).sort();
                        
                        if (usedPlugins) {
                            pluginPaths.forEach(function(p) {
                                usedPlugins[p] = true;
                            });
                        }
                        
                        if (!configCache) return;
                        
                        if (!configCache.defaultConfig) {
                            configCache.defaultConfig = Object.create(null);
                            pluginPaths.forEach(function(p) {
                                configCache.defaultConfig[p] = true;
                            });
                            return false;
                        }
                        
                        var isDuplicate = pluginPaths.every(function(p) {
                            return configCache.defaultConfig[p];
                        });
                        
                        if (!isDuplicate) return false;
                        
                        configCache.duplicates.push(configName);
                        process.nextTick(buildConfig);
                        return true;
                    });
                })();
                
            } else if (options.worker) {
                build.buildWorker(options.worker, pathConfig, save(["worker", options.worker + ".js"]));
            } else if (options.module) {
                if (options.module === "ace") {
                    listAceModules(pathConfig, function(module, next) {
                        if (next) pending++;
                        build.buildAce(module, pathConfig, function(err, result) {
                            save(["modules", module + ".js"], function(err) {
                                warn(err);
                                done();
                            })(err, result);
                            if (next) process.nextTick(next); // start building next without waiting for write
                        });
                    });
                } else if (options.module.match(/^ace\//)) {
                    build.buildAce(options.module, pathConfig, save(["modules", options.module + ".js"]));
                } else {
                    build.buildModule(options.module, pathConfig, save(["modules", options.module + ".js"]));
                }
            } else {
                done(new Error("unknown action"));
            }
            
            function warn(err) {
                if (err) console.warn(err);
            }
            
            function save(nameParts, cb) {
                return function(err, result) {
                    if (err) return cb(err);
                    var code = result.code;
                    nameParts.unshift(root);

                    writeFile(nameParts, code, cb || done);

                    if (result.sources && options.compressOutputDirPrefix) {
                        // compress and save in parallel
                        pending++;
                        var compress = require("architect-build/compress");
                        code = compress.withCache(result.sources, {
                            cache: cache,
                            obfuscate: options.obfuscate,
                            exclude: /(jsoniq|xquery)\.js$/
                        }).code;
                        nameParts[0] += "/" + options.compressOutputDirPrefix;
                        writeFile(nameParts, code, done);
                    }
                };
            }
            
            function writeFile(filename, code, cb) {
                if (typeof filename != "string")
                    filename = path.join.apply(path, filename);
                mkdirp(path.dirname(filename), function(err) {
                    if (err) return cb(err);
                    fs.writeFile(filename, code, "utf8", function(err) {
                        if (err) return cb(err);
                        console.log("file saved at", filename);
                        cb && cb();
                    });
                });
            }
            
            function done(err) {
                if (err) {
                    console.error(err);
                    process.exit(1);
                }
                pending--;
                if (pending <= 0)
                    process.exit();
            }
        });
        function listAceModules(pathConfig, cb) {
            // build async loaded ace modules
            var aceModules = ["vim", "emacs", "sublime"].map(function(x) {
                return "plugins/c9.ide.ace.keymaps/" + x + "/keymap";
            });
            var acePath = __dirname + "/../../node_modules/ace/lib/ace";
            function addAceModules(type, excludePattern) {
                var files = fs.readdirSync(acePath + "/" + type);
                files.filter(function(p) {
                    return !excludePattern.test(p) && !/[\s#]/.test(p) && /.*\.js$/.test(p);
                }).forEach(function(p) {
                    aceModules.push("ace/" + type + "/" + p.slice(0, -3));
                });
            }
            addAceModules("mode", /_highlight_rules|_test|_worker|xml_util|_outdent|behaviour|completions/);
            addAceModules("theme", /_test/);
            addAceModules("ext", /_test/);
            addAceModules("snippets", /_test/);
            
            function take() {
                var p = aceModules.pop();
                console.log("building ", p, aceModules.length);
                cb(p, aceModules.length && take);
            }
            take();
        }
        function copyStaticResources(usedPlugins, pathConfig, next) {
            var moduleDeps = require("architect-build/module-deps");
            var copy = require('architect-build/copy');
            // hack: add bootstrap.js manually since it is included only from html
            usedPlugins["/plugins/c9.login.client/bootstrap"] = 1;
            function collectDirs(plugins) {
                var map = Object.create(null);
                plugins.forEach(function(p) {
                    map[path.dirname(p)] = 1;
                });
                return Object.keys(map);
            }
            collectDirs(Object.keys(usedPlugins)).forEach(function(p) {
                var absPath = moduleDeps.resolveModulePath(p, pathConfig.pathMap);
                copy(absPath, root + "/static/" + p, {
                    include: /^(libmarkdown.js|loading.css|runners_list.js|builders_list.js|bootstrap.js)$/,
                    exclude: /\.(js|css|less|xml)$|^mock$/,
                    onDir: function(e) { console.log('\x1b[1A\x1b[0K' + e) }
                });
            });
            next();
        }
    }
});
