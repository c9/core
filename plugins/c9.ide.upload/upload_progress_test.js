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
            local: false
        },
        
        "plugins/c9.core/ext",
        "plugins/c9.core/http-xhr",
        "plugins/c9.core/util",
        "plugins/c9.ide.ui/focus",
        "plugins/c9.ide.ui/lib_apf",
        "plugins/c9.core/settings",
        "plugins/c9.ide.ui/anims",
        {
            packagePath: "plugins/c9.ide.ui/ui",
            staticPrefix: "plugins/c9.ide.ui"
        },
        {
            packagePath: "plugins/c9.ide.tree/tree",
            staticPrefix: "/static/plugins/c9.ide.layout.classic"
        },
        "plugins/c9.ide.ui/menus",
        {
            packagePath: "plugins/c9.ide.upload/upload_progress",
            staticPrefix: "plugins/c9.ide.layout.classic"
        },
        {
            packagePath: "plugins/c9.ide.upload/upload_manager",
            filesPrefix: "/workspace"
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
        
        "plugins/c9.ide.dialog/dialog",
        "plugins/c9.ide.dialog.common/alert",
        "plugins/c9.ide.dialog.common/alert_internal",
        "plugins/c9.ide.dialog.common/question",
        "plugins/c9.ide.dialog.common/fileoverwrite",
        "plugins/c9.ide.dialog.common/fileremove",
        
        {
            consumes: ["upload.progress", "upload.manager", "settings"],
            provides: [],
            setup: main
        }
    ], architect);
    
    function main(options, imports, register) {
        var progress = imports["upload.progress"];
        var uploadManager = imports["upload.manager"];
        
        describe('upload', function() {
            before(function(done) {
                imports.settings.set("general/@animateui", true);
                var createJob = uploadManager._createJob;
                uploadManager._createJob = function() {
                    var job = createJob.apply(this, arguments);
                    job._startUpload = function() {};
                    return job;
                };
                done();
            });
            
            describe("upload manager", function() {
                it('should open the list', function(done) {
                    progress.show();
                    
                    var job1 = uploadManager.uploadFile({ name: "hello.txt", size: 423 }, "/lib/hello.txt");
                    var job2 = uploadManager.uploadFile({ name: "juhu.txt", size: 423 }, "/lib/juhu.txt");
                    
                    job1._progress(0.55);
                    
                    done();
                });

            });
            if (!onload.remain) {
                describe("unload()", function() {
                    it('should destroy all ui elements when it is unloaded', function(done) {
                        progress.unload();
                        
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