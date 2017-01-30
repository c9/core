/*global describe it before after */

"use client";

require(["lib/architect/architect", "lib/chai/chai", "/vfs-root", "/vfs-home"], function (architect, chai, basePath, homePath) {
    var expect = chai.expect;
    var Assert = chai.assert;
    
    expect.setupArchitectTest([
        {
            packagePath: "plugins/c9.core/c9",
            workspaceId: "ubuntu/ip-10-35-77-180",
            startdate: new Date(),
            debug: true,
            hosted: true,
            local: false,
            davPrefix: "/",
            home: homePath
        },
        
        "plugins/c9.core/ext",
        "plugins/c9.core/http-xhr",
        "plugins/c9.core/util",
        "plugins/c9.ide.ui/lib_apf",
        "plugins/c9.ide.ui/ui",
        "plugins/c9.core/settings",
        "plugins/c9.vfs.client/vfs_client",
        "plugins/c9.vfs.client/endpoint",
        "plugins/c9.ide.auth/auth",
        "plugins/c9.fs/fs",
        "plugins/c9.fs/net",
        
        {
            packagePath: "plugins/c9.cli.bridge/bridge",
            startBridge: true
        },
        {
            packagePath: "plugins/c9.cli.bridge/bridge_commands",
            basePath: basePath
        },
        "plugins/c9.cli.bridge/bridge-client",
        
        {
            consumes: ["bridge", "bridge.client"],
            provides: [],
            setup: main
        }
    ], architect);
    
    function main(options, imports, register) {
        var bridge = imports.bridge;
        var client = imports["bridge.client"];
        
        describe('bridge', function() {
            // this.timeout(10000);
            
            before(function(done) {
                bridge.on("ready", function() {
                    done();
                });
            });
            
            it('send and receive messages', function(done) {
                bridge.on("message", function(e) {
                    if (e.message.hello) {
                        e.respond(null, { "hi": true });
                    }
                });
                client.send({ "hello": true }, function(err, message) {
                    if (err) throw err.message;
                    expect(message).property("hi").to.be.ok;
                    done();
                });
            });
        });
        
        if (onload)
            onload();
    }
});