/*global describe it before disabledFeatures*/

"use client";

if (typeof define === "undefined") {
    require("amd-loader");
    require("../../test/setup_paths");
}

define(function(require, exports, module) {
    var assert = require("assert");
    var LanguageWorker = require('../c9.ide.language.core/worker').LanguageWorker;
    var EventEmitter = require("ace/lib/event_emitter").EventEmitter;
    
    describe("Jump To Definition", function() {
        this.timeout(1000000);
        
        it("test jump to definition should point to variable declaration", function(next) {
            disabledFeatures = { jshint: true };
            var emitter = Object.create(EventEmitter);
            emitter.emit = emitter._dispatchEvent;
            emitter.on("definition", function(def) {
                assert.equal(def.results[0].row, 0);
                assert.equal(def.results[0].column, 4);
                next();
            });
            emitter.once("markers", function(markers) {
                worker.jumpToDefinition({
                    data: {
                        row: 0,
                        column: 26
                    }
                });
            });
            var worker = new LanguageWorker(emitter);
            worker.register("plugins/c9.ide.language.javascript/scope_analyzer");
            worker.register("plugins/c9.ide.language.javascript/jumptodef");
            worker.register("plugins/c9.ide.language.javascript/parse");
            worker.switchFile("test.js", false, "javascript", "var ab = 4; console.log(ab);", null, "");
        });
        it("test jump to definition on a position without code should still return a result", function(next) {
            disabledFeatures = { jshint: true };
            var emitter = Object.create(EventEmitter);
            emitter.emit = emitter._dispatchEvent;
            var definitionListener = function() {definitionListener.callCount += 1;};
            definitionListener.callCount = 0;
            emitter.on("definition", definitionListener);
            emitter.once("markers", function(markers) {
                worker.jumpToDefinition({
                    data: {
                        row: 0,
                        column: 40
                    }
                });
            });
            var worker = new LanguageWorker(emitter);
            worker.register("plugins/c9.ide.language.javascript/scope_analyzer");
            worker.register("plugins/c9.ide.language.javascript/jumptodef");
            worker.register("plugins/c9.ide.language.javascript/parse");
            worker.switchFile("test.js", false, "javascript", "var ab = 4; console.log(ab);                            ", null, "");
            
            // definition listener should not be called
            setTimeout(function () {
                assert.equal(definitionListener.callCount, 1);
                next();
            }, 500);
        });
        it("test isJumpToDefinitionAvailable should return true when available", function(next) {
            disabledFeatures = { jshint: true };
            var emitter = Object.create(EventEmitter);
            emitter.emit = emitter._dispatchEvent;
            emitter.on("isJumpToDefinitionAvailableResult", function(res) {
                assert.equal(res.value, true);
                next();
            });
            emitter.once("markers", function(markers) {
                worker.isJumpToDefinitionAvailable({
                    data: {
                        row: 0,
                        column: 26
                    }
                });
            });
            var worker = new LanguageWorker(emitter);
            worker.register("plugins/c9.ide.language.javascript/scope_analyzer");
            worker.register("plugins/c9.ide.language.javascript/jumptodef");
            worker.register("plugins/c9.ide.language.javascript/parse");
            worker.switchFile("test.js", false, "javascript", "var ab = 4; console.log(ab);", null, "");
        });
        it("test isJumpToDefinitionAvailable should return false when not available", function(next) {
            disabledFeatures = { jshint: true };
            var emitter = Object.create(EventEmitter);
            emitter.emit = emitter._dispatchEvent;
            emitter.on("isJumpToDefinitionAvailableResult", function(res) {
                assert.equal(res.value, false);
                next();
            });
            emitter.once("markers", function(markers) {
                worker.isJumpToDefinitionAvailable({
                    data: {
                        row: 0,
                        column: 15
                    }
                });
            });
            var worker = new LanguageWorker(emitter);
            worker.register("plugins/c9.ide.language.javascript/scope_analyzer");
            worker.register("plugins/c9.ide.language.javascript/jumptodef");
            worker.register("plugins/c9.ide.language.javascript/parse");
            worker.switchFile("test.js", false, "javascript", "var ab = 4; console.log(ab);", null, "");
        });
    });
    
    onload && onload();
});
