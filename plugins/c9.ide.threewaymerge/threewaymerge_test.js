/*global describe:false, it:false */

"use client";

require(["lib/architect/architect", "lib/chai/chai", "/vfs-root", "events", "ace/document"], function(architect, chai, baseProc, events, document) {

    var expect = chai.expect;
    var Emitter = events.EventEmitter;
    var Document = document.Document;

    var ev = new Emitter();
    // var merge = require("./threewaymerge");

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
            packagePath: "plugins/c9.ide.ui/ui",
            staticPrefix: "plugins/c9.ide.ui"
        },
        "plugins/c9.ide.ui/lib_apf",
        {
            packagePath: "plugins/c9.fs/fs",
            baseProc: baseProc
        },
        "plugins/c9.core/ext",
        "plugins/c9.core/http-xhr",
        "plugins/c9.core/util",
        "plugins/c9.core/settings",
        "plugins/c9.vfs.client/vfs_client",
        "plugins/c9.vfs.client/endpoint",
        "plugins/c9.ide.auth/auth",
        "plugins/c9.core/api",
        "plugins/c9.ide.threewaymerge/threewaymerge",
        {
            consumes: ["threewaymerge", "fs"],
            provides: [],
            setup: main
        }
    ], architect);
    
    function main(options, imports, register) {
        var merge = imports.threewaymerge;
        var fs = imports.fs;

        describe('threewaymerge', function() {
            it("should patch remote changes changes", function(done) {
                var root = "Hello World";
                var theirs = "Hello Peter";
                var ours = new Document(root);

                merge.merge(root, theirs, ours);
                expect(ours.getValue()).equal("Hello Peter");
                done();
            });
            it("should patch remote with local changes", function(done) {
                var root = "Hello World";
                var theirs = "Hello World";
                var ours = new Document("Hello Max");

                merge.merge(root, theirs, ours);
                expect(ours.getValue()).equal("Hello Max");
                done();
            });
            it("should patch against both changes", function(done) {
                var root = "Hello World";
                var theirs = "Hello Peter";
                var ours = new Document("Hallo World");

                merge.merge(root, theirs, ours);
                expect(ours.getValue()).equal("Hallo Peter");
                done();
            });
            it("should patch multi-lines documents against changes", function(done) {
                var root = [
                    "Hello Peter",
                    "abcdefg",
                    "o my god"
                ].join("\n");
                var theirs = [
                    "Hello Max",
                    "abcdefg",
                    "bla bla",
                    "o my god"
                ].join("\n");
                var ours = new Document([
                    "Hello Paul",
                    "abcdefg",
                    "o my"
                ]);

                merge.merge(root, theirs, ours);

                expect(ours.getValue()).equal([
                    "<<<<<<<<< saved version",
                    "Hello Max",
                    "=========",
                    "Hello Paul",
                    ">>>>>>>>> local version",
                    "abcdefg",
                    "bla bla",
                    "o my"
                    ].join("\n")
                );
                done();
            });
            it("should patch both changes with conflicts", function(done) {
                var root = "Hello World";
                var theirs = "Hello Peter";
                var ours = new Document("Hello Max");

                merge.merge(root, theirs, ours);
                expect(ours.getValue()).equal([
                    "<<<<<<<<< saved version",
                    "Hello Peter",
                    "=========",
                    "Hello Max",
                    ">>>>>>>>> local version"].join("\n")
                );
                done();
            });
            it("should not remove all listeners", function(done) {
                var root = [
                    "Hello Peter",
                    "abcdefg",
                    "o my god"
                ].join("\n");
                var theirs = [
                    "Hello Max",
                    "abcdefg",
                    "bla bla",
                    "o my god"
                ].join("\n");
                var ours = [
                    "Hello Paul",
                    "abcdefg",
                    "o my"
                ].join("\n");

                var merged = merge.diff3(theirs, root, ours);

                expect(merged).equal([
                    "<<<<<<<<< saved version",
                    "Hello Max",
                    "=========",
                    "Hello Paul",
                    ">>>>>>>>> local version",
                    "abcdefg",
                    "bla bla",
                    "o my"
                    ].join("\n")
                );
                done();
            });
            it("should patch ace document", function(done) {
                var value = "Juhu kinners";
                var newValue = "Juhu max";
                var doc = new Document(value);

                merge.patchAce(value, newValue, doc);
                expect(newValue).equal(doc.getValue());
                done();
            });
            it("should patch bigger file", function(done) {
                fs.readFile("/file.js", function (err, value) {
                    var doc = new Document(value);
                    var newValue = value.replace(/function/g, "def");

                    console.time("patch");
                    merge.patchAce(value, newValue, doc);
                    console.timeEnd("patch");
                    
                    expect(newValue).equal(doc.getValue());
                    done();
                });
            });
        });

        onload();
    }
});
