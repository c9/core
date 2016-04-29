"use strict";

plugin.consumes = [
    "connect.static", 
    "connect",
    "preview.handler",
    "connect.render",
    "connect.render.ejs"
];
plugin.provides = ["api", "passport"];

module.exports = plugin;
    
var fs = require("fs");
var assert = require("assert");
var async = require("async");
var join = require("path").join;
var extend = require("util")._extend;
var resolve = require("path").resolve;
var basename = require("path").basename;
var frontdoor = require("frontdoor");

function plugin(options, imports, register) {
    var previewHandler = imports["preview.handler"];
    var statics = imports["connect.static"];
    
    assert(options.workspaceDir, "Option 'workspaceDir' is required");
    assert(options.options, "Option 'options' is required");
    

    // serve index.html
    statics.addStatics([{
        path: __dirname + "/www",
        mount: "/"
    }]);
    
    statics.addStatics([{
        path: __dirname + "/../../configs",
        mount: "/configs"
    }]);

    statics.addStatics([{
        path: __dirname + "/../../test/resources",
        mount: "/test"
    }]);

    var api = frontdoor();
    imports.connect.use(api);
    
    api.get("/", function(req, res, next) {
        res.writeHead(302, { "Location": options.sdk ? "/ide.html" : "/static/places.html" });
        res.end();
    });
    
    api.get("/ide.html", {
        params: {
            workspacetype: {
                source: "query",
                optional: true
            },
            devel: {
                source: "query",
                optional: true
            },
            collab: {
                type: "number",
                optional: true,
                source: "query"
            },
            nocollab: {
                type: "number",
                optional: true,
                source: "query"
            },
            debug: {
                optional: true,
                source: "query"
            },
            packed: {
                source: "query",
                type: "number",
                optional: true
            }, 
            token: {
                source: "query",
                optional: true
            },  
            w: {
                source: "query",
                optional: true
            }, 
        }
    }, function(req, res, next) {

        var configName = getConfigName(req.params, options);

        var collab = options.collab && req.params.collab !== 0 && req.params.nocollab != 1;
        var opts = extend({}, options);
        opts.options.collab = collab;
        if (req.params.packed == 1)
            opts.packed = opts.options.packed = true;
        
        var cdn = options.options.cdn;
        options.options.themePrefix = "/static/" + cdn.version + "/skin/" + configName;
        options.options.workerPrefix = "/static/" + cdn.version + "/worker";
        options.options.CORSWorkerPrefix = opts.packed ? "/static/" + cdn.version + "/worker" : "";
        
        api.updatConfig(opts.options, {
            w: req.params.w,
            token: req.params.token
        });
        
        opts.options.debug = req.params.debug !== undefined;
        res.setHeader("Cache-Control", "no-cache, no-store");
        res.render(__dirname + "/views/standalone.html.ejs", {
            architectConfig: getConfig(configName, opts),
            configName: configName,
            packed: opts.packed,
            version: opts.version
        }, next);
    });
    
    api.get("/_ping", function(params, callback) {
        return callback(null, {"ping": "pong"}); 
    });
    
    api.get("/preview/:path*", [
        function(req, res, next) {
            req.projectSession = {
                pid: 1
            };
            req.session = {};
            api.authenticate()(req, res, next);
        },
        previewHandler.getProxyUrl(function() {
            return {
                url: "http://localhost:" + options.options.port + "/vfs"
            };
        }),
        previewHandler.proxyCall()
    ]);
    
    api.get("/preview", function(req, res, next) {
        res.redirect(req.url + "/");
    });

    api.get("/vfs-root", function(req, res, next) {
        if (!options.options.testing)
            return next();
            
        res.writeHead(200, {"Content-Type": "application/javascript"});
        res.end("define(function(require, exports, module) { return '" 
            + options.workspaceDir + "'; });");
    });
    api.get("/vfs-home", function(req, res, next) {
        if (!options.options.testing)
            return next();
            
        res.writeHead(200, {"Content-Type": "application/javascript"});
        res.end("define(function(require, exports, module) { return '" 
            + process.env.HOME + "'; });");
    });

    api.get("/update", function(req, res, next) {
        res.writeHead(200, {
            "Content-Type": "application/javascript", 
            "Access-Control-Allow-Origin": "*"
        });
        var path = resolve(__dirname + "/../../build/output/latest.tar.gz");
        fs.readlink(path, function(err, target) {
            if (err) return next(err);
            
            res.end((target || "").split(".")[0]);
        });
    });
    
    api.get("/update/:path*", function(req, res, next) {
        var filename = req.params.path;
        var path = resolve(__dirname + "/../../build/output/" + resolve("/" + filename));
        
        var stream = fs.createReadStream(path);
        stream.on("error", function(err) {
            next(err);
        });
        stream.on("data", function(data) {
            if (!res.headersSent)
                res.writeHead(200, {"Content-Type": "application/octet-stream"});
                
            res.write(data);
        });
        stream.on("end", function(data) {
            res.end();
        });
    });

    api.get("/configs/require_config.js", function(req, res, next) {
        var config = res.getOptions().requirejsConfig || {};
        
        res.writeHead(200, {"Content-Type": "application/javascript"});
        res.end("requirejs.config(" + JSON.stringify(config) + ");");
    });
    
    api.get("/test/all.json", function(req, res, next) {
        var base = __dirname + "/../../";
        var blacklistfile = base + "/test/blacklist.txt";
        var filefinder = require(base + "/test/lib/filefinder.js");
        filefinder.find(base, "plugins", ".*_test.js", blacklistfile, function(err, result) {
            result.all = result.list.concat(result.blacklist);
            async.filterSeries(result.list, function(file, next) {
                fs.readFile(file, "utf8", function(err, file) {
                    if (err) return next(false);
                    if (file.match(/^"use server"/m) && !file.match(/^"use client"/m))
                        return next(false);
                    next(file.match(/^define\(|^require\(\[/m));
                });
            }, function(files) {
                result.list = files;
                res.writeHead(200, {"Content-Type": "application/json"});
                res.end(JSON.stringify(result, null, 2));
            });
        });
    });
    
    // fake authentication
    api.authenticate = api.authenticate || function() {
        return function(req, res, next) { 
            req.user = extend({}, options.options.extendOptions.user);
            next(); 
        };
    };
    api.ensureAdmin = api.ensureAdmin || function() {
        return function(req, res, next) { 
            next(); 
        };
    };
    api.getVfsOptions = api.getVfsOptions || function(user, pid) {
        if (!options._projects) {
            options._projects = [options.workspaceDir];
        }
        var wd = options._projects[pid] || options._projects[0];
        
        return {
            workspaceDir: wd,
            extendOptions: {
                user: user,
                project: {
                    id: pid,
                    name: pid + "-" + options._projects[pid]
                },
                readonly: user.id > 100
            }
        };
    };    
    api.updatConfig = api.updatConfig || function(opts, params) {
        var id = params.token;
        opts.accessToken = id || "token";
        var user = opts.extendOptions.user;
        user.id = id || -1;
        user.name = id ? "user" + id : "johndoe";
        user.email = id ? "user" + id + "@c9.io" : "johndoe@example.org";
        user.fullname = id ? "User " + id : "John Doe";
        opts.workspaceDir = params.w ? params.w : options.workspaceDir;
        opts.projectName = basename(opts.workspaceDir);
        if (!options._projects) {
            options._projects = [options.workspaceDir];
        }
        var project = opts.extendOptions.project;
        var pid = options._projects.indexOf(opts.workspaceDir);
        if (pid == -1)
            pid = options._projects.push(opts.workspaceDir) - 1;
        project.id = pid;
    };
    
    imports.connect.setGlobalOption("apiBaseUrl", "");

    register(null, {
        "api": api,
        "passport": {
            authenticate: function() {
                return function(req, res, next) {
                    req.user = extend({}, options.options.extendOptions.user);
                    next();
                };
            }
        }
    });
}

function getConfigName(requested, options) {
    var name;
    if (requested && requested.workspacetype) {
        name = requested.workspacetype;
        if (name == "readonly" || name == "ro")
            name = "default-ro";
        else
            name = "workspace-" + name;
    }
    else if (options.workspaceType) {
        name = "workspace-" + options.workspaceType;
    }
    else if (options.options.client_config) {
        // pick up client config from settings, if present
        name = options.options.client_config;
    }
    else if (options.readonly) {
        name = "default-ro";
    }
    else {
        name = "default";
    }
    
    if (options.local)
        name += "-local";
    
    return name;
}

function getConfig(configName, options) {
    var filename = __dirname + "/../../configs/client-" + configName + ".js";

    var installPath = options.settingDir || options.installPath || "";
    var workspaceDir = options.options.workspaceDir;
    var settings = {
        "user": join(installPath, "user.settings"),
        "project": join(options.local ? installPath : join(workspaceDir, ".c9"), "project.settings"),
        "state": join(options.local ? installPath : join(workspaceDir, ".c9"), "state.settings")
    };
    
    var fs = require("fs");
    for (var type in settings) {
        var data = "";
        try {
            data = fs.readFileSync(settings[type], "utf8");
        } catch (e) {
        }
        settings[type] = data;
    }
    options.options.settings = settings;
    
    return require(filename)(options.options);
}
