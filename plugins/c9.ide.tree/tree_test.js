/*global describe it before */

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
        {
            packagePath: "plugins/c9.ide.tree/tree",
            staticPrefix: "/static/plugins/c9.ide.layout.classic"
        },
        "plugins/c9.core/ext",
        "plugins/c9.core/http-xhr",
        "plugins/c9.core/util",
        {
            packagePath: "plugins/c9.core/settings",
            settings: "default",
            testing: true
        },
        {
            packagePath: "plugins/c9.ide.ui/ui",
            staticPrefix: "plugins/c9.ide.ui"
        },
        "plugins/c9.ide.ui/lib_apf",
        "plugins/c9.ide.ui/menus",
        "plugins/c9.ide.ui/anims",
        {
            packagePath: "plugins/c9.fs/fs",
            baseProc: baseProc
        },
        "plugins/c9.vfs.client/vfs_client",
        "plugins/c9.vfs.client/endpoint",
        "plugins/c9.ide.auth/auth",
        "plugins/c9.core/api",
        "plugins/c9.fs/fs.cache.xml",
        
        "plugins/c9.ide.dialog/dialog",
        "plugins/c9.ide.dialog.common/alert",
        "plugins/c9.ide.dialog.common/alert_internal",
        "plugins/c9.ide.dialog.common/confirm",
        "plugins/c9.ide.dialog.common/filechange",
        "plugins/c9.ide.dialog.common/fileoverwrite",
        "plugins/c9.ide.dialog.common/fileremove",
        "plugins/c9.ide.dialog.common/question",
        
        {
            consumes: ["tree", "fs", "fs.cache", "tabManager", "ui", 
                "dialog.question", "dialog.alert"],
            provides: [],
            setup: main
        }
    ], architect);
    
    function main(options, imports, register) {
        var tree = imports.tree;
        var fs = imports.fs;
        var tabs = imports.tabManager;
        var ui = imports.ui;
        var fsCache = imports["fs.cache"];
        
        var questionDialog = imports["dialog.question"];
        var alertDialog = imports["dialog.alert"];
        var container;

        function getDomNode(treeNode) {
            var r = tree.tree.renderer;
            r.scrollCaretIntoView(treeNode);
            r.$renderChanges(r.$loop.changes);
            var i = r.provider.getIndexForNode(treeNode);
            return r.$cellLayer.getDomNodeAtIndex(i);
        }
        
        function countEvents(count, expected, done) {
            if (count == expected) 
                done();
            else
                throw new Error("Wrong Event Count: "
                    + count + " of " + expected);
        }
        
        expect.html.setConstructor(function(path) {
            var treeNode = fsCache.findNode(path);
            return getDomNode(treeNode);
        });
        
        describe('tree', function() {
            before(function(done) {
                tree.getElement("container", function(container_) {
                    container = container_;
                    container.$ext.style.height = "500px";
                    container.$ext.style.width = "200px";
                    tree.tree.resize();
                    
                    
                    done();
                });
            });

            describe("expand()", function() {
                before(function(done) {
                    fsCache.clear();
                    done();
                });
                
                it('should expand a folder in the tree that is already in the fs cache', function(done) {
                    tree.expand("/", function(err) {
                        if (err) throw err.message;
                        
                        expect.html("/dir").to.exist.and.is.visible;
                        done();
                    });
                });
                it('should expand a folder in the tree that is not yet loaded', function(done) {
                    fsCache.clear();
                    tree.expand("/dir", function(err) {
                        if (err) throw err.message;
                        
                        expect.html("/dir/smile.png").to.exist.and.is.visible;
                        done();
                    });
                });
                it('should give an error when the path does not exist', function(done) {
                    tree.expand("/does/not/exist", function(err) {
                        expect(err.message).to.equal("File Not Found");
                        done();
                    });
                });
                it('should give an error when the node does not exist', function(done) {
                    tree.expand(null, function(err) {
                        expect(err.message).to.equal("Missing Node");
                        done();
                    });
                });
            });
            describe("getAllExpanded()", function() {
                it('should return a list of expanded folders', function(done) {
                    fsCache.clear();
                    tree.expand("/dir", function() {
                        tree.expand("/dirLink", function() {
                            expect(tree.getAllExpanded().sort())
                                .deep.equal(["/", "/dir", "/dirLink"]);
                            done();
                        });
                    });
                });
            });
            describe("collapse() and collapseAll()", function() {
                it('should collapse a folder in the tree that is expanded', function(done) {
                    tree.expand("/", function(err) {
                        if (err) throw err.message;
                        tree.collapse("/");
                        expect.html("/dir").to.notExist;
                        expect(tree.getAllExpanded().sort())
                                .deep.equal(["/dir", "/dirLink"]);
                        done();
                    });
                });
                it('should collapse all expanded nodes', function(done) {
                    fsCache.clear();
                    tree.expand("/dir", function() {
                        expect.html("/dir").to.exist.and.visible;
                        expect.html("/dir/smile.png").to.exist.and.visible;
                        
                        tree.expand("/dirLink", function() {
                            expect.html("/dirLink").to.exist.and.visible;
                            expect.html("/dirLink/smile.png").to.exist.and.visible;
                            tree.collapseAll();
                            
                            //@todo expandedNode is sometimes empty
                            expect.html("/dir").to.notExist;
                            expect.html("/dir/smile.png").to.notExist;
                            expect.html("/dirLink").to.notExist;
                            expect.html("/dirLink/smile.png").to.notExist;
                            expect(tree.getAllExpanded()).deep.equal([]);
                            done();
                        });
                    });
                });
            });
            describe("select() and selectList()", function() {
                it('should select a node', function(done) {
                    tree.expand("/", function(err) {
                        if (err) throw err;
                        
                        var node = fsCache.findNode("/dir");
                        expect(node, "xml node").to.ok;
                        tree.select(node);
                        expect.html("/dir")
                            .to.exist
                            .to.have.className("selected");
                        expect(tree.selection).deep.equal(["/dir"]);
                        done();
                    });
                });
                it('should select a path', function(done) {
                    tree.select("/dirLink");
                    expect.html("/dirLink")
                        .to.exist
                        .to.have.className("selected");
                    expect(tree.selection).deep.equal(["/dirLink"]);
                    done();
                });
                it('should select a list of paths', function(done) {
                    tree.selectList(["/", "/dir", "/dirLink"]);
                    expect.html("/dirLink")
                        .to.exist
                        .to.have.className("selected");
                    expect.html("/dir")
                        .to.exist
                        .to.have.className("selected");
                    expect.html("/")
                        .to.exist
                        .to.have.className("selected");
                    expect(tree.selection)
                        .deep.equal(["/", "/dir", "/dirLink"]);
                    done();
                });
                it('should select a list of nodes', function(done) {
                    tree.selectList(["/", "/file.txt"].map(function(p) {
                        return fsCache.findNode(p);
                    }));
                    expect.html("/file.txt")
                        .to.exist
                        .to.have.className("selected");
                    expect.html("/")
                        .to.exist
                        .to.have.className("selected");
                    expect(tree.selection)
                        .deep.equal(["/", "/file.txt"]);
                    done();
                });
            });
            describe("openSelection()", function() {
                before(function(done) {
                    fsCache.clear();
                    done();
                });
                
                it('should open all files selected and ignore folders', function(done) {
                    var count = 0;
                    function c1() { count++; }
                    tabs.on("open", c1);
                    
                    tree.expand("/", function() {
                        tree.selectList(["/dir", "/file.txt", "/listing.json"]);
                        tree.openSelection();
                        tabs.off("open", c1);
                        countEvents(count, 2, done);
                    });
                });
            });
            describe("refresh()", function() {
                //@todo fsCache.clear should actually reset the expanded nodes
                //@todo add a test for refreshing of a not yet loaded folder
                
                before(function(done) {
                    fsCache.clear();
                    done();
                });
                
                it('should refresh the entire tree and remember all the expanded states', function(done) {
                    tree.expand("/dir", function() {
                        tree.expand("/dirLink", function() {
                            tree.selectList(
                                ["/dirLink/smile.png", "/dir/stuff.json"]);
                            expect(tree.selection)
                              .deep.equal(["/dirLink/smile.png", "/dir/stuff.json"]);
              
                            tree.refresh(function() {
                                expect.html("/dir").to.exist.and.visible;
                                expect.html("/dirLink").to.exist.and.visible;
                                expect(tree.getAllExpanded().sort())
                                  .deep.equal(["/", "/dir", "/dirLink"]);
                                expect(tree.selection)
                                  .deep.equal(["/dirLink/smile.png", "/dir/stuff.json"]);
              
                                done();
                            });
                        });
                    });
                });
                it('should refresh a sub tree and remember all the expanded states', function(done) {
                    fs.rmfile("/dir/test.html", function() {
                        fs.rmfile("/test.html", function() {
                            tree.expand("/dir", function(err) {
                                if (err) throw err.message;
                                
                                expect(fsCache.findNode("/dir/test.html"), "start").not.ok;
                                expect(fsCache.findNode("/test.html"), "start").not.ok;

                                fs.writeFile("/dir/test.html", "test", "utf8", function(err) {
                                    if (err) throw err.message;
                                    
                                    fs.writeFile("/test.html", "test", "utf8", function(err) {
                                        if (err) throw err.message;
                                        
                                        tree.select("/dir/smile.png");
              
                                        tree.refresh(["/dir"], function(err) {
                                            if (err) throw err.message;
                                            
                                            expect(fsCache.findNode("/dir/test.html")).ok;
                                            // expect(fsCache.findNode("/test.html")).not.ok; // TODO why this shouldn't exist?
                                            
                                            expect.html("/dir/test.html").to.exist.and.visible;
                                            // expect.html("/test.html").to.not.exist
                                            
                                            expect(tree.selection)
                                              .deep.equal(["/dir/smile.png"]);
              
                                            fs.rmfile("/dir/test.html", function() {
                                                fs.rmfile("/test.html", function() {
                                                    done();
                                                });
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
            describe("createFile() and createFolder()", function() {
                // @todo should create a file while the requested name already extists
                
                before(function(done) {
                    fsCache.clear();
                    done();
                });
                
                /**
                 * The problem is related to the fs caching. This ETAG thing is not always working properly
                 * Add the proper console.log statements to figure it out
                 */
                it('should create a file in the selected path and allow the user to rename it', function(done) {
                    fs.rmfile("/dir/test.html", function() {
                        tree.expand("/dir", function(err) {
                            if (err) throw err.message;
                            
                            tree.select("/dir");
                            expect(fsCache.findNode("/dir/test.html")).to.not.ok;
                            tree.createFile("test.html", false, function(err) {
                                if (err) throw err.message;
                                
                                expect(fsCache.findNode("/dir/test.html")).to.ok;
                                expect.html("/dir/test.html").to.exist.and.visible;
                                expect(tree.tree.edit.renaming).is.ok;
                                tree.tree.edit.endRename(false);
                                
                                fs.rmfile("/dir/test.html", function() {
                                    done();
                                });
                            });
                        });
                    });
                });
                it('should create a file in the selected path without renaming', function(done) {
                    fs.rmfile("/dir/test.html", function() {
                        tree.expand("/dir", function(err) {
                            if (err) throw err.message;
                            
                            tree.select("/dir");
                            expect(fsCache.findNode("/dir/test.html")).to.not.ok;
                            tree.createFile("test.html", true, function(err) {
                                if (err) throw err.message;
                                
                                expect(fsCache.findNode("/dir/test.html")).to.ok;
                                expect.html("/dir/test.html").to.exist.and.visible;
                                expect(tree.tree.edit.renaming).is.not.ok;
                                
                                fs.rmfile("/dir/test.html", function() {
                                    done();
                                });
                            });
                        });
                    });
                });
                it('should create a folder in the selected path and allow the user to rename it', function(done) {
                    fs.rmdir("/dir/dir", function() {
                        tree.expand("/dir", function(err) {
                            if (err) throw err.message;
                            
                            tree.select("/dir");
                            expect(fsCache.findNode("/dir/dir")).to.not.ok;
                            tree.createFolder("dir", false, function(err) {
                                if (err) throw err.message;
                                
                                expect(fsCache.findNode("/dir/dir")).to.ok;
                                expect.html("/dir/dir").to.exist.and.visible;
                                expect(tree.tree.edit.renaming).is.ok;
                                tree.tree.edit.endRename(false);
                                
                                fs.rmdir("/dir/dir", function() {
                                    done();
                                });
                            });
                        });
                    });
                });
                it('should create a folder in the selected path without renaming', function(done) {
                    fs.rmfile("/dir/dir", function() {
                        tree.expand("/dir", function(err) {
                            if (err) throw err.message;
                            
                            tree.select("/dir");
                            expect(fsCache.findNode("/dir/dir")).to.not.ok;
                            tree.createFolder("dir", true, function(err) {
                                if (err) throw err.message;
                                
                                expect(fsCache.findNode("/dir/dir")).to.ok;
                                expect.html("/dir/dir").to.exist.and.visible;
                                expect(tree.tree.edit.renaming).is.not.ok;
                                
                                fs.rmdir("/dir/dir", function() {
                                    done();
                                });
                            });
                        });
                    });
                });
            });
            describe("Response to changes to the fs cache", function() {
                before(function(done) {
                    fsCache.clear();
                    done();
                });
                
                it('should display the loading state and remove it', function(done) {
                    tree.expand("/", function(err) {
                        if (err) throw err.message;
                        expect.html("/").child(".filetree-icon").has.not.className("loading");
                        expect.html("/dirLink").has.className("symlink");
                        done();
                    });
                    expect.html("/").child(".filetree-icon").has.className("loading");
                });
                it('should add a node at the right sorting location', function(done) {
                    var node = fsCache.createNode("/gtest");
                    expect.html("/gtest").to.exist;
                    done();
                });
                it('should update a name', function(done) {
                    var node = fsCache.findNode("/gtest");
                    fsCache.createNode("/atest", null, node);
                    expect.html("/gtest").to.not.exist;
                    expect.html("/atest")
                        .to.exist
                        .child(-1)
                        .to.have.text("atest");
                    done();
                });
                it('should update an icon', function(done) {
                    var node = fsCache.findNode("/atest");
                    fsCache.createNode("/atest.js", null, node);
                    expect.html("/atest.js")
                        .to.have.icon("page_white_code");
                    done();
                });
                it('should remove a node', function(done) {
                    var node = fsCache.findNode("/atest.js");
                    fsCache.removeNode(node);
                    expect.html("/atest.js").to.not.exist;
                    done();
                });
                it('should move a subtree', function(done) {
                    fs.mkdir("/dir2", function(err) {
                        tree.expand("/dirLink", function(err) {
                            tree.expand("/dir2", function(err) {
                                if (err) throw err.message;
                                fs.rename("/dir2", "/dirLink/dir2", function() {
                                    done();
                                });
                                expect.html("/dirLink/dir2").to.have.text("dir2");
                            });
                        });
                    });
                });
                it('should deal correctly with a non-loaded subtree', function(done) {
                    fsCache.clear();
                    tree.expand("/dirLink", function(err) {
                        fs.rename("/dirLink/dir2", "/dir2", function() {
                            fs.rmdir("/dir2", function() {
                                done();
                            });
                        });
                        expect.html("/dir2").to.exist;
                    });
                });
            });
            describe("Actions from the UI that trigger fs actions", function() {
                before(function(done) {
                    fsCache.clear();
                    done();
                });
                
                it('should expand a node and load its contents', function(done) {
                    tree.select("/");
                    tree.expand(fsCache.findNode("/"));
                    fs.on("afterReaddir", function c1(e) {
                        fs.off("afterReaddir", c1);
                        
                        setTimeout(function() {
                            expect.html("/dir")
                                .to.exist
                                .is.visible;
    
                            done();
                        }, 0);
                    });
                });
                it('should rename a node', function(done) {
                    tree.expand("/", function() {
                        fs.rmfile("/test2.html", function() {
                            fs.writeFile("/test.html", "test", function(err) {
                                if (err) throw err.message;
                            
                                tree.select("/test.html");
                                
                                var edit = tree.tree.edit;
                                edit.startRename();
                                edit.ace.setValue("test2.html");
                                edit.endRename();
                                
                                expect(fsCache.findNode("/test2.html")).to.ok
                                    .and.property("status").equals("predicted");
                                
                                fs.once("afterRename", function() {
                                    fs.exists("/test2.html", function(exists) {
                                        expect(exists).to.ok;
                                        expect(fsCache.findNode("/test2.html")).to.ok
                                            .and.property("status").equals("loaded");
                                        done();
                                    });
                                });
                            });
                        });
                    });
                });
                it('should delete a node', function(done) {
                    tree.select("/test2.html");
                        
                    tree.tree.execCommand("delete");
                    
                    setTimeout(function() {
                        questionDialog.getElement("yes").onclick();
                        expect(fsCache.findNode("/test2.html")).to.not.ok;
                        
                        fs.exists("/test2.html", function(exists) {
                            expect(exists).to.not.ok;
                            done();
                        });
                    }, 0);
                });
                it('should not be able to delete the root folder', function(done) {
                    tree.select("/");
                    
                    var alerted;
                    alertDialog.once("show", function() {
                        alerted = true;
                    });
                    
                    tree.tree.execCommand("delete");
                    expect(fsCache.findNode("/")).to.ok;
                    
                    setTimeout(function() {
                        expect(alerted).to.ok;
                        alertDialog.hide();
                        
                        fs.exists("/", function(exists) {
                            expect(exists).to.ok;
                            done();
                        });
                    }, 0);
                });
                it('should move a node', function(done) {
                    fs.rmfile("/dir/test.html", function() {
                        fs.writeFile("/test.html", "test", "utf8", function(err) {
                            if (err) throw err.message;
                            
                            tree.select("/test.html");
                                
                            tree.move(
                                [fsCache.findNode("/test.html")], 
                                fsCache.findNode("/dir"),
                                null, 
                                function() {
                                    fs.exists("/dir/test.html", function(exists) {
                                        expect(exists, "exists1").to.ok;
                                        fs.exists("/test.html", function(exists) {
                                            expect(exists, "exists2").to.not.ok;
                                            expect(tree.selection).deep.equal(["/dir/test.html"]);
                                            done();
                                        });
                                    });
                                }
                            );
                            expect(fsCache.findNode("/dir/test.html"), "/dir/test.html").to.ok;
                            expect(fsCache.findNode("/test.html"), "/test.html").to.not.ok;
                            
                        });
                    });
                });
                it('should copy a node', function(done) {
                    expect(fsCache.findNode("/dir/test.html")).to.ok;
                    expect(fsCache.findNode("/test.html")).to.not.ok;
                    tree.copy(
                        [fsCache.findNode("/dir/test.html")],
                        fsCache.findNode("/"),
                        function () {
                            fs.exists("/dir/test.html", function(exists) {
                                expect(exists).to.ok;
                                fs.exists("/test.html", function(exists) {
                                    expect(exists).to.ok;
                                    expect(tree.selection, "selection").deep.equal(["/test.html"]);
                                    fs.rmfile("/dir/test.html", function() {
                                        fs.rmfile("/test.html", function() {
                                            done();
                                        });
                                    });
                                });
                            });
                        }
                    );
                    
                    expect(fsCache.findNode("/dir/test.html")).to.ok;
                    expect(fsCache.findNode("/test.html")).to.ok;
                });
            });
            
            if (!onload.remain) {
                describe("unload()", function() {
                    it('should destroy all ui elements when it is unloaded', function(done) {
                        tree.unload();
                        expect(container.$amlDestroyed).to.equal(true);
                        done();
                    });
                });
            }
        });
        
        register();
    }
});