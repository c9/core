/*global describe it before*/

"use client";

require(["lib/architect/architect", "lib/chai/chai", "/vfs-root", "events"], 
  function (architect, chai, baseProc, events) {
    var expect = chai.expect;
    var EventEmitter = events.EventEmitter;
    
    expect.setupArchitectTest([
        {
            packagePath: "plugins/c9.core/c9",
            startdate: new Date(),
            debug: false,
            hosted: true,
            local: false,
            davPrefix: "/"
        },
        "plugins/c9.core/http-xhr",
        "plugins/c9.core/ext",
        "plugins/c9.core/settings",
        "plugins/c9.core/util",
        "plugins/c9.core/api",
        "plugins/c9.ide.ui/ui",
        "plugins/c9.ide.ui/lib_apf",
        "plugins/c9.fs/fs.cache.xml",
        {
            consumes: [],
            provides: ["watcher"],
            setup: function(options, imports, register) {
                register(null, {
                    watcher: new EventEmitter()
                });
            }
        },
        {
            packagePath: "plugins/c9.fs/fs",
            baseProc: baseProc
        },
        "plugins/c9.fs/proc",
        "plugins/c9.vfs.client/vfs_client",
        "plugins/c9.vfs.client/endpoint",
        "plugins/c9.ide.auth/auth",
         // Mock plugins
        {
            consumes: ["apf", "ui", "Plugin"],
            provides: [
                "auth.bootstrap", "info", "dialog.error"
            ],
            setup: expect.html.mocked
        },
        {
            consumes: ["fs.cache", "fs", "proc", "watcher"],
            provides: [],
            setup: main
        },
        
    ], architect);
    
    function main(options, imports, register) {
        var fsCache = imports["fs.cache"];
        var fs = imports.fs;
        var proc = imports.proc;
        var watcher = imports.watcher;
        var model = fsCache.model;
        
        describe('fs.cache.xml', function() {
            describe('fs.readdir()', function() {
                it("should cache a directory when read and parent exist and fire readdir event", function(done) {
                    fsCache.clear();
                    
                    var count = 0;
                    function c2(e) {
                        expect(e.path).to.equal("/");
                        count++;
                    }
                    fsCache.on("readdir", c2);
                    
                    var root = model.projectDir;
                    fs.readdir("/", function(){
                        expect(model.getChildren(root)).length.gt(4);
                        fsCache.off("readdir", c2);
                        
                        if (count == 1) 
                            done();
                        else
                            throw new Error("Wrong Event Count: "
                                + count + " of 1");
                    });
                });
                it("should defer caching a directory until it's parent is cached and then fire orphan-append event", function(done) {
                    fsCache.clear();
                    var root = model.projectDir;
                    
                    var count = 0;
                    function c3(e) {
                        expect(e.path).to.equal("/dir");
                        count++;
                    }
                    fsCache.on("orphan-append", c3);
                    
                    fs.readdir("/dir", function(){
                        expect(model.getChildren(root)).not.ok;
                        
                        fs.readdir("/", function(){
                            expect(model.getChildren(root)).length.gt(4);
                            model.open(root)
                            var dir = fsCache.findNode("/dir");
                            expect(dir).to.exist
                            expect(model.getChildren(dir)).length.gt(1);
                            fsCache.off("orphan-append", c3);
                            
                            if (count == 1) 
                                done();
                            else
                                throw new Error("Wrong Event Count: "
                                + count + " of 1");
                        });
                    });
                });
                it("shouldn't loose contents of a loading child", function(done) {
                    fsCache.clear();
                    
                    var root = model.projectDir;
                    fs.readdir("/", function(){
                        fs.readdir("/dir", function(){
                            expect(fsCache.findNode("/dir/smile.png")).to.exist;
                            fs.readdir("/dir", function(){});
                            var dir = fsCache.findNode("/dir");
                            expect(dir.status).to.equal("loading");
                            model.open(root);
                            model.open(dir);
                            var nodeCount = model.visibleItems.length;
                            expect(nodeCount).gt(4);
                            expect(model.visibleItems.indexOf(dir)).not.equal(-1);
                            model.close(root);
                            model.open(root);
                            var newNodeCount = model.visibleItems.length;
                            expect(newNodeCount).to.equal(nodeCount);
                            done();
                        });
                    });
                });
            });
            
            describe('fs.stat()', function() {
                it("should cache file information from a stat() call", function(done) {
                    var node = fsCache.findNode("/file.txt");
                    fsCache.removeNode(node);
                    
                    fs.stat("/file.txt", function() {
                        expect(fsCache.findNode("/file.txt")).to.exist;
                        done(); 
                    });
                });
            });
        
            describe('fs.readFile()', function() {
                it("should cache file information from a readFile() call", function(done) {
                    var node = fsCache.findNode("/file.txt");
                    fsCache.removeNode(node)
                    
                    fs.readFile("/file.txt", "utf8", function() {
                        expect(fsCache.findNode("/file.txt")).to.exist;
                        done(); 
                    });
                });
            });
        
            describe('fs.exists()', function() {
                it("should cache file information from an exists() call", function(done) {
                    var node = fsCache.findNode("/file.txt");
                    fsCache.removeNode(node)
                    
                    fs.on("afterExists", function(e) {
                        if (e.error) throw e.errror;
                    });
                    
                    fs.exists("/file.txt", function() {
                        expect(fsCache.findNode("/file.txt")).to.exist;
                        done(); 
                    });
                });
                it("should cache dir information from an exists() call", function(done) {
                    var vpath = "/dir";
                    fs.readdir("/", function(){
                        var node = fsCache.findNode(vpath);
                        fsCache.removeNode(node)
                        
                        fs.exists(vpath, function() {
                            expect(fsCache.findNode(vpath))
                                .to.exist
                                .property("isFolder").to.equal(true);
                            done(); 
                        });
                    });
                });
            });
        
            describe('fs.writeFile()', function() {
                before(function(done) {
                    fsCache.clear();
                    done();
                });

                it("should cache file information from a writeFile() call", function(done) {
                    var count = 0;
                    function c2(e) {
                        expect(e.path).to.equal("/newfile.txt");
                        count++;
                    }
                    fsCache.on("add", c2);
                    
                    fs.writeFile("/newfile.txt", "test", function() {
                        fsCache.off("add", c2);
                        expect(fsCache.findNode("/newfile.txt")).to.exist;
                        fs.unlink("/newfile.txt", function(){});
                        
                        if (count == 1)
                            done();
                        else
                            throw new Error("Wrong event Count");
                    });
                });
                it("should undo cache file information from a writeFile() that returns an error", function(done) {
                    var vpath = "/file2.txt";
                    var count = 0;
                    // TODO
                    return done()
                    fs.writeFile(vpath, "test", "utf8", function(){
                        function c4(e) {
                            expect(e.path).to.equal(vpath);
                            count++;
                        }
                        function c3(e) {
                            expect(e.path).to.equal(vpath);
                            count++;
                        }
                        fsCache.on("add", c3);
                        fsCache.on("remove", c4);
                        
                        var node = fsCache.findNode(vpath);
                        if (node)
                            fsCache.removeNode(node)
                        
                        proc.spawn("chmod", {
                            args: ["000", baseProc + vpath]
                        }, function(err, child) {
                            expect(err, "chmod error").to.not.ok;
                            expect(fsCache.findNode(vpath), "start").to.not.exist;
                            
                            fs.writeFile(vpath, "Test2", function(err) {
                                expect(err, "fs write error").to.ok;
                                
                                fsCache.off("remove", c4);
                                fsCache.off("add", c3);
                                expect(fsCache.findNode(vpath), "after").to.not.exist;
                                
                                proc.spawn("chmod", {
                                    args: ["666", baseProc + "/file.txt"]
                                }, function() {
                                    fs.unlink(vpath, function(){
                                        if (count == 2)
                                            done();
                                        else
                                            throw new Error("Wrong Event Count: " 
                                                + count + " of 2");
                                    });
                                });
                            });
                        });
                    });
                });
            });
            
            describe('fs.mkdir()', function() {
                before(function(done) {
                    fsCache.clear();
                    done();
                });
                it("should cache file information from a mkdir() call", function(done) {
                    var vpath = "/newdir";
                    var count = 0;
                    
                    // Make sure it doesn't exist yet
                    fs.rmdir(vpath, {}, function(err) {
                        function c2(e) {
                            expect(e.path).to.equal(vpath);
                            count++;
                        }
                        fsCache.on("add", c2);
                        
                        fs.mkdir(vpath, function(err) {
                            expect(fsCache.findNode(vpath)).to.exist;
                            fsCache.off("add", c2);
                            fs.rmdir(vpath, function(){
                                if (count == 1)
                                    done();
                                else
                                    throw new Error("Wrong Event Count: " 
                                        + count + " of 1");
                            });
                        });
                    });
                });
                it("should undo cache file information from a mkdir() that returns an error", function(done) {
                    var vpath = "/dir";
                    var count = 0;
                    fsCache.on("add", function c3(e) {
                        expect(e.path).to.equal(vpath);
                        fsCache.off("add", c3);
                        count++;
                    });
                    fsCache.on("remove", function c4(e) {
                        expect(e.path).to.equal(vpath);
                        fsCache.off("remove", c4);
                        count++;
                    });
                    
                    expect(fsCache.findNode(vpath), "start").to.not.exist;
                    
                    fs.mkdir(vpath, function(){
                        expect(fsCache.findNode(vpath), "after").to.not.exist;
                        if (count == 2)
                            done();
                        else
                            throw new Error("Wrong Event Count: " 
                                + count + " of 2");
                    });
                });
            });
        
            describe('fs.rmfile()', function() {
                before(function(done) {
                    fsCache.clear();
                    done();
                });

                it("should remove an entry from the cache", function(done) {
                    var vpath = "/deleteme.txt";
                    
                    fs.writeFile(vpath, "DELETE ME!\n", "utf8", function(){
                        expect(fsCache.findNode(vpath), "start").to.exist;
                        
                        fsCache.on("remove", function c2(){
                            fsCache.off("remove", c2);
                            expect(fsCache.findNode(vpath), "start").to.not.exist;
                            done();
                        });
                        fs.rmfile(vpath, function() {});
                    });
                });
                it("should undo removal from cache when and error occurs", function(done) {
                    var vpath = "/dir";
                    var count = 0;
                    fs.on("afterReaddir", function c4(){
                        fs.off("afterReaddir", c4);
                        
                        function c2(){
                            expect(fsCache.findNode(vpath), "start").to.not.exist;
                            count++;
                        }
                        function c1(){
                            expect(fsCache.findNode(vpath), "start").to.exist;
                            count++;
                        }
                        fsCache.on("remove", c2);
                        fsCache.on("add", c1);
                        fs.rmfile(vpath, function() {
                            fsCache.off("add", c1);
                            fsCache.off("remove", c2);
                            if (count == 2)
                                done();
                            else
                                throw new Error("Wrong Event Count: " + count + " of 2");
                        });
                    });
                    fs.readdir("/", function(){});
                });
            });
        
            describe('fs.rmdir()', function() {
                before(function(done) {
                    fsCache.clear();
                    done();
                });
                
                it("should remove an entry from the cache", function(done) {
                    var vpath = "/newdir";
                    var count = 0;
                    
                    fs.mkdir(vpath, function(){
                        expect(fsCache.findNode(vpath), "start").to.exist;
                        
                        fsCache.on("remove", function c2(){
                            fsCache.off("remove", c2);
                            expect(fsCache.findNode(vpath), "start").to.not.exist;
                            count++;
                        });
                        fs.rmdir(vpath, function() {
                            if (count == 1)
                                done();
                            else
                                throw new Error("Wrong Event Count: " 
                                    + count + " of 1");
                        });
                    });
                });
                it("should undo removal from cache when and error occurs", function(done) {
                    var vpath = "/file.txt";
                    var count = 0;
                    fs.readdir("/", function(){
                        function c1(){
                            expect(fsCache.findNode(vpath), "start").to.exist;
                            count++;
                        }
                        function c2(){
                            expect(fsCache.findNode(vpath), "start").to.not.exist;
                            count++;
                        }
                        fsCache.on("remove", c2);
                        fsCache.on("add", c1);
                        fs.rmdir(vpath, function() {
                            fsCache.off("remove", c2);
                            fsCache.off("add", c1);

                            if (count == 2)
                                done();
                            else
                                throw new Error("Wrong Event Count: " 
                                    + count + " of 2");
                        });
                    });
                });
                /*it("should emit the remove event for all subnodes", function(done) {
                    fs.copy("/dir", "/dir2", {recursive: true}, function(err) {
                        if (err) throw err.message;
                        
                        // Timeout to prevent caching
                        setTimeout(function(){
                            fs.readdir("/", function(){
                                fs.readdir("/dir2", function(){
                                    expect(fsCache.findNode("/dir2"), "/dir2").to.exist;
                                    
                                    var count = 0;
                                    fsCache.on("remove", function(e) {
                                        count++;
                                    });
                                    
                                    fs.rmdir("/dir2", {recursive:true}, function(){
                                        if (count >= 3)
                                            done();
                                        else
                                            throw new Error("Wrong Event Count: " 
                                                + count + " of 3");
                                    });
                                });
                            });
                        }, 1000);
                    });
                });*/
            });
        
            describe('fs.rename()', function() {
                before(function(done) {
                    fsCache.clear();
                    done();
                });
                
                it("should set the filename of a cached node", function(done) {
                    var before = "/start.txt";
                    var after = "/end.txt";
                    var text = "Move me please\n";
                    var count = 0;
                    
                    function c1(){ count++; }
                    fsCache.on("update", c1);
                    
                    fs.writeFile(before, text, function(err) {
                        expect(fsCache.findNode(before), "start").to.exist;
                        fs.rename(before, after, function() {
                            expect(fsCache.findNode(after), "afer").to.exist;
                            expect(fsCache.findNode(before), "before").to.not.exist;
                            fs.rmfile(after, function(){
                                fsCache.off("update", c1);
                                if (count == 1) 
                                    done();
                                else
                                    throw new Error("Wrong Event Count: "
                                        + count + " of 1");
                            });
                        });
                    });
                });
                it("should undo cache file information from a rename() that returns an error", function(done) {
                    var before = "/start.txt";
                    var after = "/dir";
                    var text = "Move me please\n";
                    var count = 0;
                    
                    function c1(){ count++; }
                    fsCache.on("update", c1);
                    
                    fs.writeFile(before, text, function(err) {
                        expect(fsCache.findNode(before), "start").to.exist;
                        
                        fs.rename(before, after, function() {
                            expect(fsCache.findNode(before), "before").to.exist;
                            expect(fsCache.findNode(after), "after").to.not.exist;
                            
                            fs.unlink(before, function(){
                                fsCache.off("update", c1);
                                if (count == 2) 
                                    done();
                                else
                                    throw new Error("Wrong Event Count: "
                                        + count + " of 2");
                            });
                // Disabled: test fails only on CI server...
                        });
                    });
                });
                it.skip("should recursively update the nodes in cache when a dir is renamed", function(done) {
                    fs.rmdir("/rdir", {recursive:true}, function(){
                        fs.copy("/dir", "/dir2", {recursive: true}, function(err) {
                            if (err) throw err.message;
                            
                            fs.readdir("/", function(){
                                expect(fsCache.findNode("/dir2"), "/dir2").to.exist;

                                fs.readdir("/dir2", function(){
                                    var count = 0;
                                    
                                    function c1(e){ count++; }
                                    fsCache.on("update", c1);
                                    
                                    fs.rename("/dir2", "/rdir", function(){
                                        expect(fsCache.findNode("/rdir"), "/rdir").to.exist;
                                        expect(fsCache.findNode("/rdir/smile.png"), "/rdir/smile.png").to.exist;
                                        expect(fsCache.findNode("/rdir/stuff.json"), "/rdir/stuff.json").to.exist;
                                        expect(fsCache.findNode("/dir2"), "/dir2").to.not.exist;
                                        expect(fsCache.findNode("/dir2/smile.png"), "/dir2/smile.png").to.not.exist;
                                        expect(fsCache.findNode("/dir2/stuff.json"), "/dir2/stuff.json").to.not.exist;
                                        
                                        fs.rmdir("/rdir", {recursive: true}, function(){
                                            fsCache.off("update", c1);
                                            if (count >= 3) 
                                                done();
                                            else
                                                throw new Error("Wrong Event Count: "
                                                    + count + " of 3");
                                        });
                                    });
                                })
                            });
                        });
                    });
                });
            });
        
            describe('fs.copy()', function() {
                before(function(done) {
                    fsCache.clear();
                    done();
                });
                
                it("should copy a cached node when copying a file", function(done) {
                    var source = "/file.txt";
                    var target = "/copy.txt";
                    var count = 0;
                    
                    fs.unlink(target, function(){
                        fs.readFile(source, "utf8", function(err, text) {
                            function c1(e) {
                                expect(fsCache.findNode(source), "source").to.exist;
                                expect(fsCache.findNode(target), "target").to.exist;
                                count++;
                            }
                            
                            fsCache.on("add", c1);
                                
                            fs.copy(source, target, function() {
                                fsCache.off("add", c1);
                                fs.unlink(target, function(){});
                                if (count == 1)
                                    done();
                                else
                                    throw new Error("Wrong Event Count: " 
                                        + count + " of 1");
                            });
                        });
                    });
                });
                it("should copy a cached node to and from a different dir", function(done) {
                    var source = "/dir/stuff.json";
                    var target = "/copy.json";
                    var count = 0;
                    
                    fs.unlink(target, function(){
                        fs.readdir("/", function(err) {
                            if (err) throw err.message;
                            
                            fs.readFile(source, "utf8", function(err, text) {
                                function c1(e) {
                                    expect(fsCache.findNode(source), "source").to.exist;
                                    expect(fsCache.findNode(target), "target")
                                      .to.exist
                                      .property("parent")
                                        .to.equal(fsCache.findNode("/"));
                                    count++;
                                }
                                
                                fsCache.on("add", c1);
                                    
                                fs.copy(source, target, function() {
                                    fsCache.off("add", c1);
                                    fs.unlink(target, function(){});
                                    if (count == 1)
                                        done();
                                    else
                                        throw new Error("Wrong Event Count: " 
                                            + count + " of 1");
                                });
                            });
                        });
                    });
                });
                it("should remove a node when a copy fails", function(done) {
                    var source = "/file.txt";
                    var target = "/dir";
                    var count = 0;
                    fs.readdir("/", function(err) {
                        if (err) throw err.message;
                        
                        function c1(){
                            expect(fsCache.findNode(source), "source").to.exist;
                            expect(fsCache.findNode(target), "target").to.exist;
                            count++;
                        }
                        
                        function c2(){
                            expect(fsCache.findNode(source), "source").to.exist;
                            expect(fsCache.findNode(target), "target").to.not.exist;
                            count++;
                        }
                        
                        fsCache.on("add", c1);
                        fsCache.on("remove", c2);
                            
                        fs.copy(source, target, function() {
                            fsCache.off("add", c1);
                            fsCache.off("remove", c2);
                            if (count == 2)
                                done();
                            else
                                throw new Error("Wrong Event Count: " 
                                    + count + " of 2");
                        });
                    });
                });
                it("should emit the add event for each node copied", function(done) {
                    var source = "/dir";
                    var target = "/dir2";
                    var count = 0;
                    
                    fs.readdir("/", function(err) {
                        if (err) throw err.message;
                        fs.readdir(source, function(err) {
                            if (err) throw err.message;
                            
                            expect(fsCache.findNode(target + "/"));
                    
                            fs.rmdir(target, {recursive: true}, function(){
                                function c1(){ count++; };
                                
                                expect(fsCache.findNode("/dir"), "/dir").to.exist;
                                expect(fsCache.findNode("/dir/smile.png"), "/dir/smile.png").to.exist;
                                expect(fsCache.findNode("/dir/stuff.json"), "/dir/stuff.json").to.exist;
                                
                                fsCache.on("add", c1);
                                fsCache.on("remove", c1);
                                    
                                fs.copy(source, target, {recursive: true}, function() {
                                    fsCache.off("add", c1);
                                    fsCache.off("remove", c1);
                                    
                                    expect(fsCache.findNode("/dir"), "/dir").to.exist;
                                    expect(fsCache.findNode("/dir/smile.png"), "/dir/smile.png").to.exist;
                                    expect(fsCache.findNode("/dir/stuff.json"), "/dir/stuff.json").to.exist;
                                    expect(fsCache.findNode("/dir2"), "/dir2").to.exist;
                                    expect(fsCache.findNode("/dir2/smile.png"), "/dir2/smile.png").to.exist;
                                    expect(fsCache.findNode("/dir2/stuff.json"), "/dir2/stuff.json").to.exist;
                                    
                                    fs.rmdir(target, {recursive: true}, function(){
                                        if (count >= 3)
                                            done();
                                        else
                                            throw new Error("Wrong Event Count: " 
                                                + count + " of 3");
                                    });
                                });
                            });
                        });
                    });
                });
                it("should update a node when overwrite is false and a new name is chosen", function(done) {
                    var source = "/file.txt";
                    var target = "/listing.json";
                    
                    fs.exists(target, function(exists) {
                        expect(exists).ok;
                        fs.readdir("/", function(){
                            var count = 0;
                            function c1(e) {
                                expect(fsCache.findNode(source), "source").to.exist;
                                expect(fsCache.findNode(target), "target").to.exist;
                                expect(fsCache.findNode("/listing.1.json"), "/listing.1.json").to.exist;
                                expect(fsCache.findNode("/listing.1.json").label).to.equal("listing.1.json");
                                count++;
                            }
                            
                            fsCache.on("add", c1);
                                
                            fs.copy(source, target, {overwrite: false}, function() {
                                fsCache.off("add", c1);
                                fs.unlink("/listing.1.json", function(){});
                                if (count == 1)
                                    done();
                                else
                                    throw new Error("Wrong Event Count: " 
                                        + count + " of 1");
                            });
                        });
                    });
                });
            });
        
            describe('fs.symlink()', function() {
                before(function(done) {
                    fsCache.clear();
                    done();
                });

                it("should cache file information from a symlink() call", function(done) {
                    var target = "/file.txt";
                    var vpath = "/newlink.txt";
                    fs.unlink(vpath, function(){
                        var count = 0;
                        function c2(e) {
                            expect(e.path).to.equal(vpath);
                            count++;
                        }
                        function c3(){
                            fsCache.off("add", c2);
                            fsCache.off("update", c3);
                            expect(fsCache.findNode(vpath)).to.exist;
                            expect(fsCache.findNode(vpath).isFolder).to.equal(false);
                            expect(fsCache.findNode(vpath).link).to.equal(target);
                            expect(fsCache.findNode(vpath).label).to.equal(vpath.substr(1));
                            expect(fsCache.findNode(vpath).path).to.equal(vpath);
                            fs.unlink(vpath, function(){});
                            
                            if (count == 1)
                                done();
                            else
                                throw new Error("Wrong event Count");
                        }
                        fsCache.on("add", c2);
                        fsCache.on("update", c3);
                        
                        fs.symlink(vpath, target, function() {});
                    });
                });
                it("should cache dir information from a symlink() call", function(done) {
                    var target = "/dir";
                    var vpath = "/newlink";
                    fs.unlink(vpath, function(){
                        var count = 0;
                        function c2(e) {
                            expect(e.path).to.equal(vpath);
                            count++;
                        }
                        function c3(){
                            fsCache.off("add", c2);
                            fsCache.off("update", c3);
                            expect(fsCache.findNode(vpath)).to.exist;
                            expect(fsCache.findNode(vpath).isFolder).to.equal(true);
                            expect(fsCache.findNode(vpath).link).to.equal(target);
                            expect(fsCache.findNode(vpath).label).to.equal(vpath.substr(1));
                            expect(fsCache.findNode(vpath).path).to.equal(vpath);
                            fs.unlink(vpath, function(){});
                            
                            if (count == 1)
                                done();
                            else
                                throw new Error("Wrong event Count");
                        }
                        fsCache.on("add", c2);
                        fsCache.on("update", c3);
                        
                        fs.symlink(vpath, target, function() {});
                    });
                });
                it("should undo cache file information from a symlink() that returns an error", function(done) {
                    fsCache.clear();
                    
                    var vpath = "/file.txt";
                    var count = 0;
                    function c4(e) {
                        expect(e.path).to.equal(vpath);
                        count++;
                    }
                    function c3(e) {
                        expect(e.path).to.equal(vpath);
                        count++;
                    }
                    fsCache.on("add", c3);
                    fsCache.on("remove", c4);
                    
                    fs.symlink(vpath, "/this/is/crazy", function() {
                        fsCache.off("remove", c4);
                        fsCache.off("add", c3);
                        if (count == 2)
                            done();
                        else
                            throw new Error("Wrong Event Count:"
                                + count + " of 2")
                    });
                });
            });
            
            describe('watcher', function() {
                before(function(done) {
                    fsCache.clear();
                    fs.readdir("/", done);
                });

                it("delete event", function(done) {
                    var vpath = "/file.txt";
                    expect(fsCache.findNode(vpath)).to.exist;
                    watcher.emit("delete", { path : vpath });
                    expect(fsCache.findNode(vpath)).to.not.exist;
                    done();
                });
                it("change event", function(done) {
                    var vpath = "/listing.json";
                    expect(fsCache.findNode(vpath)).to.exist;
                    expect(fsCache.findNode(vpath).size).to.equal(920);
                    watcher.emit("change", {
                        type: "change",
                        filename: vpath.substr(1),
                        path: vpath,
                        stat: {
                            size: 1111
                        }
                    });
                    expect(fsCache.findNode(vpath).size).to.equal(1111);
                    done();
                });
            });
        });
        
        onload && onload();
    }
});