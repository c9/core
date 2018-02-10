/*global describe it before after = */

"use client";

require(["lib/architect/architect", "lib/chai/chai"], function (architect, chai) {
    var expect = chai.expect;
    var assert = chai.assert;
    
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
        "plugins/c9.vfs.client/vfs_client",
        "plugins/c9.vfs.client/endpoint",
        "plugins/c9.ide.auth/auth",
        "plugins/c9.core/api",
        {
            packagePath: "plugins/c9.fs/fs",
            baseProc: "plugins/c9.fs/mock"
        },
        {
            packagePath: "plugins/c9.ide.upload/upload_manager",
            filesPrefix: "/workspace",
            workerPrefix: "/static/plugins/c9.ide.upload"
        },
        
        {
            consumes: ["upload.manager", "fs"],
            provides: [],
            setup: main
        }
    ], architect);
    
    function main(options, imports, register) {
        var mgr = imports["upload.manager"];
        var fs = imports.fs;
        var browserFs;
        var files;
        
        describe('upload manager', function() {
            if (!(window.requestFileSystem || window.webkitRequestFileSystem)) {
                return it.skip("upload manager test requires file system api", function(done) {
                    done();
                });
            }
            
            before(function(done) {
                fs.rmdir("/upload", { recursive: true }, function(err) {
                    if (err) return console.error(err);
                    fs.mkdirP("/upload", function() {
                        if (err) return console.error(err);
                        getBrowserFs(function(err, _browserFs) {
                            browserFs = _browserFs;
                            createFiles(browserFs.root, {
                                "hello.txt": new Blob(['Hello World'], { type: 'text/plain' }),
                                "tag.txt": new Blob(['Guten Tag'], { type: 'text/plain' })
                            }, function(err, _files) {
                                if (err) return console.error(err);
                                files = _files;
                                
                                mkdir(browserFs.root, "sub", function(err, dir) {
                                    if (err) return console.error(err);
                                    
                                    createFiles(dir, {
                                        "sub.txt": new Blob(["s'up?"], { type: 'text/plain' })
                                    }, function(err, _files) {
                                        if (err) return console.error(err);
                                        done();
                                    });
                                });
                            });
                        });
                    });
                });
            });
            
            after(function(done) {
                fs.rmdir("/upload", { recursive: true }, done);
            });
            
            it('should upload a single file', function(done) {
                var job = mgr.uploadFile(files["hello.txt"], "/upload/hello.txt");
                job.on("progress", function(progress) {
                    console.log("progress", progress * 100);
                });
                job.on("changeState", function(e) {
                    if (e.state == "error")
                        assert.fail(null, null, "Upload failed " + JSON.stringify(job.error));

                    if (e.state == "done") {                    
                        fs.readFile("/upload/hello.txt", "utf8", function(err, data) {
                            expect(err).to.be.null;
                            expect(data).to.be.equal("Hello World");
                            return done();
                        });
                    }
                });
            });

            it("should upload to a non existing folder", function(done) {
                var job = mgr.uploadFile(files["hello.txt"], "/upload/bla/hello.txt");
                job.on("changeState", function(e) {
                    if (e.state == "error")
                        assert.fail(null, null, "Upload failed " + JSON.stringify(job.error));

                    if (e.state == "done") {
                        done();
                    }
                });
            });
                    
            it("should upload directories", function(done) {
                mgr.batchFromFileApi([browserFs.root], function(err, batch) {
                    console.log(err, batch);
                    
                    mgr.upload("/upload/", batch, function dialog(batch, path, root, callback) {
                        console.log("dialog", arguments);
                        callback("replace", true);
                    }, function(err) {
                        console.log("scheduled");
                    });
                });

                var removed = 0;
                var added = 0;
                mgr.on("addJob", function(job) {
                    added += 1;
                });
                mgr.on("removeJob", function(job) {
                    removed += 1;
                    if (mgr.jobs.length === 0 && removed === 4) {
                        expect(added).to.be.equal(3);
                        mgr.off("removeJob", arguments.callee);
                        
                        fs.readFile("/upload/sub/sub.txt", "utf8", function(err, data) {
                            expect(data).to.be.equal("s'up?");
                            done();
                        });
                    }
                });
            });
            
            it("should ask before overwriting files", function(done) {
                var called = false;
                
                mgr.batchFromFileApi([files["hello.txt"].entry], function(err, batch) {
                    mgr.upload("/upload/", batch, function dialog(batch, path, root, callback) {
                        called = true;
                        callback("no-replace", false);
                    }, function(err) {
                        expect(called).to.be.true;
                        done();
                    });
                });
            });

            after(function(done) {
                done();
            });
        });
        
        function getBrowserFs(callback) {
            var requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
            requestFileSystem(window.TEMPORARY, 5 * 1024 * 1024 /*5MB*/, function onInitFs(fs) {
                callback(null, fs);
            }, callback);
        }
        
        function mkdir(parent, dir, callback) {
            parent.getDirectory(dir, { create: true }, function(dirEntry) {
                callback(null, dirEntry);
            }, callback);
        }
        
        function createFiles(dir, files, callback) {
            parallelKeys(files, function(name, blob, next) {
                dir.getFile(name, { create: true }, function(fileEntry) {
                    fileEntry.createWriter(function(fileWriter) {
                        fileWriter.onwriteend = function(e) {
                            fileEntry.file(function(file) {
                                file.entry = fileEntry;
                                next(null, file);
                            }, next);
                        };
                        fileWriter.onerror = next;
                        
                        fileWriter.write(blob);
                    }, next);
                }, next);
            }, callback);
        }
        
        function parallelKeys(obj, onItem, callback) {
            var processed = 0;
            var hadError = false;
            var keys = Object.keys(obj);
            keys.forEach(function(key) {
                onItem(key, obj[key], function(err, result) {
                    if (err) {
                        if (hadError) return;
                        return callback(err);
                    }
                    processed += 1;
                    obj[key] = result;
                    if (processed >= keys.length)
                        callback(null, obj);
                });
            });
        }
        
        register();
    }
});