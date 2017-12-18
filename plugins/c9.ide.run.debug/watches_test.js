/*global describe it before bar */

"use client";

require(["lib/architect/architect", "lib/chai/chai", "/vfs-root", "events"],
  function (architect, chai, baseProc, events) {
    var expect = chai.expect;

    var EventEmitter = events.EventEmitter;
    
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
        "plugins/c9.ide.ui/lib_apf",
        {
            packagePath: "plugins/c9.ide.editors/editors",
            defaultEditor: "ace"
        },
        "plugins/c9.ide.editors/editor",
        {
            packagePath: "plugins/c9.ide.ace/ace",
            staticPrefix: "plugins/c9.ide.layout.classic"
        },
        {
            packagePath: "plugins/c9.fs/fs",
            baseProc: baseProc
        },
        "plugins/c9.ide.editors/tabmanager",
        "plugins/c9.ide.ui/focus",
        "plugins/c9.ide.editors/pane",
        "plugins/c9.ide.editors/tab",
        "plugins/c9.vfs.client/vfs_client",
        "plugins/c9.vfs.client/endpoint",
        "plugins/c9.ide.auth/auth",
        "plugins/c9.core/api",
        "plugins/c9.ide.ui/menus",
        "plugins/c9.ide.panels/panels",
        "plugins/c9.ide.panels/panel",
        "plugins/c9.ide.panels/area",
        "plugins/c9.ide.run.debug/debugpanel",
        {
            packagePath: "plugins/c9.ide.run.debug/debuggers/debugger",
            staticPrefix: "plugins/c9.ide.layout.classic"
        },
        "plugins/c9.ide.run.debug/breakpoints",
        "plugins/c9.ide.run.debug/watches",
        {
            consumes: ["panels", "debugger", "watches", "breakpoints", "layout"],
            provides: [],
            setup: main
        }
    ], architect);
    
    function main(options, imports, register) {
        var watches = imports.watches;
        var panels = imports.panels;
        var breakpoints = imports.breakpoints;
        var debug = imports.debugger;
        var layout = imports.layout;
        var datagrid;
        
        var testDebugger = new EventEmitter();
        testDebugger.attach = function () {
            testDebugger.emit("attached", { breakpoints: breakpoints });
        };
        
        describe('breakpoints', function() {
            before(function(done) {
                layout.findParent();
                panels.activate("debugger");
                var datagrid = watches.getElement("datagrid");
            
                bar.$ext.style.background = "rgba(220, 220, 220, 0.93)";
                bar.$ext.style.position = "fixed";
                bar.$ext.style.top = "75px";
                bar.$ext.style.right = "20px";
                bar.$ext.style.left = "";
                bar.$ext.style.bottom = "20px";
                bar.$ext.style.width = "300px";
                bar.$ext.style.height = "";

                debug.registerDebugger("test", testDebugger);
                done();
            });

            it('should add a frame', function(done) {
                debug.debug({ running: true, STARTED: true, meta: { $debugger: true }, runner: { "debugger": "test" }}, function () {});
                testDebugger.emit("break", { frame: {}});
                
                // TODO actual watches
                // expect.html(datagrid, "Missing caption").text("/file.txt");
                // expect.html(datagrid, "Missing content").text("This is the content");
                // expect.html(datagrid.getFirstTraverseNode(), "Checked").className("checked");
                
                done();
            });
            
        });

       // describe("unload()", function(){
       //     it('should destroy all ui elements when it is unloaded', function(done) {
       //         breakpoints.unload();
       //         expect(datagrid.$amlDestroyed).to.equal(true);
       //         bar.destroy(true, true);
       //         bar = null;
       //         done();
       //     });
       // });

        
        register();
    }
});