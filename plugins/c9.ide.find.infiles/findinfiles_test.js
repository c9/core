/*global describe it before after bar =*/

"use client";

require(["lib/architect/architect", "lib/chai/chai", "/vfs-root"], 
  function (architect, chai, baseProc) {
    var expect = chai.expect;
    
    var nak = baseProc.replace(/plugins\/.*/, "/node_modules/nak/bin/nak");
    
    expect.setupArchitectTest([
        {
            packagePath: "plugins/c9.core/c9",
            workspaceId: "ubuntu/ip-10-35-77-180",
            startdate: new Date(),
            debug: true,
            hosted: true,
            local: false,
            davPrefix: "/",
            home: "/home/ubuntu"
        },
        
        "plugins/c9.core/ext",
        "plugins/c9.core/http-xhr",
        "plugins/c9.core/util",
        "plugins/c9.ide.console/console",
        "plugins/c9.ide.ui/lib_apf",
        "plugins/c9.ide.ui/tooltip",
        "plugins/c9.ide.ui/menus",
        {
            packagePath: "plugins/c9.core/settings",
            settings: { user: { general: { animateui: true }}}
        },
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
        {
            packagePath: "plugins/c9.ide.editors/tabmanager"
        },
        "plugins/c9.ide.ui/focus",
        "plugins/c9.ide.editors/pane",
        "plugins/c9.ide.editors/tab",
        "plugins/c9.ide.ace/ace",
        {
            packagePath: "plugins/c9.ide.find.infiles/findinfiles",
        },
        {
            packagePath: "plugins/c9.ide.find/find",
            basePath: baseProc
        },
        {
            packagePath: "plugins/c9.ide.find/find.nak",
            ignore: "",
            installPath: "~/.c9",
            testing: true,
            nak: nak,
            node: "node"
        },
        "plugins/c9.ide.keys/commands",
        "plugins/c9.fs/proc",
        {
            packagePath: "plugins/c9.vfs.client/vfs_client"
        },
        "plugins/c9.vfs.client/endpoint",
        "plugins/c9.ide.auth/auth",
        "plugins/c9.core/api",
        "plugins/c9.fs/fs",
        
        {
            consumes: ["findinfiles", "tabManager", "console"],
            provides: [],
            setup: main
        }
    ], architect);
    
    function main(options, imports, register) {
        var findinfiles = imports.findinfiles;
        var tabs = imports.tabManager;
        
        function getTabHtml(tab) {
            return tab.pane.aml.getPage("editor::" + tab.editorType).$ext;
        }
        
        expect.html.setConstructor(function(tab) {
            if (typeof tab == "object")
                return tab.$ext;
        });
        
        describe('ace', function() {
            this.timeout(10000);
            
            before(function(done) {
                bar.$ext.style.background = "rgba(220, 220, 220, 0.93)";
                bar.$ext.style.position = "absolute";
                bar.$ext.style.left = "20px";
                bar.$ext.style.right = "20px";
                bar.$ext.style.bottom = "50px";
                bar.$ext.style.height = "150px";
      
                document.body.style.marginBottom = "150px";
                done();
            });
            
            describe("open", function() {
                it("should open searchresults tab", function(done) {
                    findinfiles.toggle();
                    tabs.open({ path: "/file.txt", focus: true }, function(err, tab) {
                        expect(tabs.getTabs()).length.is.gte(1);
                        findinfiles.getElement("ddSFSelection").setValue("open");
                        findinfiles.execFind(null, function() {
                            expect(tabs.findTab("/.c9/searchresults").document.value).match(/^\/file.txt:/m);
                            done();
                        });
                    });
                });
            });
            
            if (!onload.remain) {
                describe("unload", function() {
                    it('should unload find in files plugin', function(done) {
                        findinfiles.unload();
                        done();
                    });
                });
                
                after(function(done) {
                   imports.console.unload();
                   
                   document.body.style.marginBottom = "";
                   done();
               });
            }
        });
            
        register();
    }
});