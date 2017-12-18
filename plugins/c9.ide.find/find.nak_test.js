/*global describe it before after = */

"use client";

require(["lib/architect/architect", "lib/chai/chai", "/vfs-root"], 
  function (architect, chai, baseProc) {
    var expect = chai.expect;
    var Assert = chai.assert;
    
    baseProc = baseProc.replace(/plugins\/.*/, "plugins/c9.ide.find/mock");
    var nak = baseProc.replace(/plugins\/.*/, "/node_modules/nak/bin/nak");
    
    expect.setupArchitectTest([
        {
            packagePath: "plugins/c9.core/c9",
            startdate: new Date(),
            debug: true,
            hosted: true,
            local: false,
        },
        
        "plugins/c9.core/ext",
        "plugins/c9.core/http-xhr",
        "plugins/c9.core/util",
        "plugins/c9.ide.ui/lib_apf",
        "plugins/c9.ide.ui/ui",
        "plugins/c9.core/settings",
        {
            packagePath: "plugins/c9.ide.find/find",
            basePath: baseProc
        },
        {
            packagePath: "plugins/c9.ide.find/find.nak",
            ignore: "file7_ignorable.rb",
            basePath: baseProc,
            installPath: "~/.c9",
            testing: true,
            nak: nak,
            node: "node"
        },
        "plugins/c9.vfs.client/vfs_client",
        "plugins/c9.vfs.client/endpoint",
        "plugins/c9.ide.auth/auth",
        "plugins/c9.core/api",
        "plugins/c9.fs/fs",
        "plugins/c9.fs/proc",
        
        {
            consumes: ["find", "finder"],
            provides: [],
            setup: main
        }
    ], architect);
    
    function main(options, imports, register) {
        var find = imports.find;
        var finder = imports.finder;
        
        describe('find', function() {
            this.timeout(30000);
            
            describe("getFileList", function() {
                var path = "/list";
                var basePath = "/list";
                
                var options1 = { buffer: true, hidden: true, path: path };
                var options2 = { buffer: true, hidden: true, path: path, nocache: true };
                
                it('should return a list of files', function(done) {
                    find.getFileList(options1, function(err, results) {
                        Assert.equal(!err, true);
                        var files = results.split("\n").filter(function(file) { return !!file; }).sort();

                        Assert.equal(files[2], basePath + "/level1/Toasty.gif");
                        Assert.equal(files[3], basePath + "/level1/level2/.hidden");
                        Assert.equal(files[4], basePath + "/level1/level2/.level3a/.hidden");
                        done();
                    });
                });
                it('should get a cache of the file list the 2nd time', function(done) {
                    find.getFileList(options1, function(err, results) {
                        Assert.equal(!err, true);
                        var files = results.split("\n").filter(function(file) { return !!file; }).sort();

                        Assert.equal(files[2], basePath + "/level1/Toasty.gif");
                        Assert.equal(files[3], basePath + "/level1/level2/.hidden");
                        Assert.equal(files[4], basePath + "/level1/level2/.level3a/.hidden");
        
                        done();
                    });
                });
                it('should ignore a cached file list', function(done) {
                    find.getFileList(options2, function(err, results) {
                        Assert.equal(!err, true);
                        var files = results.split("\n").filter(function(file) { return !!file; }).sort();

                        Assert.equal(files[2], basePath + "/level1/Toasty.gif");
                        Assert.equal(files[3], basePath + "/level1/level2/.hidden");
                        Assert.equal(files[4], basePath + "/level1/level2/.level3a/.hidden");
        
                        done();
                    });
                });
            });
            describe("findFiles", function() {
                var options1 = {
                    query: "sriracha",
                    pattern: "",
                    casesensitive: false,
                    regexp: false,
                    replaceAll: false,
                    replacement: "",
                    wholeword: false,
                    path: "/find",
                    buffer: true
                };
                
                it('should search for a token', function(done) {
                    find.findFiles(options1, function(err, results, data) {
                        if (err) throw err;
                        expect(results).to.match(/Found 8 matches in 4 files/);
                        var lines = results.split("\n");
                        Assert.equal(lines.length, 16);
                        done();
                    });
                });
            });
        });
        describe('finder', function() {
            function buffer(stream, callback) {
                var buf = "";
                stream.on("data", function(chunk) {
                    buf += chunk;
                });
                stream.on("end", function(data) {
                    callback(buf, data);
                });
            }
            
            describe("list", function() {
                var base = baseProc + "/list";
                var basePath = base;
                var path = "/";
                
                var options1 = { hidden: true, base: base, path: path };
                var options2 = { hidden: false, base: base, path: path };
                var options3 = { path: "doesnotexist", hidden: true, base: base };
            
                it("should get filelist, including hidden files and binaries", function(done) {
                    finder.list(options1, function(err, stream) {
                        buffer(stream, function(results) {
                            Assert.equal(!err, true);
                            var files = results.split("\n").filter(function(file) { return !!file; }).sort();
    
                            Assert.equal(files[2], basePath + "/level1/Toasty.gif");
                            Assert.equal(files[3], basePath + "/level1/level2/.hidden");
                            Assert.equal(files[4], basePath + "/level1/level2/.level3a/.hidden");
            
                            done();
                        });
                    });
                });
            
                it("should get filelist, without hidden files", function(done) {
                    finder.list(options2, function(err, stream) {
                        buffer(stream, function(results) {
                            Assert.equal(!err, true);
                            var files = results.split("\n").filter(function(file) { return !!file; }).sort();
                            Assert.equal(files[3], basePath + "/level1/level2/level2.rb");
                            Assert.equal(files[4], basePath + "/level1/level2/level3/level4/level4.txt");
            
                            done();
                        });
                    });
                });
            
                it("should return an empty list when a path does not exist", function(done) {
                    finder.list(options3, function(err, stream) {
                        buffer(stream, function(results) {
                            Assert.equal(results.trim(), "");
                            done();
                        });
                    });
                });
            });
            describe("find", function() {
                var base = baseProc + "/find";
                var basePath = base;
                var path = "";
                
                var options1 = {
                    query: "sriracha",
                    pattern: "",
                    casesensitive: false,
                    regexp: false,
                    replaceAll: false,
                    replacement: "",
                    wholeword: false,
                    path: path,
                    base: base
                };
                var options2 = {
                    query: "Messenger",
                    pattern: "",
                    casesensitive: true,
                    regexp: false,
                    replaceAll: false,
                    replacement: "",
                    wholeword: false,
                    path: path,
                    base: base
                };
                var options3 = {
                    query: "gastro",
                    pattern: "",
                    casesensitive: false,
                    regexp: false,
                    replaceAll: false,
                    replacement: "",
                    wholeword: true,
                    path: path,
                    base: base
                };
                var options4 = {
                    query: "pb.",
                    pattern: "",
                    casesensitive: false,
                    regexp: true,
                    replaceAll: false,
                    replacement: "",
                    wholeword: false,
                    path: path,
                    base: base
                };
                var options5 = {
                    query: ".+wave",
                    pattern: "",
                    casesensitive: true,
                    regexp: true,
                    replaceAll: false,
                    replacement: "",
                    wholeword: false,
                    path: path,
                    base: base,
                    hidden: true
                };
                var options6 = {
                    query: "shorts",
                    pattern: "*.txt, file*.gif",
                    casesensitive: true,
                    regexp: true,
                    replaceAll: false,
                    replacement: "",
                    wholeword: false,
                    path: path,
                    base: base
                };
                var options7 = {
                    query: "williamsburg",
                    pattern: "-file*.txt",
                    casesensitive: true,
                    regexp: true,
                    replaceAll: false,
                    replacement: "",
                    wholeword: false,
                    path: path,
                    base: base,
                    hidden: true
                };
                    
                it("should find matches without regexp, case-sensitive OFF and word boundaries OFF", function(done) {
                    finder.find(options1, function(err, stream) {
                        buffer(stream, function(results, data) {
                            Assert.equal(!err, true);
                            expect(results).to.match(/Found 8 matches in 4 files/);
                            var lines = results.split("\n");
                            Assert.equal(lines.length, 16);
                            done();
                        });
                    });
                });
            
                it("should find matches without regexp, case-sensitive ON and word boundaries OFF", function(done) {
                    finder.find(options2, function(err, stream) {
                        buffer(stream, function(results, data) {
                            Assert.equal(!err, true);
                            expect(results).to.match(/Found 2 matches in 2 files/);
                            var lines = results.split("\n");
                            Assert.equal(lines.length, 8);
                            
                            done();
                        });
                    });
                });
            
                it("should find matches without regexp, case-sensitive OFF and word boundaries ON", function(done) {
                    finder.find(options3, function(err, stream) {
                        buffer(stream, function(results, data) {
                            Assert.equal(!err, true);
                            expect(results).to.match(/Found 3 matches in 3 files/);
                            var lines = results.split("\n");
                            Assert.equal(lines.length, 11);
                            
                            done();
                        });
                    });
                });
            
                it("should find matches with a regexp, case-sensitive OFF", function(done) {
                    finder.find(options4, function(err, stream) {
                        buffer(stream, function(results, data) {
                            Assert.equal(!err, true);
                            expect(results).to.match(/Found 8 matches in 4 files/);
                            var lines = results.split("\n");
                            Assert.equal(lines.length, 18);
                            
                            done();
                        });
                    });
                });
                
                it("should find matches with a regexp, case-sensitive ON, including the default .agignore file, and hidden files", function(done) {
                    finder.find(options5, function(err, stream) {
                        buffer(stream, function(results, data) {
                            Assert.equal(!err, true);
                            expect(results).to.match(/Found 14 matches in 7 files/);
                            var lines = results.split("\n");
                            Assert.equal(lines.length, 30);
                            
                            done();
                        });
                    });
                });
             
                it("should find matches without regexp, only two file types, and no hidden files (even if they contain the string)", function(done) {
                    finder.find(options6, function(err, stream) {
                        buffer(stream, function(results, data) {
                            Assert.equal(!err, true);
                            expect(results).to.match(/Found 2 matches in 2 files/);
                            var lines = results.split("\n");
                            Assert.equal(lines.length, 8);
            
                            Assert.equal(/.file8_hidden.txt/.test(lines), false);
                            done();
                        });
                    });
                });
            
                it("should find matches without regexp, excluding txt files", function(done) {
                    finder.find(options7, function(err, stream) {
                        buffer(stream, function(results, data) {
                            Assert.equal(!err, true);
                            expect(results).to.match(/Found 14 matches in 4 files/);
                            var lines = results.split("\n");
                            Assert.equal(lines.length, 20);
                            
                            done();
                        });
                    });
                });
            });
        });
        
        register();
    }
});