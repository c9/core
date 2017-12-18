/*global describe it before after beforeEach*/

"use client";


require(["plugins/c9.ide.language/test_base"], function(base) {
    base.setup(function(err, imports, helpers) {
        var tabs = imports.tabManager;
        var ace = imports.ace;
        var Document = imports.Document;
        var language = imports.language;
        var complete = imports["language.complete"];
        
        var chai = require("lib/chai/chai");
        var expect = chai.expect;
        var assert = require("assert");
        
        describe("architect_resolver", function() {
            var jsTab;
            var jsSession;
            
            // Setup
            beforeEach(setup);
            
            before(function(done) {
                setup(function() {
                    // Trigger intialization
                    jsTab.editor.ace.onTextInput("m");
                    helpers.afterCompleteOpen(function(el) {
                        setup(done);
                    });
                });
            });

            function setup(done) {
                tabs.getTabs().forEach(function(tab) {
                    tab.close(true);
                });
                // tab.close() isn't quite synchronous, wait for it :(
                complete.closeCompletionBox();
                setTimeout(function() {
                    tabs.openFile("/plugins/c9.dummy/architect_test_dummy.js", function(err, tab) {
                        jsTab = tab;
                        jsSession = jsTab.document.getSession().session;
                        expect(jsSession).to.not.equal(null);
                        setTimeout(function() {
                            complete.closeCompletionBox();
                            jsTab.editor.ace.selection.setSelectionRange({ start: { row: 15, column: 17 }, end: { row: 15, column: 17 }});
                            jsTab.editor.ace.renderer.scrollCursorIntoView();
                            done();
                        });
                    });
                }, 100);
            }
            
            it('shows an inference completer popup for a local architect module', function(done) {
                jsTab.editor.ace.onTextInput("my");
                helpers.afterCompleteOpen(function(el) {
                    expect.html(el).text(/myplugin/);
                    done();
                });
            });
            
            it('shows a completer popup for a non-local architect module', function(done) {
                jsTab.editor.ace.onTextInput("P");
                helpers.afterCompleteOpen(function(el) {
                    expect.html(el).text(/Plugin/);
                    done();
                });
            });
            
            it('shows a documentation popup for non-local architect functions', function(done) {
                jsTab.editor.ace.onTextInput("Plugin");
                jsTab.editor.ace.onTextInput(".");
                helpers.afterCompleteDocOpen(function(el) {
                    expect.html(el).text(/so bogus/);
                    done();
                });
            });
            
            it('shows a completion indirect import references', function(done) {
                jsTab.editor.ace.onTextInput("Plugin;\nPlugin");
                jsTab.editor.ace.onTextInput(".");
                helpers.afterCompleteDocOpen(function(el) {
                    expect.html(el).text(/so bogus/);
                    done();
                });
            });
            
            it('shows types for a non-local architect function', function(done) {
                jsTab.editor.ace.onTextInput("Plugin");
                jsTab.editor.ace.onTextInput(".");
                helpers.afterCompleteDocOpen(function(el) {
                    expect.html(el).text(/s : string/);
                    done();
                });
            });
            
            it('shows a documentation popup for modules', function(done) {
                jsTab.editor.ace.onTextInput("Pl");
                helpers.afterCompleteDocOpen(function(el) {
                    expect.html(el).text(/dummy[\s\S]*documentation/);
                    assert(!el.textContent.match(/\*/));
                    done();
                });
            });
            
            it('shows module name completions for imports', function(done) {
                jsTab.editor.ace.onTextInput('main.consumes = ["u');
                helpers.afterCompleteOpen(function(el) {
                    expect.html(el).text(/ui/);
                    done();
                });
            });
        });
    
    });
});
