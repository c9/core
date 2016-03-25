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
        var SHELLSCRIPT = TEST_MODE ? "" : require("text!./publish.git.sh");
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
        var createTag = false;
        var compress = false;
        
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
                    },
                    "tag" : {
                        "description": "Create git tag for published version",
                        "alias": "t",
                        "default": false,
                        "boolean": true
                    },
                    "compress" : {
                        "description": "Minify output with uglify.js",
                        "default": true,
                        "boolean": true
                    }
                },
                check: function(argv) {
                    
                },
                exec: function(argv) {
                    verbose = argv["verbose"];
                    force = argv["force"];
                    dryRun = argv["dry-run"];
                    createTag = argv["tag"];
                    
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
                            else if (!dryRun) {
                                console.log("Successfully published version", data.version);
                                process.exit(0);
                            }
                        });
                }
            });
            
            cmd.addCommand({
                name: "build", 
                info: "    Builds development version of package to load in non-debug mode.",
                usage: "[--devel]",
                options: {
                    "devel" : {
                        "description": "",
                        "alias": "d",
                        "default": false,
                        "boolean": true
                    },
                    "compress" : {
                        "description": "Minify output with uglify.js",
                        "default": false,
                        "boolean": true
                    }
                },
                exec: function(argv) {
                    compress = argv["compress"];
                    verbose = argv["verbose"];
                    force = argv["force"];
                    if (argv["devel"]) {
                        var code = function(argument) {
                            /* TODO explain */
                            define("plugins/PACKAGE_NAME/__installed__", [],[
                                "plugins/PACKAGE_NAME/__debug__"
                            ]);
                            define("plugins/PACKAGE_NAME/__debug__",[], function(require, exports, module) {
                                main.consumes = ["plugin.debug"];
                                main.provides = [];
                                return main;
                            
                                function main(options, imports, register) {
                                    var debug = imports["plugin.debug"];
                                    debug.loadPackage("PACKAGE_NAME");
                                }
                            });
                        }.toString();
                        var cwd = process.cwd();
                        var packageName = basename(cwd);
                        var indent = code.match(/\n\r?(\s*)/)[1].length;
                        code = code
                            .replace(/\r/g, "")
                            .replace(new RegExp("^ {" + indent + "}", "gm"), "")
                            .replace(/^.*?{|}$/g, "")
                            .trim()
                            .replace(/PACKAGE_NAME/g, packageName);
                                    
                        fs.writeFileSync(cwd + "/__installed__.js", code, "utf8");
                    } 
                    else {
                        dryRun = true;
                        publish({local: true}, function(err, result){
                            if (err) {
                                console.error(err);
                                if (!verbose)
                                    console.error("\nTry running with --verbose flag for more information");
                                process.exit(1);
                            }
                            console.log("Done!");
                        });
                    }
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
                    compress = argv["compress"];
                    
                    unpublish(
                        function(err, data){
                            if (err) {
                                console.error(err.message || err || "Terminated.");
                                process.exit(1);
                            }
                            else {
                                console.log("Successfully disabled package");
                                process.exit(0);
                            }
                        });
                }
            });
        }

        /***** Methods *****/
        
        function spawn(command, options, callback) {
            if (options.stdio == null) {
                // if verbose, echo stdout
                // always echo stderr
                options.stdio = [
                    "pipe",
                    verbose ? process.stdout : "ignore",
                    process.stderr
                ];
            }
            
            proc.spawn(command, options, function(err, child) {
                if (err) return callback(err);
                
                child.on("exit", function(code) {
                    if (code !== 0) {
                        var error = new Error("Command failed: " + command);
                        error.code = code;
                        return callback(error);
                    }
                    
                    callback();
                });
            });
        }
        
        function stringifyError(err){
            return (verbose ? JSON.stringify(err, 4, "    ") : (typeof err == "string" ? err : err.message));
        }
        
        function addMissingValues(json) {
            json.permissions = json.permissions || "world";
            
            return json;
        }
        
        function validateConfig(json) {
            var cwd = process.cwd();
            
            // Basic Validation
            if (json.private)
                return new Error("ERROR: Private flag in package.json prevents from publishing");
            if (!json.name)
                return new Error("ERROR: Missing name property in package.json");
            if (!json.name.match(/^[\w\._]+$/))
                return new Error("ERROR: Package name can only contain Alphanumeric characters, periods and underscores");
            if (basename(cwd) != json.name) {
                console.warn("WARNING: The name property in package.json is not equal to the directory name, which is " + basename(cwd));
                if (!force)
                    return new Error("Use --force to ignore this warning.");
            }
            if (!json.repository)
                return new Error("ERROR: Missing repository property in package.json");
            if (!json.repository.url)
                return new Error("ERROR: Missing repository.url property in package.json");
            if (!json.categories || json.categories.length == 0)
                return new Error("ERROR: At least one category is required in package.json");
            if (!json.permissions || !json.permissions.match(/org|world/)) 
                return new Error("ERROR: Permissions must be 'org' or 'world'");
        }
        
        function publish(options, callback) {
            if (typeof options != "object")
                options = {version: options};
            
            var version = options.version;
            var cwd = process.cwd();
            var packagePath = cwd + "/package.json";
            fs.readFile(packagePath, "utf8", function(err, data){
                if (err) return callback(new Error("ERROR: Could not find package.json in " + cwd));
                
                var json;
                try { json = JSON.parse(data); }
                catch(e) { 
                    return callback(new Error("ERROR: Could not parse package.json: ", e.message)); 
                }
                
                console.log("Permissions are: ", json.permissions);
                console.log("Data is: ", data);
                json = addMissingValues(json);
                
                console.log("Permissions are: ", json.permissions);
                var validationError = validateConfig(json);
                if (validationError) return callback(validationError);
                
                var description = json.description;
                
                if (description)
                    console.warn("WARNING: Description property in package.json will be ignored. README.md will be used.");
                
                // Validate README.md
                if (fs.existsSync(join(cwd, "README.md"))) {
                    description = fs.readFileSync(join(cwd, "README.md"), "utf8")
                        .replace(/^\#.*\n*/, "");
                } else {
                    console.warn("WARNING: README.md is missing.");
                    if (!force)
                        return callback(new Error("Use --force to ignore these warnings."));
                }
                
                // Validate plugins
                var plugins = {};
                
                var warned, failed;
                Object.keys(json.plugins || {}).forEach(function(name){
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
                    } catch(e) {
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
                    fs.writeFile(cwd + "/.c9/.build/package.json", newData, function(){
                        if (dryRun)
                            return next(); // if dry-run is passed only update path in .build
                        fs.writeFile(packagePath, newData, function(err){
                            if (err) return callback(err);
                            return next();
                        });
                    });
                }
                
                // Build the package
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
                                
                                packedFiles.push(cwd + "/__installed__.js");
                                
                                if (json.installer) {
                                    var path = join(cwd, json.installer);
                                    var installerCode = fs.readFileSync(path, "utf8");
                                    
                                    var m = installerCode.match(/\.version\s*=\s*(\d+)/);
                                    
                                    var installerVersion = m && m[1];
                                    if (!installerVersion)
                                        return callback(new Error("ERROR: missing installer version in " +  json.installer));
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
                            var path = "plugins/" + packageName + "/__installed__";
                            additional.push({
                                id: path,
                                source: 'define("' + path + '", [],' + 
                                    JSON.stringify(packedConfig.map(function(p) {
                                        var name = p.slice(p.lastIndexOf("/") + 1)
                                        var options = json.plugins[name] || {};
                                        options.packagePath = p;
                                        return options;
                                    }), null, 4) + ');',
                                literal : true,
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
                                return fs.writeFile(cwd + "/__installed__.js", result.code, "utf8", callback);
                            next();
                        },
                        function(next) {
                            proc.execFile("rm", {
                                args: ["-rf", ".c9/.build"],
                                cwd: cwd
                            }, function() {
                                mkdirP(cwd + "/.c9/.build");
                                fs.writeFile(cwd + "/.c9/.build/__installed__.js", result.code, "utf8", next);
                            });
                        },
                        function(next) {
                            var copy = require("architect-build/copy");
                            
                            var excludeRe = /^\.(gitignore|hgignore|git|c9|hg)$/;
                            var excludeMap = Object.create(null);
                            
                            packedFiles.push(cwd + "/__installed__.js");
                            packedFiles.forEach(function(p) {
                                p = "/" + normalizePath(Path.relative(cwd, p));
                                excludeMap[p] = 1;
                            });
                            // keep installer in both packed and unpacked form
                            if (json.installer)
                                excludeMap["/" + normalizePath(Path.relative(cwd, json.installer))] = 0;
                            
                            copy(cwd, cwd + "/.c9/.build", {
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
                        updatePackageJSON,
                        function(next) {
                            zip();
                        }
                    ]);
 
                }
                
                function zip(){
                    zipFilePath = join(os.tmpDir(), json.name + "@" + json.version) + ".tar.gz";
                    var tarArgs = ["-zcvf", normalizePath(zipFilePath)]; 
                    var c9ignore = normalizePath(process.env.HOME + "/.c9/.c9ignore");
                    fs.exists(c9ignore, function (exists) {
                        if (exists) {
                            tarArgs.push("--exclude-from=" + c9ignore);
                        }
                        tarArgs.push(".");
                        spawn(TAR, {
                            args: tarArgs,
                            cwd: cwd + "/.c9/.build"
                        }, function(err){
                            if (err)
                                return callback(new Error("ERROR: Could not package directory"));
                                
                            console.log("Built package", json.name + "@" + json.version +
                                (dryRun ? " at " + zipFilePath : ""));
                            
                            if (dryRun) return callback();
                            
                            upload();
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
                                        description: description,
                                        owner_type: "user", // @TODO implement this when adding orgs
                                        owner_id: parseInt(user.id),
                                        permissions: json.permissions,
                                        categories: json.categories,
                                        repository: json.repository,
                                        longname: json.longname,
                                        website: json.website,
                                        screenshots: json.screenshots || [],
                                        pricing: json.pricing || {}
                                    }
                                }, function(err, pkg){
                                    if (err) {
                                        return callback(new Error("ERROR: Failed to upload new package to API - " 
                                            + stringifyError(err)));
                                    }
                                    
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
                                    description: description,
                                    screenshots: json.screenshots,
                                    pricing: json.pricing,
                                    enabled: true
                                }
                            }, function(err, pkg){
                                if (err) 
                                    return callback(new Error("ERROR: Failed to update existing package - " 
                                        + stringifyError(err)));
                                if (verbose)
                                    console.log("Successfully updated metadata of existing package");
                                
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
                                // TODO better handle version exists error
                                if (res.statusCode == 412)
                                    console.error("ERROR: most likely version " + json.version + " already exisits, try increasing version");
                                if (res.statusCode != 200)
                                    return callback(new Error("ERROR: Unknown Error:" + res.statusCode));
                            
                                commitAndPush();
                            });
                        }
                    });
                }
                
                function commitAndPush() {
                    // Create Version Complete
                    if (!createTag)
                        callback(null, json);
                                
                    spawn("bash", {
                        args: ["-c", SHELLSCRIPT, "--", json.version, normalizePath(packagePath)]
                    }, function(err, p){
                        if (err) return callback(err);                            
                        console.log("Created tag and updated package.json to version", json.version);                            
                        callback(null, json);
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
        
        function normalizePath(p) {
            if (process.platform == "win32")
                p = p.replace(/\\/g, "/").replace(/^(\w):/, "/$1");
            return p;
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
            unpublish: unpublish
        });
        
        register(null, {
            "cli.publish": plugin
        });
    }
    
});
