define(function(require, exports, module) {
    "use strict";
    
    main.consumes = [
        "connect.render",
        "connect.render.ejs",
        "connect.redirect",
        "connect.static",
        "error.logger",
        "metrics"
    ];
    main.provides = ["preview.handler"];
    return main;

    function main(options, imports, register) {
        var error = require("http-error");
        var https = require("https");
        var http = require("http");
        var mime = require("mime");
        var metrics = imports.metrics;
        var parseUrl = require("url").parse;
        var debug = require("debug")("preview");
        var logError = imports["error.logger"].warn;
        
        var staticPrefix = imports["connect.static"].getStaticPrefix();
        
        function getProjectSession() {
            return function(req, res, next) {
                var session = req.session;
    
                req.user = req.user || { id: -1 };
    
                var username = req.params.username;
                var projectname = req.params.projectname;
    
                var ws = req.ws = username + "/" + projectname;
                
                if (!session.ws)
                    session.ws = {};
    
                req.projectSession = session.ws[ws];
                
                if (
                    !req.projectSession || 
                    !req.projectSession.expires || 
                    req.projectSession.expires <= Date.now() ||
                    req.projectSession.uid != req.user.id
                ) {
                    req.projectSession = session.ws[ws] = {
                        expires: Date.now() + 10000
                    };
                }
                
                next();
            };
        }
        
        function getRole(db) {
            return function(req, res, next) {
                if (req.projectSession.role) {
                    return next();
                }
                    
                db.Project.findOne({
                    username: req.params.username,
                    name: req.params.projectname
                }, function(err, project) {
                    if (err && err.code == 404)
                        return next(new error.NotFound("Project '" + req.ws + "' doest not exist."));
                        
                    if (err) return next(err);
                    
                    project.getRole(req.user, function(err, role) {
                        if (err) return next(err);
                        
                        if (role == db.Project.ROLE_NONE) {
                            if (project.isPublicPreview())
                                role = db.Project.ROLE_VISITOR;
                            else if (req.user.id == -1)
                                return next(new error.Unauthorized());
                            else
                                return next(new error.Forbidden("You don't have access rights to preview this workspace"));
                        }
                        req.projectSession.role = role;
                        req.projectSession.pid = project.id;
                        req.projectSession.uid = req.user.id;
                        
                        var type = project.scm;
                        req.projectSession.type = type;
                        
                        if (type != "docker" || project.state != db.Project.STATE_READY)
                            return next();
                        
                        project.populate("remote", function(err) {
                            if (err) return next(err);
                            
                            var meta = project.remote.metadata;
                            if (meta && meta.host && meta.cid) {
                                db.Container.load(meta.cid, function(err, container) {
                                    if (err) return next(err);

                                    if (container.state == db.Container.STATE_RUNNING)
                                        req.projectSession.proxyUrl = "http://" + meta.host + ":9000/" + meta.cid + "/home/ubuntu/workspace";
                                    else
                                        req.projectSession.expires = Date.now() + 1000;
                                        
                                    next();
                                });
                            } else {
                                next();
                            }
                        });
                    });
                });
            };
        }

        function getProxyUrl(getServer) {
            return function(req, res, next) {
                
                if (req.projectSession.proxyUrl) {
                    req.proxyUrl = req.projectSession.proxyUrl;
                    return next();
                }
                
                var server = req.projectSession.vfsServer;
                if (!server) {
                    server = getServer();
                    if (!server || !server.url)
                        return next(new error.ServiceUnavailable("No VFS server found"));
                        
                    server = req.projectSession.vfsServer = server.internalUrl || server.url;
                }
                        
                var url = server + "/" + req.projectSession.pid + "/preview";
                    
                req.proxyUrl = url;
                next();
            };
        }

        function proxyCall() {
            return function(req, res, next) {
                
                var path = req.params.path;
                var url = req.proxyUrl + path;
                if (req.user.code)
                    url += "?access_token=" + encodeURIComponent(req.user.code);

                var parsedUrl = parseUrl(url);
                var httpModule = parsedUrl.protocol == "https:" ? https : http;
                
                req.headers.accept = "application/json";
                delete req.headers.host;

                var isDir = path[path.length-1] == "/";
                if (isDir || parsedUrl.pathname.match(/\.html?$/i)) {
                    req.headers["accept-encoding"] = "identity";
                    delete req.headers["if-range"];
                } else {
                    req.headers["accept-encoding"] = "gzip";
                }
                
                debug("proxy call %s", url);
                httpModule.get({
                    path: parsedUrl.path,
                    hostname: parsedUrl.hostname,
                    port: parsedUrl.port,
                    headers: req.headers
                }, function(request) {
                    if (request.statusCode >= 400)
                        handleError(request);
                    else if (isDir)
                        serveListing(request);
                    else if (request.headers["content-type"] == "text/html")
                        serveHtml(request, parsedUrl.hostname, req);
                    else
                        serveFile(request);
                }).on("error", function(err) {
                    metrics.increment("preview.failed.error");
                    next(err); 
                });
                
                function handleError(request) {
                    var body = "";
                    
                    debug("handle error %s", request.statusCode);
                    
                    if (request.statusCode == 401)
                        return next(new error.Unauthorized());
                    
                    var stream;
                    if (request.headers["content-encoding"] == "gzip") {
                        stream = require("zlib").createGunzip();
                        request.pipe(stream);
                    } else {
                        stream = request;
                    }
                    
                    stream.on("data", function(data) {
                        body += data;
                    });
                    stream.on("end", function(data) {
                        if (data)
                            body += data;
                        
                        req.headers.accept= "text/html";
                        var statusCode = request.statusCode;

                        if (body.indexOf("EISDIR") !== -1) {
                            res.redirect(req.url + "/");
                        } else if (body.indexOf("ENOENT") !== -1 || statusCode == 404) {
                            next(new error.NotFound("File '" + path + "' could not be found!"));
                        } else {
                            delete req.session.ws[req.ws];
                            
                            var json;
                            try {
                                json = JSON.parse(body);
                            } catch(e) {} 
                            
                            if (statusCode == 503) {
                                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                                res.render(__dirname + "/views/progress.html.ejs", {
                                    title: "Connecting to your Workspace",
                                    message: "Please wait a moment while we are connecting to the preview server",
                                    retryIn: 2000,
                                    statusCode: statusCode
                                }, next);
                            }
                            else if (statusCode == 428 && json && json.error) {
                                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                                res.render(__dirname + "/views/progress.html.ejs", {
                                    title: json.error.message,
                                    message: "",
                                    retryIn: 2000,
                                    statusCode: statusCode
                                }, next);
                            }
                            else {
                                next(new error.HttpError(body.split("\n")[0], statusCode));
                            }
                            
                        }
                    });
                }
                
                function serveListing(request) {
                    debug("serve directory listing %s", request.url);
                    
                    var body = "";
                    request.on("data", function(data) {
                        body += data;
                    });
                    request.on("end", function(data) {
                        if (data)
                            body += data;
                        
                        try {
                            body = JSON.parse(body);
                        } catch (e) {
                            return next(e);
                        }

                        // convert nginx listing
                        if (body[0] && body[0].type) {
                            body = body.map(function(stat) {
                                return {
                                    name: stat.name,
                                    mime: stat.type == "directory" ? "inode/directory" : mime.lookup(stat.name),
                                    size: stat.size || 0,
                                    mtime: stat.mtime
                                };
                            });
                        }
                        var entries = body
                            .filter(function(entry) {
                                return entry.name[0] !== ".";
                            })
                            .sort(function(a, b) {
                                if (a.mime === "inode/directory" && b.mime !== "inode/directory")
                                    return -1;
                                else if (a.mime !== "inode/directory" && b.mime === "inode/directory")
                                    return 1;
                                else if (a.name.toLowerCase() == b.name.toLowerCase())
                                    return 0;
                                else if (a.name.toLowerCase() < b.name.toLowerCase())
                                    return -1;
                                else
                                    return 1;
                            });
                        
                        res.render(__dirname + "/views/listing.html.ejs", {
                            isRoot: path == "/",
                            entries: entries
                        }, next);
                    });
                }
                
                function serveHtml(request, ideHost, req) {
                    debug("serve HTML %s", request.url);
                    
                    var shouldInject = req.parsedUrl.query["_c9_id"] ? true : false;
                    
                    var inject = shouldInject
                        ? '<script src="' + staticPrefix + '/preview/livecss.js"></script>'
                        : '';
                    var generateInstrumentedHTML = require("../c9.ide.language.html.diff/HTMLSimpleDOM").generateInstrumentedHTML;
                        
                    var buffer = "";
                    request.on("data", function(data) {
                        buffer += data;
                    });
                    request.on("end", function(data) {
                        if (data)
                            buffer += data;
                        
                        if (shouldInject) {
                            try {
                                buffer = generateInstrumentedHTML(buffer) || "";
                            } catch(e) {
                                // don't intrument if it fails
                                logError(new Error("HTML instrumentation failed"), {
                                    exception: e
                                });
                            }
                        }
                        data = new Buffer(buffer);
                        res.writeHead(200, {
                            "content-length": data.length + inject.length,
                            "content-type": request.headers["content-type"],
                            "etag": request.headers.etag,
                            "date": request.headers.date,
                            "x-robots-tag": "noindex, nofollow",
                            "access-control-allow-origin": "https://ide." + ideHost
                        });
                        res.write(data);
                        
                        res.end(inject);
                    });
                }
                
                function serveFile(request) {
                    debug("forward file %s", request.url);
                    request.headers["x-robots-tag"] = "noindex, nofollow";
                    if (!request.headers["Cache-Control"])
                        request.headers["Cache-Control"] = "max-age=31536000,no-cache";
                    res.writeHead(request.statusCode, request.headers);
                    request.pipe(res);
                }
                
            };
        }
        
        register(null, {
            "preview.handler": {
                getProjectSession: getProjectSession,
                getRole: getRole,
                getProxyUrl: getProxyUrl,
                proxyCall: proxyCall
            }
        });
    }
});