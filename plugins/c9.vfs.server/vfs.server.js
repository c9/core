"use strict";

plugin.consumes = [
    "api",
    "passport",
    "connect",
    "connect.render",
    "connect.render.ejs",
    "connect.remote-address",
    "vfs.cache",
    "analytics"
];
plugin.provides = [
    "vfs.server"
];

module.exports = plugin;

/**
 * VFS session:
 * - unique vfsid
 * - bound to the client sessionId
 * - either readonly or read/write
 * - auto disposes after N seconds of idle time
 * - keeps:
 *  - vfs-ssh instance
 *  - engine.io instance (only one socket connected at a time)
 *  - vfs rest API instance
 *     
 * - authentication using tokens or auth headers (no cookies)
 */
function plugin(options, imports, register) {
    var api = imports.api;
    var cache = imports["vfs.cache"];
    var passport = imports.passport;
    var connect = imports.connect;
    var render = imports["connect.render"];
    var analytics = imports["analytics"];
    var async = require("async");
    
    var Types = require("frontdoor").Types;
    var error = require("http-error");
    var kaefer = require("kaefer");
    var ratelimit = require("c9/ratelimit");
    var requestTimeout = require("c9/request_timeout");

    var section = api.section("vfs");

    var VFS_ACTIVITY_WINDOW = 1000 * 60 * 60;

    section.registerType("vfsid", new Types.RegExp(/[a-zA-Z0-9]{16}/));
    section.registerType("pid", new Types.Number(0));
    
    // admin interface
    api.use(render.setTemplatePath(__dirname + "/views"));
    api.get("/:status", {
        params: {
            status: {
                type: /^vfs(?:\.(?:json|html))?$/,
                source: "url"
            }
        }
    }, [
        api.ensureAdmin(),
        function(req, res, next) {
            var type = req.params.status.split(".")[1] || "html";
            
            var entries = cache.getAll();
            var data = {
                entries: []
            };
            for (var key in entries) {
                var entry = entries[key];
                
                data.entries.push({
                    vfsid: entry.vfsid,
                    pid: entry.pid,
                    uid: entry.user.id,
                    ttl: entry.ttl,
                    readonly: entry.vfs ? entry.vfs.readonly : "",
                    state: entry.vfs ? "connected" : "connecting",
                    startTime: entry.startTime,
                    connectTime: entry.connectTime || -1
                });
            }
            
            if (type == "json")
                res.json(data);
            else
                res.render("status.html.ejs", data, next);
        }
    ]);
    
    // creates a new connection for the specified project
    section.post("/:pid", {
        params: {
            "pid": {
                type: "pid"
            },
            "version": {
                type: "string",
                source: "body",
                optional: false
            }
        }
    }, [
        api.authenticate(),
        ratelimit("pid", 60 * 1000, 30),
        function(req, res, next) {
            var pid = req.params.pid;
            var version = req.params.version;
            var user = req.user;
            
            trackActivity(user, req);
            
            if (version != kaefer.version.protocol) {
                var err = new error.PreconditionFailed("Wrong VFS protocol version. Expected version '" + kaefer.version.protocol + "' but found '" + version + "'");
                err.subtype = "protocol_mismatch";
                err.clientVersion = version;
                err.serverVersion = kaefer.version.protocol;
                return next(err);
            }
            
            var done = false;
            var cancel = cache.create(pid, user, function(err, entry) {
                if (done) return;
                if (err) return next(err);
            
                res.json({
                    pid: pid,
                    uid: user.id,
                    readonly: entry.vfs.readonly, 
                    vfsid: entry.vfsid
                }, null, 201);
            });

            // if the clients aborts the request we have to kill the ssh process
            req.on("close", function() {
                done = true;
                cancel();
                res.json({}, 0, 500);
            });
        }
    ]);

    // checks if the connection exists and returns connection meta data
    section.get("/:pid/:vfsid", {
        params: {
            "pid": {
                type: "pid"
            },
            "vfsid": {
                type: "vfsid"
            }
        }
    }, function(req, res, next) {
        var pid = req.params.pid;
        var vfsid = req.params.vfsid;
        
        var entry = cache.get(vfsid);
        if (!entry) {
            var err = new error.PreconditionFailed("VFS connection does not exist");
            err.code = 499;
            return next(err);
        }
        
        res.json({
            pid: pid,
            vfsid: vfsid,
            uid: entry.user.id
        });
    });
    
    // read only rest interface
    section.get("/:pid/plugins/:access_token/:path*", {
        "access_token": {
            type: "string"
        },
        "pid": {
            type: "pid"
        },
        "path": {
            type: "string"
        }
    }, [
        requestTimeout(15*60*1000),
        connect.getModule().compress(),
        function(req, res, next) {
            req.query = {
                access_token: req.params["access_token"]
            };
            passport.authenticate("bearer", { session: false }, function(err, user) {
                if (err) return next(err);
                
                req.user = user || { id: -1};
                next();
            })(req, res, next);
        },
        function(req, res, next) {
            var pid = req.params.pid;
            var path = req.params.path;
            var user = req.user;
            
            trackActivity(user, req);
            
            if (path.indexOf("../") !== -1)
                return next(new error.BadRequest("invalid path"));

            cache.readonlyRest(pid, user, "/.c9/plugins/" + path, "home", req, res, next);
        }
    ]);
    
    section.get("/:pid/preview/:path*", {
        "pid": {
            type: "pid"
        },
        "path": {
            type: "string"
        }
    }, [
        requestTimeout(15*60*1000),
        connect.getModule().compress(),
        function(req, res, next) {
            passport.authenticate("bearer", { session: false }, function(err, user) {
                if (err) return next(err);
                
                req.user = user || { id: -1};
                next();
            })(req, res, next);
        },
        function(req, res, next) {
            var pid = req.params.pid;
            var path = req.params.path;
            var user = req.user;

            cache.readonlyRest(pid, user, path, "workspace", req, res, next);
        }
    ]);
    
    // disconnects VFS connection
    section.delete("/:pid/:vfsid", {
        params: {
            "pid": {
                type: "pid"
            },
            "vfsid": {
                type: "vfsid"
            }
        }
    }, function(req, res, next) {
        var vfsid = req.params.vfsid;
        
        cache.remove(vfsid);
        res.json({}, null, 201);
    });
    
    // REST API
    // serves all files with mime type "text/plain"
    // real mime type will be in "X-C9-ContentType"
    section.all("/:pid/:vfsid/:scope/:path*", {
        params: {
            "pid": {
                type: "pid"
            },
            "vfsid": {
                type: "vfsid"
            },
            "scope": {
                type: /^(home|workspace)$/
            },
            "path": {
                type: "string"
            }
        }
    }, [
        function(req, res, next) {
            var vfsid = req.params.vfsid;
            var scope = req.params.scope;
            var path = req.params.path;
    
            var entry = cache.get(vfsid);
            if (!entry) {
                var err = new error.PreconditionFailed("VFS connection does not exist");
                err.code = 499;
                return next(err);
            }
            // TODO: use an interval to make sure this fires
            //       even when this REST api is not used for a day
            trackActivity(entry.user, req);
            entry.vfs.handleRest(scope, path, req, res, next);
        }
    ]);
    
    // engine.io endpoint of the VFS server
    section.all("/:pid/:vfsid/socket/:path*", {
        params: {
            "pid": {
                type: "pid"
            },
            "vfsid": {
                type: "vfsid"
            },
            "path": {
                type: "string"
            }
        }
    }, [
        requestTimeout(15*60*1000),
        function handleEngine(req, res, next) {
            var vfsid = req.params.vfsid;
            
            var entry = cache.get(vfsid);
            if (!entry) {
                var err = new error.PreconditionFailed("VFS connection does not exist");
                err.code = 499;
                return next(err);
            }
            
            entry.vfs.handleEngine(req, res, next);
        }
    ]);
    
    function trackActivity(user, req) {
        if (user.id === -1)
            return;

        if (new Date(user.lastVfsAccess).getDate() != new Date().getDate() || 
            Date.now() > user.lastVfsAccess + VFS_ACTIVITY_WINDOW) {
                
            analytics.superagent && analytics.superagent
                .post(options.apiBaseUrl + "/metric/usage/" + req.params.pid + "?access_token=" + req.query.access_token)
                .end(function() {});
                
            user.lastVfsAccess = Date.now();
            user.save(function() {});
        }
    }

    register(null, {
        "vfs.server": {
            get section() { return section; }
        }
    });
}
