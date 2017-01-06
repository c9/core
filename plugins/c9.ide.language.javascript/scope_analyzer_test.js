/*global describe it before disabledFeatures:true*/

"use client";

if (typeof define === "undefined") {
    require("amd-loader");
    require("../../test/setup_paths");
}

define(function(require, exports, module) {
    var assert = require("lib/chai/chai").assert;
    var LanguageWorker = require('plugins/c9.ide.language.core/worker').LanguageWorker;
    var EventEmitter = require("ace/lib/event_emitter").EventEmitter;
    
    require("plugins/c9.ide.language.javascript/scope_analyzer");
    require("plugins/c9.ide.language.javascript/parse");
    
    describe("Scope Analyzer", function() {
        this.timeout(1000000);
        
        it("test jshint-style globals", function(next) {
            disabledFeatures = { jshint: undefined };
            var emitter = Object.create(EventEmitter);
            emitter.emit = emitter._dispatchEvent;
            emitter.on("markers", function(markers) {
                assert.equal(markers.length, 0);
                next();
            });
            var worker = new LanguageWorker(emitter);
            worker.$analyzeInterval = {};
            worker.register("plugins/c9.ide.language.javascript/scope_analyzer");
            worker.register("plugins/c9.ide.language.javascript/parse");
            worker.switchFile("test.js", false, "javascript", "/*global foo:true*/ foo;", null, "");
        });

        // Note: many tests are disabled since some analysis features
        // were disabled when c9.ide.language.javascript.tern was added

        it.skip("test unused variable", function(next) {
            disabledFeatures = { jshint: true };
            var emitter = Object.create(EventEmitter);
            emitter.emit = emitter._dispatchEvent;
            emitter.on("markers", function(markers) {
                assert.equal(markers.length, 1);
                assert.equal(markers[0].message, 'Unused variable.');
                assert.equal(markers[0].pos.sl, 0);
                assert.equal(markers[0].pos.el, 0);
                assert.equal(markers[0].pos.sc, 4);
                assert.equal(markers[0].pos.ec, 9);
                next();
            });
            var worker = new LanguageWorker(emitter);
            worker.register("plugins/c9.ide.language.javascript/scope_analyzer");
            worker.register("plugins/c9.ide.language.javascript/parse");
            assert.equal(worker.handlers.length, 2);
            worker.switchFile("test.js", false, "javascript", "var hello = false;", null, "");
        });
        it.skip("test unused const", function(next) {
            disabledFeatures = { jshint: true };
            var emitter = Object.create(EventEmitter);
            emitter.emit = emitter._dispatchEvent;
            emitter.on("markers", function(markers) {
                assert.equal(markers.length, 1);
                next();
            });
            var worker = new LanguageWorker(emitter);
            worker.register("plugins/c9.ide.language.javascript/scope_analyzer");
            worker.register("plugins/c9.ide.language.javascript/parse");
            assert.equal(worker.handlers.length, 2);
            worker.switchFile("test.js", false, "javascript", "const hello = false;", null, "");
        });
        it.skip("test unused variable scoped", function(next) {
            disabledFeatures = { jshint: true };
            var emitter = Object.create(EventEmitter);
            emitter.emit = emitter._dispatchEvent;
            emitter.on("markers", function(markers) {
                assert.equal(markers.length, 1);
                assert.equal(markers[0].message, 'Unused variable.');
                next();
            });
            var worker = new LanguageWorker(emitter);
            worker.register("plugins/c9.ide.language.javascript/scope_analyzer");
            worker.register("plugins/c9.ide.language.javascript/parse");
            assert.equal(worker.handlers.length, 2);
            worker.switchFile("test.js", false, "javascript", "var hello = false; function noName() { var hello = true; hello = false; }", null, "");
        });
        it.skip("test unused variable scoped without var decl", function(next) {
            disabledFeatures = { jshint: true };
            var emitter = Object.create(EventEmitter);
            emitter.emit = emitter._dispatchEvent;
            emitter.on("markers", function(markers) {
                assert.equal(markers.length, 0);
                next();
            });
            var worker = new LanguageWorker(emitter);
            worker.register("plugins/c9.ide.language.javascript/scope_analyzer");
            worker.register("plugins/c9.ide.language.javascript/parse");
            assert.equal(worker.handlers.length, 2);
            worker.switchFile("test.js", false, "javascript", "var hello = false; function noName() { hello = false; }", null, "");
        });
        it.skip("test undeclared variable", function(next) {
            disabledFeatures = { jshint: true };
            var emitter = Object.create(EventEmitter);
            emitter.emit = emitter._dispatchEvent;
            emitter.on("markers", function(markers) {
                assert.equal(markers.length, 1);
                assert.equal(markers[0].message, 'Assigning to undeclared variable.');
                next();
            });
            var worker = new LanguageWorker(emitter);
            worker.register("plugins/c9.ide.language.javascript/scope_analyzer");
            worker.register("plugins/c9.ide.language.javascript/parse");
            assert.equal(worker.handlers.length, 2);
            worker.switchFile("test.js", false, "javascript", "hello = false;", null, "");
        });
        it.skip("test undeclared iteration variable", function(next) {
            disabledFeatures = { jshint: true };
            var emitter = Object.create(EventEmitter);
            emitter.emit = emitter._dispatchEvent;
            emitter.on("markers", function(markers) {
                assert.equal(markers.length, 1);
                assert.equal(markers[0].message, 'Using undeclared variable as iterator variable.');
                next();
            });
            var worker = new LanguageWorker(emitter);
            worker.register("plugins/c9.ide.language.javascript/scope_analyzer");
            worker.register("plugins/c9.ide.language.javascript/parse");
            worker.switchFile("test.js", false, "javascript", "for(p in {}) { }", null, "");
        });
        it.skip("test bad this call", function(next) {
            disabledFeatures = { jshint: true };
            var emitter = Object.create(EventEmitter);
            emitter.emit = emitter._dispatchEvent;
            emitter.on("markers", function(markers) {
                assert.equal(markers.length, 1);
                next();
            });
            var worker = new LanguageWorker(emitter);
            worker.register("plugins/c9.ide.language.javascript/scope_analyzer");
            worker.register("plugins/c9.ide.language.javascript/parse");
            worker.switchFile("test.js", false, "javascript", "var accept = function(){}; accept('evt', function(){this});", null, "");
        });
        it.skip("test bad this call (2)", function(next) {
            disabledFeatures = { jshint: true };
            var emitter = Object.create(EventEmitter);
            emitter.emit = emitter._dispatchEvent;
            emitter.on("markers", function(markers) {
                assert.equal(markers.length, 2);
                next();
            });
            var worker = new LanguageWorker(emitter);
            worker.register("plugins/c9.ide.language.javascript/scope_analyzer");
            worker.register("plugins/c9.ide.language.javascript/parse");
            worker.switchFile("test.js", false, "javascript", "var accept = function(){}; accept(function(err){this});", null, "");
        });
        it.skip("test bad this call (3)", function(next) {
            disabledFeatures = { jshint: true };
            var emitter = Object.create(EventEmitter);
            emitter.emit = emitter._dispatchEvent;
            emitter.on("markers", function(markers) {
                assert.equal(markers.length, 1);
                next();
            });
            var worker = new LanguageWorker(emitter);
            worker.register("plugins/c9.ide.language.javascript/scope_analyzer");
            worker.register("plugins/c9.ide.language.javascript/parse");
            worker.switchFile("test.js", false, "javascript", "function g(err){this};", null, "");
        });    
        it.skip("test missing return in err handler", function(next) {
            disabledFeatures = { jshint: true };
            var emitter = Object.create(EventEmitter);
            emitter.emit = emitter._dispatchEvent;
            emitter.on("markers", function(markers) {
                assert.equal(markers.length, 1);
                next();
            });
            var worker = new LanguageWorker(emitter);
            worker.register("plugins/c9.ide.language.javascript/scope_analyzer");
            worker.register("plugins/c9.ide.language.javascript/parse");
            worker.switchFile("test.js", false, "javascript", "function doSomethingElse() { } function helloAsync(callback) {  doSomethingElse(function(err) { if (err) callback(err); }); }", null, "");
        });
        it.skip("test missing return in err handler without using err in call", function(next) {
            disabledFeatures = { jshint: true };
            var emitter = Object.create(EventEmitter);
            emitter.emit = emitter._dispatchEvent;
            emitter.on("markers", function(markers) {
                assert.equal(markers.length, 0);
                next();
            });
            var worker = new LanguageWorker(emitter);
            worker.register("plugins/c9.ide.language.javascript/scope_analyzer");
            worker.register("plugins/c9.ide.language.javascript/parse");
            worker.switchFile("test.js", false, "javascript", "function doSomethingElse() { } doSomethingElse(function(err) { if (err) console.log('sup'); });", null, "");
        });
        it.skip("test not reporting error when there is a return in err handler", function(next) {
            disabledFeatures = { jshint: true };
            var emitter = Object.create(EventEmitter);
            emitter.emit = emitter._dispatchEvent;
            emitter.on("markers", function(markers) {
                assert.equal(markers.length, 0);
                next();
            });
            var worker = new LanguageWorker(emitter);
            worker.register("plugins/c9.ide.language.javascript/scope_analyzer");
            worker.register("plugins/c9.ide.language.javascript/parse");
            worker.switchFile("test.js", false, "javascript", "function doSomethingElse() { } function helloAsync(callback) {  doSomethingElse(function(err) { if (err) return callback(err); }); }", null, "");
        });
        it.skip("test be less complainy", function(next) {
            disabledFeatures = { jshint: true };
            var emitter = Object.create(EventEmitter);
            emitter.emit = emitter._dispatchEvent;
            emitter.on("markers", function(markers) {
                assert.equal(markers.length, 1);
                next();
            });
            var worker = new LanguageWorker(emitter);
            worker.register("plugins/c9.ide.language.javascript/scope_analyzer");
            worker.register("plugins/c9.ide.language.javascript/parse");
            worker.switchFile("test.js", false, "javascript", "var foo = true ? false\n: { a : 1\n b : 2}", null, "");
        });
        it.skip("test be less complainy 2", function(next) {
            disabledFeatures = { jshint: true };
            var emitter = Object.create(EventEmitter);
            emitter.emit = emitter._dispatchEvent;
            emitter.on("markers", function(markers) {
                assert.equal(markers.length, 0);
                next();
            });
            var worker = new LanguageWorker(emitter);
            worker.register("plugins/c9.ide.language.javascript/scope_analyzer");
            worker.register("plugins/c9.ide.language.javascript/parse");
            worker.switchFile("test.js", false, "javascript", "for(;;) { [].forEach(function() {}) }", null, "");
        });
        it.skip("test be selectively complainy about functions in loops", function(next) {
            disabledFeatures = { jshint: true };
            var emitter = Object.create(EventEmitter);
            emitter.emit = emitter._dispatchEvent;
            emitter.on("markers", function(markers) {
                assert.equal(markers.length, 1);
                next();
            });
            var worker = new LanguageWorker(emitter);
            worker.register("plugins/c9.ide.language.javascript/scope_analyzer");
            worker.register("plugins/c9.ide.language.javascript/parse");
            worker.switchFile("test.js", false, "javascript", "for(;;) { [].bar(function() {}) }", null, "");
        });
        it.skip("test complain about functions in 'for in'", function(next) {
            disabledFeatures = { jshint: true };
            var emitter = Object.create(EventEmitter);
            emitter.emit = emitter._dispatchEvent;
            emitter.on("markers", function(markers) {
                assert.equal(markers.length, 1);
                next();
            });
            var worker = new LanguageWorker(emitter);
            worker.register("plugins/c9.ide.language.javascript/scope_analyzer");
            worker.register("plugins/c9.ide.language.javascript/parse");
            worker.switchFile("test.js", false, "javascript", "for(var x in []) { x.bar(function() {}) }", null, "");
        });
    });
    
    onload && onload();
});