/*global describe it before after beforeEach*/

"use client";


require(["lib/architect/architect", "lib/chai/chai", "plugins/c9.ide.language/complete_util", "assert"], function (architect, chai, util, complete) {
    var expect = chai.expect;
    var assert = require("assert");
    
    util.setStaticPrefix("/static");
    
    expect.setupArchitectTest(window.plugins = [
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
        "plugins/c9.ide.language.core/keyhandler",
        "plugins/c9.ide.language/worker_util_helper",
        "plugins/c9.ide.language.core/complete",
        "plugins/c9.ide.language.core/tooltip",
        "plugins/c9.ide.language.core/marker",
        "plugins/c9.ide.language.generic/generic",
        "plugins/c9.ide.language.css/css",
        "plugins/c9.ide.language.javascript/javascript",
        "plugins/c9.ide.language.javascript.infer/jsinfer",
        {
            packagePath: "plugins/c9.ide.language.javascript.tern/tern",
            defs: [],
            plugins: [
                {
                    name: "doc_comment",
                    path: "tern/plugin/doc_comment",
                    enabled: true,
                    hidden: true,
                },
                {
                    name: "node",
                    path: "tern/plugin/node",
                    enabled: true,
                    hidden: false,
                },
                {
                    name: "requirejs",
                    path: "tern/plugin/requirejs",
                    enabled: true,
                    hidden: false,
                },
                {
                    name: "architect_resolver",
                    path: "./architect_resolver_worker",
                    enabled: true,
                    hidden: true,
                },
            ],
        },
        "plugins/c9.ide.language.javascript.tern/architect_resolver",
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
        
        var timer;
        after(function() { clearTimeout(timer); });
        
        function getTabHtml(tab) {
            return tab.pane.aml.getPage("editor::" + tab.editorType).$ext;
        }
        
        function afterCompleteOpen(callback, delay) {
            clearTimeout(timer);
            timer = setTimeout(function() {
                var el = document.getElementsByClassName("ace_autocomplete")[0];
                if (!el || el.style.display === "none")
                    return afterCompleteOpen(callback, 100);
                timer = setTimeout(function() {
                    callback(el);
                }, 5);
            }, delay || 5);
        }
        
        function afterCompleteDocOpen(callback, delay) {
            timer = setTimeout(function() {
                var el = document.getElementsByClassName("code_complete_doc_text")[0];
                if (!el || el.style.display === "none")
                    return afterCompleteDocOpen(callback);
                timer = setTimeout(function() {
                    callback(el);
                }, 5);
            }, delay || 5);
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
            this.timeout(20000);
            
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
                
                tabs.once("ready", function() {
                    tabs.getPanes()[0].focus();
                    done();
                });
            });
            
            describe("architect_resolver", function() {
                var jsTab;
                var jsSession;
                
                // Setup
                beforeEach(setup);
                
                before(function(done) {
                    setup(function() {
                        // Trigger intialization
                        jsTab.editor.ace.onTextInput("m");
                        afterCompleteOpen(function(el) {
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
                                done();
                            });
                        });
                    }, 500);
                }
                
                it('shows an inference completer popup for a local architect module', function(done) {
                    jsTab.editor.ace.onTextInput("my");
                    afterCompleteOpen(function(el) {
                        expect.html(el).text(/myplugin/);
                        done();
                    });
                });
                
                it('shows an completer popup for a non-local architect module', function(done) {
                    jsTab.editor.ace.onTextInput("P");
                    afterCompleteOpen(function(el) {
                        expect.html(el).text(/Plugin/);
                        done();
                    });
                });
                
                it('shows a documentation popup for non-local architect functions', function(done) {
                    jsTab.editor.ace.onTextInput("Plugin");
                    jsTab.editor.ace.onTextInput(".");
                    afterCompleteDocOpen(function(el) {
                        expect.html(el).text(/so bogus/);
                        done();
                    });
                });
                
                it('shows a completion indirect import references', function(done) {
                    jsTab.editor.ace.onTextInput("Plugin;\nPlugin");
                    jsTab.editor.ace.onTextInput(".");
                    afterCompleteDocOpen(function(el) {
                        expect.html(el).text(/so bogus/);
                        done();
                    });
                });
                
                it('shows types for a non-local architect function', function(done) {
                    jsTab.editor.ace.onTextInput("Plugin");
                    jsTab.editor.ace.onTextInput(".");
                    afterCompleteDocOpen(function(el) {
                        expect.html(el).text(/s : string/);
                        done();
                    });
                });
                
                it('shows a documentation popup for modules', function(done) {
                    jsTab.editor.ace.onTextInput("Pl");
                    afterCompleteDocOpen(function(el) {
                        expect.html(el).text(/dummy[\s\S]*documentation/);
                        assert(!el.textContent.match(/\*/));
                        done();
                    });
                });
                
                it('shows module name completions for imports', function(done) {
                    jsTab.editor.ace.onTextInput('main.consumes = ["u');
                    afterCompleteOpen(function(el) {
                        expect.html(el).text(/ui/);
                        done();
                    });
                });
            });
        });
        
        onload && onload();
    }
});
