define(function(require, exports, module) {
    main.consumes = ["Plugin", "cli_commands", "proc", "api", "auth"];
    main.provides = ["cli.publish"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var cmd = imports.cli_commands;
        var proc = imports.proc;
        var auth = imports.auth;
        var api = imports.api;
        
        var TEST_MODE = !!process.env.C9_TEST_MODE;
        var TAR = "tar";
        var APIHOST = options.apiHost;
        var BASICAUTH = process.env.C9_TEST_AUTH;
        var SCM = {
            "git": {
                binary: "git",
                clone: "clone"
            },
            "mercurial": {
                binary: "hg",
                clone: "clone"
            },
            "hg": {
                binary: "hg",
                clone: "clone"
            }
        };
        
        var fs = require("fs");
        var join = require("path").join;
        var Path = require("path");
        var basename = require("path").basename;
        var dirname = require("path").dirname;
        var async = require("async");
        
        var verbose = false;
        var force = false;
        var dryRun = false;
        var compress = false;
        
        // Set up basic auth for api if needed
        if (BASICAUTH) api.basicAuth = BASICAUTH;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        // var emit = plugin.getEmitter();

        var loaded;
        function load() {
            if (loaded) return;
            loaded = true;
            
            cmd.addCommand({
                name: "build", 
                info: "    Builds cloud9 package for loading from cdn.",
                usage: "[--compress]",
                options: {
                    "compress": {
                        "description": "Minify output with uglify.js",
                        "alias": "c",
                        "default": false,
                        "boolean": true
                    }
                },
                exec: function(argv) {
                    compress = argv["compress"];
                    verbose = argv["verbose"];
                    force = argv["force"];
                    dryRun = true;
                    publish({ local: false }, function(err, result) {
                        if (err) {
                            console.error(err);
                            if (!verbose)
                                console.error("\nTry running with --verbose flag for more information");
                            process.exit(1);
                        }
                        console.log("Done!");
                    });
                }
            });
        }

        /***** Methods *****/

        function addMissingValues(json) {
            
            return json;
        }
        
        function validateConfig(json) {
            var cwd = process.cwd();
            
            // Basic Validation
            if (!json.name.match(/^[\w\._]+$/))
                return new Error("ERROR: Package name can only contain Alphanumeric characters, periods and underscores");
            if (basename(cwd) != json.name) {
                console.warn("WARNING: The name property in package.json is not equal to the directory name, which is " + basename(cwd));
                if (!force)
                    return new Error("Use --force to ignore this warning.");
            }
        }
        
        function publish(options, callback) {
            if (typeof options != "object")
                options = { version: options };
            
            var version = options.version;
            var cwd = process.cwd();
            var packagePath = cwd + "/package.json";
            fs.readFile(packagePath, "utf8", function(err, data) {
                if (err) return callback(new Error("ERROR: Could not find package.json in " + cwd));
                
                var json;
                try { json = JSON.parse(data); }
                catch (e) { 
                    return callback(new Error("ERROR: Could not parse package.json: ", e.message)); 
                }
                
                console.log("Data is: ", data);
                json = addMissingValues(json);
                
                var validationError = validateConfig(json);
                if (validationError) return callback(validationError);
                
                var description = json.description;
                
                if (description)
                    console.warn("WARNING: Description property in package.json will be ignored. README.md will be used.");
                
                // Validate plugins
                var plugins = {};
                
                var warned, failed;
                Object.keys(json.plugins || {}).forEach(function(name) {
                    var filename = name + ".js";
                    if (!fs.existsSync(join(cwd, name + "_test.js"))) {
                        console.warn("ERROR: Plugin '" + name + "' has no test associated with it. There must be a file called '" + name + "_test.js' containing tests.");
                        warned = true;
                    }
                    plugins[filename] = json.plugins[name];
                });
                
                fs.readdirSync(cwd).forEach(function(filename) {
                    if (/(__\w*__|_test)\.js$/.test(filename) || !/\.js$/.test(filename)) return;
                    try {
                        var val = fs.readFileSync(cwd + "/" + filename);
                    } catch (e) {
                        if (e.code == "EISDIR") return;
                        throw e;
                    }
                    if (!/\(options,\s*imports,\s*register\)/.test(val)) return;
                    if (!/consumes\s*=/.test(val)) return;
                    if (!/provides\s*=/.test(val)) return;
                    if (!plugins[filename]) {
                        console.warn("WARNING: Plugin '" + filename + "' is not listed in package.json.");
                    }
                });
                
                if (failed)
                    return callback(new Error());
                
                if (warned && !force && !dryRun)
                    return callback(new Error("Use --force to ignore these warnings."));
                
                if (version) {
                    var v = (json.version || "0.0.1").split(".");
                    // Update the version field in the package.json file
                    if (version == "major") {
                        v[0]++;
                        v[1] = 0;
                        v[2] = 0;
                    }
                    else if (version == "minor") {
                        v[1]++;
                        v[2] = 0;
                    }
                    else if (version == "patch" || version == "build") v[2]++;
                    else if (version.match(/^\d+\.\d+\.\d+$/))
                        v = version.split(".");
                    else
                        return callback(new Error("Invalid version. Semver required: " + version));
                    
                    json.version = v.join(".");
                }
                
                return build();
                
                function updatePackageJSON(next) {
                    if (!version)
                        return next();
                    
                    // Write the package.json file
                    var indent = data.match(/{\n\r?^ {4}"/) ? 4 : 2;
                    var newData = JSON.stringify(json, null, indent);
                    fs.writeFile(cwd + "/c9build/package.json", newData, function() {
                        if (dryRun)
                            return next(); // if dry-run is passed only update path in c9build
                        fs.writeFile(packagePath, newData, function(err) {
                            if (err) return callback(err);
                            return next();
                        });
                    });
                }
                
                function build() {
                    var base = dirname(cwd);
                    var packageName = json.name;
                    var config = Object.keys(plugins).map(function(p) {
                        return "plugins/" + packageName + "/" + p.replace(/\.js$/, "");
                    });
                    var result, packedFiles = [], staticPlugin;
                    async.series([
                        function(next) {
                            fs.readdir(cwd, function(err, files) {
                                if (err) 
                                    return next();
                                var extraCode = [];
                                function forEachFile(dir, f) {
                                    try {
                                        fs.readdirSync(dir).forEach(function(filename) {
                                            var data = fs.readFileSync(dir + "/" + filename, "utf8");
                                            f(filename, data);
                                        });
                                    } catch (e) {
                                        console.error(e);
                                    }
                                }
                                
                                if (files.indexOf("builders") != -1) {
                                    forEachFile(cwd + "/builders", function(filename, data) {
                                        packedFiles.push(cwd + "/builders/" + filename);
                                        extraCode.push({
                                            type: "builders",
                                            filename: filename,
                                            data: data
                                        });
                                    });
                                }
                                if (files.indexOf("keymaps") != -1) {
                                    forEachFile(cwd + "/keymaps", function(filename, data) {
                                        packedFiles.push(cwd + "/keymaps/" + filename);
                                        extraCode.push({
                                            type: "keymaps",
                                            filename: filename,
                                            data: data
                                        });
                                    });
                                }
                                if (files.indexOf("modes") != -1) {
                                    forEachFile(cwd + "/modes", function(filename, data) {
                                        if (/(?:_highlight_rules|_test|_worker|_fold|_behaviou?r)\.js$/.test(filename))
                                            return;
                                        if (!/\.js$/.test(filename))
                                            return;
                                        var firstLine = data.split("\n", 1)[0].replace(/\/\*|\*\//g, "").trim();
                                        
                                        if (!/caption\s*:[^;]+/i.test(firstLine)) {
                                            packedFiles.push(cwd + "/modes/" + filename);
                                            console.error("Ignoring mode with invalid header: ", firstLine);
                                            console.error("    at " + cwd + "/modes/" + filename);
                                            return;
                                        }
                                        extraCode.push({
                                            type: "modes",
                                            filename: filename,
                                            data: firstLine
                                        });
                                    });
                                }
                                if (files.indexOf("outline") != -1) {
                                    forEachFile(cwd + "/outline", function(filename, data) {
                                        packedFiles.push(cwd + "/outline/" + filename);
                                        extraCode.push({
                                            type: "outline",
                                            filename: filename,
                                            data: data
                                        });
                                    });
                                }
                                if (files.indexOf("runners") != -1) {
                                    forEachFile(cwd + "/runners", function(filename, data) {
                                        packedFiles.push(cwd + "/runners/" + filename);
                                        extraCode.push({
                                            type: "runners",
                                            filename: filename,
                                            data: data
                                        });
                                    });
                                }
                                if (files.indexOf("snippets") != -1) {
                                    forEachFile(cwd + "/snippets", function(filename, data) {
                                        packedFiles.push(cwd + "/snippets/" + filename);
                                        extraCode.push({
                                            type: "snippets",
                                            filename: filename,
                                            data: data
                                        });
                                    });
                                }
                                if (files.indexOf("themes") != -1) {
                                    forEachFile(cwd + "/themes", function(filename, data) {
                                        packedFiles.push(cwd + "/themes/" + filename);
                                        extraCode.push({
                                            type: "themes",
                                            filename: filename,
                                            data: data
                                        });
                                    });
                                }
                                if (files.indexOf("templates") != -1) {
                                    forEachFile(cwd + "/templates", function(filename, data) {
                                        packedFiles.push(cwd + "/templates/" + filename);
                                        extraCode.push({
                                            type: "templates",
                                            filename: filename,
                                            data: data
                                        });
                                    });
                                }
                                
                                packedFiles.push(cwd + "/package." + packageName + ".js");
                                
                                if (json.installer) {
                                    var path = join(cwd, json.installer);
                                    var installerCode = fs.readFileSync(path, "utf8");
                                    
                                    var m = installerCode.match(/\.version\s*=\s*(\d+)/);
                                    
                                    var installerVersion = m && m[1];
                                    if (!installerVersion)
                                        return callback(new Error("ERROR: missing installer version in " + json.installer));
                                    extraCode.push({
                                        type: "installer",
                                        filename: json.installer,
                                        data: installerVersion
                                    });
                                }
                                
                                if (!extraCode.length)
                                    return next();
                                    
                                var code = (function() {
                                    define(function(require, exports, module) {
                                        main.consumes = [
                                            "Plugin", "plugin.debug"
                                        ];
                                        main.provides = [];
                                        return main;
                                        function main(options, imports, register) {
                                            var debug = imports["plugin.debug"];
                                            var Plugin = imports.Plugin;
                                            var plugin = new Plugin();
                                            plugin.version = "VERSION";
                                            plugin.on("load", function load() {
                                                extraCode.forEach(function(x) {
                                                    debug.addStaticPlugin(x.type, "PACKAGE_NAME", x.filename, x.data, plugin);
                                                });
                                            });
                                            
                                            plugin.load("PACKAGE_NAME.bundle");
                                            
                                            register(null, {});
                                        }
                                    });
                                }).toString();
                                
                                var indent = code.match(/\n\r?(\s*)/)[1].length;
                                code = code
                                    .replace(/\r/g, "")
                                    .replace(new RegExp("^ {" + indent + "}", "gm"), "")
                                    .replace(/^.*?{|}$/g, "")
                                    .replace(/PACKAGE_NAME/g, packageName)
                                    .replace(/VERSION/g, json.version)
                                    .replace(/^(\s*)extraCode/gm, function(_, indent) {
                                        return JSON.stringify(extraCode, null, 4)
                                            .replace(/^/gm, indent);
                                    });
                                
                                staticPlugin = {
                                    source: code,
                                    id: "plugins/" + packageName + "/__static__",
                                    path: ""
                                };
                                next();
                            });
                        },
                        
                        function(next) {
                            var build = require("architect-build/build");
                            var paths = {};
                            paths["plugins/" + packageName] = cwd;
                            
                            var additional = [];
                            var packedConfig = config.slice();
                            if (staticPlugin) {
                                additional.push(staticPlugin);
                                packedConfig.push(staticPlugin.id);
                            }
                            var path = "plugins/" + packageName + "/package." + packageName;
                            
                            if (!json.c9) json.c9 = {};
                            json.c9.plugins = packedConfig.map(function(p) {
                                var name = p.slice(p.lastIndexOf("/") + 1);
                                var options = json.plugins[name] || {};
                                options.packagePath = p;
                                return options;
                            });
                            json.name = packageName;
                            json.plugins = undefined;
                            
                            additional.push({
                                id: path,
                                source: 'define("' + path + '", [], ' + JSON.stringify(json, null, 4) + ');',
                                literal: true,
                                order: -1
                            });
                            
                            build(config, {
                                additional: additional,
                                paths: paths,
                                enableBrowser: true,
                                includeConfig: false,
                                noArchitect: true,
                                compress: compress,
                                obfuscate: true,
                                oneLine: true,
                                filter: [],
                                ignore: [],
                                withRequire: false,
                                stripLess: false,
                                basepath: base,
                            }, function(e, r) {
                                result = r;
                                result.sources.forEach(function(m) {
                                    m.file && packedFiles.push(m.file);
                                });
                                next();
                            });
                        },
                        function(next) {
                            if (options.local)
                                return fs.writeFile(cwd + "/package." + packageName + ".js", result.code, "utf8", callback);
                            next();
                        },
                        function(next) {
                            proc.execFile("rm", {
                                args: ["-rf", "c9build"],
                                cwd: cwd
                            }, function() {
                                mkdirP(cwd + "/c9build");
                                fs.writeFile(cwd + "/c9build/package." + packageName + ".js", result.code, "utf8", next);
                            });
                        },
                        function(next) {
                            var copy = require("architect-build/copy");
                            
                            var excludeRe = /^\.(\w*ignore|git|c9|hg|build)$|^(c9)?build$/;
                            var excludeMap = Object.create(null);
                            
                            packedFiles.push(cwd + "/package." + packageName + ".js");
                            packedFiles.forEach(function(p) {
                                p = "/" + normalizePath(Path.relative(cwd, p));
                                excludeMap[p] = 1;
                            });
                            // keep installer in both packed and unpacked form
                            if (json.installer)
                                excludeMap["/" + normalizePath(Path.relative(cwd, json.installer))] = 0;
                            
                            copy(cwd, cwd + "/c9build", {
                                exclude: function(name, parent) {
                                    if (excludeRe.test(name))
                                        return true;
                                    var fullPath = parent.substr(cwd.length) + "/" + name;
                                    if (excludeMap[fullPath])
                                        return true;
                                    return false;
                                }
                            });
                            next();
                        },
                        updatePackageJSON
                    ]);
                }
            });
        }
        
        function mkdirP(path) {
            var dirs = path.split('/');
            var prevDir = dirs.splice(0, 1) + "/";
            while (dirs.length > 0) {
                var curDir = prevDir + dirs.splice(0, 1);
                if (! fs.existsSync(curDir)) {
                    fs.mkdirSync(curDir);
                }
                prevDir = curDir + '/';
            }
        }
        
        function normalizePath(p) {
            if (process.platform == "win32")
                p = p.replace(/\\/g, "/").replace(/^(\w):/, "/$1");
            return p;
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
            verbose = false;
            force = false;
        });
        
        /***** Register and define API *****/

        /**
         * 
         **/
        plugin.freezePublicAPI({
            /**
             *
             */
            publish: publish,
        });
        
        register(null, {
            "cli.publish": plugin
        });
    }
    
});
