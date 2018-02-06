/*global describe it before after = */

"use client";

require(["lib/architect/architect", "lib/chai/chai", "/vfs-root"],
    function (architect, chai, baseProc) {

    var expect = chai.expect;

    // save
    document.body.appendChild(document.createElement("div"))
            .setAttribute("id", "saveStatus");

    expect.setupArchitectTest([
        {
            packagePath: "plugins/c9.core/c9",
            workspaceId: "javruben/dev",
            startdate: new Date(),
            debug: true,
            hosted: true,
            local: false,
            davPrefix: "/"
        },
        "plugins/c9.core/ext",
        "plugins/c9.core/http-xhr",
        "plugins/c9.core/util",
        "plugins/c9.ide.ui/lib_apf",
        {
            packagePath: "plugins/c9.core/settings",
            testing: true
        },
        {
            packagePath: "plugins/c9.ide.ui/ui",
            staticPrefix: "plugins/c9.ide.ui"
        },
        "plugins/c9.ide.ui/menus",
        "plugins/c9.ide.editors/document",
        "plugins/c9.ide.editors/undomanager",
        "plugins/c9.ide.editors/editors",
        "plugins/c9.ide.editors/editor",
        "plugins/c9.ide.editors/tabmanager",
        "plugins/c9.ide.ui/focus",
        "plugins/c9.ide.editors/pane",
        "plugins/c9.ide.editors/tab",
        "plugins/c9.ide.ace/ace",
        "plugins/c9.ide.save/save",
        "plugins/c9.fs/proc",
        "plugins/c9.vfs.client/vfs_client",
        "plugins/c9.vfs.client/endpoint",
        "plugins/c9.ide.auth/auth",
        "plugins/c9.core/api",
        {
            packagePath: "plugins/c9.fs/fs",
            baseProc: baseProc
        },
        "plugins/c9.fs/fs.cache.xml",
        {
            packagePath: "plugins/c9.ide.collab/connect",
            enable: true,
            debug: true,
            nodeBin: "node",
            nodePath: "",
            basePath: baseProc
        },
        "plugins/c9.ide.collab/collab",
        "plugins/c9.ide.collab/collabpanel",
        "plugins/c9.ide.collab/share/share",
        "plugins/c9.ide.collab/workspace",
        "plugins/c9.ide.collab/util",
        {
            packagePath: "plugins/c9.ide.collab/ot/document",
            minDelay: 500,
            maxDelay: 10000
        },
        {
            packagePath: "plugins/c9.ide.collab/cursor_layer",
        },
        "plugins/c9.ide.collab/author_layer",
        {
            packagePath: "plugins/c9.ide.collab/timeslider/timeslider",
        },
        {
            packagePath: "plugins/c9.ide.collab/chat/chat",
        },
        "plugins/c9.ide.collab/members/members_panel",
        {
            packagePath: "plugins/c9.ide.collab/members/members",
        },

        {
            consumes: ["fs", "tabManager", "save",
                "collab.connect", "collab.workspace", "collab", "OTDocument",
                "members", "chat", "timeslider"],
            provides: [],
            setup: main
        }
    ], architect);
    
    function main(options, imports, register) {
        var save = imports.save;
        var fs = imports.fs;
        var tabs = imports.tabManager;

        var connect = imports["collab.connect"];
        var workspace = imports["collab.workspace"];
        var collab = imports.collab;
        var OTDocument = imports.OTDocument;
        var members = imports.members;
        var chat = imports.chat;
        var timeslider = imports.timeslider;

        describe('collab', function() {
            this.timeout(5000);

            var filePath = "/collab1.txt";
            
            before(function(done) {
                setTimeout(function() {
                    fs.writeFile(filePath, filePath, function() {
                        tabs.openFile(filePath, function() {
                            done();
                        });
                    });
                }, 100);
            });

            after(function(done) {
                fs.unlink(filePath, function() {
                    done();
                });
            });

            describe('test collab', function() {

                it('should connect', function(done) {
                    connect.on("connect", function(msg) {
                        expect(connect.connected).to.be.true;
                        expect(collab.connected).to.be.true;
                        expect(Object.keys(workspace.users)).length(1);
                        expect(workspace.users).to.contain.keys("1");
                        expect(workspace.users["1"].fullname).to.equal("John Doe");
                        done();
                    });
                });

                it('should be able to join a document', function(done) {
                    var doc = collab.getDocument(filePath);
                    doc.on("joined", function(e) {
                        expect(e.err).to.be.an('undefined');
                        expect(e.contents).to.equal(filePath);
                        done();
                    });
                });

                it('should edit and save a file', function(done) {
                    var doc = collab.getDocument(filePath);
                    var editorDoc = doc.session.doc;
                    var tab = tabs.focussedTab;

                    editorDoc.insert({ row: 0, column: 2 }, "-abc-");
                    expect(tab.document.value).to.equal("/c-abc-ollab1.txt");

                    doc.on("saved", function(e) {
                        expect(e.err).to.be.an('undefined');
                        expect(e.star).to.be.true;
                        expect(e.clean).to.be.true;
                        expect(e.revision.author).to.equal(1);
                        expect(e.revision.operation).to.deep.equal(["r2", "i-abc-", "r10"]);
                    });

                    save.save(tab, null, function() {
                        // expect(tab.document.changed).to.be.false;
                        done();
                    });
                });
            });

            describe('test timeslider and revisions', function() {

                before(function(done) {
                    timeslider.show();
                    done();
                });

                after(function(done) {
                    timeslider.hide();
                    done();
                });

                it('should load revisions', function(done) {
                    var doc = collab.getDocument(filePath);
                    doc.on("revisions", function(e) {
                        console.log(e.revisions);
                        timeslider.show();
                        done();
                    });
                    doc.loadRevisions();
                });
            });

            describe('test members panel', function() {
                it('should show members panel', function(done) {
                    collab.show();
                    done();
                });
            });
        });

        if (onload)
            onload();
    }
});
