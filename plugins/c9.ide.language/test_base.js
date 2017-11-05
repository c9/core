define(function(require, exports, module) {
    var architect = require("lib/architect/architect");
    var chai = require("lib/chai/chai");
    var expect = chai.expect;
    var assert = require("assert");
    var complete_util = require("plugins/c9.ide.language/complete_util");
    complete_util.setStaticPrefix("/static");
    
    module.exports.setup = function(callback) {
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
            "plugins/c9.ide.language.javascript.eslint/eslint",
            "plugins/c9.ide.language.javascript.infer/jsinfer",
            {
                packagePath: "plugins/c9.ide.language.codeintel/codeintel",
                paths: [],
            },
            {
                packagePath: "plugins/c9.ide.language.python/python",
                testing: true,
            },
            {
                packagePath: "plugins/c9.ide.language.javascript.tern/tern",
                plugins: [
                    {
                        name: "angular",
                        path: "tern/plugin/angular",
                        enabled: true,
                        hidden: false,
                    },
                    {
                        name: "doc_comment",
                        path: "tern/plugin/doc_comment",
                        enabled: true,
                        hidden: true,
                    },
                    {
                        name: "es_modules",
                        path: "tern/plugin/es_modules",
                        enabled: true,
                        hidden: true,
                    },
                    {
                        name: "modules",
                        path: "tern/plugin/modules",
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
                defs: [{
                    name: "ecma5",
                    enabled: true,
                    experimental: false,
                    firstClass: true,
                    path: "lib/tern/defs/ecma5.json"
                }, {
                    name: "jQuery",
                    enabled: true,
                    experimental: false,
                    path: "lib/tern/defs/jquery.json"
                }, {
                    name: "browser",
                    enabled: true,
                    experimental: false,
                    firstClass: true,
                    path: "lib/tern/defs/browser.json"
                }, {
                    name: "underscore",
                    enabled: false,
                    experimental: false,
                    path: "lib/tern/defs/underscore.json"
                }, {
                    name: "chai",
                    enabled: false,
                    experimental: false,
                    path: "lib/tern/defs/chai.json"
                }]
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
            {
                packagePath: "plugins/c9.ide.language.jsonalyzer/jsonalyzer",
                bashBin: "bash",
                useCollab: false,
                useSend: true,
                homeDir: "~",
                workspaceDir: "/fake_root/",
            },
            "plugins/c9.ide.language.jsonalyzer/mock_collab",
            
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
            var language = imports.language;
            var complete = imports["language.complete"];
            var timer;
            var completionCalls;
            var predictionCalls;
            
            complete.$setShowDocDelay(50);
            
            after(function() { clearTimeout(timer); });
            
            function getTabHtml(tab) {
                return tab.pane.aml.getPage("editor::" + tab.editorType).$ext;
            }
            
            expect.html.setConstructor(function(tab) {
                if (typeof tab == "object")
                    return getTabHtml(tab);
            });
            
            describe("tests", function() {
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
                    
                    tabs.once("ready", function() {
                        tabs.getPanes()[0].focus();
                        done();
                    });
                });
                
                before(function(done) {
                    language.getWorker(function(err, worker) {
                        if (err) return done(err);
                        imports.worker = worker;
                        language.registerLanguageHandler(
                            "plugins/c9.ide.language/language_test_helper",
                            function(err, handler) {
                                if (err) return done(err);
                                imports.testHandler = handler;
                                handler.on("complete_called", function() {
                                    completionCalls++;
                                });
                                handler.on("complete_predict_called", function() {
                                    predictionCalls++;
                                });
                                done();
                            }
                        );
                    });
                });
                
                beforeEach(function() {
                    completionCalls = predictionCalls = 0;
                });
            
                callback(null, imports, {
                    afterNoCompleteOpen: afterNoCompleteOpen,
                    afterCompleteDocOpen: afterCompleteDocOpen,
                    afterCompleteOpen: afterCompleteOpen,
                    isCompleterOpen: isCompleterOpen,
                    getCompletionCalls: function() {
                        return completionCalls;
                    },
                    getPredictionCalls: function() {
                        return predictionCalls;
                    },
                });
            });
    
            function afterNoCompleteOpen(callback) {
                imports.worker.once("complete", function(e) {
                    assert(!e.data.matches.length, "Completion opened");
                    callback();
                });
            }
            
            function afterCompleteOpen(callback, delay) {
                complete.once("showPopup", function(e) {
                    e.popup.resize(true);
                    var el = document.querySelector(".ace_autocomplete");
                    callback(el);
                });
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
                
            window.onload && window.onload();
        }
    };
});