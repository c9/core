/*global describe it before after */

"use client";

require(["lib/architect/architect", "lib/chai/chai"], function (architect, chai) {
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
            davPrefix: "/"
        },
        
        "plugins/c9.core/ext",
        "plugins/c9.core/http-xhr",
        "plugins/c9.core/util",
        "plugins/c9.ide.ui/ui",
        "plugins/c9.core/settings",
        //"plugins/c9.ide.collab/collab",
        "plugins/c9.vfs.client/vfs_client",
        "plugins/c9.vfs.client/endpoint",
        "plugins/c9.ide.auth/auth",
        "plugins/c9.fs/fs",
        
        // Mock plugins
        {
            consumes: ["ui"],
            provides: [
                "preferences", "dialog.error"
            ],
            setup: expect.html.mocked
        },
        {
            consumes: ["collab"],
            provides: [],
            setup: main
        }
    ], architect);
    
    function main(options, imports, register) {
        var collab = imports.collab;
        
        describe('collab', function() {
            this.timeout(10000);
            
            describe("connect", function(){
                it('should connect', function(done) {
                    collab.connect(null, function(err, stream) {
                        if (err) throw err.message;
                    });
                });
            });
        });
        
        if (onload)
            onload();
    }
});