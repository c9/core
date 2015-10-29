/*global describe it before*/

"use client";

require(["lib/architect/architect", "lib/chai/chai"], function (architect, chai) {
    var expect = chai.expect;
    
    expect.setupArchitectTest([
        {
            packagePath: "plugins/c9.core/c9",
            startdate: new Date(),
            debug: true,
            hosted: true,
            local: false
        },
        "plugins/c9.core/http-xhr",
        "plugins/c9.core/ext",
        "plugins/c9.fs/net",
        "plugins/c9.fs/proc",
        "plugins/c9.vfs.client/vfs_client",
        "plugins/c9.vfs.client/endpoint",
        "plugins/c9.ide.auth/auth",
        
        //Mock Plugins
        {
            consumes: ["Plugin"],
            provides: ["auth.bootstrap", "info", "dialog.error"],
            setup: expect.html.mocked
        },
        {
            consumes: ["net", "proc"],
            provides: [],
            setup: main
        }
    ], architect);
    
    function main(options, imports, register) {
        var net = imports.net;
        var proc = imports.proc;

        describe('net', function() {
            describe('connect()', function() {
                this.timeout(30000);
                
                it("should connect to a port", function(done) {
                    var code = 
                      "var server = require('net').createServer(function(c) {"
                          + "c.write('1');"
                          + "c.pipe(c);"
                      + "});"
                      + "server.listen(18000, function() {});";
                    
                    proc.spawn("node", { args: ["-e", code] }, 
                    function(err, child) {
                        if (err) throw err.message;
                        
                        expect(child).ok;
                        expect(child).property("stdout").ok;
                        expect(child).property("stdin").ok;
                        child.stderr.on("data", function(data) {
                            throw new Error(data);
                        });
                        child.stdin.on("data", function(data) {
                            throw new Error(data);
                        });
                        
                        net.connect(18000, {}, function(err, stream) {
                            if (err) throw err.message;
                            stream.on("data", function(chunk) {
                                expect(chunk).equal("1");
                                child.kill();
                                done();
                            });
                        });
                    });
                });
            });
        });
        
        onload && onload();
    }
});