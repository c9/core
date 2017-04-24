#!/usr/bin/env node
/*global describe it before after beforeEach afterEach */

"use strict";
"use server";

require("c9/inline-mocha")(module);
require("c9/setup_paths");

var async = require("async");
var assert = require("assert");
var nock = require("nock");

var RestClient = require("c9/rest_client");
var baseTest = require('../c9.api/base_test');
var testDb = require("../c9.db.redis/test_redis");
var setupFixtures = require("test/lib/integration/setup");

describe(__filename, function() {
    
    var db, serverList, client;
    var testUser, testProject, testRemote, testContainer;
    var loggedInUser = null;
    
    before(function(next) {
        baseTest({
            config: "preview",
        }, function(err, services) {
            db = services.db;
            serverList = services["vfs.serverlist"];
            
            services.connect.useSetup(function(req, res, next) {
                req.user = loggedInUser;
                next();
            });

            client = new RestClient("localhost", services.apiPort, {
                debug: false
            });

            testUser = require("test/lib/integration/db/user")(db);
            testProject = require("test/lib/integration/db/project")(db);
            testRemote = require("test/lib/integration/db/mock-remote")(db);
            testContainer = require("test/lib/integration/db/mock-container")(db);
            
            next(err);
        });
    });
    
    after(function(next) {
        testDb.stop(next);
    });

    beforeEach(function(next) {
        serverList._testSetServerList([{
            url: "http://vfs.c9.dev",
            internalUrl: "http://vfs.c9.dev"
        }]);
        testDb.reset(next);
    });

    describe("preview", function() {
        it("Should authorize users correctly", function(next) {
            var user1, user2;
            var public1, private1, private2;

            // user1 user2
            // user2/public
            // user2/private1 user1 has no access
            // user2/private2 user1 is collaborator

            setupFixtures(
                testUser.create(),
                testUser.create(),
                testProject.create(),
                testRemote.create({ type: "docker" }),
                testContainer.create(),
                testProject.create(),
                testRemote.create({ type: "docker" }),
                testContainer.create(),
                testProject.create(),
                testRemote.create({ type: "docker" }),
                testContainer.create(),
                function(ctx, next) {
                    user1 = ctx.users[0];
                    user2 = ctx.users[1];
                    public1 = ctx.projects[0];
                    private1 = ctx.projects[1];
                    private2 = ctx.projects[2];
                    next();
                },
                function(ctx, next) {
                    public1.owner = user2;
                    public1.visibility = "public";
                    public1.save(next);
                },
                function(ctx, next) {
                    private1.owner = user2;
                    private1.visibility = "private";
                    private1.save(next);
                },
                function(ctx, next) {
                    private2.owner = user2;
                    private2.visibility = "private";
                    private2.save(next);
                },
                function(ctx, next) {
                    db.WorkspaceMember.create(
                        private2, 
                        user1.id, 
                        db.WorkspaceMember.ACL_R, 
                        db.Project.ROLE_COLLABORATOR, null, next
                    );
                },
                function(fixtures, teardown) {
                    /*
                     * Logged in	Role	                    Visibility	ACTION
                     * =================================================================
                     * true         none	                    public	    view
                     * false        none	                    public	    view
                     * true         none	                    private	    forbidden
                     * false        none	                    private	    unauthorized
                     * true         visitor/collaborator/admin	public	    view
                     * true         visitor/collaborator/admin	private	    view
                     */
                     
                     var expect = [
                        { uid: user1.id, role: db.Project.ROLE_NONE, p: public1, code: 200 },
                        { uid: -1, role: db.Project.ROLE_NONE, p: public1, code: 200 },
                        { uid: user1.id, role: db.Project.ROLE_NONE, p: private1, code: 403 },
                        { uid: -1, role: db.Project.ROLE_NONE, p: private1, code: 302 }, // redirect to login page
                        { uid: user1.id, role: db.Project.ROLE_COLLABORATOR, p: public1, code: 200 },
                        { uid: user2.id, role: db.Project.ROLE_ADMIN, p: private2, code: 200 }
                    ];
                    
                    async.eachSeries(expect, function(expect, next) {
                        var path = "/" + expect.p.owner.name + "/" + expect.p.name + "/";

                        nock('http://vfs.c9.dev')
                            .get("/" + expect.p.id + "/preview/")
                            .reply(200, []);
                        
                        loggedInUser = {
                            id: expect.uid
                        };
                        
                        client.get(path, function (err, res) {
                            assert((err && err.code) == expect.code || expect.code == 200, "Wrong return code");
                            next();
                        });
                    }, function(err) {
                        if (err) return next(err);
                        teardown(next);
                    });
                }
            );
        });
    });
});
