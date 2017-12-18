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
        
        describe("analysis", function() {
            var tab;
            var session;
            var worker;
            
            before(function(done) {
                language.getWorker(function(err, result) {
                    worker = result;
                    done();
                });
            });
            
            // Setup
            beforeEach(function(done) {
                tabs.getTabs().forEach(function(tab) {
                    tab.close(true);
                });
                // tab.close() isn't quite synchronous, wait for it :(
                complete.closeCompletionBox();
                setTimeout(function() {
                    tabs.openFile("/test_broken.sh", function(err, _tab) {
                        if (err) return done(err);
                        tab = _tab;
                        session = tab.document.getSession().session;
                        expect(session).to.not.equal(null);
                        setTimeout(function() {
                            complete.closeCompletionBox();
                            done();
                        });
                    });
                });
            });
            
            it("shows syntax error markers for shell scripts", function beginTest(done) {
                // Wait for analysis to complete
                if (!session.getAnnotations().length)
                    return session.once("changeAnnotation", beginTest.bind(null, done));

                expect(session.getAnnotations()).to.have.length(1);
                done();
            });
            
            it.skip("shows syntax error markers for php scripts", function(done) {
                tabs.openFile("/test_broken.php", function(err, _tab) {
                    tab = _tab;
                    tabs.focusTab(tab);
                    session = tab.document.getSession().session;
                    
                    session.on("changeAnnotation", testAnnos);
                    testAnnos();
                    
                    function testAnnos() {
                        if (!session.getAnnotations().length)
                            return;
                        session.off("changeAnnotation", testAnnos);
                        done();
                    }
                });
            });
            
            it.skip("shows syntax error markers for go scripts", function(done) {
                tabs.openFile("/test_broken.go", function(err, _tab) {
                    tab = _tab;
                    tabs.focusTab(tab);
                    session = tab.document.getSession().session;
                    
                    session.on("changeAnnotation", testAnnos);
                    testAnnos();
                    
                    function testAnnos() {
                        if (!session.getAnnotations().length)
                            return;
                        session.off("changeAnnotation", testAnnos);
                        done();
                    }
                });
            });
            
            it.skip("shows syntax error markers for ruby scripts", function(done) {
                tabs.openFile("/test_broken.rb", function(err, _tab) {
                    tab = _tab;
                    tabs.focusTab(tab);
                    session = tab.document.getSession().session;
                    
                    session.on("changeAnnotation", testAnnos);
                    testAnnos();
                    
                    function testAnnos() {
                        if (!session.getAnnotations().length)
                            return;
                        session.off("changeAnnotation", testAnnos);
                        done();
                    }
                });
            });
            
            it('does completion without going to the server', function beginTest(done) {
                // Wait for analysis to complete
                if (!session.getAnnotations().length)
                    return session.once("changeAnnotation", beginTest.bind(null, done));
                    
                var callServer;
                worker.on("jsonalyzerCallServer", callServer = function() {
                    assert(false, "Server should not be called");
                });
                helpers.afterCompleteOpen(function(el) {
                    expect.html(el).text(/foo/);
                    worker.off("jsonalyzerCallServer", callServer);
                    done();
                });
                tab.editor.ace.selection.setSelectionRange({ start: { row: 1, column: 1 }, end: { row: 1, column: 1 }});
                complete.deferredInvoke(false, tab.editor.ace);
            });
        });
    });
});
