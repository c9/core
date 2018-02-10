/*global describe it before after bar */

"use client";

require([
    "lib/architect/architect", 
    "lib/chai/chai",
    "/vfs-root"
], function (architect, chai, baseProc) {
    var expect = chai.expect;
    
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
        "plugins/c9.ide.ui/forms",
        "plugins/c9.ide.ui/lib_apf",
        "plugins/c9.ide.ui/menus",
        "plugins/c9.ide.ui/anims",
        {  
            packagePath: "plugins/c9.core/settings",
            testing: true
        },
        "plugins/c9.ide.keys/commands",
        "plugins/c9.ide.keys/editor",
        {
            packagePath: "plugins/c9.ide.ui/ui",
            staticPrefix: "plugins/c9.ide.ui"
        },
        "plugins/c9.ide.editors/document",
        "plugins/c9.ide.editors/undomanager",
        "plugins/c9.ide.editors/editors",
        "plugins/c9.ide.editors/editor",
        "plugins/c9.ide.editors/tabmanager",
        "plugins/c9.ide.ui/focus",
        "plugins/c9.ide.editors/pane",
        "plugins/c9.ide.editors/tab",
        "plugins/c9.ide.terminal/terminal",
        "plugins/c9.ide.ace/ace",
        {
            packagePath: "plugins/c9.ide.welcome/welcome",
            staticPrefix: "plugins/c9.ide.welcome"
        },
        {
            packagePath: "plugins/c9.ide.preferences/preferences",
            staticPrefix: "plugins/c9.ide.preferences"
        },
        "plugins/c9.ide.preferences/preferencepanel",
        "plugins/c9.ide.preferences/general",
        {
            packagePath: "plugins/c9.fs/fs",
            baseProc: baseProc
        },
        "plugins/c9.fs/proc",
        "plugins/c9.vfs.client/vfs_client",
        "plugins/c9.vfs.client/endpoint",
        "plugins/c9.ide.auth/auth",
        "plugins/c9.core/api",
        
        {
            consumes: ["tabManager", "welcome"],
            provides: [],
            setup: main
        }
    ], architect);
    
    function main(options, imports, register) {
        var tabs = imports.tabManager;
        
        expect.html.setConstructor(function(tab) {
            if (typeof tab == "object")
                return tab.pane.aml.getPage("editor::" + tab.editorType).$ext;
        });
        
        describe('preferences', function() {
            this.timeout(20000);
            
            before(function(done) {
                bar.$ext.style.height = "66%";
                
                document.body.style.marginBottom = "66%";
                
                tabs.once("ready", function() {
                    done();
                });
            });
            
            
            describe("Welcome", function() {
                this.timeout(10000);
                
                it('should open a pane with just an editor', function(done) {
                    tabs.openEditor("welcome", function(err, tab) {
                        expect(tabs.getTabs()).length.gt(0);
                        
                        done();
                    });
                });
            });
            describe("unload()", function() {
               this.timeout(10000);
               
               it('should unload the welcome screen', function(done) {
                   tabs.getTabs()[0].editor.unload();
                   tabs.getTabs()[0].unload();
                   tabs.unload();
                   done();
               });
           });
           
           after(function(done) {
               document.body.style.marginBottom = "";
               done();
           });
        });
        
        register();
    }
});