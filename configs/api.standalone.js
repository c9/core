#!/usr/bin/env node
"use strict";

module.exports.addApi = function(plugins, config) {
    config.apiUrl = "";
    var apiPlugins = [{
        setup: function(options, imports, register) {
            mockRedis(options, imports, register);
        },
        provides: ["mq", "db", "mailer"],
        consumes: ["api"]
    }, {
        packagePath: "./c9.logtimestamp/logtimestamp",
        mode: config.mode
    },
    "./c9.error/logger.raygun_mock",
    "./c9.api/ping",
    {
        packagePath: "./c9.api/health",
        revision: config.manifest.revision,
        version: config.manifest.version,
    },
    "./c9.api/user",
    "./c9.api/project",
    "./c9.api/applications",
    "./c9.api/session",
    "./c9.api/collab",
    "./c9.api/settings",
    "./c9.api/vfs",
    "./c9.api/preview",
    "connect-architect/connect.bodyparser",
    "connect-architect/connect.query",
    "./c9.passport/passport",
    "./c9.passport/bearer",
    "./c9.passport/basic"];
    
    return plugins.concat(apiPlugins);
};

function mockRedis(options, imports, register) {
    var api = imports.api;
    if (api.bindUser)
        return;
    
    api.bindUser = function(call) {
        return function(req, res, next) {
            call(req.user, req.params, function(err, json) {
                if (err) return next(err);
                res.json(json);
            });
        };
    };
    api.authenticate = function() {
        return function(req, res, next) { 
            req.user = new User(req.query.access_token);
            next(); 
        };
    };
    var users = {
        "-1": {
           name: "John Doe", email: "johndoe@example.org",
        }
    };
    
    var projects = [{
        owner: -1, members: ["rw", -1, 1, 2, 3, "r", 4, 5]
    }];
    
    function User(id) {
        if (typeof id == "object")
            id = id.id;
        if (!/^\d+/.test(id))
            id = -1;
        var u = users[id];
        if (!u) {
            u = users[id] = {
               name: "user" + id,
               email: "user" + id + "@c9.io",
               fullname: "User " + id
            };
        }
        
        u.id = id;
        return {
            name: u.name,
            fullname: u.fullname,
            email: u.email,
            id: id
        };
    }
    
    function Project(id) {
        if (typeof id == "object")
            id = id.id;
        var p = projects[id];
        if (!p)
            return console.log(id);
        return {
            isPrivate: function() {
                return false;
            },
            owner: new User(p.owner),
            getMembers: function(cb) {
                var memebers = [], acl;
                var ownerId = this.owner.id;
                p.members.forEach(function(memberId) {
                    if (typeof memberId == "string")
                        return (acl = memberId);
                    memebers.push(new Member(memberId, acl, ownerId));
                });
                cb && cb(null, memebers);
                return memebers;
            },
            id: id
        };
    }
    
    function Member(id, acl, ownerId) {
        return {
            user: id,
            status: "",
            acl: acl,
            role: id == ownerId ? "a" : "c",
            save: function(project, cb) {
                cb();
            },
            remove: function(project, cb) {
                var p = projects[project.id];
                var i = p.members.indexOf(id);
                if (i != -1)
                    p.members.splice(i, 1);
                cb();
            }
        };
    }
    
    function DB(type) {
        var key, query;
        var dbApi = {
            findOne: function(keyv, cb) {
                key = keyv;
                if (cb)
                    return dbApi.exec(cb);
                return dbApi;
            },
            populate: function(queryV) {
                query = queryV;
                return dbApi;
            },
            exec: function(cb) {
                var result;
                switch (type) {
                    case "Project":
                        result = new Project(0);
                        break;
                    case "User":
                        result = new User(key.uid);
                        break;
                    case "AccessToken":
                        if (query == "user") {
                            var id = /\d/.test(key.token) ? key.token : -1;
                            result = {user: new User(id)};
                        }
                        break;
                    case "WorkspaceMember":
                        var p = key.project;
                        var user = new User(key.user);
                        result = p.getMembers().filter(function(m) {
                            return m.user == user.id;
                        })[0];
                        break;
                    default:
                        console.log(":(((");
                }
                cb(null, result);
                return dbApi;
            },
        };
        dbApi.ROLE_NONE = "n";
        dbApi.ROLE_VISITOR = "v"; // @deprecated
        dbApi.ROLE_COLLABORATOR = "c";
        dbApi.ROLE_ADMIN = "a";
        dbApi.ACL_RW = "rw";
        dbApi.ACL_R = "r";
        dbApi.COLLABSTATE_PENDING_ADMIN = "pending-admin";
        dbApi.COLLABSTATE_PENDING_USER = "pending-user"; // @deprecated
        dbApi.COLLABSTATE_PENDING_NONE = "pending-none";
        return dbApi;
    }
    
    var pubsub = {
        publish: function() {
            
        }
    };
    
    function noop() { return {}; }
    
    register(null, {
        "mq": {
            connection: noop,
            close: noop,
            onReady: noop,
            onceReady: noop,
        },
        "db": {
            User:  new DB("User"),
            Project: new DB("Project"),
            Remote:  new DB("Remote"),
            AccessToken: new DB("AccessToken"),
            WorkspaceMember:  new DB("WorkspaceMember"),
            Vfs:  new DB("Vfs"),
            DockerHost:  new DB("DockerHost"),
            Container:  new DB("Container"),
            Image: new DB("Image"),
            Lock:  new DB("Lock"),
            Nonce: new DB("Nonce"),
            // PubSub as part of the database infrastructure
            getSubscriber: function() { return pubsub },
            getPublisher: function() { return pubsub },
        },
        mailer: {
            
        }
    });
}
