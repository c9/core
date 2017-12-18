/*global describe it before after = */

"use client";

require(["lib/architect/architect", "lib/chai/chai", "/vfs-root"], 
  function (architect, chai, baseProc) {
    var expect = chai.expect;
    
    expect.setupArchitectTest([
        {
            packagePath: "plugins/c9.core/c9",
            startdate: new Date(),
            debug: true,
            staticUrl: "/static/plugins",
            hosted: true,
            local: false,
            projectName: "upload_test"
        },
        
        "plugins/c9.core/ext",
        "plugins/c9.core/http-xhr",
        "plugins/c9.core/util",
        "plugins/c9.ide.ui/focus",
        "plugins/c9.ide.ui/lib_apf",
        "plugins/c9.core/settings",
        {
            packagePath: "plugins/c9.ide.ui/ui",
            staticPrefix: "plugins/c9.ide.ui"
        },
        "plugins/c9.ide.tree/tree",
        "plugins/c9.ide.ui/menus",
        "plugins/c9.ide.upload/dragdrop",
        {
            packagePath: "plugins/c9.ide.upload/upload",
            staticPrefix: "plugins/c9.ide.upload"
        },
        {
            packagePath: "plugins/c9.ide.upload/upload_manager",
            filesPrefix: "/workspace"
        },
        {
            packagePath: "plugins/c9.ide.upload/upload_progress",
            staticPrefix: "plugins/c9.ide.upload"
        },        
        "plugins/c9.vfs.client/vfs_client",
        "plugins/c9.vfs.client/endpoint",
        "plugins/c9.ide.auth/auth",
        "plugins/c9.core/api",
        {
            packagePath: "plugins/c9.fs/fs",
            baseProc: baseProc
        },
        "plugins/c9.fs/fs.cache.xml",
        
        // dialogs
        "plugins/c9.ide.dialog/dialog",
        "plugins/c9.ide.dialog.common/alert",
        "plugins/c9.ide.dialog.common/alert_internal",
        "plugins/c9.ide.dialog.common/confirm",
        "plugins/c9.ide.dialog.common/filechange",
        "plugins/c9.ide.dialog.common/fileoverwrite",
        "plugins/c9.ide.dialog.common/fileremove",
        "plugins/c9.ide.dialog.common/question",
        "plugins/c9.ide.dialog.file/file",
        
        {
            consumes: ["upload", "dragdrop", "dialog.fileoverwrite"],
            provides: [],
            setup: main
        }
    ], architect);
    
    function main(options, imports, register) {
        var upload = imports.upload;
        var overwriteDialog = imports["dialog.fileoverwrite"];
        
        // expect.html.setConstructor(function(tab) {
        //     if (typeof tab == "object")
        //         return tab.pane.aml.getPage("editor::" + tab.editorType).$ext;
        // });
        
        describe('upload', function() {
            before(function(done) {
                done();
            });
            
            describe("upload dialog", function() {
                it('should open the dialog', function(done) {
                    upload.showUploadWindow();
                    done();
                });
            });
                
            describe("file exists dialog", function() {
                it('should open the dialog', function(done) {
                    var batch = {
                        files: [1, 2]
                    };
                    
                    upload.fileExistsDialog(batch, "/lib", "server.js", function(action, toAll) {
                        expect(action).is.equal("stop");
                        expect(toAll).ok;
                        done();
                    });
                    setTimeout(function() {
                        overwriteDialog.getElement("notoall").dispatchEvent("click");
                    }, 0);
                });
            });
            
            if (!onload.remain) {
                describe("unload()", function() {
                    it('should destroy all ui elements when it is unloaded', function(done) {
                        upload.unload();
                        done();
                    });
                });
                
                after(function(done) {
                    document.body.style.marginBottom = "";
                    done();
                });
            }
        });
        
        register();
    }
});