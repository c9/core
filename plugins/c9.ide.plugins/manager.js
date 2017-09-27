/*global requirejs*/
define(function(require, exports, module) {
    main.consumes = [
        "app", "ext", "c9", "Plugin", "proc", "fs", "vfs", "dialog.error",
        "util"
    ];
    main.provides = ["pluginManager", "plugin.manager", "plugin.debug"];
    return main;


    function main(options, imports, register) {
        var c9 = imports.c9;
        var fs = imports.fs;
        var ext = imports.ext;
        var proc = imports.proc;
        var Plugin = imports.Plugin;
        var util = imports.util;
        var vfs = imports.vfs;
        var showError = imports["dialog.error"].show;
        var architectApp = imports.app;

        var join = require("path").join;
        var basename = require("path").basename;
        var dirname = require("path").dirname;
        var async = require("async");
        
        var staticPrefix = options.staticPrefix;

        var TEMPLATES = {
            "plugin.simple": "Empty Plugin",
            "plugin.default": "Full Plugin",
            "plugin.installer": "Installer Plugin",
            "plugin.bundle": "Cloud9 Bundle"
        };

        /***** Initialization *****/

        var plugin = new Plugin();
        var emit = plugin.getEmitter();

        var disabledPlugins = Object.create(null);
        var packages = Object.create(null);
        
        function load() {
            function loadDefaultPlugins() {
                // do not allow errors here to interfer with connect event
                setTimeout(function() {
                    loadPackage(options.loadFromDisk, function(err) {
                        if (err) return showError(err);
                    });
                });
            }
            if (options.loadFromDisk) {
                if (vfs.connected) loadDefaultPlugins();
                else vfs.once("connect", loadDefaultPlugins);
            }
        }

        /***** Methods *****/
        
        function readAvailablePlugins(callback) {
            fs.readdir("~/.c9/plugins", function(err, list) {
                if (err) return callback && callback(err);
                
                var available = [];
                list.forEach(function(stat) {
                    var name = stat.name;
                    if (!/(directory|folder)$/.test(stat.mime)) return;
                    if (!/[._]/.test(name[0])) available.push(name);
                });
                callback && callback(null, available);
            });
        }

        function createNewPlugin(template) {
            if (!template)
                template = "c9.ide.default";
            
            var tarSourcePath = join("templates", template + ".tar.gz");
            var url = staticPrefix + "/" + tarSourcePath;
            if (!url.match(/^http/))
                url = location.origin + url;

            function getPath(callback, i) {
                i = i || 0;
                var path = join("~", ".c9/plugins/", template + (i ? "." + i : ""));
                fs.exists(path, function(exists) {
                    if (exists) return getPath(callback, i + 1);
                    callback(null, path);
                });
            }

            function handleError(err) {
                showError("Could not create plugin.");
                console.error(err);
            }

            getPath(function(err, path) {
                if (err)
                    return handleError(err);

                var pluginsDir = join("~", ".c9/plugins/_/");
                var pluginsDirAbsolute = pluginsDir.replace(/^~/, c9.home);
                var tarPath = join(pluginsDir, template + ".tar.gz");
                var tarPathAbsolute = tarPath.replace(/^~/, c9.home);

                // Download tar file with template for plugin
                proc.execFile("bash", {
                    args: ["-c", [
                        // using mkdirp since "--create-dirs" is broken on windows
                        "mkdir", "-p", util.escapeShell(dirname(tarPathAbsolute)), ";",
                    ].concat(
                        c9.sourceDir
                        ? [ "cp", util.escapeShell(c9.sourceDir + "/plugins/c9.ide.plugins/" + tarSourcePath),
                            util.escapeShell(tarPathAbsolute) ]
                        : [ "curl", "-L", 
                            (architectApp.services.onlinedev_helper ? "-k" : ""), // ignore certificate errors in dev mode
                            util.escapeShell(url),
                            "-o", util.escapeShell(tarPathAbsolute)
                        ].filter(Boolean)
                    ).join(" ")]
                }, function(err, stderr, stdout) {
                    if (err)
                        return handleError(err);

                    // Untar tar file
                    proc.execFile("bash", {
                        args: ["-c", ["tar", "-zxvf", util.escapeShell(tarPath), "-C", util.escapeShell(pluginsDirAbsolute)].join(" ")]
                    }, function(err, stderr, stdout) {
                        if (err)
                            return handleError(err);

                        // Move template to the right folder
                        var dirPath = join(dirname(tarPath), template);
                        fs.rename(dirPath, path, function(err) {
                            if (err)
                                return handleError(err);

                            // Remove .tar.gz
                            fs.unlink(tarPath, function() {
                                // using this to allow reloading the tree
                                var tree = architectApp.services["tree"];
                                var favs = architectApp.services["tree.favorites"];

                                // Add plugin to favorites
                                favs.addFavorite(dirname(pluginsDir), "plugins");

                                // Select and expand the folder of the plugin
                                tree.expandAndSelect(path);
                                
                                readAvailablePlugins(function(e) {
                                    emit("change");
                                });
                            });
                        });
                    });
                });
            });
        }

        function reload(nodes, mode) {
            var reloadLast = [];
            nodes.forEach(function(node) {
                var id;
                if (node.packageConfig) {
                    var config = node.packageConfig;
                    if (!mode)
                        unloadPackage(config.name);
                    if (mode != false)
                        loadPackage(config.filePath || config.url);
                    id = config.name;
                }
                else {
                    if (!mode)
                        unloadPlugins({ path: node.path });
                    if (mode != false)
                        loadPlugins({ path: node.path });
                    id = node.path;
                }
                
                reloadLast.push(id);
                if (mode == false)
                    disabledPlugins[id] = true;
                else
                    delete disabledPlugins[id];
            });
            return reloadLast;
        }

        function checkPluginsWithMissingDependencies() {
            var services = architectApp.services;
            var plugins = [];
            getAllPlugins().forEach(function(p) {
                if (!p.provides.length) return;
                var packagePath = p.packagePath;
                var isDisabled = p.provides.every(function(name) {
                    if (!services[name]) return true;
                    if (!services[name].loaded && typeof services[name].load == "function")
                        return true;
                });
                if (isDisabled && packagePath) {
                    var packageName = packagePath.split("/")[1];
                    if (disabledPlugins[packageName]) return;
                    while (packagePath && !disabledPlugins[packagePath]) {
                        var i = packagePath.lastIndexOf("/");
                        packagePath = packagePath.slice(0, i > 0 ? i : 0);
                    }
                    if (!packagePath) plugins.push(p);
                }
            });
            if (!plugins.length) return;
            architectApp.loadAdditionalPlugins(plugins, function(err) { 
                if (err) return showError(err);
            });
        }
        
        function getAllPlugins(includeDisabled) {
            var config = architectApp.config;
            Object.keys(packages).forEach(function(n) {
                if (packages[n] && packages[n].c9 && packages[n].c9.plugins)
                    config = config.concat(packages[n].c9.plugins);
            });
            return includeDisabled ? config : config.filter(function(x) {
                return x.consumes && x.provides;
            });
        }
        
        function addAllDependents(plugins) {
            var config = getAllPlugins();
            var level = 0;
            do {
                level++;
                var changed = false;
                var packageNames = Object.keys(plugins);
                config.forEach(function(x) {
                    packageNames.forEach(function(p) {
                        if (x.consumes.indexOf(p) != -1) {
                            x.provides.forEach(function(name) {
                                if (plugins[name] == null) {
                                    changed = true;
                                    plugins[name] = level;
                                }
                            });
                        }
                    });
                });
            } while (changed);
            return plugins;
        }
        
        function addAllProviders(plugins) {
            var serviceToPlugin = architectApp.serviceToPlugin;
            var level = 0;
            do {
                level--;
                var changed = false;
                var packageNames = Object.keys(plugins);
                packageNames.forEach(function(p) {
                    var service = serviceToPlugin[p];
                    if (service && service.consumes) {
                        service.consumes.forEach(function(name) {
                            if (plugins[name] == null) {
                                changed = true;
                                plugins[name] = level;
                            }
                        });
                    }
                });
            } while (changed);
            return plugins;
        }
        
        function unloadPackage(options, callback) {
            if (Array.isArray(options))
                return async.map(options, unloadPackage, callback || function() {});
            var name = typeof options == "object" ? options.name : options;
            if (packages[name]) {
                packages[name].enabled = false;
                unloadPlugins(packages[name].path);
                emit("disablePackage");
            }
        }
        
        function loadPackage(options, callback) {
            if (Array.isArray(options))
                return async.map(options, loadPackage, callback || function() {});
            
            if (typeof options == "string") {
                if (/^https?:/.test(options)) {
                   options = { url: options };
                } else if (/^[~\/]/.test(options)) {
                    options = { path: options };
                } else if (/^[~\/]/.test(options)) {
                    options =  { url: require.toUrl(options) };
                }
            }
            
            var url = options.url;
            
            if (!options.url && options.path) {
                if (!vfs.connected) {
                    // wait until vfs.url is available
                    return vfs.once("connect", function() {
                        loadPackage(options, callback);
                    });
                }
                options.url = vfs.url(options.path);
            }
            
            var parts = options.url.split("/");
            var root = parts.pop();
            options.url = parts.join("/");
            
            if (!options.name) {
                // try to find the name from file name
                options.name = /^package\.(.*)\.js$|$/.exec(root)[1];
                // try folder name
                if (!options.name || options.name == "json")
                    options.name = parts[parts.length - 1];
                // try parent folder name
                if (/^(.?build|master|c9build)/.test(options.name))
                    options.name = parts[parts.length - 2];
                // remove version from the name
                options.name = options.name.replace(/@.*$/, "");
            }
            if (!options.packageName)
                options.packageName = root.replace(/\.js$/, "");
            
            if (!options.rootDir)
                options.rootDir = "plugins";
            
            var name = options.name;
            var id = options.rootDir + "/" + name;
            var pathMappings = {};
            
            if (packages[name]) packages[name].loading = true;
            
            unloadPlugins("plugins/" + options.name);
            
            pathMappings[id] = options.url;
            requirejs.config({ paths: pathMappings });
            requirejs.undef(id + "/", true);
            
            if (/\.js$/.test(root)) {
                require([options.url + "/" + root], function(json) {
                    json = json || require(id + "/" + options.packageName);
                    if (!json) {
                        var err = new Error("Didn't provide " + id + "/" + options.packageName);
                        return addError("Error loading plugin", err);
                    }
                    if (Array.isArray(json))
                        json = { plugins: json };
                    if (json.name && json.name != name)
                        name = json.name;
                    getPluginsFromPackage(json, callback);
                }, function(err) {
                    addError("Error loading plugin", err);
                });
            }
            else if (options.path && /\.json$/.test(root)) {
                fs.readFile(options.path, function(err, value) {
                    if (err) return addError("Error reading " + options.path, err);
                    try {
                        var json = JSON.parse(value);
                    } catch (e) {
                        return addError("Error parsing package.json", e);
                    }
                    json.fromVfs = true;
                    // handle the old format
                    if (!json.c9) loadBundleFiles(json, options);
                    getPluginsFromPackage(json, callback);
                });
            }
            else if (options.url && /\.json$/.test(root)) {
                require(["text!" + options.url + "/" + root], function(value) {
                    try {
                        var json = JSON.parse(value);
                    } catch (e) {
                        return addError("Error parsing package.json", e);
                    }
                    getPluginsFromPackage(json, callback);
                }, function(err) {
                    addError("Error loading plugin", err);
                });
            }
            else {
                callback && callback(new Error("Missing path and url"));
            }
            
            function addError(message, err) {
                if (!packages[name])
                    packages[name] = {};
                packages[name].filePath = options.path;
                packages[name].url = url;
                packages[name].__error = new Error(message + "\n" + err.message);
                packages[name].loading = false;
                
                emit("change");
                
                callback && callback(err);
            }
            
            function getPluginsFromPackage(json, callback) {
                var plugins = [];
                if (json.name != name)
                    json.name = name;
                var unhandledPlugins = json.c9 && json.c9.plugins || json.plugins;
                if (unhandledPlugins) {
                    Object.keys(unhandledPlugins).forEach(function(name) {
                        var plugin = unhandledPlugins[name];
                        if (typeof plugin == "string")
                            plugin = { packagePath: plugin };
                        if (!plugin.packagePath)
                            plugin.packagePath = id + "/" + name;
                        plugin.staticPrefix = options.url;
                        plugins.push(plugin);
                    });
                }
                
                packages[json.name] = json;
                json.filePath = options.path;
                json.url = url;
                
                if (!json.c9)
                    json.c9 = {};
                
                json.c9.plugins = plugins;
                json.enabled = true;
                json.path = id;
                
                emit("enablePackage", json);
                loadPlugins(plugins, function(err, result) {
                    if (err) return addError("Error loading plugins", err);
                    if (packages[name])
                        packages[name].loading = false;
                    emit("change");
                    callback && callback(err, result);
                });
            }
            
            function loadBundleFiles(json, options, callback) {
                var cwd = dirname(options.path);
                var resourceHolder = new Plugin();
                fs.readdir(cwd, function(err, files) {
                    if (err) return callback && callback(err);
                    function forEachFile(dir, fn) {
                        fs.readdir(dir, function(err, files) {
                            if (err) return callback && callback(err);
                            files.forEach(function(stat) {
                                fs.readFile(dir + "/" + stat.name, function(err, value) {
                                    if (err) return callback && callback(err);
                                    fn(stat.name, value);
                                });
                            });
                        });
                    }
                    function parseHeader(data, filename) {
                        var firstLine = data.split("\n", 1)[0].replace(/\/\*|\*\//g, "").trim();
                        var info = {};
                        firstLine.split(";").forEach(function(n) {
                            var key = n.split(":");
                            if (key.length != 2)
                                return console.error("Ignoring invalid key " + n + " in " + filename);
                            info[key[0].trim()] = key[1].trim();
                        });
                        info.data = firstLine;
                        return info;
                    }
                    function addResource(type) {
                        forEachFile(cwd + "/" + type, function(filename, data) {
                            addStaticPlugin(type, options.name, filename, data, plugin);
                            
                        });
                    }
                    function addMode(type) {
                         forEachFile(cwd + "/modes", function(filename, data) {
                            if (/(?:_highlight_rules|_test|_worker|_fold|_behaviou?r)\.js$/.test(filename))
                                return;
                            if (!/\.js$/.test(filename))
                                return;
                            var info = parseHeader(data, cwd + "/modes/" + filename);
                            
                            if (!info.caption) info.caption = filename;

                            info.type = "modes";
                            info.filename = filename;
                            addStaticPlugin(type, options.name, filename, data, plugin);
                        });
                    }
                    var handlers = {
                        templates: addResource,
                        snippets: addResource,
                        builders: addResource,
                        keymaps: addResource,
                        outline: addResource,
                        runners: addResource,
                        themes: addResource,
                        modes: addMode,
                    };
                    files.forEach(function(stat) {
                        var type = stat.name;
                        if (handlers.hasOwnProperty(type))
                            handlers[type](type);
                    });
                    
                    var name = options.name + ".bundle";
                    var bundle = {
                        packagePath: id + "/" + name,
                        consumes: [],
                        provides: [name],
                        setup: function(imports, options, register) {
                            var ret = {};
                            ret[name] = resourceHolder;
                            register(null, ret);
                        }
                    };
                    json.c9.plugins.push(bundle);
                    architectApp.loadAdditionalPlugins([bundle], function() {});
                });
            }
        }
        
        function loadPlugins(plugins, callback) {
            if (!Array.isArray(plugins)) {
                options = plugins;
                plugins = [];
                Object.keys(getServiceNamesByPath(options)).forEach(function(n) {
                    var plugin = architectApp.serviceToPlugin[n];
                    if (plugin && plugin.packagePath) {
                        unloadPluginConfig(plugin);
                        plugins.push(plugin);
                    }
                });
            }
            
            architectApp.loadAdditionalPlugins(plugins, function(err) {
                setTimeout(checkPluginsWithMissingDependencies);
                callback && callback && callback(err);
            });
        }
        
        function getServiceNamesByPath(options) {
            var toUnload = Object.create(null);
            var config = getAllPlugins();
            function addPath(path) {
                config.forEach(function(p) {
                    if (!p.packagePath) return;
                    if (p.packagePath.startsWith(path)) {
                        p.provides.forEach(function(name) {
                            toUnload[name] = 0;
                        });
                    }
                });
            }
            if (!options) {
                return toUnload;
            }
            if (typeof options == "string") {
                addPath(options);
            }
            if (options.path) {
                addPath(options.path);
            }
            if (options.paths) {
                options.path.forEach(addPath);
            }
            if (options.services) {
                options.services.forEach(function(name) {
                    toUnload[name] = 0;
                });
            }
            return toUnload;
        }
        
        function unloadPlugins(options, callback) {
            var toUnload = getServiceNamesByPath(options);
            addAllDependents(toUnload);
            
            var services = architectApp.services;
            var serviceToPlugin = architectApp.serviceToPlugin;
            Object.keys(toUnload).forEach(function(name) {
                recurUnload(name);
            });
            
            function recurUnload(name) {
                var service = services[name];
                
                if (!service || !service.loaded)
                    return;
                
                // Find all the dependencies
                var deps = ext.getDependents(service.name);
                
                // Unload all the dependencies (and their deps)
                deps.forEach(function(name) {
                    recurUnload(name);
                });
                
                console.log(name);
                
                // Unload plugin
                service.unload();
                
                var pluginConfig = serviceToPlugin[name];
                if (pluginConfig && toUnload[name] == 0)
                    pluginConfig.__userDisabled = true;
            }
            
            emit("change");
        }
        
        function unloadPluginConfig(plugin) {
            var url = requirejs.toUrl(plugin.packagePath, ".js");
            if (!define.fetchedUrls[url]) return false;
            
            delete plugin.provides;
            delete plugin.consumes;
            delete plugin.setup;
            
            requirejs.undef(plugin.packagePath);
            return true;
        }
        
        // TODO optimize this
        function addStaticPlugin(type, pluginName, filename, data, plugin) {
            var services = architectApp.services;
            var path = "plugins/" + pluginName + "/" 
                + (type == "installer" ? "" : type + "/") 
                + filename.replace(/\.js$/, "");
            
            switch (type) {
                case "builders":
                    data = util.safeParseJson(data, function() {});
                    if (!data) return;
                    if (!services.build.addBuilder) return;
                    
                    services.build.addBuilder(filename, data, plugin);
                    break;
                case "keymaps":
                    data = util.safeParseJson(data, function() {});
                    if (!data) return;
                    if (!services["preferences.keybindings"].addCustomKeymap) return;
                    
                    services["preferences.keybindings"].addCustomKeymap(filename, data, plugin);
                    break;
                case "modes":
                    if (!services.ace) return;
                    var mode = {};
                    var firstLine = data.split("\n", 1)[0].replace(/\/\*|\*\//g, "").trim();
                    firstLine.split(";").forEach(function(n) {
                        var info = n.split(":");
                        if (info.length != 2) return;
                        mode[info[0].trim()] = info[1].trim();
                    });
                    
                    services.ace.defineSyntax({
                        name: path,
                        caption: mode.caption || filename,
                        extensions: (mode.extensions || "").trim()
                            .replace(/\s*,\s*/g, "|").replace(/(^|\|)\./g, "$1")
                    });
                    break;
                case "outline":
                    if (!data) return;
                    if (!services.outline.addOutlinePlugin) return;
                    
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
                        services.installer.createSession(pluginName, data, function(v, o) {
                            require([path], function(fn) {
                                fn(v, o);
                            });
                        });
                    }
                    else {
                        require([path], function(fn) {
                            services.installer.createSession(pluginName, fn.version, function(v, o) {
                                fn(v, o);
                            });
                        });
                    }
                default:
                    console.error("Unsupported type", type);
            }
        }


        /***** Lifecycle *****/

        plugin.on("load", function() {
            load();
        });
        plugin.on("unload", function() {
            disabledPlugins = null;
            plugin = null;
        });

        /***** Register and define API *****/

        /**
         *
         **/
        plugin.freezePublicAPI({
            /**
             *
             */
            readAvailablePlugins: readAvailablePlugins,
            
            /**
             *
             */
            createNewPlugin: createNewPlugin,
            
            /**
             *
             */
            getAllPlugins: getAllPlugins,
            
            /**
             *
             */
            addAllDependents: addAllDependents,
            
            /**
             *
             */
            addAllProviders: addAllProviders,
            
            /**
             *
             */
            unloadPackage: unloadPackage,
            
            /**
             *
             */
            loadPackage: loadPackage,
            
            /**
             *
             */
            loadPlugins: loadPlugins,
            
            /**
             *
             */
            reload: reload,
            
            /**
             *
             */
            getServiceNamesByPath: getServiceNamesByPath,
            
            /**
             *
             */
            unloadPlugins: unloadPlugins,
            
            /**
             *
             */
            unloadPluginConfig: unloadPluginConfig,
            
            /**
             *
             */
            addStaticPlugin: addStaticPlugin,
            
            
            get packages() { return packages; },
            get disabledPlugins() { return disabledPlugins; },
        });

        var shim = new Plugin();
        shim.addStaticPlugin = addStaticPlugin;

        register(null, {
            "pluginManager": plugin,
            "plugin.manager": shim,
            "plugin.debug": shim,
        });
    }
});
