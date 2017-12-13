/*global describe:false, it:false */

require(["lib/architect/architect", "lib/chai/chai"], function (architect, chai) {
    "use client";
    var expect = chai.expect;
    
    expect.setupArchitectTest([
        "plugins/c9.core/ext",
        "plugins/c9.ide.ui/ui",
        "plugins/c9.core/util",
        "plugins/c9.ide.ui/lib_apf",
        "plugins/c9.ide.editors/editor",
        "plugins/c9.ide.clipboard/clipboard",
        "plugins/c9.ide.clipboard/html5",
        "plugins/c9.ide.editors/document",
        "plugins/c9.ide.editors/undomanager",
        
        {
            consumes: ["Editor", "Document"],
            provides: [],
            setup: main
        }
    ], architect);
    
    function main(options, imports, register) {
        var Editor = imports.Editor;
        var Document = imports.Document;
        
        describe('editor', function() {
            it('should load it\'s state from the constructor', function(done) {
                var exts = ["js", "txt"];
                var editor = new Editor("Ajax.org", [], exts);
                
                expect(editor.fileExtensions).to.equal(exts);
                
                done();
            });
            it('should emit document event and connect state get/setters with those of editor', function(done) {
                var exts = ["js", "txt"];
                var editor = new Editor("Ajax.org", [], exts);
                var doc = new Document();
                
                editor.type = "test";
                editor.name = "test1";
                
                var count = 0;
                editor.on("documentLoad", function(e) {
                    expect(e.doc).to.equal(doc);
                    count++;
                });
                editor.on("documentActivate", function(e) {
                    expect(e.doc).to.equal(doc);
                    count++;
                });
                editor.on("documentUnload", function(e) {
                    expect(e.doc).to.equal(doc);
                    count++;
                });
                doc.on("setState", function(e) {
                    count++;
                });
                doc.on("getState", function(e) {
                    count++;
                });
                editor.on("setState", function(e) {
                    expect(e.state).property("x").to.equal(1);
                    count++;
                });
                editor.on("getState", function(e) {
                    e.state.x = 1;
                    count++;
                });
                
                editor.loadDocument(doc);
                
                var state = doc.getState();
                doc.setState(state);

                editor.loadDocument(doc);
                
                doc.unload();
                
                if (count != 8) {
                    throw new Error("Not all events where called: " 
                        + count + " of 8");
                }
                
                expect(state).property("test").property("x").to.equal(1);
                
                done();
            });
            it('should emit clear when clearing the editor', function(done) {
                var editor = new Editor();
                editor.on("clear", function(e) { done(); });
                editor.clear();
            });
            it('should emit focus when focussing the editor', function(done) {
                var editor = new Editor();
                editor.on("focus", function(e) { done(); });
                editor.focus();
            });
            it('should emit validate when validating the editor', function(done) {
                var editor = new Editor();
                editor.on("validate", function(e) { 
                    expect(e.document).to.equal(1);
                    done(); 
                });
                editor.isValid(1);
            });
            it('should attach itself to a pane element', function(done) {
                var editor = new Editor();
                
                var count = 0;
                editor.on("draw", function(e) {
                    e.tab.on("DOMNodeRemovedFromDocument", function() {
                        if (count != 2)
                            throw new Error("Not all events where called: "
                                + count);
                        
                        done();
                    });
                    count++;
                });
                
                var pane = {
                    aml: { insertBefore: function() { count++; }, 
                    getPage: function() {} },
                    on: function() {}
                };
                editor.attachTo(pane);
                
                editor.load("test");
                editor.unload();
            });
        });
        
        register();
    }
});