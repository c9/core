/*global describe it before*/

"use client";

if (typeof define === "undefined") {
    require("amd-loader");
    require("../../test/setup_paths");
    require("c9/inline-mocha")(module);
}

function outlineSync(handler, document, node) {
    var result;
    handler.outline(document, node, function(o) {
        result = o.items;
    });
    return result;
}

define(function(require, exports, module) {
    var handler = require("./outline");
    var parser = require("treehugger/js/parse");
    var assert = require("ace/test/assertions");
    var Document = require("ace/document").Document;
    
    //var microtime = require("microtime");
    
    describe("Outline", function() {
        it("test basic outline", function(done) {
            var testfile = "" + require('text!./test/test1.js');
            var node = parser.parse(testfile);
            var outline = outlineSync(handler, new Document(testfile), node);
            //console.log(""+node);
            //console.log(JSON.stringify(outline, null, 2));
            assert.equal(outline[0].name, 'simpleFunction()');
            assert.equal(outline[1].name, 'simpleFunctionNested(a, b)');
            assert.equal(outline[1].items[0].name, 'nested(c)');
            assert.equal(outline[2].name, 'someFunction(a, b)');
            assert.equal(outline[3].name, 'someFunction.bla()');
            assert.equal(outline[4].name, 'SomeClass');
            assert.equal(outline[4].items[0].name, 'method(x)');
            assert.equal(outline.length, 5);
            done();
        });
    
        it("!test jquery", function(done) {
            // we don't have jquery now, so let's test something else
            // var now = microtime.now();
            // var testfile = "" + require('text!jquery.js');
            // var node = parser.parse(testfile);
            // console.log("Parsing time: " + (microtime.now() - now)/1000 + "ms");
            // var now = microtime.now();
            // var outline = outlineSync(handler, new Document(testfile), node);
            // console.log("Outline time: " + (microtime.now() - now)/1000 + "ms");
            done();
        });
        
        it("test complicated outline", function(done) {
            var testfile = "" + require('text!./test/test2.js');
            var node = parser.parse(testfile);
            console.log(Document);
            var outline = outlineSync(handler, new Document(testfile), node);
            //console.log(""+node);
            //console.log(JSON.stringify(outline, null, 2));
            assert.equal(outline[0].name, 'simpleFunction()');
            assert.equal(outline[1].name, 'simpleFunctionNested(a, b)');
            assert.equal(outline[1].items[0].name, 'nested(c)');
            assert.equal(outline[2].name, 'someFunction(a, b)');
            assert.equal(outline[3].name, 'someFunction.bla()');
            assert.equal(outline[4].name, 'b[x]()');
            assert.equal(outline[7].items.length, 1);
            assert.equal(outline[3].items[0].items.length, 3);
            
            assert.equal(outline.length, 8);
            
            done();
        });
    });
    
    onload && onload();
});
