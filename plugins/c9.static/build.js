"use strict";

main.consumes = ["Plugin", "connect.static"];
main.provides = ["cdn.build"];
module.exports = main;

function main(options, imports, register) {
    var Plugin = imports.Plugin;
    var connectStatic = imports["connect.static"];
    
    var os = require("os");
    var fs = require("fs");
    var path = require("path");
    var error = require("http-error");
    
    var build = function() {
        // delay loading of architect build for faster startup
        // todo should we disable this plugin on local instead?
        build = require("architect-build/build");
        build.apply(null, arguments);
    };
    var cache;
    
    /***** Initialization *****/
    
    var compress = options.compress || false;
    var obfuscate = options.obfuscate || false;
    var keepLess = options.keepLess || false;
    var config = options.config || "ide";
    var settings = options.settings || "devel";
    var cacheDir = path.resolve(options.cache || os.tmpdir() + "/cdn");
    var staticsConfig;
    
    var plugin = new Plugin("Ajax.org", main.consumes);
    
    /***** Register and define API *****/
    
    function init(callback) {
        if (!options.link)
            return callback();
        
        var dir = path.join(cacheDir, options.version);
        var rjsConfigPath = path.join(dir, "/static/requirejs-config.json");
        fs.exists(rjsConfigPath, function(exists) {
            if (!exists)
                getStaticsConfig(callback);
            else
                callback();
        });
    }

    function readConfig(config) {
        if (config == "full") {
            var plugins = [];
            ["default-local", "ssh", "default"].forEach(function(n) {
                plugins.push.apply(plugins, readConfig(n).config);
            });
            return {config: plugins};
        }
        
        if (config[0] != "/")
            config = path.join(__dirname, "/../../configs/client-" + config);
            
        if (config.slice(-3) !== ".js")
            config += ".js";
            
        var settings;
        try {
            settings = require("../../settings/standalone");
            config = require(config);
        } catch (e) {
            if (e.code == "MODULE_NOT_FOUND")
                e = new error.NotFound();
            return {error: e};
        }
        settings = settings();
        settings.packaging = true;
        return {config: config(settings)};
    }
    
    function buildConfig(config, pathConfig, callback, onReadConfig) {
        var data = readConfig(config);
        if (data.error) 
            return callback(data.error);
        
        if (onReadConfig && onReadConfig(config, data.config))
            return;
        
        var plugins = data.config.concat(sharedModules());
        
        var moduleLoadUrl = (options.virtual 
            ? pathConfig.baseUrl + "/" + pathConfig.hash
            : options.baseUrl) + "/modules";

        build(plugins, {
            cache: cache,
            pathConfig: pathConfig,
            enableBrowser: true,
            includeConfig: false,
            noArchitect: true,
            compress: compress,
            filter: [],
            ignore: ["amdefine", "plugins/c9.ide.ui/lib_less1.5"],
            withRequire: true,
            stripLess: !keepLess,
            moduleLoadUrl: moduleLoadUrl,
            basepath: pathConfig.root
        }, callback);
    }
    
    function buildSkin(config, color, pathConfig, callback) {
        var data = readConfig(config);
        if (data.error) 
            return callback(data.error);
        
        var plugins = data.config.concat(sharedModules());
        var lessLibs = [];
        
        fs.readFile(path.join(pathConfig.root, "plugins/c9.ide.layout.classic/less/lesshat.less"), "utf8", function(err, lesshat) {
            if (err) return callback(err);
            
            lessLibs.push(lesshat);
            
            fs.readFile(path.join(pathConfig.root, "plugins/c9.ide.layout.classic/themes/default-" + color + ".less"), "utf8", function(err, theme) {
                if (err) return callback(err);
                
                lessLibs.push(theme);
                
                lessLibs.staticPrefix = "plugins/c9.ide.layout.classic";
                
                var themeCss = [{
                    id: "text!" + "plugins/c9.ide.layout.classic/themes/" + color + ".less",
                    parent: {}
                }];
                
                build(plugins, {
                    cache: cache,
                    pathConfig: pathConfig,
                    enableBrowser: true,
                    includeConfig: false,
                    noArchitect: true,
                    compress: compress,
                    filter: [],
                    ignore: [],
                    withRequire: false,
                    compileLess: true,
                    lessLibs: lessLibs,
                    lessLibCacheKey: color,
                    basepath: pathConfig.root,
                    additional: themeCss
                }, callback);
            });
        });
    }
    
    function buildAce(module, pathConfig, callback, aceModuleIgnores) {
        if (!aceModuleIgnores && cache && cache.aceModuleIgnores)
            aceModuleIgnores = cache.aceModuleIgnores;
        
        if (aceModuleIgnores) {
            if (aceModuleIgnores.indexOf(module) != -1)
                aceModuleIgnores = []; // allow building default themes
                
            return build([module], {
                cache: cache,
                pathConfig: pathConfig,
                enableBrowser: true,
                includeConfig: false,
                noArchitect: true,
                compress: compress,
                quiet: true,
                filter: [],
                ignore: aceModuleIgnores,
                withRequire: false,
                basepath: pathConfig.root
            }, callback);
        }
        
        var ignoreRoots = sharedModules().concat([
            "ace/editor",
            "ace/multi_select"
        ]);
        
        build(ignoreRoots, {
            cache: cache,
            pathConfig: pathConfig,
            enableBrowser: true,
            includeConfig: false,
            noArchitect: true,
            compress: false,
            quiet: true,
        }, function(err, result) {
            var deps = Object.create(null);
            result.sources.forEach(function(pkg) {
                pkg.deps && pkg.deps.forEach(function(p) {
                    if (!deps[p]) deps[p] = 1;
                });
                deps[pkg.id] = 1;
            });
            aceModuleIgnores = Object.keys(deps);
            if (cache)
                cache.aceModuleIgnores = aceModuleIgnores;
            buildAce(module, pathConfig, callback, aceModuleIgnores);
        });
    }
    
    function sharedModules() {
        return [
            "lib/architect/architect"
        ];
    }
    
    function buildModule(module, pathConfig, callback) {
        if (/^(ace\/|plugins\/c9.ide.ace)/.test(module))
            return buildAce(module, pathConfig, callback);
        
        build([], {
            cache: cache,
            pathConfig: pathConfig,
            enableBrowser: true,
            includeConfig: false,
            noArchitect: true,
            compress: compress,
            filter: [],
            ignore: [],
            additional: [{
                id: module,
                noDeps: true
            }],
            withRequire: false,
            basepath: pathConfig.root
        }, callback);
    }
    
    function buildWorker(module, pathConfig, callback) {
        var modules = [module];
        if (module == "plugins/c9.ide.language/worker") {
            // jsonalyzer is missing in built version of local
            var jsonalyzer = require("../c9.ide.language.jsonalyzer/default_plugins");
            var extraPackages = [
                "plugins/c9.ide.test.mocha/mocha_outline_worker",
                "plugins/@smartface/smartface.language/loadInclude",
                "plugins/@smartface/smartface.language/warnings_worker.js",
                "plugins/@smartface/smartface.language/plugincomplete_worker.js",
                "plugins/@smartface/smartface.language/emptyTernPlugin"
            ];
            try {
                extraPackages = extraPackages
                    .concat(require("lib/salesforce.language/__worker__"))
                    .concat(require("lib/salesforce.sync/__worker__"));
            } catch(e) {}
            // TODO find a saner method for managing files loaded in language worker
            modules = [
                "plugins/c9.ide.language/worker",
                "plugins/c9.ide.language.generic/local_completer",
                "plugins/c9.ide.language.generic/snippet_completer",
                "plugins/c9.ide.language.generic/mode_completer",
                "plugins/c9.ide.language.generic/open_files_local_completer",
                "plugins/c9.ide.language.generic/simple/make",
                "plugins/c9.ide.language.generic/simple/shell",
                "plugins/c9.ide.language.javascript/parse",
                "plugins/c9.ide.language.javascript/scope_analyzer",
                "plugins/c9.ide.language.javascript/debugger",
                "plugins/c9.ide.language.javascript/outline",
                "plugins/c9.ide.language.javascript/jumptodef",
                "plugins/c9.ide.language.javascript.immediate/immediate_complete",
                "plugins/c9.ide.language.javascript.immediate/immediate_complete_static",
                "plugins/c9.ide.language.javascript.infer/infer_jumptodef",
                "plugins/c9.ide.language.javascript.infer/infer_tooltip",
                "plugins/c9.ide.language.javascript.infer/infer_completer",
                "plugins/c9.ide.language.python/worker/python_linter",
                "plugins/c9.ide.language.python/worker/python_completer",
                "plugins/c9.ide.language.python/worker/python_jsonalyzer",
                "plugins/c9.ide.language.go/worker/go_completer",
                "plugins/c9.ide.language.codeintel/worker/php_completer",
                "plugins/c9.ide.language.codeintel/worker/css_less_completer",
                "plugins/c9.ide.language.codeintel/worker/ruby_completer",
                "plugins/c9.ide.language.codeintel/worker/codeintel_worker",
                "plugins/c9.ide.language.html/html_completer",
                "plugins/c9.ide.language.css/css_handler",
                "plugins/c9.ide.language.javascript.tern/worker/tern_worker",
                "plugins/c9.ide.language.javascript.tern/worker/architect_resolver_worker",
                "plugins/c9.ide.language.javascript.eslint/worker/eslint_worker",
            ]
            .concat(jsonalyzer.handlersWorker)
            .concat(jsonalyzer.helpersWorker)
            .concat(extraPackages);
        }

        build(modules, {
            cache: cache,
            pathConfig: pathConfig,
            enableBrowser: true,
            includeConfig: false,
            noArchitect: true,
            compress: compress,
            obfuscate: obfuscate,
            filter: [],
            ignore: [],
            additional: [{
                id: "ace/worker/worker", 
                order: -1000,
                noRequire: true
            }],
            withRequire: false,
            basepath: pathConfig.root
        }, callback);
    }

    function getStaticsConfig(callback) {
        if (staticsConfig)
            return callback(null, staticsConfig);
        
        tryGetConfig(null, connectStatic);
        
        if (staticsConfig)
            return callback(null, staticsConfig);
        
        var dir = path.join(cacheDir, options.version);
        console.log("Linking static files to ", dir, settings);
        require("../../scripts/makestatic.js")(config, settings, {
            dest: dir + "/static",
            symlink: false,
            compress: options.compress,
            getMounts: !options.link,
            saveRjsConfig: false,
        }, function(err, connectStatic) {
            tryGetConfig(err, connectStatic);
            return callback(err, staticsConfig);
        });
        
        function tryGetConfig(err, connectStatic) {
            if (!connectStatic || options.link)
                return;
            
            var mounts = connectStatic.getMounts();
            var rjsConfig = connectStatic.getRequireJsConfig();
        
            if (!mounts || !mounts[0] || !mounts[0].mount)
                return;
            
            var pathMap = Object.create(null);
            mounts.forEach(function(mount) {
                pathMap[mount.mount] = mount.path;
            });
                
            staticsConfig = {
                pathMap: pathMap,
                rjsConfig: JSON.parse(JSON.stringify(rjsConfig))
            };
        }
    }
    
    function getPathConfig(hash, callback) {
        if (!options.link) {
            getStaticsConfig(function(err, config) {
                if (err) return callback(err);
                
                var pathMap = config.pathMap;
                var pathConfig = config.rjsConfig;
                
                pathConfig.hash = hash;
                pathConfig.root = path.resolve(path.join(__dirname, "../../"));
                var baseUrl = pathConfig.baseUrl || "";
                for (var p in pathConfig.paths) {
                    var url = pathConfig.paths[p];
                    if (typeof url === "string" && url.substring(0, baseUrl.length) == baseUrl)
                        pathConfig.paths[p] = url.substring(baseUrl.length);
                }
                pathConfig.pathMap = pathMap;
                callback(null, pathConfig);
            });
        } else {
            var root = path.resolve(path.join(cacheDir, hash));
            var rjsConfigPath = path.join(root, "/static/requirejs-config.json");
            fs.readFile(rjsConfigPath, "utf8", function(err, pathConfig) {
                if (err) {
                    if (err.code == "ENOENT") 
                        return callback(new error.NotFound());
                    else 
                        return callback(err);
                }
                
                try {
                    pathConfig = JSON.parse(pathConfig);
                } catch (e) {
                    return callback(e);
                }

                pathConfig.root = path.join(root, pathConfig.baseUrl);
                for (var p in pathConfig.paths) {
                    pathConfig.paths[p] = path.join(root, pathConfig.paths[p]);
                }
                callback(null, pathConfig);
            });
        }
    }
    
    function setCache(cacheObj) {
        cache = cacheObj;
    }
    
    /**
     * 
     **/
    plugin.freezePublicAPI({
        buildAce: buildAce,
        setCache: setCache,
        buildSkin: buildSkin,
        buildConfig: buildConfig,
        buildModule: buildModule,
        buildWorker: buildWorker,
        getPathConfig: getPathConfig,
        get cacheDir() { return cacheDir; },
        get version() { return options.version; }
    });
    
    init(function(err) {
        if (err) return register(err);
        
        console.log("CDN: version " + options.version + " initialized", cacheDir);
        register(null, { "cdn.build" : plugin });
    });
}
