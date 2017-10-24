/*global describe it before after bar*/

"use client";

require(["lib/architect/architect", "lib/chai/chai"], function (architect, chai) {
    var expect = chai.expect;
    
    expect.setupArchitectTest([
        {
            packagePath: "plugins/c9.core/c9",
            workspaceId: "ubuntu/ip-10-35-77-180",
            startdate: new Date(),
            debug: true,
            hosted: true,
            local: false,
        },
        
        "plugins/c9.core/ext",
        "plugins/c9.core/http-xhr",
        "plugins/c9.core/util",
        "plugins/c9.ide.ui/lib_apf",
        "plugins/c9.ide.ui/menus",
        {
            packagePath: "plugins/c9.core/settings",
            settings: "default",
            testing: true
        },
        "plugins/c9.core/api.js",
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
        "plugins/c9.ide.editors/tabmanager",
        "plugins/c9.ide.ui/focus",
        "plugins/c9.ide.editors/pane",
        "plugins/c9.ide.editors/tab",
        "plugins/c9.ide.keys/commands",
        "plugins/c9.fs/proc",
        "plugins/c9.vfs.client/vfs_client",
        "plugins/c9.vfs.client/endpoint",
        "plugins/c9.ide.auth/auth",
        "plugins/c9.fs/fs",
        
        "plugins/c9.ide.dialog/dialog",
        "plugins/c9.ide.dialog.common/alert",
        "plugins/c9.ide.dialog.common/alert_internal",
        // Previewer
        {
            packagePath: "plugins/c9.ide.preview/preview",
            staticPrefix: "/static" + "/plugins/c9.ide.preview",
            defaultPreviewer: "preview.browser",
            previewUrl: "/preview",
        },
        "plugins/c9.ide.preview/previewer",
        "plugins/c9.ide.preview/previewers/raw",
        {
            packagePath: "plugins/c9.ide.preview.browser/browser",
            staticPrefix: "/static" + "/plugins/c9.ide.preview.browser"
        },
        {
            packagePath: "plugins/c9.ide.preview.markdown/markdown",
            staticPrefix: "/static",
            htmlPath: "/plugins/c9.ide.preview.markdown/markdown.html",
        },
        "plugins/c9.ide.remote/manager",
        "plugins/c9.ide.remote/documents/htmldocument",
        "plugins/c9.ide.remote/documents/cssdocument",
        "plugins/c9.ide.remote/documents/jsdocument",
        {
            packagePath: "plugins/c9.ide.remote/transports/postmessage",
            // previewBaseUrl: options.previewBaseUrl
        },
        
        {
            consumes: ["tabManager", "ace", "commands", "fs", "preview"],
            provides: [],
            setup: main
        }
    ], architect);
    
    function main(options, imports, register) {
        var fs = imports.fs;
        var ace = imports.ace;
        var tabs = imports.tabManager;
        var preview = imports.preview;
        var commands = imports.commands;
        
        describe('ace', function() {
            before(function(done) {
                bar.$ext.style.background = "rgba(220, 220, 220, 0.93)";
                bar.$ext.style.position = "fixed";
                bar.$ext.style.left = "20px";
                bar.$ext.style.width = "1000px";
                bar.$ext.style.bottom = "20px";
                bar.$ext.style.height = "33%";
      
                document.body.style.marginBottom = "33%";
                
                tabs.once("ready", function() {
                    tabs.getPanes()[0].focus();
                    done();
                });
            });
            
            describe("open", function() {
                this.timeout(10000);
                
                it('should open html preview', function(done) {
                    fs.writeFile("/dir/preview.md", [
                        "ok",
                        "<img onerror='top.xss=1' src>"
                    ].join("\n"), function(err) {
                        expect(err).to.not.ok;
                        preview.openPreview("/dir/preview.md", null, true, function(err, tab) {
                            expect(err).to.not.ok;
                            done();
                        });
                    });
                });
            });
            
           if (!onload.remain) {
               after(function(done) {
                   tabs.unload();
                   done();
               });
           }
        });
        
        register();
    }
});