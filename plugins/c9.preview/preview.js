define(function(require, exports, module) {
    "use strict";
    
    main.consumes = [
        "session",
        "db",
        "c9.login",
        "preview.handler",
        "user-content.redirect",
        "connect.remote-address"
    ];
    main.provides = [];
    return main;

    function main(options, imports, register) {
        var maxVfsAge = options.maxVfsAge || 20 * 1000;
        var region = options.region;
        
        var session = imports.session;
        var db = imports.db;
        var ensureLoggedIn = imports["c9.login"].ensureLoggedIn();
        var handler = imports["preview.handler"];
        var userContent = imports["user-content.redirect"];
        
        var frontdoor = require("frontdoor");
        var error = require("http-error");
        var requestTimeout = require("c9/request_timeout");
        
        var api = frontdoor();
        var vfsServers;
        
        api.registerType("username", /^[0-9a-z_\-]*$/i);
        api.registerType("projectname", /^[0-9a-z\-_]*$/i);
        
        api.use(function(req, res, next) {
            res.setHeader("X-Content-Type-Options", "nosniff");
            next();
        });
        
        api.use(userContent.redirectPreview());
        
        session.use(api);
        
        api.get("/:username/:projectname/:path*", {
            params: {
                username: {
                    type: "username"
                },
                projectname: {
                    type: "projectname"
                }
            }
        }, [
            requestTimeout(15*60*1000),
            handler.getProjectSession(),
            handler.getRole(db),
            handler.getProxyUrl(function() {
                return vfsServers ? vfsServers[0] : null;
            }),
            handler.proxyCall()
        ]); 
        
        api.error(function(err, req, res, next) {
            if (err instanceof error.Unauthorized) {
                req.logout();
                delete req.session.token;
                return ensureLoggedIn(req, res, next);
            }
            return next(err);
        });
        
        api.get("/:username/:projectname", {
            params: {
                username: {
                    type: "username"
                },
                projectname: {
                    type: "projectname"
                }
            }
        }, function(req, res, next) {
            res.redirect(req.url + "/");
        }); 
        
        function updateVfsServerList(callback) {
            db.Vfs.findAllAndPurge(maxVfsAge, function(err, servers) {
                if (err) 
                    return callback(err);
                if (!servers.length) 
                    return callback(new Error("No VFS server available"));
                
                vfsServers = shuffleServers(servers);
                callback();
            });
        }
        
        function shuffleServers(servers) {
            servers = servers.slice();
            var isBeta = region == "beta";
            servers = servers.filter(function(s) {
                return isBeta ? s.region == "beta" : s.region !== "beta";
            });
            return servers.sort(function(a, b) {
                if (a.region == b.region) {
                    if (a.load < b.load)
                        return -1;
                    else
                        return 1;
                }
                else if (a.region == region)
                    return -1;
                else if (b.region == region)
                    return 1;
                else
                    return 0;
            });
        }
        
        load();
        function load() {
            updateVfsServerList(function(err) {
                if (err)
                    return setTimeout(load, 20000);
        
                setInterval(updateVfsServerList.bind(null, function(err) {
                    if (err) console.error("Retrieving VFS server list failed", err);
                }), 20 * 1000);
                
                register();
            });
        }
    }
});