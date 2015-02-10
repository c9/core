/*global describe it before beforeEach after bar =*/

"use client";
"use mocha";

require(["lib/architect/architect", "lib/chai/chai", "/vfs-root", "ace/test/assertions"], function (architect, chai, baseProc) {
    var expect = chai.expect;
    
    expect.setupArchitectTest([
        {
            packagePath: "plugins/c9.core/c9",
            workspaceId: "johndoe/dev",
            startdate: new Date(),
            debug: true,
            hosted: true,
            local: false,
            davPrefix: "/"
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
        "plugins/c9.ide.editors/editors",
        "plugins/c9.ide.editors/editor",
        "plugins/c9.ide.editors/tabmanager",
        "plugins/c9.ide.ui/focus",
        "plugins/c9.ide.editors/pane",
        "plugins/c9.ide.editors/tab",
        "plugins/c9.ide.terminal/terminal",
        "plugins/c9.ide.terminal/predict_echo",
        "plugins/c9.vfs.client/vfs.ping",
        "plugins/c9.ide.preferences/preferences",
        "plugins/c9.ide.ui/forms",
        {
            packagePath: "plugins/c9.fs/proc",
            tmuxName: "cloud9test"
        },
        "plugins/c9.vfs.client/vfs_client",
        "plugins/c9.vfs.client/endpoint",
        "plugins/c9.ide.auth/auth",
        {
            packagePath: "plugins/c9.fs/fs",
            baseProc: baseProc
        },
        
        // Mock plugins
        {
            consumes: ["apf", "ui", "Plugin"],
            provides: [
                "commands", "menus", "commands", "layout", "watcher", 
                "save", "anims", "clipboard", "dialog.alert", "auth.bootstrap",
                "info", "dialog.error"
            ],
            setup: expect.html.mocked
        },
        {
            consumes: ["tabManager", "proc", "terminal", "terminal.predict_echo", "c9"],
            provides: [],
            setup: main
        }
    ], architect);
    
    function main(options, imports, register) {
        var tabs = imports.tabManager;
        var proc = imports.proc;
        var predictor = imports["terminal.predict_echo"];
        var assert = require("ace/test/assertions");
        
        var ESC = "\u001B";
        var OUTPUT_CURSOR_START = ESC + "[H";
        var INPUT_LEFT = ESC + "[D";
        var INPUT_LEFT_ONCE = ESC + "[1D";
        var INPUT_LEFT_TWICE = ESC + "[2D";
        var INPUT_HOME = ESC + "[1~";
        var INPUT_END = "\u0005";
        var INPUT_RIGHT = ESC + "[C";
        var INPUT_BACKSPACE = "\u007F";
        var INPUT_CONTROL_C = "\u0003";
        var INPUT_DELETE = ESC + "[3~";
        var OUTPUT_BACKSPACE = "\b" + ESC + "[K";
        var OUTPUT_DELETE_CHAR = ESC + "[P";
        var STATE_WAIT_FOR_ECHO_OR_PROMPT = 1;
        var STATE_WAIT_FOR_ECHO = 2;
        var STATE_WAIT_FOR_PROMPT = 3;
        
        expect.html.setConstructor(function(tab) {
            if (typeof tab == "object")
                return tab.pane.aml.getPage("editor::" + tab.editorType).$ext;
        });
        
        predictor.on("mispredict", function(e) {
            console.error("MISPREDICTED", e)
            delete e.session;
            throw new Error("MISPREDICTED: " + JSON.stringify(e));
        });
        
        describe('terminal.predict_echo', function() {
            this.timeout(30000);
                
            before(function(done) {
                this.timeout(45000);
                apf.config.setProperty("allow-select", false);
                apf.config.setProperty("allow-blur", false);
                
                bar.$ext.style.background = "rgba(220, 220, 220, 0.93)";
                bar.$ext.style.position = "fixed";
                bar.$ext.style.left = "20px";
                bar.$ext.style.right = "20px";
                bar.$ext.style.bottom = "20px";
                bar.$ext.style.height = "33%";
      
                document.body.style.marginBottom = "33%";
                
                predictor.$setTestTimeouts();
                predictor.DEBUG = true;
                
                proc.execFile("~/.c9/bin/tmux", { args: ["-L", "cloud9test", "kill-server"] }, function(err) {
                    tabs.once("ready", function(){
                        tabs.getPanes()[0].focus();
                        openTerminal(done);
                    });
                });
            });
            
            function openTerminal(done) {
                tabs.openEditor("terminal", function(err, tab) {
                    editor = tab.editor;
                    session = editor.ace.getSession().c9session;
                    send = session.send;

                    if (peek(-2) === "$") // maybe there already was a prompt
                        return init();
                    afterPrompt(function() { setTimeout(init); });
                    
                    function init() {
                        // Make sure we have a prompt with a dollar for tests
                        afterPrompt(function() { done() });
                        editor.ace.onTextInput("PS1='. $ '\n");
                        //editor.ace.onTextInput("ssh lennart\n");
                        //editor.ace.onTextInput("ssh ubuntu@ci.c9.io\n");
                    }
                });
            }
            
            function peek(offset) {
                offset = offset || 0;
                var char = session.terminal.getCharAt(
                    session.terminal.y, session.terminal.x + offset);
                return char && char[1];
            }
            
            function afterPrompt(callback) {
                // Expect a prompt to appear
                editor.on("beforeWrite", function wait(e) {
                    if (!e.data.match(/\$ ([\s\S]*\u001B\[\d+;\d+H)?$/))
                        return;
                    if (session.$predictor.predictions.length
                        && !session.$predictor.predictions[session.$predictor.predictions.length - 1].optional)
                        return; // probably a false positive
                    editor.off("beforeWrite", wait);
                    
                    console.log("  ^ prompt; proceeding with test");
                    editor.once("afterWrite", function() {
                        // Make sure we're after predict_echo's afterWrite
                        callback();
                    });
                });
            }
            
            function afterPredict(text, callback) {
                predictor.on("predict", function wait(e) {
                    if (e.data.indexOf(text) === -1
                        && e.predictions.filter(function(p) {
                            return (p.$outputText || "").indexOf(text) !== -1
                        }).length === 0)
                        return;
                    predictor.off("predict", wait);
                    callback(e);
                });
            }
            
            var editor;
            var session;
            var send;
            
            function sendAll(keys, callback) {
                var key = keys.shift();
                if (!key)
                    return callback && callback();
                setTimeout(function() {
                    send(key);
                    sendAll(keys, callback);
                });
            }
            
            describe("predict_echo", function(){
                beforeEach(function(done) {
                    afterPredict("*", function() {
                        afterPrompt(function() {
                            session.$predictor.state = 0;
                            done();
                        });
                        send("\r");
                    });
                    session.$predictor.state = 0;
                    sendAll(" # next*".split(""));
                });
            
                it("should predict a single character", function(done) {
                    predictor.on("predict", function wait(e) {
                        if (!e.data.match(/:/))
                            return;
                        predictor.off("predict", wait);
                        done();
                    });
                    sendAll([":"]);
                });
            
                it("should predict multiple characters sent at the same time", function(done) {
                    afterPredict("!", function() {
                        afterPrompt(function() {
                            done();
                        })
                        send("\r");
                    });
                    sendAll([": test!"]);
                });
                
                it("should predict a single character straight from keyboard input", function(done) {
                    predictor.on("predict", function wait(e) {
                        if (!e.data.match(/:/))
                            return;
                        predictor.off("predict", wait);
                        done();
                    });
                    editor.ace.onTextInput(":");
                });
                
                
                it("should predict multiple character", function(done) {
                    predictor.on("predict", function wait(e) {
                        if (!e.data.match(/t/))
                            return;
                        predictor.off("predict", wait);
                        assert.equal(peek(-1), "t");
                        done();
                    });
                    
                    sendAll("ls -lt".split(""));
                });
                
                it("gracefully copes with a newline", function(done) {
                    // Expect \r
                    predictor.on("nopredict", function wait(e) {
                        if (e.data.indexOf("\r") === -1)
                            return;
                        predictor.off("nopredict", wait);
                        seenNewLine = true;
                    });
                    afterPrompt(function() {
                        assert(seenNewLine);
                        done();
                    });
                    
                    var seenNewLine;
                    
                    sendAll(["\r"]);
                });
                
                it("supports cursor key left/right", function(done) {
                    afterPredict("h", function() {
                        sendAll([INPUT_LEFT, "c"]);
                    });
                    afterPredict("c", function() {
                        sendAll([INPUT_RIGHT, "o"]);
                    });
                    afterPredict("o", function() {
                        assert.equal(peek(-4), "e");
                        assert.equal(peek(-3), "c");
                        assert.equal(peek(-2), "h");
                        assert.equal(peek(-1), "o");
                        
                        afterPrompt(done);
                        send("\r");
                    });
                    
                    sendAll(["e", "h"]);
                });
                
                it("supports delete with repeated characters; stress test", function loop(done, attempt) {
                    this.timeout && this.timeout(60000);
                    session.$predictor.state = 0;
                    if (attempt === 5)
                        return done();
                    
                    afterPredict("[", function() {
                        afterPredict("[", function() {
                            assert.equal(peek(-1), " ");
                            assert.equal(peek(), "e");
                            assert.equal(peek(1), "c");

                            afterPrompt(loop.bind(null, done, (attempt || 0) + 1));
                            send("\r");
                        });
                        sendAll([INPUT_DELETE]);
                    })
                    
                    sendAll(["eecho blaaat", INPUT_HOME]);
                });
                
                // slow, useless; skip
                it.skip("supports long sequence of chars; stress test", function loop(done, attempt) {
                    this.timeout && this.timeout(60000);
                    session.$predictor.state = 0;
                    if (attempt === 4)
                        return done();
                    
                    afterPredict("?", function() {
                        send("\r");
                        afterPrompt(loop.bind(null, done, (attempt || 0) + 1));
                    });
                    
                    sendAll("echo this is a pretty long sequence of characters, right?".split(""));
                });
                
                it("supports short sequence of chars; stress test", function loop(done, attempt) {
                    this.timeout && this.timeout(90000);
                    session.$predictor.state = 0;
                    if (attempt === 5)
                        return done();
                    
                    afterPredict("?", function() {
                        send("\r");
                        afterPrompt(loop.bind(null, done, (attempt || 0) + 1));
                    });
                    
                    sendAll("echo ?".split(""));
                });
                
                it("supports short sequence of chars with a newline; stress test", function loop(done, attempt) {
                    this.timeout && this.timeout(90000);
                    session.$predictor.state = 0;
                    if (attempt === 5)
                        return done();
                    
                    afterPredict("?", function() {
                        afterPrompt(loop.bind(null, done, (attempt || 0) + 1));
                    });
                    
                    session.$predictor.state = 0;
                    sendAll("echo 2?\r".split(""));
                });
                
                it("supports backspace with repeated characters", function(done) {
                    afterPredict("[", function() {
                        afterPredict("[", function() {
                            afterPredict("[", function() {
                                assert.equal(peek(-1), " ");
                                assert.equal(peek(), "e");
                                assert.equal(peek(1), "c");

                                afterPrompt(done);
                                send("\r");
                            });
                            sendAll([INPUT_BACKSPACE]);
                        });
                        sendAll([INPUT_RIGHT]);
                    })
                    
                    sendAll(["eecho bleep", INPUT_HOME]);
                });
                
                it("supports insert with repeated characters; stress test", function loop(done, attempt) {
                    this.timeout && this.timeout(60000);
                    session.$predictor.state = 0;
                    if (attempt === 5)
                        return done();
                    
                    sendAll("echo blaat".split(""), function() {
                        var sawX;
                        
                        afterPredict("t", function() {
                            assert.equal(peek(-3), "a");
                            sendAll([INPUT_LEFT, INPUT_LEFT, INPUT_LEFT, "x", "a"]);
                        });
                        predictor.on("predict", function wait(e) {
                            sawX = sawX || e.data.match(/x/);
                            if (!sawX || e.data.match(/xaat/) || !e.data.match(/a/))
                                return; // console.log("  -", e.data, sawX)*
                            predictor.off("predict", wait);

                            assert.equal(peek(), "a");
                            assert.equal(peek(1), "a");
                            assert.equal(peek(-1), "a");

                            afterPrompt(loop.bind(null, done, (attempt || 0) + 1));
                            send("\r");
                        });
                    });
                });
                
                it("supports insert with home and repeated characters", function(done) {
                    afterPredict("t", function() {
                        assert.equal(peek(-3), "a");
                        sendAll(["x", INPUT_HOME, "e"])
                    });
                    predictor.on("predict", function wait(e) {
                        sawX = sawX || e.data.match(/x/);
                        if (!sawX || !e.data.match(/a/))
                            return;
                        predictor.off("predict", wait);
                        
                        assert.equal(peek(), "e");
                        assert.equal(peek(-1), "e");
                        
                        afterPrompt(done);
                        sendAll([INPUT_HOME, "#", "\r"]);
                    });
                    
                    var sawX;
                    
                    sendAll("echo blaat".split(""));
                });
                
                it("supports at least one spurious left cursor; stress test", function loop(done, attempt) {
                    this.timeout && this.timeout(60000);
                    session.$predictor.state = 0;
                    if (attempt === 10)
                        return done();
                    
                    afterPredict("c", function() {
                        assert.equal(peek(-1), "c");
                        assert.equal(peek(-2), "e");
                        assert.equal(peek(-3), " ");
                        
                        afterPrompt(function() {
                            loop(done, (attempt || 0) + 1)
                        });
                        send("\r");
                    });
                    
                    sendAll(["e", "h", "o", INPUT_LEFT, INPUT_LEFT, INPUT_LEFT, INPUT_RIGHT, "c"]);
                });
                
                it("supports home", function(done) {
                    predictor.on("predict", function wait(e) {
                        if (e.data.match(/^[a-z]*$/))
                            return;
                        predictor.off("predict", wait);
                        assert.equal(peek(), "e");
                        afterPrompt(done);
                        sendAll(["\r"]);
                    });
                    
                    sendAll(["e", "c", "h", "o", INPUT_HOME]);
                });
                
                // TODO: rewrite this to support delayed enabling?
                it.skip("enables and disables itself automatically; stress test", function loop(done, attempt) {
                    this.timeout && this.timeout(60000);
                    if (attempt === 5)
                        return done();
                    
                    predictor.once("nopredict", function() {
                        predictor.once("nopredict", function(e) {
                            assert.equal(e.data, ":");

                            afterPredict("i", function() {
                                afterPrompt(function() {
                                    loop(done, (attempt || 0) + 1);
                                });

                                send("\r");
                            });
                            
                            sendAll(" hoi".split(""));
                        });
                        
                        // sometimes backspace will re-enable state 0; we reset it here
                        session.$predictor.state = STATE_WAIT_FOR_ECHO_OR_PROMPT;
                        send(":");
                    });
                  
                    session.$predictor.state = STATE_WAIT_FOR_ECHO_OR_PROMPT;
                    send(INPUT_BACKSPACE);
                });
                
                it("correctly handles duplicate states", function(done) {
                    afterPredict("y", function() {
                        afterPrompt(done);
                        predictor.off("nopredict", fail);
                        send("\r");
                    });
                    predictor.on("nopredict", fail);
                    function fail(e) {
                        assert(false, "Prediction got disabled");
                    }
                    
                    var repeat = ["x", INPUT_BACKSPACE, "x", INPUT_BACKSPACE, "x", INPUT_BACKSPACE];
                    repeat = repeat.concat(repeat).concat(repeat);
                    sendAll(repeat, function() {
                        setTimeout(function() {
                            sendAll(repeat, function() {
                                setTimeout(function() {
                                    sendAll(repeat, function() {
                                        send("y");
                                    });
                                }, 300);
                            });
                        }, 200);
                    });
                });
                
                it("correctly handles repeated keys without pauses", function(done) {
                    afterPredict(":", function() {
                        afterPrompt(done);
                        send("\r");
                    })
                    sendAll("echo".split(""), function() {
                        send(INPUT_BACKSPACE);
                        send(INPUT_BACKSPACE);
                        send(INPUT_BACKSPACE);
                        send(INPUT_BACKSPACE);
                        send(":");
                        
                    });
                });
            });
            
            if (!onload.remain) {
                after(function(done) {
                    tabs.unload();
                    bar.destroy(true, true);
                    
                    document.body.style.marginBottom = "";
                    done();
                });
            }
        });
        
        onload && onload();
    }
});
