/*global describe it before bar */

"use client";

require(["lib/architect/architect", "lib/chai/chai", "/vfs-root"], 
  function (architect, chai, baseProc) {
    var expect = chai.expect;
    
    expect.setupArchitectTest([
        {
            packagePath: "plugins/c9.core/c9",
            startdate: new Date(),
            debug: true,
            hosted: true,
            davPrefix: "/",
            local: false,
            projectName: "Test Project"
        },
        "plugins/c9.core/ext",
        "plugins/c9.core/http-xhr",
        "plugins/c9.core/util",
        "plugins/c9.core/settings",
        {
            packagePath: "plugins/c9.ide.ui/ui",
            staticPrefix: "plugins/c9.ide.ui"
        },
        "plugins/c9.ide.editors/document",
        "plugins/c9.ide.editors/undomanager",
        {
            packagePath: "plugins/c9.ide.editors/editors",
            defaultEditor: "ace"
        },
        "plugins/c9.ide.editors/editor",
        "plugins/c9.ide.ui/lib_apf",
        {
            packagePath: "plugins/c9.fs/fs",
            baseProc: baseProc
        },
        {
            packagePath: "plugins/c9.ide.ace/ace",
            staticPrefix: "plugins/c9.ide.layout.classic"
        },
        "plugins/c9.vfs.client/vfs_client",
        "plugins/c9.vfs.client/endpoint",
        "plugins/c9.ide.auth/auth",
        "plugins/c9.core/api",
        "plugins/c9.ide.run.debug/breakpoints",
        {
            packagePath: "plugins/c9.ide.panels/panels",
            staticPrefix: "plugins/c9.ide.layout.classic",
            defaultActiveLeft: "tree"
        },
        "plugins/c9.ide.panels/panel",
        "plugins/c9.ide.panels/area",
        "plugins/c9.ide.run.debug/debugpanel",
        "plugins/c9.ide.ui/menus",
        {
            packagePath: "plugins/c9.ide.run.debug/debuggers/debugger",
            staticPrefix: "plugins/c9.ide.layout.classic"
        },
        "plugins/c9.ide.editors/tabmanager",
        "plugins/c9.ide.ui/focus",
        "plugins/c9.ide.editors/pane",
        "plugins/c9.ide.editors/tab",
        {
            consumes: ["breakpoints", "ui"],
            provides: [],
            setup: main
        }
    ], architect);
    
    function main(options, imports, register) {
        var breakpoints = imports.breakpoints;
        var ui = imports.ui;
        
        var list;
        
        function countEvents(count, expected, done) {
            if (count == expected)
                done();
            else
                throw new Error("Wrong Event Count: "
                    + count + " of " + expected);
        }
        
        describe('breakpoints', function() {
            before(function(done) {
                var bar = new ui.bar({
                    htmlNode: document.body
                });
                
                breakpoints.draw({ container: bar });
                list = breakpoints.getElement("list");
                
                bar.$ext.style.background = "rgba(220, 220, 220, 0.93)";
                bar.$ext.style.position = "fixed";
                bar.$ext.style.top = "75px";
                bar.$ext.style.right = "20px";
                bar.$ext.style.left = "";
                bar.$ext.style.bottom = "20px";
                bar.$ext.style.width = "300px";
                bar.$ext.style.height = "";
                
                done();
            });

            it('should add a breakpoint', function(done) {
                breakpoints.setBreakpoint({
                    path: "/file.txt",
                    text: "/file.txt",
                    line: 1,
                    column: 1,
                    lineOffset: 1,
                    content: "This is the content",
                    enabled: true
                });
                breakpoints.setBreakpoint({
                    path: "/file.txt",
                    text: "/file.txt",
                    line: 10,
                    column: 10,
                    lineOffset: 10,
                    content: "This is other content",
                    enabled: false
                });
                breakpoints.setBreakpoint({
                    path: "/file2.txt",
                    text: "/file2.txt",
                    line: 10,
                    column: 10,
                    lineOffset: 10,
                    content: "This is even other content",
                    enabled: false
                });
                
                expect.html(list, "Missing caption").text("/file.txt");
                expect.html(list, "Missing content").text("This is the content");
                expect.html(list.getFirstTraverseNode(), "Checked").className("checked");
                
                done();
            });
            
            it('should disable a breakpoint', function(done) {
                var bp = list.getFirstTraverseNode();
                
                expect.html(bp, "Checked").className("checked");
                var result = breakpoints.disableBreakpoint("/file.txt", 1);
                expect(result, "failed to execute command").ok;
                expect.html(bp, "Checked").not.className("checked");
                
                done();
            });
            
            it('should enable a breakpoint', function(done) {
                var bp = list.getFirstTraverseNode();
                
                expect.html(bp, "Checked").not.className("checked");
                var result = breakpoints.enableBreakpoint("/file.txt", 1);
                expect(result, "failed to execute command").ok;
                expect.html(bp, "Checked").className("checked");
                
                done();
            });
            
            it('should goto a breakpoint', function(done) {
                var bp = list.getFirstTraverseNode();
                
                breakpoints.on("breakpointShow", function(e) {
                    expect(e.path).to.equal("/file.txt");
                    expect(e.row).to.equal(1);
                    expect(e.column).to.equal(1);
                    done();
                });
                
                breakpoints.gotoBreakpoint("/file.txt", 1, 1);
            });
            
            it('should find a breakpoint', function(done) {
                var bp = breakpoints.findBreakpoint("/file.txt", 1);
                
                expect(bp.path).to.equal("/file.txt");
                expect(bp.text).to.equal("/file.txt");
                expect(bp.line).to.equal(1);
                expect(bp.column).to.equal(1);
                expect(bp.lineOffset).to.equal(1);
                expect(bp.content).to.equal("This is the content");
                expect(bp.enabled).to.equal(true);
                
                breakpoints.disableBreakpoint("/file.txt", 1);
                var bp = breakpoints.findBreakpoint("/file.txt", 1);
                expect(bp.enabled).to.equal(false);
                
                done();
            });
            
            it('should find all breakpoints in a file', function(done) {
                var result = breakpoints.findBreakpoints("/file.txt");
                expect(result).length(2);
                expect(result[1].path).to.equal("/file.txt");
                
                done();
            });
            
            it('should get all breakpoints', function(done) {
                var result = breakpoints.getAllBreakpoints("/file.txt");
                expect(result).length(3);
                expect(result[2].path).to.equal("/file2.txt");
                
                done();
            });
            
            describe("unload()", function() {
                it('should destroy all ui elements when it is unloaded', function(done) {
                    breakpoints.unload();
                    expect(list.$amlDestroyed).to.equal(true);
                    done();
                });
            });
        });
        
        register();
    }
});