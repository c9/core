#!/usr/bin/env node
"use strict";
"use server";


require("c9/inline-mocha")(module);
require("amd-loader");

var assert = require("assert");
var fs = require("fs");
var http = require("http");
var mkdirp = require("mkdirp");
var localfs = require("vfs-local");
var download = require("./download");
var urlParse = require('url').parse;
var execFile = require('child_process').execFile;

describe(__filename, function() {
    this.timeout(4000);
    var base;
    var id = 0;

    before(function(next) {
        var that = this;
        var vfs = localfs({ root: "/" });
        download({}, {
            "Plugin": function() {
                var that = this;
                this.freezePublicAPI = function(api) {
                    for (var key in api)
                        that[key] = api[key];
                };
            },
            "vfs.cache": {
                registerExtension: function() { }
            }
        }, function(err, api) {
            assert.equal(err, null);
            var download = api["vfs.download"].download;
            that.server = http.createServer(function(req, res, next) {
                req.uri = urlParse(req.url, true);
                download(vfs, __dirname, req, res, function(err) {
                    console.log("download failed", err);
                    assert.fail(err);
                });
            });
            function tryNext(retries, err) {
                if (retries < 0) return next(err);
                var port = 20000 + Math.round(Math.random() * 20000);
                base = "http://localhost:" + port;
                that.server.listen(port, "localhost", function() {
                    if (err) return tryNext(retries - 1, err);
                    next();
                });
            }
            tryNext(4);
        });
    });

    after(function(next) {
        this.server.close(next);
    });
    
    before(cleanup);
    after(cleanup);
    
    function cleanup(next) {
        execFile("rm", ["-rf", __dirname + "/_test"], function() {
            next();
        });
    }
    
    function tmpDir(callback) {
        var path = __dirname + "/_test/" + id++;
        mkdirp(path, function(err) {
            callback(err, path);
        });
    }

    describe("download", function() {
    
        it("should download as tar", function(next) {
            tmpDir(function(err, path) {
                assert.equal(err, null);
                var filename = "download.tar.gz";
                var file = fs.createWriteStream(path + "/" + filename);
                http.get(base + "/?download=download.tar.gz", function(res) {
                    assert.equal(res.headers["content-type"], "application/x-gzip");
                    assert.equal(res.headers["content-disposition"], "attachment; filename*=utf-8''download.tar.gz");
    
                    res.pipe(file);
                    
                    file.on("finish", function() {
                        execFile("tar", ["-zxvf", filename, "c9.vfs.server/download.js"], { cwd: path }, function(err, stdout, stderr) {
                            assert.equal(err, null);
                            assert.equal(
                                fs.readFileSync(__dirname + "/download.js", "utf8"),
                                fs.readFileSync(path + "/c9.vfs.server/download.js", "utf8")
                            );
                            next();
                        });
                    });
                });
            });
        });
    
        it("should download sub directory as tar", function(next) {
            tmpDir(function(err, path) {
                assert.equal(err, null);
                
                var filename = "download.tar.gz";
                var file = fs.createWriteStream(path + "/" + filename);
                http.get(base + "/test?download=download.tar.gz", function(res) {
                    res.pipe(file);
                    
                    file.on("finish", function() {
                        execFile("tar", ["-zxvf", filename, "test/dir1/testdata1.txt"], { cwd: path }, function(err) {
                            assert.equal(err, null);
                            assert.equal(
                                fs.readFileSync(__dirname + "/test/dir1/testdata1.txt", "utf8"),
                                fs.readFileSync(path + "/test/dir1/testdata1.txt", "utf8")
                            );
                            next();
                        });
                    });
                });
            });
        });
    
        it("should download without specifying a name", function(next) {
            tmpDir(function(err, path) {
                assert.equal(err, null);
                
                var filename = "download.tar.gz";
                var file = fs.createWriteStream(path + "/" + filename);
                http.get(base + "/test?download", function(res) {
                    assert.equal(res.headers["content-type"], "application/x-gzip");
                    assert.equal(res.headers["content-disposition"], "attachment; filename*=utf-8''test.tar.gz");
                    
                    res.pipe(file);
                    
                    file.on("finish", function() {
                        execFile("tar", ["-zxvf", filename, "test/dir1/testdata1.txt"], { cwd: path }, function(err) {
                            assert.equal(err, null);
                            assert.equal(
                                fs.readFileSync(__dirname + "/test/dir1/testdata1.txt", "utf8"),
                                fs.readFileSync(path + "/test/dir1/testdata1.txt", "utf8")
                            );
                            next();
                        });
                    });
                });
            });
        });

        it("should download several files in same directory as tar", function(next) {
            tmpDir(function(err, path) {
                assert.equal(err, null);

                var filename = "download.tar.gz";
                var file = fs.createWriteStream(path + "/" + filename);
                http.get(base + "/test/dir2/testdata2a.txt,/test/dir2/testdata2b.txt?download=download.tar.gz", function(res) {
                    res.pipe(file);
                    file.on("finish", function() {
                        execFile("tar", ["-zxvf", filename], { cwd: path }, function(err) {
                            assert.equal(err, null);
                            assert.equal(
                                fs.readFileSync(__dirname + "/test/dir2/testdata2a.txt", "utf8"),
                                fs.readFileSync(path + "/testdata2a.txt", "utf8")
                            );
                            assert.equal(
                                fs.readFileSync(__dirname + "/test/dir2/testdata2b.txt", "utf8"),
                                fs.readFileSync(path + "/testdata2b.txt", "utf8")
                            );
                            next();
                        });
                    });
                });
            });
        });

        it("should download several files in different directories as tar", function(next) {
            tmpDir(function(err, path) {
                assert.equal(err, null);

                var filename = "download.tar.gz";
                var file = fs.createWriteStream(path + "/" + filename);
                http.get(base + "/test/dir1/testdata1.txt,/test/dir2/testdata2a.txt?download=download.tar.gz", function(res) {
                    res.pipe(file);
                    file.on("finish", function() {
                        execFile("tar", ["-zxvf", filename], { cwd: path }, function(err) {
                            assert.equal(err, null);
                            assert.equal(
                                fs.readFileSync(__dirname + "/test/dir1/testdata1.txt", "utf8"),
                                fs.readFileSync(path + "/dir1/testdata1.txt", "utf8")
                            );
                            assert.equal(
                                fs.readFileSync(__dirname + "/test/dir2/testdata2a.txt", "utf8"),
                                fs.readFileSync(path + "/dir2/testdata2a.txt", "utf8")
                            );
                            next();
                        });
                    });
                });
            });
        });

        it("should download as zip", function(next) {
            tmpDir(function(err, path) {
                assert.equal(err, null);
                var filename = "download.zip";
                var file = fs.createWriteStream(path + "/" + filename);
                http.get(base + "/?download=download.zip", function(res) {
                    assert.equal(res.headers["content-type"], "application/zip");
                    assert.equal(res.headers["content-disposition"], "attachment; filename*=utf-8''download.zip");

                    res.pipe(file);

                    file.on("finish", function() {
                        execFile("unzip", [filename, "c9.vfs.server/download.js"], { cwd: path }, function(err, stdout, stderr) {
                            assert.equal(err, null);
                            assert.equal(
                                fs.readFileSync(__dirname + "/download.js", "utf8"),
                                fs.readFileSync(path + "/c9.vfs.server/download.js", "utf8")
                            );
                            next();
                        });
                    });
                });
            });
        });

        it("should download sub directory as zip", function(next) {
            tmpDir(function(err, path) {
                assert.equal(err, null);

                var filename = "download.zip";
                var file = fs.createWriteStream(path + "/" + filename);
                http.get(base + "/test?download=download.zip", function(res) {
                    res.pipe(file);

                    file.on("finish", function() {
                        execFile("unzip", [filename, "test/dir1/testdata1.txt"], { cwd: path }, function(err) {
                            assert.equal(err, null);
                            assert.equal(
                                fs.readFileSync(__dirname + "/test/dir1/testdata1.txt", "utf8"),
                                fs.readFileSync(path + "/test/dir1/testdata1.txt", "utf8")
                            );
                            next();
                        });
                    });
                });
            });
        });

        it("should download several files in same directory as zip", function(next) {
            tmpDir(function(err, path) {
                assert.equal(err, null);

                var filename = "download.zip";
                var file = fs.createWriteStream(path + "/" + filename);
                http.get(base + "/test/dir2/testdata2a.txt,/test/dir2/testdata2b.txt?download=download.zip", function(res) {
                    res.pipe(file);
                    file.on("finish", function() {
                        execFile("unzip", [filename], { cwd: path }, function(err) {
                            assert.equal(err, null);
                            assert.equal(
                                fs.readFileSync(__dirname + "/test/dir2/testdata2a.txt", "utf8"),
                                fs.readFileSync(path + "/testdata2a.txt", "utf8")
                            );
                            assert.equal(
                                fs.readFileSync(__dirname + "/test/dir2/testdata2b.txt", "utf8"),
                                fs.readFileSync(path + "/testdata2b.txt", "utf8")
                            );
                            next();
                        });
                    });
                });
            });
        });

        it("should download several files in different directories as zip", function(next) {
            tmpDir(function(err, path) {
                assert.equal(err, null);

                var filename = "download.zip";
                var file = fs.createWriteStream(path + "/" + filename);
                http.get(base + "/test/dir1/testdata1.txt,/test/dir2/testdata2a.txt?download=download.zip", function(res) {
                    res.pipe(file);
                    file.on("finish", function() {
                        execFile("unzip", [filename], { cwd: path }, function(err) {
                            assert.equal(err, null);
                            assert.equal(
                                fs.readFileSync(__dirname + "/test/dir1/testdata1.txt", "utf8"),
                                fs.readFileSync(path + "/dir1/testdata1.txt", "utf8")
                            );
                            assert.equal(
                                fs.readFileSync(__dirname + "/test/dir2/testdata2a.txt", "utf8"),
                                fs.readFileSync(path + "/dir2/testdata2a.txt", "utf8")
                            );
                            next();
                        });
                    });
                });
            });
        });
    });
});