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
        
        describe('getFileIcon', function() {
            it('should retrieve the icon class name based on a filename', function() {
                expect(util.getFileIcon("test.js")).to.equal("page_white_code");
                expect(util.getFileIcon("test.html")).to.equal("html");
            });
        });
        
        describe('normalizePath', function() {
            var normalizePath = util.normalizePath;
            it('should handle home in workspaceDir', function() {
                util.$initPaths("/home/ubuntu", "/");
                expect(normalizePath("/home/ubuntu")).to.equal("/home/ubuntu/");
                expect(normalizePath("/home/ubuntu/x")).to.equal("/home/ubuntu/x");
                expect(normalizePath("/home/ubuntu/x/y")).to.equal("/home/ubuntu/x/y");
                expect(normalizePath("/home/ubuntu/xy")).to.equal("/home/ubuntu/xy");
                expect(normalizePath("/")).to.equal("/");
                expect(normalizePath("~/z")).to.equal("/home/ubuntu/z");
            });
            it('should handle workspaceDir in home', function() {
                util.$initPaths("/home/ubuntu", "/home/ubuntu/x");
                expect(normalizePath("/home/ubuntu")).to.equal("~/");
                expect(normalizePath("/home/ubuntu/x")).to.equal("/");
                expect(normalizePath("/home/ubuntu/x/y")).to.equal("/y");
                expect(normalizePath("/home/ubuntu/xy")).to.equal("~/xy");
                expect(normalizePath("/")).to.equal("/");
                expect(normalizePath("~/z")).to.equal("~/z");
            });
            it('should handle home == workspaceDir', function() {
                util.$initPaths("/home/ubuntu", "/home/ubuntu");
                expect(normalizePath("/home/ubuntu")).to.equal("/");
                expect(normalizePath("/home/ubuntu/x")).to.equal("/x");
                expect(normalizePath("/home/ubuntu/x/y")).to.equal("/x/y");
                expect(normalizePath("/home/ubuntu/xy")).to.equal("/xy");
                expect(normalizePath("/")).to.equal("/");
                expect(normalizePath("~/z")).to.equal("/z");
            });
            it('should handle relative paths', function() {
                util.$initPaths("/home/ubuntu", "/");
                expect(normalizePath("/home/ubuntu/x/y/.//../z")).to.equal("/home/ubuntu/x/z");
            });
        });
        
        onload && onload();
    }
});