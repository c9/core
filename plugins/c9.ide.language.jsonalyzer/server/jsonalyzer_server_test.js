/*global describe it before after beforeEach*/

"use client";

require(["lib/architect/architect", "lib/chai/chai", "plugins/c9.ide.language/complete_util", "ace/test/assertions"], function (architect, chai, util, complete) {
    var expect = chai.expect;
    var assert = require("ace/test/assertions");

    util.setStaticPrefix("/static");
    
    expect.setupArchitectTest([
        {
            packagePath: "plugins/c9.core/c9",
            workspaceId: "ubuntu/ip-10-35-77-180",
            startdate: new Date(),
            debug: true,
            hosted: true,
            local: false,
            davPrefix: "/",
            staticPrefix: "/static"
        },
        
        "plugins/c9.core/ext",
        "plugins/c9.core/http-xhr",
        "plugins/c9.core/util",
        "plugins/c9.ide.ui/lib_apf",
        {
            packagePath: "plugins/c9.core/settings",
            testing: true
        },
        "plugins/c9.core/api.js",
        {
            packagePath: "plugins/c9.ide.ui/ui",
            staticPrefix: "plugins/c9.ide.ui"
        },
        "plugins/c9.ide.editors/document",
        "plugins/c9.ide.editors/undomanager",
        {
            packagePath: "plugins/c9.ide.editors/editors",
            defaultEditor: "ace"
        },
        "plugins/c9.ide.editors/editor",
        "plugins/c9.ide.editors/tabmanager",
        "plugins/c9.ide.ui/focus",
        "plugins/c9.ide.editors/pane",
        "plugins/c9.ide.editors/tab",
        {
            packagePath: "plugins/c9.ide.ace/ace",
            staticPrefix: "plugins/c9.ide.layout.classic"
        },
        {
            packagePath: "plugins/c9.ide.language/language",
            workspaceDir: "/"
        },
        "plugins/c9.ide.language/worker_util_helper",
        "plugins/c9.ide.language.core/keyhandler",
        "plugins/c9.ide.language.core/complete",
        "plugins/c9.ide.language.core/tooltip",
        "plugins/c9.ide.language.core/marker",
        "plugins/c9.ide.language.generic/generic",
        "plugins/c9.ide.language.css/css",
        "plugins/c9.ide.language.javascript/javascript",
        "plugins/c9.ide.language.javascript.infer/jsinfer",
        "plugins/c9.ide.keys/commands",
        "plugins/c9.fs/proc",
        "plugins/c9.vfs.client/vfs_client",
        "plugins/c9.vfs.client/endpoint",
        "plugins/c9.ide.auth/auth",
        "plugins/c9.fs/fs",
        "plugins/c9.ide.ui/menus",
        {
            packagePath: "plugins/c9.ide.immediate/immediate",
            staticPrefix: "plugins/c9.ide.layout.classic"
        },
        "plugins/c9.ide.language.javascript.immediate/immediate",
        "plugins/c9.ide.immediate/evaluator",
        "plugins/c9.ide.immediate/evaluators/browserjs",
        "plugins/c9.ide.console/console",
        "plugins/c9.ide.ace.statusbar/statusbar",
        "plugins/c9.ide.ace.gotoline/gotoline",
        "plugins/c9.ide.save/save",
        {
            packagePath: "plugins/c9.ide.language.jsonalyzer/jsonalyzer",
            bashBin: "bash",
            useCollab: false,
            useSend: true,
            homeDir: "~",
            workspaceDir: "/fake_root/",
        },
        "plugins/c9.ide.language.jsonalyzer/mock_collab",
        // "plugins/c9.ide.language.jsonalyzer/architect_resolver",
        
        // Mock plugins
        {
            consumes: ["apf", "ui", "Plugin"],
            provides: [
                "commands", "menus", "layout", "watcher", 
                "save", "preferences", "anims", "clipboard", "auth.bootstrap",
                "info", "dialog.error", "panels", "tree", "dialog.question",
                "dialog.alert"
            ],
            setup: expect.html.mocked
        },
        {
            consumes: [
                "tabManager",
                "ace",
                "Document",
                "language.keyhandler",
                "language.complete",
                "language"
            ],
            provides: [],
            setup: main
        }
    ], architect);
    
    function main(options, imports, register) {
        var tabs = imports.tabManager;
        var ace = imports.ace;
        var Document = imports.Document;
        var language = imports.language;
        var complete = imports["language.complete"];
        
        util.setStaticPrefix("/static");
        complete.$setShowDocDelay(50);
        
        function getTabHtml(tab) {
            return tab.pane.aml.getPage("editor::" + tab.editorType).$ext;
        }
        
        function afterCompleteOpen(callback) {
            setTimeout(function() {
                var el = document.getElementsByClassName("ace_autocomplete")[0];
                if (!el || el.style.display === "none")
                    return setTimeout(function() {
                         afterCompleteOpen(callback);
                    }, 1000);
                setTimeout(function() {
                    callback(el);
                }, 50);
            }, 50);
        }
        
        function afterCompleteDocOpen(callback) {
            setTimeout(function() {
                var el = document.getElementsByClassName("code_complete_doc_text")[0];
                if (!el || el.style.display === "none")
                    return afterCompleteDocOpen(callback);
                setTimeout(function() {
                    callback(el);
                }, 50);
            }, 50);
        }
        
        function isCompleterOpen() {
            var el = document.getElementsByClassName("ace_autocomplete")[0];
            return el && el.style.display === "none";
        }
        
        expect.html.setConstructor(function(tab) {
            if (typeof tab == "object")
                return getTabHtml(tab);
        });
        
        describe('ace', function() {
            this.timeout(30000);
            before(function(done) {
                apf.config.setProperty("allow-select", false);
                apf.config.setProperty("allow-blur", false);
                
                window.bar.$ext.style.background = "rgba(220, 220, 220, 0.93)";
                window.bar.$ext.style.position = "fixed";
                window.bar.$ext.style.left = "20px";
                window.bar.$ext.style.right = "20px";
                window.bar.$ext.style.bottom = "20px";
                window.bar.$ext.style.height = "33%";
      
                document.body.style.marginBottom = "33%";
                
                tabs.on("ready", function() {
                    tabs.getPanes()[0].focus();
                    done();
                });
            });
            
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
                
                it("shows syntax error markers for php scripts", function(done) {
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
                
                it("shows syntax error markers for go scripts", function(done) {
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
                
                it("shows syntax error markers for ruby scripts", function(done) {
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
                    afterCompleteOpen(function(el) {
                        expect.html(el).text(/foo/);
                        worker.off("jsonalyzerCallServer", callServer);
                        done();
                    });
                    tab.editor.ace.selection.setSelectionRange({ start: { row: 1, column: 1 }, end: { row: 1, column: 1 }});
                    complete.deferredInvoke(false, tab.editor.ace);
                });
            });
        });
        
        onload && onload();
    }
});
