define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "cli_commands", "proc", "api", "auth", "installer", 
        "installer.cli"
    ];
    main.provides = ["cli.install"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var cmd = imports.cli_commands;
        var proc = imports.proc;
        var auth = imports.auth;
        var api = imports.api;
        var installer = imports.installer;
        var installerCLI = imports["installer.cli"];
        
        var dirname = require("path").dirname;
        
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
        var os = require("os");
        var http = require(APIHOST.indexOf("localhost") > -1 ? "http" : "https");
        
        var verbose = false;
        var force = false;
        
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
                name: "install", 
                info: "  Installs a cloud9 package.",
                usage: "[--verbose] [--force] [--global] [--local] [--debug] [<package>[@<version>] | . ]",
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
                    var test = name == ".";
                    if (test)
                        name = require("path").basename(process.cwd());
                    
                    install(
                        name,
                        {
                            global: argv.global,
                            local: argv.local,
                            debug: argv.debug,
                            test: test
                        },
                        function(err, data){
                            if (err) {
                                console.error(err.message || "Terminated.");
                                process.exit(1);
                            }
                            else {
                                console.log("Successfully installed", name + (argv.debug ? "" : "@" + data.version));
                                process.exit(0);
                            }
                        });
                }
            });
            
            cmd.addCommand({
                name: "remove", 
                alias: "uninstall",
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
                                console.log("Successfully removed", name);
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
        
        function install(packageName, options, callback){
            // Call install url
            var parts = packageName.split("@");
            var name = parts[0];
            var version = parts[1];
            var repository;
            
            if ((!version || options.debug) && !options.test) {
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
                var exists = fs.existsSync(packagePath);
                
                // Ignore when testing and in the same dir
                if (options.test && process.cwd() == packagePath)
                    exists = false;
                
                if (exists) {
                    if (!force && !options.test)
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
                if (!version && !options.test)
                    return callback(new Error("No version found for this package"));
                
                if (options.local) {
                    installLocal();
                }
                else if (options.debug) {
                    installDebug();
                }
                else {
                    installFull();
                }
            }
            
            function installLocal(){
                if (verbose)
                    console.log("Installing package locally");
                
                prepareDirectory(function(err, packagePath){
                    if (err) return callback(err);
                    
                    function installNPM(){
                        spawn(join(process.env.HOME, process.platform == "win32"? ".c9/npm.cmd" : ".c9/node/bin/npm"), {
                            args: ["install"],
                            cwd: packagePath
                        }, function(err) {
                            if (err) return callback(err);
                            callback(null, { version: version });
                        });
                    }
                    
                    if (options.test) {
                        try {
                            var json = JSON.parse(fs.readFileSync(join(process.cwd(), "package.json")));
                            if (json.private)
                                return callback(new Error("ERROR: Private flag in package.json prevents from installing"));
                        }
                        catch(e) {
                            return callback(new Error("ERROR: Invalid package: " + e.message));
                        }
                        
                        if (process.cwd() == packagePath)
                            installNPM();
                        else {
                            proc.execFile("cp", { 
                                args: ["-R", process.cwd(), dirname(packagePath)]
                            }, function(err){
                                if (err) return callback(err);
                                
                                installNPM();
                            });
                        }
                        
                        return;
                    }
                    
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
                    });
                    
                    file.on('finish', function() {
                        if (verbose)
                            console.log("Unpacking", gzPath, "to", packagePath);
                        
                        // Untargz package
                        spawn(TAR, {
                            args: [
                                (verbose ? "-v" : ""),
                                "-C", normalizePath(packagePath),
                                "-zxf", normalizePath(gzPath)
                            ]
                        }, function(err) {
                            if (err) {
                                var error = new Error("Failed to unpack package");
                                error.code = err.code;
                                return callback(error);
                            }
                            
                            installNPM();
                        });
                    });
                });
            }
            
            function installDebug(){
                if (verbose)
                    console.log("Installing debug version of package");
                
                if (options.test)
                    return callback(new Error("Test is not supported for debug installations"));
                
                prepareDirectory(function(err, packagePath){
                    if (err) return callback(err);
                
                    if (verbose)
                        console.log("Cloning repository: ", repository);
                    
                    // Git clone repository
                    var scm = SCM[repository.type];
                    spawn(scm.binary, {
                        args: [scm.clone, repository.url, packagePath]
                    }, function(err) {
                        if (err) {
                            var error = new Error("Failed to clone package from repository. Do you have access?");
                            error.code = err.code;
                            return callback(error);
                        }
                        
                        callback();
                    });
                });
            }
            
            function installFull(){
                // Install Locally
                options.local = true;
                install(name + "@" + version, options, function(err){
                    if (err) return callback(err);
                
                    var path = process.env.HOME + "/.c9/plugins/" + name;
                    fs.readFile(path + "/package.json", "utf8", function(err, data){
                        if (err) return callback(new Error("Package.json not found in " + path));
                
                        var installPath;
                        try { installPath = JSON.parse(data).installer; }
                        catch(e){ 
                            return callback(new Error("Could not parse package.json in " + path));
                        }
                        
                        if (installPath) {
                            installerCLI.verbose = verbose;
                            installer.createSession(name, version || "", require(path + "/" + installPath), function(err){
                                if (err) return callback(new Error("Error Installing Package " + name + "@" + version));
                                installToDatabase();
                            }, force || options.test);
                        }
                        else
                            installToDatabase();
                    });
                    
                    
                    function installToDatabase(){
                        if (options.test)
                            return callback(null, { version: "test" });
                            
                        if (verbose)
                            console.log("Notifying c9.io that packages needs to be installed");
                        
                        var endpoint = options.global ? api.user : api.project;
                        var url = "install/" + packageName + "/" + version + "?mode=silent";
                        
                        endpoint.post(url, function(err, info){
                            callback(err, info);
                        });
                    }
                });
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
                    spawn("rm", {
                        args: ["-rf", packagePath]
                    }, function(err) {
                        if (err) {
                            var error = new Error("Failed to remove package.");
                            error.code = err.code;
                            return callback(error);
                        }
                        
                        // if debug > see if should be installed and put back original
                        // @TODO
                        
                        callback();
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
        
        /***** Register and definfe API *****/

        /**
         * 
         **/
        plugin.freezePublicAPI({
            /**
             *
             */
            install: install,
            
            /**
             * 
             */
            uninstall: uninstall
        });
        
        register(null, {
            "cli.install": plugin
        });
    }
    
});