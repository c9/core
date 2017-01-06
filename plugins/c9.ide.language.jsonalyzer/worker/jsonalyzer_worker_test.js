/*global describe it before after beforeEach afterEach define*/
"use server";
"use strict";


require("../../../test/setup_paths");

if (typeof define === "undefined") {
    require("amd-loader");
    require("c9/inline-mocha")(module);
}

define(function(require, exports, module) {

var assert = require("ace/test/assertions");
var async = require("async");
var workerUtil = require("plugins/c9.ide.language/worker_util");
var worker = require("plugins/c9.ide.language.core/worker");
var handler = require("./jsonalyzer_worker");
var index = require("./semantic_index");
var plugins = require("../default_plugins");
var fileIndexer = require("./file_indexer");
var directoryIndexer = require("./directory_indexer");
var Document = require("ace/document").Document;

// Auto-init handler.doc
var analyzed = 0;
var realAnalyze = handler.analyze.bind(handler);
handler.analyze = function(doc, ast, options, callback) {
    handler.doc = typeof doc === "string" ? new Document(doc) : doc;
    analyzed++;
    realAnalyze(doc, ast, options, callback);
};

describe("jsonalyzer handler", function() {
    this.timeout(30000);
    
    before(function(callback) {
        handler.sender = {
            on: function() {}
        };
        async.forEachSeries(
            plugins.handlersWorker,
            function(plugin, next) {
                handler.loadPlugin(plugin, null, function(err, p) {
                    if (err)
                        return next(err);
                    handler.getHandlerRegistry().registerHandler(p);
                    next();
                });
            },
            callback
        );
    });
    
    beforeEach(function(done) {
        index.clear();
        
        // Mock / defaults
        handler.doc = null;
        handler.path = null;
        handler.language = null;
        handler.sender = {
            on: function() {}
        };
        workerUtil.getTokens = function() { throw new Error("not mocked"); };
        worker.$lastWorker = {
            $openDocuments: [],
            getIdentifierRegex: function() { return (/[A-Za-z0-9]/); },
            getOutline: function(callback) {
                return handler.outline(handler.$testDoc, null, callback);
            }
        };
        workerUtil.execFile = function() { console.trace("execFile"); };

        handler.init(done);
    });
    
    it("inits", function(done) {
        handler.init(done);
    });
    it("analyzes a single .cs file", function(done) {
        handler.path = "/testfile.cs";
        handler.analyze(
            "class C { void foo() {} void bar() {} }",
            null,
            {},
            function(err) {
                assert(!err, err);
                var result = index.get("/testfile.cs");
                assert(result, "Should have a result");
                assert(result.properties);
                assert(result.properties._C);
                assert(result.properties._foo);
                done();
            }
        );
    });
    it("analyzes a javascript file", function(done) {
        handler.path = "/testfile.js";
        handler.analyze(
            "function javascript() {}",
            null,
            {},
            function(markers) {
                assert(!markers, "No markers expected");
                var result = index.get("/testfile.js");
                assert(result);
                assert(result.properties);
                assert(result.properties._javascript);
                done();
            }
        );
    });
    it("produces an outline", function(done) {
        handler.path = "/testfile.cs";
        handler.outline(
            new Document("class C { void foo() {} void bar() {} }"),
            null,
            function(result) {
                assert(result);
                assert(result.items);
                assert.equal(result.items[0].name, "C");
                done();
            }
        );
    });
    it("completes your code", function(done) {
        handler.path = "/testfile.cs";
        handler.complete(
            new Document("f \nfunction foo() {}"),
            null,
            { row: 0, column: 1 },
            {},
            function(results) {
                assert(results && results.length > 0);
                assert.equal(results[0].name, "foo");
                done();
            }
        );
    });
    it("completes your code on the same line", function(done) {
        handler.path = "/testfile.cs";
        handler.complete(
            new Document("f function foo() {}"),
            null,
            { row: 0, column: 1 },
            {},
            function(results) {
                assert(results && results.length > 0);
                assert.equal(results[0].name, "foo");
                done();
            }
        );
    });
    it("doesn't immediately reanalyze when it completes your code", function(done) {
        handler.path = "/testfile.cs";
        handler.analyze("f \nfunction foo() {}", null, {}, function() {
            var analyzedBefore = analyzed;
            handler.complete(
                new Document("f \nfunction foo() {}"),
                null,
                { row: 0, column: 1 },
                {},
                function(results) {
                    assert.equal(analyzedBefore, analyzed);
                    done();
                }
            );
        });
    });
    it("completes code accross multiple files", function(done) {
        var file1 = {
            path: "/testfile.js",
            contents: "f function bar() {}",
            cursor: { row: 0, column: 1 }
        };
        var file2 = {
            path: "/testfile2.js",
            contents: "function foo() {}"
        };
        
        handler.path = file1.path;
        worker.$lastWorker.$openDocuments = [file1.path, file2.path];
        workerUtil.readFile = function(file, options, callback) {
            callback(null, file2.contents);
        };
        
        // Update function for second file results
        worker.$lastWorker.completeUpdate = function() {
            handler.complete(
                new Document(file1.contents), null, file1.cursor, {},
                onFullComplete
            );
        };
        
        // Trigger on first file
        handler.complete(
            new Document(file1.contents), null, file1.cursor, {},
            function(results) {
                // it won't be here yet
                assert.equal(results.length, 0);
            }
        );
        
        function onFullComplete(results) {
            assert(results && results.length > 0);
            assert.equal(results[0].id, "foo");
            assert.equal(results[0].name, "foo()");
            assert.equal(results[0].meta, "testfile2.js");
            done();
        }
    });
    it("only calls completeUpdate() once for multi-file completion", function(done) {
        var file1 = {
            path: "/testfile.js",
            contents: "f function bar() {}",
            cursor: { row: 0, column: 1 }
        };
        var file2 = {
            path: "/testfile2.js",
            contents: "function foo() {}"
        };
        
        handler.path = file1.path;
        worker.$lastWorker.$openDocuments = [file1.path, file2.path];
        workerUtil.readFile = function(file, options, callback) {
            callback(null, file2.contents);
        };
        
        // Update function for second file results
        worker.$lastWorker.completeUpdate = function() {
            handler.complete(
                new Document(file1.contents), null, file1.cursor, {},
                onFullComplete
            );
        };
        
        // Trigger on first file
        handler.complete(
            new Document(file1.contents), null, file1.cursor, {},
            function(results) {
                // it won't be here yet
                assert.equal(results.length, 0);
            }
        );
        
        function onFullComplete(results) {
            assert(results && results.length > 0);
            index.removeByPath(file1.path);
            worker.$lastWorker.completeUpdate = function() {
                assert(false, "completeUpdate may only be called once");
            };
            handler.complete(
                new Document(file1.contents), null, file1.cursor, {},
                function(results) {
                    assert(results && results.length > 0);
                    done();
                }
            );
        }
    });
    it("jumps to definitions accross multiple files", function(done) {
        var file1 = {
            path: "/testfile.cs",
            contents: "class Child : Parent {}",
            cursor: { row: 0, column: 15 }
        };
        var file2 = {
            path: "/testfile2.cs",
            contents: "class Parent {}"
        };
        
        handler.path = file1.path;
        handler.$testDoc = new Document(file1.contents);
        worker.$lastWorker.$openDocuments = [file1.path, file2.path];
        workerUtil.readFile = function(file, options, callback) {
            callback(null, file2.contents);
        };
        
        // Trigger on first file
        handler.jumpToDefinition(
            new Document(file1.contents), null, file1.cursor, {},
            function(results) {
                assert(results && results.length, "Results expected: " + JSON.stringify(results));
                assert.equal(results.length, 1);
                assert.equal(results[0].path, file2.path);
                done();
            }
        );
    });
    it("only requests imported files once", function(done) {
        var file1 = {
            path: "/testfile.cs",
            contents: "class Child : Parent {}",
            cursor: { row: 0, column: 15 }
        };
        var file2 = {
            path: "/testfile2.cs",
            contents: "class Parent {}"
        };
        
        handler.path = file1.path;
        handler.$testDoc = new Document(file1.contents);
        worker.$lastWorker.$openDocuments = [file1.path, file2.path];
        workerUtil.readFile = function(file, options, callback) {
            assert.equal(file, file2.path);
            callback(null, file2.contents);
        };
        
        // Trigger on first file
        handler.jumpToDefinition(
            new Document(file1.contents), null, file1.cursor, {},
            function(results) {
                assert(results, "Results expected");
                assert.equal(results[0].path, file2.path);
                
                workerUtil.readFile = function(file, options, callback) {
                    assert(false, "readFile called a second time");
                };

                // Jump again
                handler.jumpToDefinition(
                    new Document(file1.contents), null, file1.cursor, {},
                    function(results) {
                        assert(results, "Results expected");
                        assert.equal(results[0].path, file2.path);
                        
                        // Analyze others; still no trigger
                        fileIndexer.analyzeOthers([file1.path, file2.path], true, function() {
                            done();
                        });
                    }
                );
            }
        );
    });
    it("reanalyzes on watcher events", function(done) {
        var file = {
            path: "/testfile.cs",
            contents: "class Child : Parent {}",
            cursor: { row: 0, column: 15 }
        };
        var timesAnalyzed = 0;
        workerUtil.readFile = function(name, options, callback) {
            timesAnalyzed++;
            callback(null, file.contents);
        };
        workerUtil.execFile = function(command, args, callback) {
            callback(null, "dir listing");
        };
        // Analyze others; still no trigger
        fileIndexer.analyzeOthers([file.path], true, function() {
            assert.equal(timesAnalyzed, 1);
            directoryIndexer.enqueue(file.path);
            directoryIndexer.$consumeQueue();
            fileIndexer.analyzeOthers([file.path], true, function() {
                assert.equal(timesAnalyzed, 2);
                directoryIndexer.enqueue(file.path);
                directoryIndexer.$consumeQueue();
                fileIndexer.analyzeOthers([file.path], true, function() {
                    assert.equal(timesAnalyzed, 3);
                    directoryIndexer.$consumeQueue();
                    fileIndexer.analyzeOthers([file.path], true, function() {
                        assert.equal(timesAnalyzed, 3);
                        done();
                    });
                });
            });
        });
    });
    it("jumps to definitions within the same file", function(done) {
        var file1 = {
            path: "/testfile.cs",
            contents: "class Child : Parent {}\n\
                       class Parent {}",
            cursor: { row: 0, column: 15 }
        };
        var file2 = {
            path: "/testfile2.cs",
            contents: "class Parent {}"
        };
        
        handler.path = file1.path;
        handler.$testDoc = new Document(file1.contents);
        worker.$lastWorker.$openDocuments = [file1.path, file2.path];
        workerUtil.readFile = function(file, options, callback) {
            callback(null, file2.contents);
        };
        
        // Trigger on first file
        handler.jumpToDefinition(
            new Document(file1.contents), null, file1.cursor, {},
            function(results) {
                assert(results, "Results expected");
                assert.equal(results[0].icon, "package");
                assert.equal(results.length, 1);
                assert(results[0].path !== file2.path);
                done();
            }
        );
    });
    it("analyzes multiple files", function(done) {
        var file1 = {
            path: "/testfile.cs",
            contents: "class File1 {}",
            cursor: { row: 0, column: 15 }
        };
        var file2 = {
            path: "/testfile2.cs",
            contents: "class File2 {}"
        };
        
        handler.path = file1.path;
        handler.$testDoc = new Document(file1.contents);
        worker.$lastWorker.$openDocuments = [file1.path, file2.path];
        workerUtil.readFile = function(file, options, callback) {
            callback(null, file === file1.path ? file1.contents : file2.contents);
        };
        
        // Trigger on first file
        fileIndexer.analyzeOthers([file1.path, file2.path], true, function() {
            var result1 = index.get(file1.path);
            assert(result1.properties._File1, "File1 expected in file1");
            var result2 = index.get(file2.path);
            assert(result2.properties._File2, "File2 expected in file2");
            done();
        });
    });
    it("has documentation in code completion", function(done) {
        handler.path = "/testfile.cs";
        handler.complete(
            new Document("/** herro */ \n\
                          function foo() {}"),
            null,
            { row: 0, column: 1 },
            {},
            function(results) {
                assert(results && results.length > 0);
                assert.equal(results[0].name, "foo");
                assert(results[0].doc.match(/herro/));
                done();
            }
        );
    });
    it("has documentation in code completion ... for bash!", function(done) {
        handler.path = "/testfile.sh";
        handler.complete(
            new Document("# foo something \n\
                          foo() {}"),
            null,
            { row: 0, column: 1 },
            {},
            function(results) {
                assert(results && results.length > 0);
                assert.equal(results[0].name, "foo");
                assert(results[0].doc.match(/foo something/));
                done();
            }
        );
    });
    it("has documentation in code completion ... for python!", function(done) {
        handler.path = "/testfile.py";
        handler.complete(
            new Document("def bar:\n\
                            \"\"\" bar something \"\"\" \n\
                            return true"),
            null,
            { row: 1, column: 0 },
            {}, // above breakpoint
            function(results) {
                assert(results && results.length > 0);
                assert.equal(results[0].name, "bar");
                assert(results[0].doc.match(/bar something/));
                done();
            }
        );
    });
    it("has multi-line documentation in code completion ... for python!", function(done) {
        handler.path = "/testfile.py";
        handler.complete(
            new Document("def bar:\n\
                            \"\"\" bar ... \n\
                            something \"\"\" \n\
                            return true"),
            null,
            { row: 1, column: 0 },
            {}, // above breakpoint
            function(results) {
                assert(results && results.length > 0);
                assert.equal(results[0].name, "bar");
                assert(results[0].doc.match(/bar.*\n.*something/));
                done();
            }
        );
    });
    it("has proper garbage collection", function(done) {
        var file1 = {
            path: "/testfile.cs",
            contents: "class File1 {}",
            cursor: { row: 0, column: 15 }
        };
        var file2 = {
            path: "/testfile2.cs",
            contents: "class File2 {}"
        };
        
        handler.path = file1.path;
        handler.$testDoc = new Document(file1.contents);
        worker.$lastWorker.$openDocuments = [file1.path, file2.path];
        workerUtil.readFile = function(file, options, callback) {
            callback(null, file === file1.path ? file1.contents : file2.contents);
        };
        
        // Trigger on first file
        fileIndexer.analyzeOthers([file1.path, file2.path], true, function() {
            var result1 = index.get(file1.path);
            assert(result1.properties._File1, "File1 expected in file1");
            var result2 = index.get(file2.path);
            assert(result2.properties._File2, "File2 expected in file2");
            
            index.$clearAccessedSinceGC();
            index.gc();
            assert(index.get(file1.path), "File1 is open and cannot be garbage collected");
            assert(index.get(file2.path), "File2 is open and cannot be garbage collected");
            
            worker.$lastWorker.$openDocuments = [];
            index.gc();
            assert(index.get(file1.path), "File1 is recently accessed and cannot be garbage collected");
            index.get(file2.path, "File2 is recently accessed and cannot be garbage collected");
            
            index.$clearAccessedSinceGC();
            index.gc();
            assert(!index.get(file1.path), "File1 must be garbage collected");
            assert(!index.get(file2.path), "File2 must be garbage collected");

            done();
        });
    });
    it("analyzes a php file", function(done) {
        handler.path = "/testfile.php";
        handler.analyze(
            "function phpfun() {}",
            null,
            {},
            function(markers) {
                assert(!markers, "No markers expected");
                var result = index.get("/testfile.php");
                assert(result);
                assert(result.properties);
                assert(result.properties._phpfun, "PHP function expected");
                done();
            }
        );
    });
    it("analyzes architect files, at least somewhat", function(done) {
        handler.path = "/testfile.js";
        handler.analyze(
            "define(function(require, exports, module) {\
                main.provides = ['myplugin'];\
                function main(options, imports, register) {\
                    var Plugin = imports.Plugin;\
                    var plugin = new Plugin('Ajax.org', main.consumes); \n\
                    function foo(arg1) {}    \n\
                    plugin.freezePublicAPI({ \n\
                        /** Documentation */ \n\
                        foo: foo             \n\
                    });\
                    register(null, { myplugin : plugin });\
                }\
            });",
            null,
            {},
            function(markers) {
                assert(!markers, "No markers expected");
                var result = index.get("/testfile.js");
                assert(result);
                assert(result.properties);
                assert(result.properties._foo, "Must have a property foo");
                assert(result.properties._foo.length === 1, "Must have only one property foo");
                assert(result.properties._foo[0].doc, "Must have documentation");
                assert(result.properties._foo[0].docHead.match(/arg1/), "Must have an argument arg1");
                done();
            }
        );
    });
    it("recognizes where to refactor", function(done) {
        var file1 = {
            path: "/testfile.cs",
            contents: "class Child : Parent {}\n\
                       class Parent {}",
            cursor: { row: 0, column: 15 }
        };
        
        handler.path = file1.path;
        handler.getRefactorings(
            new Document(file1.contents), null, file1.cursor, {},
            function(results) {
                assert(results.refactorings && results.refactorings.length, "Results expected");
                done();
            }
        );
    });
    it("recognizes where not to refactor", function(done) {
        var file1 = {
            path: "/testfile.cs",
            contents: "class Child : Parent {}\n\
                       class Parent {}",
            cursor: { row: 0, column: 2 }
        };
        
        handler.path = file1.path;
        handler.getRefactorings(
            new Document(file1.contents), null, file1.cursor, {},
            function(results) {
                assert(!results.refactorings || !results.refactorings.length, "No results expected");
                done();
            }
        );
    });
    it("doesn't do refactoring in the wrong place", function(done) {
        var file1 = {
            path: "/testfile.cs",
            contents: "class Child : Parent {}\n\
                       class Parent {}",
            cursor: { row: 0, column: 2 }
        };
        
        handler.path = file1.path;
        handler.getRenamePositions(
            new Document(file1.contents), null, file1.cursor, {},
            function(results) {
                assert(!results, "No results expected");
                done();
            }
        );
    });
    it("does rename refactoring", function(done) {
        var file1 = {
            path: "/testfile.cs",
            contents: "class Child : Parent {}\n\
                       class Parent {}",
            cursor: { row: 0, column: 15 }
        };
        
        // Mock getTokens
        workerUtil.getTokens = function(doc, identifiers, callback) {
            callback(null, [
                { row: 0, column: 14, value: "Parent" },
                { row: 1, column: 29, value: "Parent" }
            ]);
        };
        
        handler.path = file1.path;
        handler.getRenamePositions(
            new Document(file1.contents), null, file1.cursor, {},
            function(results) {
                assert(results);
                assert.equal(results.length, "Parent".length);
                assert.equal(results.pos.row, 0);
                assert.equal(results.pos.column, 14);
                assert(results.others.length > 0);
                assert(results.isGeneric);
                done();
            }
        );
    });
    it("highlights occurrences", function(done) {
        var file1 = {
            path: "/testfile.cs",
            contents: "class Child : Parent {}\n\
                       class Parent {}",
            cursor: { row: 0, column: 15 }
        };
        
        // Analyze first; highlighter doesn't analyze itself
        handler.path = file1.path;
        fileIndexer.analyzeCurrent(file1.path, file1.contents, null, {}, function() {
            handler.highlightOccurrences(
                new Document(file1.contents), null, file1.cursor, {},
                function(results) {
                    assert(results);
                    assert.equal(results.markers.length, 2);
                    assert.equal(results.markers[0].pos.sc, 14);
                    assert.equal(results.markers[0].type, "occurrence_other");
                    assert.equal(results.markers[1].pos.sc, 29);
                    done();
                }
            );
        });
    });
    it("doesn't highlight non-occurrences", function(done) {
        var file1 = {
            path: "/testfile.cs",
            contents: "class Child : Parent {}\n\
                       class Parent {}",
            cursor: { row: 0, column: 2 }
        };
        
        // Analyze first; highlighter doesn't analyze itself
        handler.path = file1.path;
        fileIndexer.analyzeCurrent(file1.path, file1.contents, null, {}, function() {
            handler.highlightOccurrences(
                new Document(file1.contents), null, file1.cursor, {},
                function(results) {
                    assert(!results, results);
                    done();
                }
            );
        });
    });
    it("doesn't highlight when a definiton is selected", function(done) {
        var file1 = {
            path: "/testfile.cs",
            contents: "class Child : Parent {}\n\
                       class Parent {}",
            cursor: { row: 1, column: 8 }
        };
        
        // Analyze first; highlighter doesn't analyze itself
        handler.path = file1.path;
        fileIndexer.analyzeCurrent(file1.path, file1.contents, null, {}, function() {
            handler.highlightOccurrences(
                new Document(file1.contents), null, file1.cursor, {},
                function(results) {
                    assert(!results, results);
                    done();
                }
            );
        });
    });
    it("analyzes an md file", function(done) {
        handler.path = "/testfile.md";
        handler.analyze(
            "# hello",
            null,
            {},
            function(markers) {
                assert(!markers, "No markers expected");
                var result = index.get("/testfile.md");
                assert(result);
                assert(result.properties);
                assert(result.properties._hello, "Header expected");
                done();
            }
        );
    });
    it("doesn't handle json files", function(done) {
        handler.path = "/testfile.json";
        assert(!handler.getHandlerFor(handler.path));
        done();
    });
    it("doesn't handle json-language files", function(done) {
        handler.path = "/testfile.json";
        handler.language = "json";
        assert(!handler.getHandlerFor(handler.path));
        
        handler.path = "/testfile";
        handler.language = "json";
        assert(!handler.getHandlerFor(handler.path));
        done();
    });
    it("does handle sh files", function(done) {
        handler.path = "/testfile.sh";
        assert(handler.getHandlerFor(handler.path));
        done();
    });
    it("does, apparently, handle sh files in json language", function(done) {
        handler.path = "/testfile.sh";
        handler.language = "json";
        assert(handler.getHandlerFor(handler.path));
        done();
    });
    it("does handle json files in sh language", function(done) {
        handler.path = "/testfile.json";
        handler.language = "sh";
        assert(handler.getHandlerFor(handler.path));
        done();
    });
});

if (typeof onload !== "undefined")
    onload();

});