/*global describe it before*/

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
        "plugins/c9.core/http-xhr",
        "plugins/c9.core/ext",
        {
            packagePath: "plugins/c9.ide.watcher/watcher",
            testing: true
        },
        {
            packagePath: "plugins/c9.fs/fs",
            baseProc: baseProc
        },
        "plugins/c9.vfs.client/vfs_client",
        "plugins/c9.vfs.client/endpoint",
        "plugins/c9.ide.auth/auth",
        
        //Mock Plugins
        {
            consumes: ["Plugin"],
            provides: ["auth.bootstrap", "info", "dialog.error", "api"],
            setup: expect.html.mocked
        },
        {
            consumes: ["c9", "watcher", "fs"],
            provides: [],
            setup: main
        }
    ], architect);
    
    function main(options, imports, register) {
        var watcher = imports.watcher;
        var fs = imports.fs;
        var c9 = imports.c9;
        
        before(function(done) {
            if (c9.has(c9.NETWORK))
                done();
            else {
                c9.on("stateChange", function(e) {
                    if (c9.has(c9.NETWORK))
                        done();
                });
            }
        });

        describe('watcher', function() {
            it("should watch a file and emit change and delete events", function(done) {
                var vpath = "/newfile.txt";
                fs.writeFile(vpath, "test", "utf8", function(err) {
                    if (err) throw err.message;
                    
                    var count = 0;
                    
                    fs.exists(vpath, function(exists) {
                        expect(exists).ok;
                        
                        watcher.on("change", function c1(e) {
                            expect(e.path).to.equal(vpath);
                            expect(e.filename).equal(vpath.substr(1));
                            expect(e.stat).property("size").equal(5);
                            
                            count++;
                            
                            watcher.on("delete", function c2(e) {
                                expect(e.path).to.equal(vpath);
                                watcher.off("delete", c2);
                                count++;
                                
                                if (count != 2)
                                    throw new Error("events called too often");
                                
                                done();
                            });
                            fs.unlink(vpath, function(){});

                            watcher.off("change", c1);
                        });
                        watcher.watch(vpath);
                        
                        setTimeout(function(){
                            fs.writeFile(vpath, "test2", "utf8", function(err) {});
                        }, 200);
                    });
                });
            });
            it("should watch a directory and emit delete and directory events", function(done) {
                var dpath = "/dir2";
                var fpath = "/dir2/newfile.txt";
                fs.mkdir(dpath, function(err) {
                    fs.exists(dpath, function(exists) {
                        expect(exists).ok;
                        
                        watcher.on("directory", function c1(e) {
                            var found = false;
                            e.files.forEach(function(file) {
                                if (file.name != "newfile.txt")
                                    return;

                                found = true;

                                expect(e.path).to.equal(dpath);
                                expect(e.stat.name).equal(dpath.substr(1));
                                
                                watcher.on("delete", function c2(e) {
                                    expect(e.path).to.equal(dpath);
                                    watcher.off("delete", c2);
                                    done();
                                });
                                fs.rmdir(dpath, {recursive: true}, function(){});
                            });
                            
                            if (!found) throw new Error("File not found")
                            
                            watcher.off("directory", c1);
                        });
                        watcher.watch(dpath);
                        
                        setTimeout(function(){
                            fs.writeFile(fpath, "test", "utf8", function(err) {});
                        }, 200);
                    });
                });
            });
            it("should ignore a watch when ignore is set for a file", function(done) {
                var vpath = "/newfile.txt";
                fs.writeFile(vpath, "test", "utf8", function(err) {
                    if (err) throw err.message;
                    
                    fs.exists(vpath, function(exists) {
                        expect(exists).ok;
                        
                        function c1(e) {
                            throw new Error("Change is not ignored");
                        }
                        
                        watcher.on("change", c1);
                        watcher.watch(vpath);
                        
                        setTimeout(function(){
                            watcher.ignore(vpath, 500);
                            setTimeout(function(){
                                watcher.off("change", c1);
                                fs.unlink(vpath, function(){});
                                done();
                            }, 1000);
                            fs.writeFile(vpath, "test2", "utf8", function(err) {});
                        }, 200);
                    });
                });
            });
            it("should ignore a watch when ignore is set for a directory", function(done) {
                var dpath = "/dir2";
                var fpath = "/dir2/newfile.txt";
                fs.mkdir(dpath, function(err) {
                    fs.exists(dpath, function(exists) {
                        expect(exists).ok;
                        
                        function c1(e) {
                            throw new Error("Change is not ignored");
                        }
                        
                        watcher.on("directory", c1);
                        watcher.watch(dpath);
                        
                        setTimeout(function(){
                            watcher.ignore(dpath, 500);
                            setTimeout(function(){
                                watcher.off("directory", c1);
                                fs.rmdir(dpath, {recursive: true}, function(){});
                                done();
                            }, 1000);
                            fs.writeFile(fpath, "test", "utf8", function(err) {});
                        }, 200);
                    });
                });
            });
        });
        
        onload && onload();
    }
});