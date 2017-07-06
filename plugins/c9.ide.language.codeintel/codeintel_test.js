/*global describe it before after beforeEach onload*/

"use client";

require(["plugins/c9.ide.language/test_base"], function(base) {
    base.setup(function(err, imports, helpers) {
        if (err) throw err;
        
        var language = imports.language;
        var chai = require("lib/chai/chai");
        var expect = chai.expect;
        var assert = require("assert");
        var tabs = imports.tabManager;
        var complete = imports["language.complete"];
        var afterNoCompleteOpen = helpers.afterNoCompleteOpen;
        var afterCompleteDocOpen = helpers.afterCompleteDocOpen;
        var afterCompleteOpen = helpers.afterCompleteOpen;
        var isCompleterOpen = helpers.isCompleterOpen;
        var getCompletionCalls = helpers.getCompletionCalls;

        describe("analysis", function() {
            var jsTab;
            var jsSession;
            
            // Setup
            beforeEach(function(done) {
                tabs.getTabs().forEach(function(tab) {
                    tab.close(true);
                });
                // tab.close() isn't quite synchronous, wait for it :(
                complete.closeCompletionBox();
                setTimeout(function() {
                    tabs.openFile("/language.js", function(err, tab) {
                        if (err) return done(err);
                        
                        jsTab = tab;
                        jsSession = jsTab.document.getSession().session;
                        expect(jsSession).to.not.equal(null);
                        setTimeout(function() {
                            complete.closeCompletionBox();
                            done();
                        });
                    });
                }, 0);
            });
            
            it('manages to succesfully install codeintel', function(done) {
                this.timeout(5 * 60 * 1000);
                tabs.openFile("/test.css", function(err, tab) {
                    if (err) return done(err);
                    
                    tabs.focusTab(tab);
                    
                    imports.worker.once("codeintel_ready", function(e) {
                        assert(!e.data.err, e.data.err);
                        done();
                    });
                });
            });
            
            it('does continuous completion for CSS if you just typed one character', function(done) {
                tabs.openFile("/test.css", function(err, tab) {
                    if (err) return done(err);
                    
                    tabs.focusTab(tab);
                    // We get a tab, but it's not done yet, so we wait
                    setTimeout(function() {
                        tab.editor.ace.selection.setSelectionRange({ start: { row: 1, column: 4 }, end: { row: 1, column: 4 }});
                        tab.editor.ace.onTextInput(" f");
                        afterCompleteOpen(function(el) {
                            expect.html(el).text(/font-/);
                            done();
                        });
                    });
                });
            });
            
            it('does continuous completion for CSS if you just typed one character', function(done) {
                tabs.openFile("/test.css", function(err, tab) {
                    if (err) return done(err);
                    
                    tabs.focusTab(tab);
                    // We get a tab, but it's not done yet, so we wait
                    setTimeout(function() {
                        tab.editor.ace.selection.setSelectionRange({ start: { row: 1, column: 4 }, end: { row: 1, column: 4 }});
                        tab.editor.ace.onTextInput("f");
                        afterCompleteOpen(function(el) {
                            assert(el.textContent.match(/font-size/), el.textContent);
                            done();
                        });
                    });
                });
            });
            
            it('does continuous completion for CSS', function(done) {
                tabs.openFile("/test.css", function(err, tab) {
                    if (err) return done(err);
                    
                    tabs.focusTab(tab);
                    // We get a tab, but it's not done yet, so we wait
                    setTimeout(function() {
                        tab.editor.ace.selection.setSelectionRange({ start: { row: 1, column: 4 }, end: { row: 1, column: 4 }});
                        tab.editor.ace.onTextInput("font-f");
                        afterCompleteOpen(function(el) {
                            expect.html(el).text(/font-family/);
                            done();
                        });
                    });
                });
            });
            
            it("completes php", function(done) {
                tabs.openFile("/test.php", function(err, tab) {
                    if (err) return done(err);
                    
                    tabs.focusTab(tab);
                    imports.worker.on("setCompletionRegex", function onRegex(e) {
                        if (e.data.language !== "php")
                            return;
                        imports.worker.off("setCompletionRegex", onRegex);
                        
                        tab.editor.ace.selection.setSelectionRange({ start: { row: 17, column: 5 }, end: { row: 17, column: 5 }});
                        tab.editor.ace.onTextInput("-");
                        tab.editor.ace.onTextInput(">");
                        afterCompleteOpen(function(el) {
                            complete.closeCompletionBox();
                            assert(el.textContent.match(/y/), el.textContent);
                            done();
                        });
                    });
                });
            });
        }); 
    });
});
