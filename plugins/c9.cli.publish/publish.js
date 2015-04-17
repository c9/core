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
        var SHELLSCRIPT = TEST_MODE ? "" : require("text!./publish.git.sh").toString("utf8");
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
        var os = require("os");
        var FormData = require("form-data");
        var http = require(APIHOST.indexOf("localhost") > -1 ? "http" : "https");
        var Path = require("path");
        var basename = require("path").basename;
        var dirname = require("path").dirname;
        var async  = require("async");
        
        var verbose = false;
        var force = false;
        var dryRun = false;
        
        // Set up basic auth for api if needed
        if (BASICAUTH) api.basicAuth = BASICAUTH;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        // var emit = plugin.getEmitter();

        var loaded;
        function load(){
            if (loaded) return;
            loaded = true;
            
            cmd.addCommand({
                name: "publish", 
                info: "  Publishes a cloud9 package.",
                usage: "[--verbose] [--force] [<newversion> | major | minor | patch | build]",
                options: {
                    "verbose" : {
                        "description": "Output more information",
                        "alias": "v",
                        "default": false,
                        "boolean": true
                    },
                    "force" : {
                        "description": "Ignore warnings",
                        "alias": "f",
                        "default": false,
                        "boolean": true
                    },
                    "dry-run" : {
                        "description": "Only build a test version",
                        "default": false,
                        "boolean": true
                    }
                },
                check: function(argv) {
                    if (argv._.length < 2 && !argv["newversion"])
                        throw new Error("Missing version");
                },
                exec: function(argv) {
                    verbose = argv["verbose"];
                    force = argv["force"];
                    dryRun = argv["dry-run"];
                    
                    publish(
                        argv._[1],
                        function(err, data){
                            if (err) {
                                if (err.message || typeof err == "string")
                                    console.error(err.message || err);
                                
                                if (!verbose)
                                    console.error("\nTry running with --verbose flag for more information");
                                process.exit(1);
                            }
                            else {
                                console.log("Succesfully published version", data.version);
                                process.exit(0);
                            }
                        });
                }
            });
            
            cmd.addCommand({
                name: "unpublish", 
                info: "Disables a cloud9 package.",
                usage: "[--verbose]",
                options: {
                    "verbose" : {
                        "description": "Output more information",
                        "alias": "v",
                        "default": false,
                        "boolean": true
                    }
                },
                check: function(argv) {},
                exec: function(argv) {
                    verbose = argv["verbose"];
                    
                    unpublish(
                        function(err, data){
                            if (err) {
                                console.error(err.message || err || "Terminated.");
                                process.exit(1);
                            }
                            else {
                                console.log("Succesfully disabled package");
                                process.exit(0);
                            }
                        });
                }
            });
            
            cmd.addCommand({
                name: "install", 
                info: "  Installs a cloud9 package.",
                usage: "[--verbose] [--force] [--global] [--local] [--debug] <package>[@<version>]", // @TODO --global, --debug, --local
                options: {
                    "local": {
                        description: "",
                        "default": false,
                        "boolean": true
                    },
                    "global": {
                        description: "",
                        "default": false,
                        "boolean": true
                    },
                    "debug": {
                        description: "",
                        "default": false,
                        "boolean": true
                    },
                    "package" : {
                        description: "",
                        "default": false
                    },
                    "verbose" : {
                        "description": "Output more information",
                        "alias": "v",
                        "default": false,
                        "boolean": true
                    },
                    "force" : {
                        "description": "Ignore warnings",
                        "alias": "f",
                        "default": false,
                        "boolean": true
                    }
                },
                check: function(argv) {
                    if (argv._.length < 2 && !argv["package"])
                        throw new Error("package");
                },
                exec: function(argv) {
                    verbose = argv["verbose"];
                    force = argv["force"];
                    
                    if (argv.accessToken)
                        auth.accessToken = argv.accessToken;
                    
                    if (!argv.local && !argv.debug) {
                        if (!process.env.C9_PID) {
                            console.warn("It looks like you are not running on c9.io. Will default to local installation of the package");
                            argv.local = true;
                        }
                    }
                    
                    var name = argv._[1];
                    install(
                        name,
                        {
                            global: argv.global,
                            local: argv.local,
                            debug: argv.debug
                        },
                        function(err, data){
                            if (err) {
                                console.error(err.message || "Terminated.");
                                process.exit(1);
                            }
                            else {
                                console.log("Succesfully installed", name + (argv.debug ? "" : "@" + data.version));
                                process.exit(0);
                            }
                        });
                }
            });
            
            cmd.addCommand({
                name: "remove", 
                info: "   Removes a cloud9 package.",
                usage: "[--verbose] [--global] [--local] <package>", // @TODO --global
                options: {
                    "local": {
                        description: "",
                        "default": false,
                        "boolean": true
                    },
                    "global": {
                        description: "",
                        "default": false,
                        "boolean": true
                    },
                    "package" : {
                        description: ""
                    },
                    "verbose" : {
                        "description": "Output more information",
                        "alias": "v",
                        "default": false,
                        "boolean": true
                    }
                },
                check: function(argv) {
                    if (argv._.length < 2 && !argv["package"])
                        throw new Error("package");
                },
                exec: function(argv) {
                    verbose = argv["verbose"];
                    
                    if (argv.accessToken)
                        auth.accessToken = argv.accessToken;
                    
                    var name = argv._[1];
                    uninstall(
                        name,
                        {
                            global: argv.global,
                            local: argv.local
                        },
                        function(err, data){
                            if (err) {
                                console.error(err.message || "Terminated.");
                                process.exit(1);
                            }
                            else {
                                console.log("Succesfully removed", name);
                                process.exit(0);
                            }
                        });
                }
            });
            
            cmd.addCommand({
                name: "list", 
                info: "     Lists all available packages.",
                usage: "[--json]",
                options: {
                    "json": {
                        description: "",
                        "default": false,
                        "boolean": true
                    },
                },
                check: function(argv) {},
                exec: function(argv) {
                    verbose = argv["verbose"];
                    
                    list(argv.json);
                }
            });
        }

        /***** Methods *****/
        
        function stringifyError(err){
            return (verbose ? JSON.stringify(err, 4, "    ") : (typeof err == "string" ? err : err.message));
        }
        
        function list(asJson, callback){
            callback = callback || function(){};
            api.packages.get("", function(err, list){
                if (err) {
                    console.error("ERROR: Could not get list: ", stringifyError(err));
                    return callback(err);
                }
                
                if (asJson) {
                    console.log(JSON.stringify(list, 4, "   "));
                    return callback(null, list);
                }
                else {
                    list.forEach(function(item){
                        console.log(item.name, "https://c9.io/packages/" + item.name);
                    });
                    return callback(null, list);
                }
            });
        }
        
        function publish(version, callback) {
            var cwd = process.cwd();
            var packagePath = cwd + "/package.json";
            fs.readFile(packagePath, function(err, data){
                if (err) return callback(new Error("ERROR: Could not find package.json in " + cwd));
                
                var json;
                try { json = JSON.parse(data); }
                catch(e) { 
                    return callback(new Error("ERROR: Could not parse package.json: ", e.message)); 
                }
                
                // Basic Validation
                if (!json.name)
                    return callback(new Error("ERROR: Missing name property in package.json"));
                if (basename(cwd) != json.name) {
                    console.warn("WARNING: The name property in package.json is not equal to the directory name, which is " + basename(cwd));
                    if (!force)
                        return callback(new Error("Use --force to ignore this warning."));
                }
                if (!json.description)
                    return callback(new Error("ERROR: Missing description property in package.json"));
                if (!json.repository)
                    return callback(new Error("ERROR: Missing repository property in package.json"));
                if (!json.categories || json.categories.length == 0)
                    return callback(new Error("ERROR: At least one category is required in package.json"));
                
                // Validate README.md
                if (!fs.existsSync(join(cwd, "README.md"))) {
                    console.warn("WARNING: README.md is missing.");
                    if (!force)
                        return callback(new Error("Use --force to ignore these warnings."));
                }
                
                // Validate plugins
                var plugins = {};
                fs.readdirSync(cwd).forEach(function(filename) {
                    if (/(__\w*__|_test)\.js$/.test(filename) || !/\.js$/.test(filename)) return;
                    try {
                        var val = fs.readFileSync(cwd + "/" + filename);
                    } catch(e) {
                        if (e.code == "EISDIR") return;
                        throw e;
                    }
                    if (!/\(options,\s*imports,\s*register\)/.test(val)) return;
                    if (!/consumes\s*=/.test(val)) return;
                    if (!/provides\s*=/.test(val)) return;
                    plugins[filename] = {};
                });
                
                var warned, failed;
                Object.keys(plugins).forEach(function(name){
                    if (!json.plugins[name.replace(/\.js$/, "")]) {
                        console.warn("WARNING: Plugin '" + name + "' is not listed in package.json.");
                        warned = true;
                    }
                    // @TODO temporarily disabled the requirement for tests while tests cannot actually run yet
                    // else if (!fs.existsSync(join(cwd, name.replace(/\.js$/, "_test.js")))) {
                    //     console.warn("ERROR: Plugin '" + name + "' has no test associated with it.");
                    //     failed = true;
                    // }
                });
                
                if (failed)
                    return callback(new Error());
                
                if (warned && !force)
                    return callback(new Error("Use --force to ignore these warnings."));
                
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
                
                // Write the package.json file
                fs.writeFile(packagePath, JSON.stringify(json, 1, "  "), function(err){
                    if (err) return callback(err);
                    
                    if (dryRun) return build();
                    
                    SHELLSCRIPT = SHELLSCRIPT
                        .replace(/\$1/, packagePath)
                        .replace(/\$2/, json.version);
                    
                    proc.spawn("bash", {
                        args: ["-c", SHELLSCRIPT]
                    }, function(err, p){
                        if (err) return callback(err);
                        
                        if (verbose) {
                            p.stdout.on("data", function(c){
                                process.stdout.write(c.toString("utf8"));
                            });
                            p.stderr.on("data", function(c){
                                process.stderr.write(c.toString("utf8"));
                            });
                        }
                        
                        p.on("exit", function(code, stderr, stdout){
                            if (code !== 0) 
                                return callback(new Error("ERROR: publish failed with exit code " + code));
                            
                            console.log("Created tag and updated package.json to version", json.version);
                            
                            build();
                        });
                    });
                });
                
                // Build the package
                // @TODO use a proper package tool
                // @TODO add a .c9exclude file that excludes files
                var zipFilePath;
                function build(){
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
                                    } catch(e) {
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
                                        if (/(?:_highlight_rules|_test|_worker|_fold|_behaviou?r).js$/.test(filename))
                                            return;
                                        var firstLine = data.split("\n", 1)[0];
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
                                
                                if (json.installer) {
                                    var path = join(cwd, json.installer);
                                    var installerCode = fs.readFileSync(path, "utf8");
                                    
                                    var m = installerCode.match(/\.version\s*=\s*(\d+)/g);
                                    
                                    var installerVersion = m && m[0];
                                    if (!installerVersion)
                                        return callback(new Error("ERROR: missing installer version in " +  json.installer));
                                    extraCode.push({
                                        type: "installer",
                                        filename: json.installer,
                                        data: version
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
                                            
                                            plugin.load("PACKAGE_NAME.Bundle");
                                            
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
                            var path = "plugins/" + packageName + "/__installed__";
                            additional.push({
                                id: path,
                                source: 'define("' + path + '", [],' + 
                                    JSON.stringify(packedConfig, null, 4) + ')',
                                literal : true,
                                order: -1
                            });
                            
                            build(config, {
                                additional: additional,
                                paths: paths,
                                enableBrowser: true,
                                includeConfig: false,
                                noArchitect: true,
                                compress: !dryRun,
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
                            fs.writeFile("__packed__.js", result.code, "utf8", next);
                        },
                        function(next) {
                            // console.log(packedFiles)
                            zip(packedFiles);
                        }
                    ]);
 
                }
                
                function normalizePath(p) {
                    if (process.platform == "win32")
                        p = p.replace(/\\/g, "/").replace(/^(\w):/, "/$1");
                    return p;
                }
                
                function zip(ignore){
                    zipFilePath = join(os.tmpDir(), json.name + "@" + json.version) + ".tar.gz";
                    var tarArgs = ["-zcvf", normalizePath(zipFilePath), "."]; 
                    var c9ignore = normalizePath(process.env.HOME + "/.c9/.c9ignore");
                    fs.exists(c9ignore, function (exists) {
                        if (exists) {
                            tarArgs.push("--exclude-from=" + c9ignore);
                        }
                        ignore.forEach(function(p) {
                            p = Path.relative(cwd, p);
                            if (!/^\.+\//.test(p)) {
                                tarArgs.push("--exclude=./" + normalizePath(p));
                            }
                        });
                        tarArgs.push("--transform='flags=r;s|__packed__|__installed__|'");
                        // console.log(tarArgs)
                        proc.spawn(TAR, {
                            args: tarArgs,
                            cwd: cwd
                        }, function(err, p){
                            if (err) return callback(err);
                            
                            if (verbose) {
                                p.stdout.on("data", function(c){
                                    process.stdout.write(c.toString("utf8"));
                                });
                                p.stderr.on("data", function(c){
                                    process.stderr.write(c.toString("utf8"));
                                });
                            }
                            
                            p.on("exit", function(code){
                                if (code !== 0)
                                    return callback(new Error("ERROR: Could not package directory"));
                                
                                console.log("Built package", json.name + "@" + json.version);
                                
                                if (dryRun) return callback(1);
                                
                                upload();
                            });
                        });
                    });
                }
                
                // Update c9.io with the new version being published.
                function upload(){
                    // Check if the plugin is already registered
                    if (verbose)
                        console.log("Uploading package " + json.name);
                    
                    api.packages.get(json.name, function(err, pkg){
                        if (err) {} // Ignore error, if we don't get a response it means this package hasn't been published yet
                        
                        if (!pkg || pkg.error) {
                            if (verbose)
                                console.log("Package not registered, creating new.");
                            
                            // Registers the package name on c9.io if it is being published for the first time. 
                            api.user.get("", function(err, user){
                                if (err) return callback(new Error("ERROR: Failed to get user details from API - " + stringifyError(err)));
                                
                                api.packages.post("", {
                                    contentType: "application/json",
                                    body: {
                                        name: json.name,
                                        description: json.description,
                                        owner_type: "user", // @TODO implement this when adding orgs
                                        owner_id: parseInt(user.id),
                                        permissions: json.permissions || "world",
                                        categories: json.categories,
                                        repository: json.repository,
                                        longname: json.longname,
                                        website: json.website,
                                        screenshots: json.screenshots || [],
                                        pricing: json.pricing || {}
                                    }
                                }, function(err, pkg){
                                    if (err) 
                                        return callback(new Error("ERROR: Failed to upload new package to API - " 
                                            + stringifyError(err)));
                                    
                                    next(pkg);
                                });
                            });
                        }
                        else {
                            if (verbose)
                                console.log("Plugin already registered, updating.");
                            
                            api.packages.put(json.name, {
                                contentType: "application/json",
                                body: {
                                    permissions: json.permissions,
                                    categories: json.categories,
                                    repository: json.repository,
                                    longname: json.longname,
                                    website: json.website,
                                    description: json.description,
                                    screenshots: json.screenshots,
                                    pricing: json.pricing,
                                    enabled: true
                                }
                            }, function(err, pkg){
                                if (err) 
                                    return callback(new Error("ERROR: Failed to update existing package - " 
                                        + stringifyError(err)));
                                if (verbose)
                                    console.log("Successfully updated existing package");
                                
                                next(pkg);
                            });
                        }
                        
                        function next(pkg){
                            // Create Version
                            if (verbose)
                                console.log("Sending new version ", json.version);
                            
                            var form = new FormData();
                            form.append('version', json.version);
                            form.append('options', JSON.stringify(json.plugins));
                            form.append('package', fs.createReadStream(zipFilePath));
                            
                            var path = "/packages/" + json.name 
                                + "/versions?access_token=" 
                                + encodeURIComponent(auth.accessToken);
                            var host = APIHOST.split(":")[0]
                            var port = parseInt(APIHOST.split(":")[1]) || null;
                            
                            var request = http.request({
                                agent: false,
                                method: "post",
                                host: host, 
                                port: port,
                                path: path, 
                                auth: BASICAUTH,
                                headers: form.getHeaders()
                            });
                            
                            form.pipe(request);
                            
                            request.on('response', function(res) {
                                if (res.statusCode != 200)
                                    return callback(new Error("ERROR: Unknown Error:" + res.statusCode));
                            
                                // Create Version Complete
                                callback(null, json);
                            });
                        }
                    });
                }
            });
        }
        
        function unpublish(callback){
            var packagePath = process.cwd() + "/package.json";
            fs.readFile(packagePath, function(err, data){
                if (err) return callback(err); // @TODO package.json not found
                
                var json;
                try { json = JSON.parse(data); }
                catch(e) { 
                    return callback(new Error("ERROR: Could not parse package.json: ", e.message)); 
                }
                
                if (!json.name)
                    return callback(new Error("ERROR: Missing name property in package.json"));
                
                api.packages.put(json.name + "/disable", {}, callback);
            });
        }
        
        function install(packageName, options, callback){
            // Call install url
            var parts = packageName.split("@");
            var name = parts[0];
            var version = parts[1];
            var repository;
            
            if (!version || options.debug) {
                if (verbose)
                    console.log("Retrieving package info");
                    
                api.packages.get(name, function (err, info) {
                    if (err) return callback(err);
                    
                    if (verbose)
                        console.log("Found:", info);
                        
                    version = info.latest;
                    repository = info.repository;
                    
                    installPackage();
                });
            }
            else {
                installPackage();
            }
            
            function prepareDirectory(callback){
                // Create package dir
                var packagePath = process.env.HOME + "/.c9/plugins/" + name;
                var exists = fs.existsSync(packagePath) ;
                if (exists) {
                    if (!force)
                        return callback(new Error("WARNING: Directory not empty: " + packagePath 
                            + ". Use --force to overwrite."));
                
                    proc.execFile("rm", {
                        args: ["-Rf", packagePath]
                    }, function(){
                        mkdirP(packagePath);
                        callback(null, packagePath);
                    });
                }
                else {
                    mkdirP(packagePath);
                    callback(null, packagePath);
                }
            }
            
            function installPackage(){
                if (!version)
                    return callback(new Error("No version found for this package"));
                
                if (options.local) {
                    if (verbose)
                        console.log("Installing package locally");
                    
                    prepareDirectory(function(err, packagePath){
                        if (err) return callback(err);
                        
                        // Download package
                        var gzPath = join(os.tmpDir(), name + "@" + version + ".tar.gz");
                        var file = fs.createWriteStream(gzPath);
                        
                        var path = "/packages/" + name + "/versions/" + version 
                                + "/download?access_token="
                                + encodeURIComponent(auth.accessToken);
                        var host = APIHOST.split(":")[0];
                        var port = parseInt(APIHOST.split(":")[1]) || null;
                        
                        var request = http.get({
                            agent: false,
                            method: "get",
                            host: host, 
                            port: port,
                            auth: BASICAUTH,
                            path: path
                        }, function(response){
                            response.pipe(file);
                        });
                        
                        if (verbose)
                            console.log("Downloading package to", gzPath);
                        
                        request.on('response', function(res) {
                            if (res.statusCode != 200) 
                                return callback(new Error("Unknown Error:" + res.statusCode));
                                
                            if (verbose)
                                console.log("Unpacking", gzPath, "to", packagePath);
                            
                            // Untargz package
                            proc.spawn(TAR, {
                                args: ["-C", packagePath, "-zxvf", gzPath]
                            }, function(err, p){
                                if (err) return callback(err);
                                
                                if (verbose) {
                                    p.stdout.on("data", function(c){
                                        process.stdout.write(c.toString("utf8"));
                                    });
                                    p.stderr.on("data", function(c){
                                        process.stderr.write(c.toString("utf8"));
                                    });
                                }
                                
                                p.on("exit", function(code){
                                    var err = code !== 0
                                        ? new Error("Failed to unpack package")
                                        : null;
                                    if (err) return callback(err);
                                    
                                    proc.spawn(join(process.env.HOME, ".c9/node/bin/npm"), {
                                        args: ["install"],
                                        cwd: packagePath
                                    }, function(err, p){
                                        if (err) return callback(err);
                                        
                                        if (verbose) {
                                            p.stdout.on("data", function(c){
                                                process.stdout.write(c.toString("utf8"));
                                            });
                                            p.stderr.on("data", function(c){
                                                process.stderr.write(c.toString("utf8"));
                                            });
                                        }
                                        
                                        p.on("exit", function(code){
                                            // Done
                                            callback(err, {
                                                version: version
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                }
                else if (options.debug) {
                    if (verbose)
                        console.log("Installing debug version of package");
                    
                    prepareDirectory(function(err, packagePath){
                        if (err) return callback(err);
                    
                        if (verbose)
                            console.log("Cloning repository: ", repository);
                        
                        // Git clone repository
                        var scm = SCM[repository.type];
                        proc.spawn(scm.binary, {
                            args: [scm.clone, repository.url, packagePath]
                        }, function(err, p){
                            if (err) return callback(err);
                            
                            if (verbose) {
                                p.stdout.on("data", function(c){
                                    process.stdout.write(c.toString("utf8"));
                                });
                                p.stderr.on("data", function(c){
                                    process.stderr.write(c.toString("utf8"));
                                });
                            }
                            
                            p.on("exit", function(code){
                                var err = code !== 0
                                    ? new Error("Failed to clone package from repository. Do you have access?")
                                    : null;
                                
                                // Done
                                callback(err);
                            });
                        });
                    });
                }
                else {
                    if (verbose)
                        console.log("Notifying c9.io that packages needs to be installed");
                    
                    var endpoint = options.global ? api.user : api.project;
                    var url = "install/" + packageName + "/" + version;
                    
                    endpoint.post(url, function(err, info){
                        callback(err, info);
                    });
                }
            }
        }
        
        function uninstall(packageName, options, callback){
            // Call uninstall url
            var parts = packageName.split("@");
            var name = parts[0];
            var version = parts[1];
            
            if (!version) {
                api.packages.get(name, function (err, info) {
                    if (err) return callback(err);
                    version = info.latest;
                    
                    uninstallPackage();
                });
            }
            else {
                uninstallPackage();
            }
            
            function uninstallPackage(){
                if (options.local || options.debug) {
                    // rm -Rf
                    var packagePath = process.env.HOME + "/.c9/plugins/" + name;
                    proc.spawn("rm", {
                        args: ["-rf", packagePath]
                    }, function(err, p){
                        if (err) return callback(err);
                        
                        if (verbose) {
                            p.stdout.on("data", function(c){
                                process.stdout.write(c.toString("utf8"));
                            });
                            p.stderr.on("data", function(c){
                                process.stderr.write(c.toString("utf8"));
                            });
                        }
                        
                        p.on("exit", function(code){
                            var err = code !== 0
                                ? new Error("Failed to remove package.")
                                : null;
                            
                            // if debug > see if should be installed and put back original
                            // @TODO
                            
                            // Done
                            callback(err);
                        });
                    });
                }
                else {
                    var endpoint = options.global ? api.user : api.project;
                    var url = "uninstall/" + packageName;
                    
                    endpoint.post(url, function(err, info){
                        callback(err, info);
                    });
                }
            }
        }
        
        function mkdirP(path){
            var dirs = path.split('/');
            var prevDir = dirs.splice(0,1) + "/";
            while (dirs.length > 0) {
                var curDir = prevDir + dirs.splice(0,1);
                if (! fs.existsSync(curDir) ) {
                    fs.mkdirSync(curDir);
                }
                prevDir = curDir + '/';
            }
        }

        /***** Lifecycle *****/
        
        plugin.on("load", function(){
            load();
        });
        plugin.on("enable", function(){
            
        });
        plugin.on("disable", function(){
            
        });
        plugin.on("unload", function(){
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
            
            /**
             * 
             */
            unpublish: unpublish,
            
            /**
             *
             */
            install: install,
            
            /**
             * 
             */
            uninstall: uninstall,
            
            /**
             * 
             */
            list: list
        });
        
        register(null, {
            "cli.publish": plugin
        });
    }
    
});
