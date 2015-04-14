/*global describe:false, it:false */

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
        "plugins/c9.vfs.client/vfs_client",
        "plugins/c9.vfs.client/endpoint",
        "plugins/c9.ide.auth/auth",
        "plugins/c9.core/api",
        "plugins/c9.core/ext",
        "plugins/c9.core/http-xhr",
         {
            consumes: [],
            provides: ["auth.bootstrap", "info", "dialog.error"],
            setup: expect.html.mocked
        },

        {
            consumes: ["c9", "vfs"],
            provides: [],
            setup: main
        }
    ], architect);
    
    function main(options, imports, register) {
        var c9 = imports.c9;
        var vfs = imports.vfs;
        
        describe('c9', function() {
            this.timeout(30000);
            
            it('should send proper events during connecting', function(done) {
                // var count = 0;

                // c9.on("connecting", function c1(){
                //     count++;
                    
                //     expect(c9.connecting).to.equal(true);
                //     expect(c9.connected).to.equal(false);
                //     expect(c9.has(c9.NETWORK)).to.equal(false);
                    
                //     c9.off("connecting", c1);
                // });
                
                expect(c9.connected).to.equal(false);
                
                c9.once("connect", function c2(){
                    // expect(count, "Connecting event was not called").to.equal(1);
                    expect(c9.connected).to.equal(true);
                    expect(c9.has(c9.NETWORK)).to.equal(true);
                    
                    done();
                });
                
                c9.enable();
            });
            it('check status settings and getting', function(done) {
                c9.setStatus(c9.status & ~c9.STORAGE);
                expect(c9.has(c9.STORAGE)).to.equal(false);
                c9.setStatus(c9.status | c9.STORAGE);
                expect(c9.has(c9.STORAGE)).to.equal(true);
                done();
            });
            it('should send correct events during away', function(done) {
                expect(c9.connected).to.equal(true);
                expect(c9.has(c9.NETWORK)).to.equal(true);
                
                c9.once("away", function c1(){
                    expect(c9.connected).to.equal(false);
                    expect(c9.has(c9.NETWORK)).to.equal(true);
                });
                c9.once("back", function c1(){
                    expect(c9.connected).to.equal(true);
                    expect(c9.has(c9.NETWORK)).to.equal(true);
                    done();
                });
                
                vfs.connection.socket.close();
            });
        });
        
        onload && onload();
    }
});