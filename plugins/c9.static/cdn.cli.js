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
                        skins = ["dark", "light", "dark-gray", "light-gray", "flat-light", "flat-dark"];
                    else
                        skins = skins ? skins.split(/,\s*/) : [];
                    
                    build.buildConfig(config, pathConfig, save(["config", path.basename(config) + ".js"], function next(err) {
                        if (err) return done(err);
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
                    console.error(err, err.stack);
                    process.exit(1);
                }
                pending--;
                if (pending <= 0)
                    process.exit();
            }
        });
        
        function listAceModules(pathConfig, cb) {
            var result = [
                "plugins/c9.ide.ace.keymaps/vim/keymap",
                "plugins/c9.ide.ace.keymaps/emacs/keymap",
                "plugins/c9.ide.ace.keymaps/sublime/keymap",
            ];
            
            // FIXME: this could be resolved via pathConfig:
            var pathMap = {
                "ace": __dirname + "/../../node_modules/ace/lib/ace",
                "plugins": __dirname + "/../../plugins",
                "plugins/salesforce.language": __dirname + "/../../node_modules/salesforce.language",
                "plugins/salesforce.sync": __dirname + "/../../node_modules/salesforce.sync"
            };
            
            var packages = [
                "ace",
                "plugins/salesforce.language",
                "plugins/salesforce.sync",
            ];

            function toFsPath(id) {
                var testPath = id, tail = "";
                while (testPath) {
                    if (pathMap[testPath])
                        return pathMap[testPath] + tail;
                    var i = testPath.lastIndexOf("/");
                    if (i === -1) break;
                    tail = testPath.substr(i) + tail;
                    testPath = testPath.slice(0, i);
                }
                throw new Error("Cannot map path " + id);
            }
            
            function readPackage(name, type, excludePattern) {
                if (!excludePattern)
                    excludePattern = /_test/;
                
                var targetPath = name + "/" + type;
                var sourcePath = toFsPath(targetPath);
                
                try {
                    var files = fs.readdirSync(sourcePath);
                } catch (e) {
                    if (e.code === "ENOENT") return;
                    else throw e;
                }
                
                files = files.filter(function(p) {
                    return !excludePattern.test(p)
                        && !/[\s#]/.test(p)
                        && /\.js$/.test(p);
                });
                
                files.forEach(function(p) {
                    result.push(targetPath + "/" + p.replace(/.js$/, ""));
                });
            }
            
            packages.forEach(function(name) {
                var isAce = (name === "ace");
                var modesExcludePattern = /_highlight_rules|_test|_worker|xml_util|_outdent|behaviour|completions/;
                
                readPackage(name, (isAce ? "mode" : "modes"), modesExcludePattern);
                readPackage(name, (isAce ? "theme" : "themes"));
                readPackage(name, "ext");
                readPackage(name, "snippets");
            });
            
            function take() {
                var p = result.pop();
                console.log("building ", p, result.length);
                cb(p, result.length && take);
            }
            take();
        }
        
        function copyStaticResources(usedPlugins, pathConfig, next) {
            var moduleDeps = require("architect-build/module-deps");
            var copy = require('architect-build/copy');
            // todo: use usedPlugins to filter out some of unneeded deps
            var roots = pathConfig.pathMap;
            Object.keys(roots).filter(function(p) {
                return !/(c9.docker|docs|smith|vfs-socket|engine.io|msgpack.js)$/.test(p);
            }).forEach(function(p) {
                var absPath = moduleDeps.resolveModulePath(p, pathConfig.pathMap);
                if (/^\/lib\/ace/.test(p)) 
                    return;
                if (!cache.files) {
                    console.error("Config is empty");
                    process.exit(1);
                }
                copy(absPath, root + "/static/" + p, {
                    include: /^(remarkable.min.js|runners_list.js|builders_list.js|bootstrap.js)$/,
                    exclude: function(name, dir) {
                        if (/\.css$/.test(name)) {
                            if (!cache.files[dir + "/" + name]) {
                                console.log("\x1b [1A\x1b[0K", "adding file ", dir + "/" + name);
                                return false;
                            }
                        }
                        if (name == "node_modules" && /plugins\/[^\/\\]+/.test(dir))
                            return true;
                        if (/^(LICENSE|README.md)$/.test(name))
                            return true;
                        return /\.(jsx?|css|less|xml|ejs|prv|pub|sh)$|(^|[/])^(mock|example|\.[^/]*|package.json)[/]?$/.test(name);
                    },
                    onDir: function(e) { console.log("\x1b [1A\x1b[0K" + e) }
                });
            });
            next();
        }
    }
});
