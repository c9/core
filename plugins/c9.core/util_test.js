/*global describe:false, it:false */

"use client";

require(["lib/architect/architect", "lib/chai/chai"], function (architect, chai) {
    var expect = chai.expect;
    
    expect.setupArchitectTest([
        "plugins/c9.core/ext",
        "plugins/c9.core/util",
        // Mock plugins
        {
            consumes: [],
            provides: ["c9"],
            setup: expect.html.mocked
        },
        {
            consumes: ["util"],
            provides: [],
            setup: main
        }
    ], architect);
    
    function main(options, imports, register) {
        var util = imports.util;
        
        describe('getContentType, getFileIcon', function() {
            it('should retrieve the content type based on a filename', function() {
                expect(util.getContentType("test.js")).to.equal("application/javascript");
                expect(util.getContentType("test.html")).to.equal("text/html");
            });
            it('should retrieve the icon class name based on a filename', function() {
                expect(util.getFileIcon("test.js")).to.equal("page_white_code");
                expect(util.getFileIcon("test.html")).to.equal("html");
            });
        });
        
        onload && onload();
    }
});