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
            
            it('shows a word completer popup on keypress', function(done) {
                jsSession.setValue("conny; con");
                jsTab.editor.ace.selection.setSelectionRange({ start: { row: 1, column: 0 }, end: { row: 1, column: 0 }});
                jsTab.editor.ace.onTextInput("n");
                afterCompleteOpen(function(el) {
                    expect.html(el).text(/conny/);
                    done();
                });
            });
            
            it('shows a word completer popup for things in comments', function(done) {
                jsSession.setValue("// conny\nco");
                jsTab.editor.ace.selection.setSelectionRange({ start: { row: 2, column: 0 }, end: { row: 2, column: 0 }});
                jsTab.editor.ace.onTextInput("n");
                afterCompleteOpen(function(el) {
                    expect.html(el).text(/conny/);
                    done();
                });
            });
            
            it('shows an inference completer popup on keypress', function(done) {
                jsSession.setValue("console.");
                jsTab.editor.ace.selection.setSelectionRange({ start: { row: 1, column: 0 }, end: { row: 1, column: 0 }});
                jsTab.editor.ace.onTextInput("l");
                afterCompleteOpen(function(el) {
                    expect.html(el).text(/log\(/);
                    done();
                });
            });
            
            it('always does dot completion', function(done) {
                language.setContinuousCompletionEnabled(false);
                jsSession.setValue("console");
                jsTab.editor.ace.selection.setSelectionRange({ start: { row: 1, column: 0 }, end: { row: 1, column: 0 }});
                jsTab.editor.ace.onTextInput(".");
                afterCompleteOpen(function(el) {
                    expect.html(el).text(/log\(/);
                    language.setContinuousCompletionEnabled(true);
                    done();
                });
            });
            
            it('shows a documentation popup in completion', function(done) {
                jsSession.setValue("console.");
                jsTab.editor.ace.selection.setSelectionRange({ start: { row: 1, column: 0 }, end: { row: 1, column: 0 }});
                jsTab.editor.ace.onTextInput("l");
                afterCompleteDocOpen(function(el) {
                    expect.html(el).text(/Outputs a message/);
                    done();
                });
            });
            
            it('shows a word completer in an immediate tab', function(done) {
                tabs.open(
                    {
                        active: true,
                        editorType: "immediate"
                    },
                    function(err, tab) {
                        if (err) return done(err);
                        
                        // We get a tab, but it's not done yet, so we wait
                        setTimeout(function() {
                            expect(!isCompleterOpen());
                            tab.editor.ace.onTextInput("conny con");
                            expect(!isCompleterOpen());
                            tab.editor.ace.onTextInput("n");
                            afterCompleteOpen(function(el) {
                                expect.html(el).text(/conny/);
                                done();
                            });
                        });
                    }
                );
            });
            
            it('shows an immediate completer in an immediate tab', function(done) {
                tabs.open(
                    {
                        active: true,
                        editorType: "immediate"
                    },
                    function(err, tab) {
                        if (err) return done(err);
                        
                        // We get a tab, but it's not done yet, so we wait
                        setTimeout(function() {
                            tab.editor.ace.onTextInput("window.a");
                            tab.editor.ace.onTextInput("p");
                            afterCompleteOpen(function(el) {
                                expect.html(el).text(/applicationCache/);
                                done();
                            });
                        });
                    }
                );
            });
            
            it("doesn't show a word completer when there are contextual completions", function(done) {
                jsSession.setValue("// logaritm\nconsole.");
                jsTab.editor.ace.selection.setSelectionRange({ start: { row: 2, column: 0 }, end: { row: 2, column: 0 }});
                jsTab.editor.ace.onTextInput("l");
                afterCompleteOpen(function(el) {
                    assert(!el.textContent.match(/logarithm/));
                    done();
                });
            });
            
            it("completes with parentheses insertion", function(done) {
                jsSession.setValue("// logaritm\nconsole.");
                jsTab.editor.ace.selection.setSelectionRange({ start: { row: 2, column: 0 }, end: { row: 2, column: 0 }});
                jsTab.editor.ace.onTextInput("l");
                afterCompleteOpen(function(el) {
                    jsTab.editor.ace.keyBinding.onCommandKey({ preventDefault: function() {} }, 0, 13);
                    setTimeout(function() {
                        assert(jsSession.getValue().match(/console.log\(\)/));
                        done();
                    });
                });
            });
            
            it("completes local functions with parentheses insertion", function(done) {
                jsSession.setValue('function foobar() {}\nfoo');
                jsTab.editor.ace.selection.setSelectionRange({ start: { row: 2, column: 0 }, end: { row: 2, column: 0 }});
                jsTab.editor.ace.onTextInput("b");
                afterCompleteOpen(function(el) {
                    jsTab.editor.ace.keyBinding.onCommandKey({ preventDefault: function() {} }, 0, 13);
                    setTimeout(function() {
                        assert(jsSession.getValue().match(/foobar\(\)/));
                        done();
                    });
                });
            });
            
            it("completes without parentheses insertion in strings", function(done) {
                jsSession.setValue('function foobar() {}\n\"foo');
                jsTab.editor.ace.selection.setSelectionRange({ start: { row: 2, column: 0 }, end: { row: 2, column: 0 }});
                jsTab.editor.ace.onTextInput("b");
                afterCompleteOpen(function(el) {
                    jsTab.editor.ace.keyBinding.onCommandKey({ preventDefault: function() {} }, 0, 13);
                    setTimeout(function() {
                        assert(jsSession.getValue().match(/"foobar/));
                        assert(!jsSession.getValue().match(/"foobar\(\)/));
                        done();
                    });
                });
            });
            
            it("completes following local dependencies", function(done) {
                jsSession.setValue('var test2 = require("./test2.js");\ntest2.');
                jsTab.editor.ace.selection.setSelectionRange({ start: { row: 2, column: 0 }, end: { row: 2, column: 0 }});
                jsTab.editor.ace.onTextInput("h");
                afterCompleteOpen(function(el) {
                    assert(el.textContent.match(/hoi/));
                    done();
                });
            });
            
            it("completes following local with absolute paths", function(done) {
                jsSession.setValue('var ext = require("plugins/c9.dummy/dep");\next.');
                jsTab.editor.ace.selection.setSelectionRange({ start: { row: 2, column: 0 }, end: { row: 2, column: 0 }});
                jsTab.editor.ace.onTextInput("e");
                afterCompleteOpen(function(el) {
                    assert(el.textContent.match(/export3/));
                    assert(el.textContent.match(/export4/));
                    done();
                });
            });
            
            it("completes following local dependencies with absolute paths and common js style exports", function(done) {
                jsSession.setValue('var ext = require("plugins/c9.dummy/dep-define");\next.');
                jsTab.editor.ace.selection.setSelectionRange({ start: { row: 2, column: 0 }, end: { row: 2, column: 0 }});
                jsTab.editor.ace.onTextInput("e");
                afterCompleteOpen(function(el) {
                    assert(el.textContent.match(/export1/));
                    assert(el.textContent.match(/export2/));
                    done();
                });
            });
            
            it("doesn't show default browser properties like onabort for global completions", function(done) {
                jsSession.setValue('// function onlyShowMe() {}; \no');
                jsTab.editor.ace.selection.setSelectionRange({ start: { row: 2, column: 0 }, end: { row: 2, column: 0 }});
                jsTab.editor.ace.onTextInput("n");
                afterCompleteOpen(function(el) {
                    assert(!el.textContent.match(/onabort/));
                    done();
                });
            });
            
            it("shows default browser properties like onabort when 3 characters were typed", function(done) {
                jsSession.setValue('// function onlyShowMeAndMore() {};\non');
                jsTab.editor.ace.selection.setSelectionRange({ start: { row: 2, column: 0 }, end: { row: 2, column: 0 }});
                jsTab.editor.ace.onTextInput("a");
                afterCompleteOpen(function(el) {
                    assert(el.textContent.match(/onabort/));
                    done();
                });
            });
            
            it("shows no self-completion for 'var bre'", function(done) {
                jsSession.setValue('var ');
                jsTab.editor.ace.selection.setSelectionRange({ start: { row: 2, column: 0 }, end: { row: 2, column: 0 }});
                jsTab.editor.ace.onTextInput("bre");
                afterCompleteOpen(function(el) {
                    assert(!el.textContent.match(/bre\b/));
                    assert(el.textContent.match(/break/));
                    done();
                });
            });
            
            it("shows word completion for 'var b'", function(done) {
                jsSession.setValue('// blie\nvar ');
                jsTab.editor.ace.selection.setSelectionRange({ start: { row: 2, column: 0 }, end: { row: 2, column: 0 }});
                jsTab.editor.ace.onTextInput("b");
                afterCompleteOpen(function(el) {
                    assert(el.textContent.match(/blie/));
                    done();
                });
            });
            
            it("shows word completion for 'var bre'", function(done) {
                jsSession.setValue('// breedbeeld\nvar ');
                jsTab.editor.ace.selection.setSelectionRange({ start: { row: 2, column: 0 }, end: { row: 2, column: 0 }});
                jsTab.editor.ace.onTextInput("bre");
                afterCompleteOpen(function(el) {
                    assert(el.textContent.match(/breedbeeld/));
                    done();
                });
            });
            
            it("shows no self-completion for 'function blie'", function(done) {
                jsSession.setValue('function bli');
                jsTab.editor.ace.selection.setSelectionRange({ start: { row: 2, column: 0 }, end: { row: 2, column: 0 }});
                jsTab.editor.ace.onTextInput("e");
                afterNoCompleteOpen(done);
            });
            
            it("shows no completion for 'function blie(param'", function(done) {
                jsSession.setValue('function blie(para');
                jsTab.editor.ace.selection.setSelectionRange({ start: { row: 2, column: 0 }, end: { row: 2, column: 0 }});
                jsTab.editor.ace.onTextInput("m");
                afterNoCompleteOpen(done);
            });
            
            it.skip("shows word completion for 'function blie(param'", function(done) {
                jsSession.setValue('function parametric() {}\nfunction blie(para');
                jsTab.editor.ace.selection.setSelectionRange({ start: { row: 2, column: 0 }, end: { row: 2, column: 0 }});
                jsTab.editor.ace.onTextInput("m");
                afterCompleteOpen(function(el) {
                    assert(!el.textContent.match(/parapara/));
                    assert(el.textContent.match(/parametric/));
                    done();
                });
            });
            
            it("shows no self-completion for 'x={ prop'", function(done) {
                jsSession.setValue('x={ pro');
                jsTab.editor.ace.selection.setSelectionRange({ start: { row: 2, column: 0 }, end: { row: 2, column: 0 }});
                jsTab.editor.ace.onTextInput("p");
                afterNoCompleteOpen(done);
            });
            
            it("shows no function completion for 'x={ prop: 2 }'", function(done) {
                jsSession.setValue('function propAccess() {}\nx={ pro: 2 }');
                jsTab.editor.ace.selection.setSelectionRange({ start: { row: 1, column: 7 }, end: { row: 1, column: 7 }});
                jsTab.editor.ace.onTextInput("p");
                afterCompleteOpen(function(el) {
                    assert(!el.textContent.match(/propAccess\(\)/));
                    assert(el.textContent.match(/propAccess/));
                    done();
                });
            });
            
            it("shows completion for '{ prop: fo'", function(done) {
                jsSession.setValue('function foo() {}\n{ prop: f');
                jsTab.editor.ace.selection.setSelectionRange({ start: { row: 2, column: 0 }, end: { row: 2, column: 0 }});
                jsTab.editor.ace.onTextInput("o");
                afterCompleteOpen(function(el) {
                    assert(el.textContent.match(/foo\(\)/));
                    done();
                });
            });
            
            it("extracts types from comments", function(done) {
                jsSession.setValue('/**\ndocs be here\n@param {String} text\n*/\nfunction foo(text) {}\nf');
                jsTab.editor.ace.selection.setSelectionRange({ start: { row: 10, column: 0 }, end: { row: 10, column: 0 }});
                jsTab.editor.ace.onTextInput("o");

                afterCompleteOpen(function(el) {
                    assert(el.textContent.match(/foo\(text\)/));
                    afterCompleteDocOpen(function(el) {
                        assert(el.textContent.match(/string/i));
                        assert(el.textContent.match(/docs/i));
                        done();
                    });
                });
            });
            
            it("caches across expression prefixes", function(done) {
                jsSession.setValue("_collin; _c");
                jsTab.editor.ace.selection.setSelectionRange({ start: { row: 1, column: 0 }, end: { row: 1, column: 0 }});
                jsTab.editor.ace.onTextInput("o");
                afterCompleteOpen(function(el) {
                    assert.equal(getCompletionCalls(), 1);
                    complete.closeCompletionBox();
                    jsTab.editor.ace.selection.setSelectionRange({ start: { row: 1, column: 0 }, end: { row: 1, column: 0 }});
                    jsTab.editor.ace.onTextInput("rry _co");
                    afterCompleteOpen(function(el) {
                        assert.equal(getCompletionCalls(), 1);
                        // Normally typing "_corry _c" would show "_corry" in the completion,
                        // but since JavaScript is supposed to have a getCacheCompletionRegex set,
                        // a cached results should be used that doesn't have "_corry" yet
                        assert(!el.textContent.match(/_corry/));
                        assert(el.textContent.match(/_collin/));
                        done();
                    });
                });
            });
            
            it("caches across expression prefixes, including 'if(' and 'if ('", function(done) {
                jsSession.setValue("b_collin; b_c");
                jsTab.editor.ace.selection.setSelectionRange({ start: { row: 1, column: 0 }, end: { row: 1, column: 0 }});
                jsTab.editor.ace.onTextInput("o");
                afterCompleteOpen(function(el) {
                    assert.equal(getCompletionCalls(), 1);
                    complete.closeCompletionBox();
                    jsTab.editor.ace.selection.setSelectionRange({ start: { row: 1, column: 0 }, end: { row: 1, column: 0 }});
                    jsTab.editor.ace.onTextInput("rry if(if (b_co");
                    afterCompleteOpen(function(el) {
                        assert.equal(getCompletionCalls(), 1);
                        assert(el.textContent.match(/b_corry/)); // local_completer secretly ran a second time
                        assert(el.textContent.match(/b_collin/));
                        done();
                    });
                });
            });
            
            it("doesn't cache across expression prefixes in assigments", function(done) {
                jsSession.setValue("_collin; _c");
                jsTab.editor.ace.selection.setSelectionRange({ start: { row: 1, column: 0 }, end: { row: 1, column: 0 }});
                jsTab.editor.ace.onTextInput("o");
                afterCompleteOpen(function(el) {
                    assert.equal(getCompletionCalls(), 1);
                    complete.closeCompletionBox();
                    jsTab.editor.ace.selection.setSelectionRange({ start: { row: 1, column: 0 }, end: { row: 1, column: 0 }});
                    jsTab.editor.ace.onTextInput("rry=_co");
                    afterCompleteOpen(function(el) {
                        assert.equal(getCompletionCalls(), 2);
                        assert(el.textContent.match(/_corry/));
                        assert(el.textContent.match(/_collin/));
                        done();
                    });
                });
            });
            
            it("doesn't cache with expression prefixes based on function names or params", function(done) {
                jsSession.setValue("ffarg; function ");
                jsTab.editor.ace.selection.setSelectionRange({ start: { row: 1, column: 0 }, end: { row: 1, column: 0 }});
                jsTab.editor.ace.onTextInput("ff");
                afterCompleteOpen(function(el) {
                    assert.equal(getCompletionCalls(), 1);
                    assert(el.textContent.match(/ffarg/));
                    complete.closeCompletionBox();
                    jsTab.editor.ace.selection.setSelectionRange({ start: { row: 1, column: 0 }, end: { row: 1, column: 0 }});
                    jsTab.editor.ace.onTextInput("oo(ff");
                    afterCompleteOpen(function(el) {
                        assert.equal(getCompletionCalls(), 2);
                        // cache got cleared so we have farg here now
                        assert(el.textContent.match(/ffoo/));
                        assert(el.textContent.match(/ffarg/));
                        complete.closeCompletionBox();
                        jsTab.editor.ace.selection.setSelectionRange({ start: { row: 1, column: 0 }, end: { row: 1, column: 0 }});
                        jsTab.editor.ace.onTextInput("ort) ff");
                        afterCompleteOpen(function(el) {
                            assert.equal(getCompletionCalls(), 3);
                            // cache got cleared so we have fort here now
                            assert(el.textContent.match(/ffoo/));
                            assert(el.textContent.match(/ffort/));
                            assert(el.textContent.match(/ffarg/));
                            done();
                        });
                    });
                });
            });
            
            it("doesn't do prefix-caching outside of a function context", function(done) {
                jsSession.setValue("function foo() { ");
                jsTab.editor.ace.selection.setSelectionRange({ start: { row: 1, column: 0 }, end: { row: 1, column: 0 }});
                jsTab.editor.ace.onTextInput("f");
                afterCompleteOpen(function(el) {
                    assert.equal(getCompletionCalls(), 1);
                    complete.closeCompletionBox();
                    jsTab.editor.ace.selection.setSelectionRange({ start: { row: 1, column: 0 }, end: { row: 1, column: 0 }});
                    jsTab.editor.ace.onTextInput("} f");
                    afterCompleteOpen(function(el) {
                        assert.equal(getCompletionCalls(), 2);
                        done();
                    });
                });
            });
            
            it("doesn't do prefix-caching after property access", function(done) {
                jsSession.setValue("console.l");
                jsTab.editor.ace.selection.setSelectionRange({ start: { row: 1, column: 0 }, end: { row: 1, column: 0 }});
                jsTab.editor.ace.onTextInput("o");
                afterCompleteOpen(function(el) {
                    assert.equal(getCompletionCalls(), 1);
                    complete.closeCompletionBox();
                    jsTab.editor.ace.selection.setSelectionRange({ start: { row: 1, column: 0 }, end: { row: 1, column: 0 }});
                    jsTab.editor.ace.onTextInput("g c");
                    afterCompleteOpen(function(el) {
                        assert(el.textContent.match(/console/), el.textContent);
                        assert.equal(getCompletionCalls(), 2, "Should refetch after property access: " + getCompletionCalls());
                        done();
                    });
                });
            });
            
            it.skip('predicts console.log() when typing just consol', function(done) {
                jsSession.setValue("conso");
                jsTab.editor.ace.selection.setSelectionRange({ start: { row: 1, column: 0 }, end: { row: 1, column: 0 }});
                jsTab.editor.ace.onTextInput("l");
                imports.worker.once("complete_predict_called", function() {
                    assert.equal(getCompletionCalls(), 1);
                    afterCompleteOpen(function retry(el) {
                        assert.equal(getCompletionCalls(), 1);
                        if (!el.textContent.match(/log/))
                            return afterCompleteOpen(retry);
                        done();
                    });
                });
            });
            
            it('shows the current identifier as the top result', function(done) {
                jsSession.setValue("concat; conso; cons");
                jsTab.editor.ace.selection.setSelectionRange({ start: { row: 1, column: 0 }, end: { row: 1, column: 0 }});
                jsTab.editor.ace.onTextInput("o");
                afterCompleteOpen(function(el) {
                    assert.equal(getCompletionCalls(), 1);
                    assert(el.textContent.match(/conso(?!l).*console/));
                    done();
                });
            });
            
            it('shows the current identifier as the top result, and removes it as you keep typing', function(done) {
                jsSession.setValue("2; concat; conso; cons");
                jsTab.editor.ace.selection.setSelectionRange({ start: { row: 1, column: 0 }, end: { row: 1, column: 0 }});
                jsTab.editor.ace.onTextInput("o");
                afterCompleteOpen(function(el) {
                    assert.equal(getCompletionCalls(), 1);
                    assert(el.textContent.match(/conso(?!l).*console/));

                    complete.closeCompletionBox();
                    jsTab.editor.ace.selection.setSelectionRange({ start: { row: 1, column: 0 }, end: { row: 1, column: 0 }});
                    jsTab.editor.ace.onTextInput("l");
                    afterCompleteOpen(function(el) {
                        assert.equal(getCompletionCalls(), 1);
                        assert(!el.textContent.match(/conso(?!l)/));
                        assert(el.textContent.match(/console/));
                        done();
                    });
                });
            });
            
            it("doesn't assume undeclared vars are functions", function(done) {
                jsSession.setValue('window[imUndefined] = function(json) {};\n\
                    var unassigned;\n\
                    ');
                jsTab.editor.ace.selection.setSelectionRange({ start: { row: 10, column: 0 }, end: { row: 10, column: 0 }});
                jsTab.editor.ace.onTextInput("u");
                afterCompleteOpen(function(el) {
                    assert(el.textContent.match(/unassigned/));
                    assert(!el.textContent.match(/unassigned\(/));
                    done();
                });
            });
            
            it("doesn't assume arrays are optional", function(done) {
                jsSession.setValue('function myFun(arr){}\nvar a = []\nmyFun(a)\nmyF');
                jsTab.editor.ace.selection.setSelectionRange({ start: { row: 10, column: 0 }, end: { row: 10, column: 0 }});
                jsTab.editor.ace.onTextInput("u");
                afterCompleteDocOpen(function(el) {
                    assert(el.textContent.match(/myFun\(arr.*Array/));
                    done();
                });
            });
            
            it.skip("completes php variables in short php escapes", function(done) {
                tabs.openFile("/test_broken.php", function(err, _tab) {
                    if (err) return done(err);
                    var tab = _tab;
                    tabs.focusTab(tab);
                    var session = tab.document.getSession().session;
                    
                    session.setValue("<?php $foo = 1;  ?>");
                    tab.editor.ace.selection.setSelectionRange({ start: { row: 0, column: 16 }, end: { row: 0, column: 16 }});
                    tab.editor.ace.onTextInput("$");
                    afterCompleteOpen(function(el) {
                        complete.closeCompletionBox();
                        tab.editor.ace.onTextInput("f");
                        afterCompleteOpen(function(el) {
                            assert(el.textContent.match(/foo/));
                            done();
                        });
                    });
                });
            });
            
            it.skip("completes php variables in long files", function(done) {
                tabs.openFile("/test_broken.php", function(err, _tab) {
                    if (err) return done(err);
                    var tab = _tab;
                    tabs.focusTab(tab);
                    var session = tab.document.getSession().session;
                    
                    var value = "<?php\n\n";
                    for (var i = 0; i < 1000; i++) {
                        value += "$foo_" + i + " = 42;\n";
                    }
                    value = value + "?>";
                    session.setValue(value);
                    
                    tab.editor.ace.selection.setSelectionRange({ start: { row: 1, column: 0 }, end: { row: 1, column: 0 }});
                    tab.editor.ace.onTextInput("$");
                    afterCompleteOpen(function(el) {
                        complete.closeCompletionBox();
                        tab.editor.ace.onTextInput("foo_99");
                        afterCompleteOpen(function(el) {
                            assert(el.textContent.match(/foo_991/));
                            done();
                        });
                    });
                });
            });
            
            it('starts predicting a completion immediately after an assignment', function(done) {
                // We expect this behavior as infer_completer's predictNextCompletion()
                // tells worker we need completion here.
                jsSession.setValue("foo ");
                jsTab.editor.ace.selection.setSelectionRange({ start: { row: 1, column: 0 }, end: { row: 1, column: 0 }});
                jsTab.editor.ace.onTextInput("=");
                
                imports.testHandler.once("complete_called", function() {
                    assert.equal(getCompletionCalls(), 1);
                    jsTab.editor.ace.onTextInput(" ");
                    // Wait and see if this triggers anything
                    setTimeout(function() {
                        jsTab.editor.ace.onTextInput("f");
                        
                        afterCompleteOpen(function(el) {
                            assert.equal(getCompletionCalls(), 1);
                            assert(el.textContent.match(/foo/));
                            done();
                        });
                    }, 5);
                });
            });
            
            it.skip('just invokes completion once for "v1 + 1 == v2 + v"', function(done) {
                jsSession.setValue("var v1; ");
                jsTab.editor.ace.selection.setSelectionRange({ start: { row: 1, column: 0 }, end: { row: 1, column: 0 }});
                jsTab.editor.ace.onTextInput("v");
                afterCompleteOpen(function(el) {
                    complete.closeCompletionBox();
                    jsTab.editor.ace.onTextInput("1");
                    jsTab.editor.ace.onTextInput(" ");
                    jsTab.editor.ace.onTextInput("+");
                    jsTab.editor.ace.onTextInput(" ");
                    jsTab.editor.ace.onTextInput("1");
                    jsTab.editor.ace.onTextInput(" ");
                    jsTab.editor.ace.onTextInput("=");
                    jsTab.editor.ace.onTextInput("=");
                    jsTab.editor.ace.onTextInput(" ");
                    jsTab.editor.ace.onTextInput("v");
                    afterCompleteOpen(function(el) {
                        complete.closeCompletionBox();
                        jsTab.editor.ace.onTextInput("2");
                        jsTab.editor.ace.onTextInput(" ");
                        jsTab.editor.ace.onTextInput("+");
                        jsTab.editor.ace.onTextInput(" ");
                        jsTab.editor.ace.onTextInput("v");
                        afterCompleteOpen(function(el) {
                            assert.equal(getCompletionCalls(), 1);
                            done();
                        });
                    });
                });
            });
            
            it.skip('just invokes completion once for "x1 + 1 == x2 + x", with some timeouts', function(done) {
                jsSession.setValue("var x1; ");
                jsTab.editor.ace.selection.setSelectionRange({ start: { row: 1, column: 0 }, end: { row: 1, column: 0 }});
                jsTab.editor.ace.onTextInput("x");
                afterCompleteOpen(function(el) {
                    jsTab.editor.ace.onTextInput("1");
                    jsTab.editor.ace.onTextInput(" ");
                    // Allow prediction to be triggered
                    setTimeout(function() {
                        jsTab.editor.ace.onTextInput("+");
                        // Allow prediction to be triggered
                        setTimeout(function() {
                            jsTab.editor.ace.onTextInput(" ");
                            jsTab.editor.ace.onTextInput("1");
                            jsTab.editor.ace.onTextInput(" ");
                            jsTab.editor.ace.onTextInput("=");
                            jsTab.editor.ace.onTextInput("=");
                            // Allow prediction to be triggered
                            setTimeout(function() {
                                jsTab.editor.ace.onTextInput(" ");
                                jsTab.editor.ace.onTextInput("x");
                                afterCompleteOpen(function(el) {
                                    complete.closeCompletionBox();
                                    jsTab.editor.ace.onTextInput("2");
                                    jsTab.editor.ace.onTextInput(" ");
                                    jsTab.editor.ace.onTextInput("+");
                                    jsTab.editor.ace.onTextInput(" ");
                                    jsTab.editor.ace.onTextInput("x");
                                    afterCompleteOpen(function(el) {
                                        assert.equal(getCompletionCalls(), 1);
                                        done();
                                    });
                                });
                            }, 5);
                        }, 5);
                    }, 5);
                });
            });
            
            it('calls completion twice for "var y; ...", "var v; ..."', function(done) {
                jsSession.setValue("var y1; ");
                jsTab.editor.ace.selection.setSelectionRange({ start: { row: 1, column: 0 }, end: { row: 1, column: 0 }});
                jsTab.editor.ace.onTextInput("y");
                afterCompleteOpen(function(el) {
                    complete.closeCompletionBox();
                    jsSession.setValue("var v1; ");
                    jsTab.editor.ace.selection.setSelectionRange({ start: { row: 1, column: 0 }, end: { row: 1, column: 0 }});
                    jsTab.editor.ace.onTextInput("v");
                    afterCompleteOpen(function(el) {
                        assert.equal(getCompletionCalls(), 2);
                        done();
                    });
                });
            });
            
            it("doesn't start predicting completion immediately after a newline", function(done) {
                // We expect this behavior as infer_completer's predictNextCompletion()
                // tells worker we need completion here.
                jsSession.setValue("var foo;");
                jsTab.editor.ace.selection.setSelectionRange({ start: { row: 1, column: 0 }, end: { row: 1, column: 0 }});
                jsTab.editor.ace.onTextInput("\n");
                
                setTimeout(function() {
                    jsTab.editor.ace.onTextInput("\nf");
                    imports.testHandler.once("complete_called", function() {
                        assert.equal(getCompletionCalls(), 1);
                        done();
                    });
                }, 50);
            });
            
            it("completes python", function(done) {
                tabs.openFile("/python/test_user.py", function(err, _tab) {
                    if (err) return done(err);
                    var tab = _tab;
                    tabs.focusTab(tab);
                    var session = tab.document.getSession().session;
                    
                    session.setValue("import os; os");
                    tab.editor.ace.selection.setSelectionRange({ start: { row: 0, column: 16 }, end: { row: 0, column: 16 }});
                    imports.worker.once("python_completer_ready", function() {
                        tab.editor.ace.onTextInput(".");
                        afterCompleteOpen(function(el) {
                            complete.closeCompletionBox();
                            assert(el.textContent.match(/abort/));
                            done();
                        });
                    });
                });
            });
        }); 
    });
});
