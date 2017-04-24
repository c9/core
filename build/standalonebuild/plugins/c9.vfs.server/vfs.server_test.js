#!/usr/bin/env node
"use strict";
"use server";


require("c9/inline-mocha")(module);
if (typeof define === "undefined") {
    require("amd-loader");
}

var sinon = require("sinon");
var assert = require("assert");
var vfsServer = require("./vfs.server");
var mockDb = {};
var mockCache = {
    remove: sinon.stub()
};
var mockApi = {
    section: sinon.stub().returns({
        registerType: sinon.stub(),
        post: sinon.stub(),
        get: sinon.stub(),
        delete: sinon.stub(),
        all: sinon.stub()
    }),
    use: sinon.stub(),
    ensureAdmin: sinon.stub(),
    get: sinon.stub(),
    authenticate: sinon.stub()
};
var mockRender = {
    setTemplatePath: sinon.stub()
};
var mockConnect = {
    getModule: sinon.stub().returns({
        compress: sinon.stub()
    })
};

describe(__filename, function() {
    var server;
    beforeEach(function (done) {
        vfsServer({ testing: true }, {
            "db": mockDb,
            "vfs.cache": mockCache,
            "api": mockApi,
            "connect.render": mockRender,
            "connect": mockConnect,
        }, function (err, _server) {
            if (err) return done(err);
            server = _server["vfs.server"]; 
            done();
        });
    });
    
    describe("handlePublish", function() {
        beforeEach(function() {
            mockCache.remove = sinon.stub();
        });
        
        describe("remove_member", function() {
            it("Should kill the removed members VFS connection", function (done) {
                var vfs = {
                    id: "9c123",
                    uid: "123"
                };
                var message = JSON.stringify({
                    action: "remove_member",
                    body: {
                        uid: "123"
                    }
                });
                server.handlePublish(vfs, message);
                setTimeout(function() {
                    assert(mockCache.remove.calledWith(vfs.id));
                    done();
                }, 150);
            });
            
            it("Should not kill the other members VFS connection", function (done) {
                var vfs = {
                    id: "9c123",
                    uid: "456"
                };
                var message = JSON.stringify({
                    action: "remove_member",
                    body: {
                        uid: "123"
                    }
                });
                server.handlePublish(vfs, message);
                setTimeout(function() {
                    assert.equal(mockCache.remove.callCount, 0);
                    done();
                }, 150);
            });
        });
        
        describe("update_member_access", function() {
            it("Should kill the members VFS connection so they rejoin with the new access level", function (done) {
                var vfs = {
                    id: "9c123",
                    uid: "123"
                };
                var message = JSON.stringify({
                    action: "update_member_access",
                    body: {
                        uid: "123"
                    }
                });
                server.handlePublish(vfs, message);
                setTimeout(function() {
                    assert(mockCache.remove.calledWith(vfs.id));
                    done();
                }, 150);
            });
        });
        
        describe("project_changed", function() {
            it("If the project is being made private all non-owner connected users should be ejected", function (done) {
                var projectOwnerVfs = {
                    id: "9c123",
                    uid: "123"
                };
                var projectMemberVfs = {
                    id: "9c456",
                    uid: "456"
                };
                var message = JSON.stringify({
                    action: "project_changed",
                    body: {
                        owner: 123,
                        visibility: "private"
                    }
                });
                server.handlePublish(projectOwnerVfs, message);
                server.handlePublish(projectMemberVfs, message);
                setTimeout(function() {
                    assert(mockCache.remove.neverCalledWith(projectOwnerVfs.id));
                    assert(mockCache.remove.calledWith(projectMemberVfs.id));
                    done();
                }, 150);
            });
        });
        
    });
    
    
});