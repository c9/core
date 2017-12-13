/*global describe it before*/

"use client";

require(["lib/architect/architect", "lib/chai/chai", "/vfs-root"], 
  function (architect, chai, baseProc) {
    var expect = chai.expect;
    
    expect.setupArchitectTest([
        "plugins/c9.core/http-xhr",
        "plugins/c9.core/ext",
        {
            packagePath: "plugins/c9.fs/fs",
            baseProc: baseProc
        },
        "plugins/c9.vfs.client/vfs_client",
        "plugins/c9.vfs.client/endpoint",
        "plugins/c9.ide.auth/auth",
        "plugins/c9.core/api",
        
        {
            consumes: ["fs"],
            provides: [],
            setup: main
        }
    ], architect);
    
    function main(options, imports, register) {
        var fs = imports.fs;

        describe('fs', function() {
            describe('fs.stat()', function() {
                it('should return stat info for the text file', function(done) {
                    fs.stat("/file.txt", function(err, stat) {
                        if (err) throw (err.message || err);
                        expect(stat).property("name").equal("file.txt");
                        expect(stat).property("size").equal(23);
                        expect(stat).property("mime").equal("text/plain");
                        done();
                    });
                });
                it("should error with ENOENT when the file doesn't exist", function(done) {
                    fs.stat("/badfile.json", function(err, stat) {
                        expect(err).property("code").equal("ENOENT");
                        done();
                    });
                });
            });
        
            describe('fs.readFile()', function() {
                it("should read the text file", function(done) {
                    var xhr = fs.readFile("/file.txt", "utf8", function(err, body) {
                        if (err) throw err.message;
                        expect(body).equal("This is a simple file!\n");
                        expect(body.length).equal(23);
                        done();
                    });
                    expect(xhr.abort).to.ok;
                });
                it("should error with ENOENT on missing files", function(done) {
                    fs.readFile("/badfile.json", "utf8", function(err, body) {
                        expect(err).property("code").equal("ENOENT");
                        done();
                    });
                });
                it("should error with EISDIR on directories", function(done) {
                    var called;
                    fs.once("userError", function() {
                        if (called)
                            done();
                    });
                    fs.readFile("/", "utf8", function(err, body) {
                        expect(err).property("code").equal("EISDIR");
                        called = true;
                    });
                });
                it("should not emit userError if error is handled", function(done) {
                    function onError() {
                        fs.off("userError", onError);
                        done(new Error("userError emitted"));
                    }
                    fs.on("userError", onError);
                    fs.readFile("/", "utf8", function(err, body) {
                        expect(err).property("code").equal("EISDIR");
                        setTimeout(function() {
                            fs.off("userError", onError);
                            done();
                        });
                        return false;
                    });
                });
            });
        
            describe('fs.writeFile()', function() {
                it("should write a text file", function(done) {
                    var str = "Check this out\n";
                    fs.writeFile("/file2.txt", str, "utf8", function(err) {
                        if (err) throw err.message;
                        
                        fs.readFile("/file2.txt", "utf8", function(err, body) {
                            if (err) throw err.message;
                            expect(body).equal(str);
                            expect(body.length).equal(str.length);
                            done();
                        });
                    });
                });
                it("should update an existing file", function(done) {
                    var str = "New content for an old file\n";
                    fs.writeFile("/file2.txt", str, "utf8", function(err) {
                        if (err) throw err.message;
                        
                        fs.readFile("/file2.txt", "utf8", function(err, body) {
                            if (err) throw err.message;
                            expect(body).equal(str);
                            expect(body.length).equal(str.length);
                            done();
                            fs.rmfile("/file2.txt", function() {});
                        });
                    });
                });
            });
        
            describe('fs.readdir()', function() {
                it("should read the directory", function(done) {
                    fs.readdir("/", function(err, files) {
                        if (err) throw err;
                        expect(files).length.gt(4);
                        done();
                    });
                });
                it("should error with ENOENT when the folder doesn't exist", function(done) {
                    fs.readdir("/fake", function(err, meta) {
                        expect(err).property("code").equal("ENOENT");
                        done();
                    });
                });
                it("should error with ENOTDIR when the path is a file", function(done) {
                    fs.readdir("/file.txt", function(err, meta) {
                        expect(err).property("code").equal("ENOTDIR");
                        done();
                    });
                });
            });
        
            describe('fs.exists()', function() {
                it("should check if a file exists", function(done) {
                    fs.exists("/file.txt", function(exist) {
                        expect(exist).equal(true);
                        done();
                    });
                });
                it("should check if a file does not exists", function(done) {
                    fs.exists("/file_not_exist.txt", function(exist) {
                        expect(exist).equal(false);
                        done();
                    });
                });
                it("should check if a dir exists", function(done) {
                    fs.exists("/dir", function(exist) {
                        expect(exist).equal(true);
                        done();
                    });
                });
                it("should check if a dir does not exists", function(done) {
                    fs.exists("/dir_not_exist.txt", function(exist) {
                        expect(exist).equal(false);
                        done();
                    });
                });
            });
            
            describe('fs.mkdir()', function() {
                it("should create a directory", function(done) {
                    var vpath = "/newdir";
                    // Make sure it doesn't exist yet
                    fs.rmdir(vpath, {}, function(err) {
                        fs.mkdir(vpath, function(err) {
                            if (err) {
                                fs.rmdir(vpath, {}, function() {});
                                return done(new Error(err.message));
                            }
                            
                            fs.exists(vpath, function(exist) {
                                expect(exist, "Directory does not exist").equal(true);
                                fs.rmdir(vpath, function() {});
                                done();
                            });
                        });
                    });
                });
                it("should create a directory with a space in the name", function(done) {
                    var vpath = "/New Dir";
                    // Make sure it doesn't exist yet
                    fs.rmdir(vpath, {}, function(err) {
                        fs.mkdir(vpath, function(err) {
                            if (err) {
                                fs.rmdir(vpath, {}, function() {});
                                return done(new Error(err.message));
                            }
                            
                            fs.exists(vpath, function(exist) {
                                expect(exist, "Directory does not exist").equal(true);
                                // fs.rmdir(vpath, function(){});
                                done();
                            });
                        });
                    });
                });
                it("should error with EEXIST when the directory already exists", function(done) {
                    fs.mkdir("/dir", function(err, meta) {
                        expect(err).property("code").equal("EEXIST");
                        done();
                    });
                });
                it("should error with EEXIST when a file already exists at the path", function(done) {
                    fs.mkdir("/file.txt", function(err, meta) {
                        expect(err).property("code").equal("EEXIST");
                        done();
                    });
                });
            });
        
            describe('fs.rmfile()', function() {
                it("should delete a file", function(done) {
                    var vpath = "/deleteme.txt";
                    fs.writeFile(vpath, "DELETE ME!\n", "utf8", function(err) {
                        if (err) throw err;
                        
                        fs.exists(vpath, function(exists) {
                            expect(exists).ok;
                            
                            fs.rmfile(vpath, function(err, meta) {
                                if (err) throw err;
                                
                                fs.exists(vpath, function(exists) {
                                    expect(exists).not.ok;
                                    done();
                                });
                            });
                        });
                    });
                });
                it("should error with ENOENT if the file doesn't exist", function(done) {
                    var vpath = "/badname.txt";
                    fs.exists(vpath, function(exists) {
                        expect(exists).not.ok;
                        
                        fs.rmfile(vpath, function(err, meta) {
                            expect(err).property("code").equal("ENOENT");
                            done();
                        });
                    });
                });
                it("should error with EISDIR if the path is a directory", function(done) {
                    var vpath = "/dir";
                    fs.exists(vpath, function(exists) {
                        expect(exists).ok;
                        
                        fs.rmfile(vpath, function(err, meta) {
                            expect(err).property("code").match(/EPERM|EISDIR/);
                            done();
                        });
                    });
                });
            });
        
            describe('fs.rmdir()', function() {
                it("should delete a directory", function(done) {
                    var vpath = "/newdir";
                    fs.mkdir(vpath, function(err) {
                        fs.exists(vpath, function(exists) {
                            expect(exists).ok;
                            
                            fs.rmdir(vpath, {}, function(err, meta) {
                                if (err) throw err.message;
                                
                                fs.exists(vpath, function(exists) {
                                    expect(exists).not.ok;
                                    done();
                                });
                            });
                        });
                    });
                });
                it("should error with ENOENT if the directory doesn't exist", function(done) {
                    var vpath = "/baddir";
                    fs.exists(vpath, function(exists) {
                        expect(exists).not.ok;
                        
                        fs.rmdir(vpath, {}, function(err, meta) {
                            expect(err).property("code").equal("ENOENT");
                            done();
                        });
                    });
                });
                it("should error with ENOTDIR if the path is a file", function(done) {
                    var vpath = "/file.txt";
                    fs.exists(vpath, function(exists) {
                        expect(exists).ok;
                        
                        fs.rmdir(vpath, {}, function(err, meta) {
                            if (err.code == "EACCES") // node sends EACCES on windows
                                err.code = "ENOTDIR";
                            expect(err).property("code").equal("ENOTDIR");
                            done();
                        });
                    });
                });
                it("should do recursive deletes if options.recursive is set", function(done) {
                    var vpath = "/foo/bar/test";
                    fs.mkdirP(vpath, function(err) {
                        fs.exists(vpath, function(exists) {
                            expect(exists).ok;
                            
                            fs.rmdir("/foo", {
                                recursive: true
                            }, function(err, meta) {
                                if (err) throw err.message;
                                
                                fs.exists("/foo", function(exists) {
                                    expect(exists).not.ok;
                                    done();
                                });
                            });
                        });
                    });
                });
            });
        
            describe('fs.rename()', function() {
                it("should rename a file", function(done) {
                    var before = "/start.txt";
                    var after = "/end.txt";
                    var text = "Move me please\n";
                    
                    fs.writeFile(before, text, function(err) {
                        fs.exists(before, function(exists) {
                            expect(exists).ok;
                            fs.rmfile(after, function(err) {
                                
                                fs.rename(before, after, function(err) {
                                    if (err) throw err.message;
                                    
                                    fs.exists(before, function(exists) {
                                        expect(exists).not.ok;
                                        fs.exists(after, function(exists) {
                                            expect(exists).ok;
                                            fs.readFile(after, "utf8", function(err, data) {
                                                expect(data).equal(text);
                                                done();
                                                fs.rmfile(after, function() {});
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
                it("should error with ENOENT if the source doesn't exist", function(done) {
                    fs.rename("/notexist", "/newname", function(err, meta) {
                        expect(err).property("code").equal("ENOENT");
                        done();
                    });
                });
            });
        
            describe('fs.copy()', function() {
                var source = "/file.txt";
                var target = "/copy.txt";
                
                it("should copy a file to a target that doesn't exist", function(done) {
                    fs.unlink(target, function() {
                        fs.readFile(source, "utf8", function(err, text) {
                            fs.copy(source, target, { overwrite: false }, function(err) {
                                if (err) throw err.message;
                                
                                fs.exists(target, function(exists) {
                                    expect(exists).ok;
                                    
                                    fs.readFile(target, "utf8", function(err, data) {
                                        if (err) throw err.message;
                                    
                                        expect(data).equal(text);
                                        done();
                                    });
                                });
                            });
                        });
                    });
                });
                it("should copy a directory recursively when recursive = true", function(done) {
                    var target = "/dir2";
                    
                    fs.rmdir(target, { recursive: true }, function(err) {
                        // if (err) throw err.message;
                        
                        fs.copy("/dir", target, { recursive: true }, function(err) {
                            if (err) throw err.message;
                            
                            fs.exists(target, function(exists) {
                                expect(exists).ok;
                                
                                fs.readFile("/dir2/stuff.json", "utf8", function(err, data) {
                                    if (err) throw err.message;
                                
                                    expect(data).length(14);
                                    
                                    fs.rmdir(target, { recursive: true }, function(err) {
                                        if (err) throw err.message;
                                        done();
                                    });
                                });
                            });
                        });
                    });
                });
                it("should copy a file over a target that already exists with overwrite = true", function(done) {
                    fs.readFile(source, "utf8", function(err, text) {
                        fs.copy(source, target, { overwrite: true }, function(err) {
                            if (err) throw err.message;
                            
                            fs.exists(target, function(exists) {
                                expect(exists).ok;
                                
                                fs.readFile(target, "utf8", function(err, data) {
                                    if (err) throw err.message;
                                
                                    expect(data).equal(text);
                                    done();
                                });
                            });
                        });
                    });
                });
                it("should copy a file over a target that already exists with overwrite = false", function(done) {
                    fs.readFile(source, "utf8", function(err, text) {
                        fs.copy(source, target, { overwrite: false }, function(err, data) {
                            if (err) throw err.message;
                            
                            expect(data.to).to.equal("/copy.1.txt");
                            var filename = data.to;
                            
                            fs.exists(filename, function(exists) {
                                expect(exists).ok;
                                
                                fs.readFile(target, "utf8", function(err, data) {
                                    if (err) throw err.message;
                                
                                    expect(data).equal(text);
                                    done();
                                    fs.unlink(filename, function() {});
                                    fs.unlink(target, function() {});
                                });
                            });
                        });
                    });
                });
                it("should error with ENOENT if the source doesn't exist", function(done) {
                    fs.copy("/badname.txt", "/copy.txt", { overwrite: false }, function(err) {
                        expect(err).property("code").equal("ENOENT");
                        done();
                    });
                });
            });
        
            describe('fs.symlink()', function() {
                it("should create a file symlink", function(done) {
                    var target = "/file.txt";
                    var vpath = "/newlink.txt";
                    fs.unlink(vpath, function() {
                        fs.readFile(target, "utf8", function(err, text) {
                            if (err) throw err.message;
                            
                            fs.symlink(vpath, target, function(err, meta) {
                                if (err) throw err.message;
                                
                                fs.readFile(vpath, "utf8", function(err, data) {
                                    expect(data).equal(text);
                                    done();
                                    fs.unlink(vpath, function() {});
                                });
                            });
                        });
                    });
                });
                it("should create a dir symlink", function(done) {
                    var target = "/dir";
                    var vpath = "/newlink";
                    fs.unlink(vpath, function() {
                        fs.symlink(vpath, target, function(err, meta) {
                            if (err) throw err.message;
                            
                            fs.readdir(vpath, function(err, files) {
                                expect(files).length.gt(1);
                                done();
                                fs.unlink(vpath, function() {});
                            });
                        });
                    });
                });
                it("should error with EEXIST if the file already exists", function(done) {
                    fs.symlink("/file.txt", "/this/is/crazy", function(err, meta) {
                        expect(err).property("code").equal("EEXIST");
                        done();
                    });
                });
            });
        
            describe('fs.watch()', function() {
                it("should notice a directly watched file change", function(done) {
                    var vpath = "/newfile.txt";
                    fs.writeFile(vpath, "test", "utf8", function(err) {
                        if (err) throw err.message;
                        
                        var inner = false;
                        fs.watch(vpath, function c1(err, event, filename) {
                            if (err) throw err.message;
                            if (event == "init") return;
                            
                            if (inner) {
                                fs.unwatch(vpath, c1);
                                return done();
                            }
                            
                            // expect(event).to.equal("change"); TODO
                            expect(filename).equal(vpath.substr(1));
                            
                            setTimeout(function() {
                                fs.unlink(vpath, function() {});
                                inner = true;
                            }, 200);
                            
                        });
                        setTimeout(function() {
                            fs.writeFile(vpath, "test2", "utf8", function(err) {});
                        }, 500);
                    });
                });
                it("should notice a new file in a watched directory", function(done) {
                    var vpath = "/newfile.txt";
                    fs.exists(vpath, function(exists) {
                        expect(exists).not.ok;
                        
                        fs.watch("/", function c1(err, event, filename) {
                            if (err) throw err.message;
                            if (event == "init") return;
                            
                            fs.unwatch("/", c1);
                            fs.unlink(vpath, function() {});
                            expect(event).ok;
                            expect(filename).equal(vpath.substr(1));
                            done();
                        });
                        
                        setTimeout(function() {
                            fs.writeFile(vpath, "test2", "utf8", function(err) {});
                        }, 500);
                    });
                });
//                it("should not crash the server when I disconnect with a running watcher", function(done) {
//                    throw new Error("It does");
//                });
            });
            
        });
        
        register();
    }
});