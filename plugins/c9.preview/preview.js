define(function(require, exports, module) {
    "use strict";
    
    main.consumes = [
        "session",
        "db",
        "c9.login",
        "preview.handler",
        "vfs.serverlist",
        "user-content.redirect",
        "connect.remote-address"
    ];
    main.provides = [];
    return main;

    function main(options, imports, register) {
        var session = imports.session;
        var db = imports.db;
        var ensureLoggedIn = imports["c9.login"].ensureLoggedIn();
        var handler = imports["preview.handler"];
        var userContent = imports["user-content.redirect"];
        var getVfsServers = imports["vfs.serverlist"].getServers;
        var ratelimit = require("c9/ratelimit");
        
        var frontdoor = require("frontdoor");
        var error = require("http-error");
        var requestTimeout = require("c9/request_timeout");
        
        var api = frontdoor();
        
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
            require("./lib/middleware/sanitize-path-param"),
            require("./lib/middleware/block-dot-files"),
            handler.getProjectSession(),
            handler.getRole(db),
            handler.getProxyUrl(function() {
                return getVfsServers()[0] || null;
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

        register();
    }
});
