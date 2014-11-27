/*global describe it before after = */

"use client";

require(["lib/architect/architect", "lib/chai/chai"], function (architect, chai) {
    var expect = chai.expect;
    
    expect.setupArchitectTest([
        "plugins/c9.core/ext",
        "plugins/c9.ide.ui/ui",
        "plugins/c9.ide.ui/lib_apf",
        "plugins/c9.ide.clipboard/clipboard",
        "plugins/c9.ide.clipboard/html5",
        
        // Mock plugins
        {
            consumes: [],
            provides: [
                "commands", "menus", "http", "layout", "c9", "dialog.error", 
                "dialog.alert", "settings"
            ],
            setup: expect.html.mocked
        },
        {
            consumes: ["clipboard"],
            provides: [],
            setup: main
        }
    ], architect);
    
    function main(options, imports, register) {
        var clipboard = imports.clipboard;
        
        describe('clipboard', function() {
            it('should provide the right events for the cut method', function(done) {
                var count = 0;
                clipboard.on("beforeCut", function(){ count++; });
                clipboard.on("cut", function(){ count++; });
                clipboard.cut();
                expect(count).to.equal(2);
                done();
            });
            it('should provide the right events for the copy method', function(done) {
                var count = 0;
                clipboard.on("beforeCopy", function(){ count++; });
                clipboard.on("copy", function(){ count++; });
                clipboard.copy();
                expect(count).to.equal(2);
                done();
            });
            it('should provide the right events for the paste method', function(done) {
                var count = 0;
                clipboard.on("beforePaste", function(){ count++; });
                clipboard.on("paste", function(){ count++; });
                clipboard.paste();
                expect(count).to.equal(2);
                done();
            });
            
           if (!onload.remain) {
               after(function(done) {
                   clipboard.unload();
                   done();
               });
           }
        });
        
        onload && onload();
    }
});