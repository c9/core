/*global describe it before beforeEach*/

"use blacklist";
"use client";

require(["lib/architect/architect", "lib/chai/chai"], function (architect, chai) {
    var expect = chai.expect;
    
    expect.setupArchitectTest([
        {
            packagePath: "plugins/c9.core/c9",
            startdate: new Date(),
            debug: 2,
            hosted: true,
            local: false
        },
        "plugins/c9.core/http-xhr",
        "plugins/c9.core/ext",
        {
            packagePath: "plugins/c9.vfs.client/vfs_client",
            debug: true
        },
        "plugins/c9.vfs.client/endpoint",
        "plugins/c9.ide.auth/auth",
        
        {
            consumes: ["vfs", "c9"],
            provides: [],
            setup: main
        }
    ], architect);
    
    function main(options, imports, register) {
        var vfs = imports.vfs;
        var c9 = imports.c9;

        describe('vfs', function() {
            this.timeout(30000);
            
            beforeEach(function(done) {
                if (vfs.connected)
                    return done();
                
                vfs.once("connect", done);
            });
            
            it("should handle calls across away/back boundary", function(done) {
                vfs.readdir("/", {}, function(err, meta) {
                    if (err) throw err;
                    meta.stream.destroy();
                    done();
                });
                
                // Disconnect to force away state
                vfs.connection.socket.close();
            });
            it("should handle calls during away", function(done) {
                vfs.connection.socket.close();
                vfs.readdir("/", {}, function(err, meta) {
                    if (err) throw err;
                    meta.stream.destroy(); 
                    done();
                });
            });
            it("should keep state over away/back boundary", function(done) {
                var path = "/testwatch.txt";
                
                vfs.copy("/file.txt", { to: path, overwrite: true }, function(err) {
                    if (err) throw err;
                    vfs.watch(path, {}, function(err, meta) {
                        if (err) throw err;
                        
                        meta.watcher.on("change", function (event, filename) {
                            if (event == "delete" && filename == path.substr(1)) {
                                done();
                                vfs.off("back", onBack);
                            }
                        });
                        meta.watcher.on("error", function(err) {
                            throw err;
                        });
                        
                        c9.once("back", onBack);
                        
                        function onBack() {
                            vfs.rmfile(path, {}, function(err) {
                                if (err) throw err;
                            });
                        }
                        
                        setTimeout(function() {
                            vfs.connection.socket.close();
                        }, 200);
                    });
                });
            });
        });
        
        onload && onload();
    }
});