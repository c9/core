/*global describe it before after bar*/

"use client";

    var expect = require("lib/chai/chai").expect;
    
    expect.setupArchitectTest([
        {
            packagePath: "plugins/c9.core/c9",
            workspaceId: "ubuntu/ip-10-35-77-180",
            startdate: new Date(),
            debug: true,
            hosted: true,
        },
        
        "plugins/c9.core/ext",
        "plugins/c9.core/http-xhr",
        "plugins/c9.core/util",
        "plugins/c9.ide.ui/lib_apf",
        "plugins/c9.ide.ui/menus",
        {
            packagePath: "plugins/c9.core/settings",
            settings: "default",
            testing: true
        },
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
        "plugins/c9.ide.keys/commands",
        "plugins/c9.fs/proc",
        "plugins/c9.vfs.client/vfs_client",
        "plugins/c9.vfs.client/endpoint",
        "plugins/c9.ide.auth/auth",
        "plugins/c9.core/api",
        "plugins/c9.fs/fs",
        
        "plugins/c9.ide.dialog/dialog",
        "plugins/c9.ide.dialog.common/alert",
        "plugins/c9.ide.dialog.common/alert_internal",
        
        {
            consumes: ["tabManager", "ace", "commands", "settings"],
            provides: [],
            setup: main
        }
    ]);
    
    function main(options, imports, register) {
        var settings = imports.settings;
        var commands = imports.commands;
        var tabs = imports.tabManager;
        var ace = imports.ace;
        
        function getTabHtml(tab) {
            return tab.pane.aml.getPage("editor::" + tab.editorType).$ext;
        }
        
        expect.html.setConstructor(function(tab) {
            if (tab && typeof tab == "object")
                return getTabHtml(tab);
        });
        
        describe('ace', function() {
            before(function(done) {
                bar.$ext.style.background = "rgba(220, 220, 220, 0.93)";
                bar.$ext.style.position = "fixed";
                bar.$ext.style.left = "20px";
                bar.$ext.style.width = "1000px";
                bar.$ext.style.bottom = "20px";
                bar.$ext.style.height = "33%";
      
                document.body.style.marginBottom = "33%";
                
                tabs.once("ready", function() {
                    tabs.getPanes()[0].focus();
                    done();
                });
            });
            
            describe("open", function() {
                this.timeout(10000);
                
                it('should open a pane with just an editor', function(done) {
                    tabs.openFile("/file.txt", function(err, tab) {
                        expect(tabs.getTabs()).length(1);
                        
                        expect(tab.document.title).equals("file.txt");
                        done();
                    });
                });
                it('should handle multiple documents in the same pane', function(done) {
                    tabs.openFile("/listing.json", function(err, tab) {
                        expect(tabs.getTabs()).length(2);
                        
                        tab.activate();
                        
                        var doc = tab.document;
                        expect(doc.title).match(new RegExp("listing.json"));
                        done();
                    });
                });
            });
            describe("clear(), getState() and setState()", function() {
                var state, info = {};
                
                it('should retrieve the state', function(done) {
                    // @todo make sure ace has a selection and scrolltop / left
                    
                    state = tabs.getState();
                    info.pages = tabs.getTabs().map(function(tab) {
                        return tab.path || tab.id;
                    });
                    done();
                });
                it('should clear all tabs and pages', function(done) {
                    tabs.getPanes()[0];
                    var pages = tabs.getTabs();
                    tabs.clear(true, true); //Soft clear, not unloading the pages
                    expect(tabs.getTabs(), "pages").length(0);
                    expect(tabs.getPanes(), "tabManager").length(0);
                    //expect(pane.getTabs(), "aml").length(0);
                    done();
                });
                it('should restore the state', function(done) {
                    // @todo make sure the selection and scrolltop / left is preserved
                    
                    tabs.setState(state, false, function(err) {
                        if (err) throw err.message;
                    });
                    var l = info.pages.length;
                    expect(tabs.getTabs()).length(l);
                    expect(tabs.getPanes()[0].getTabs()).length(l);
                    expect(tabs.focussedTab.pane.getTabs()).length(l);
                    
                    expect(tabs.getTabs().map(function(tab) {
                        return tab.path || tab.id;
                    })).to.deep.equal(info.pages);
                    done();
                });
                it('should jump to on an already loaded file', function(done) {
                    var tab = tabs.focussedTab;
                    tab.document.setState({
                        ace: {
                            jump: {
                                row: 3,
                                column: 10
                            }
                        }
                    });
                    var cursor = tab.editor.ace.getCursorPosition();
                    expect(cursor.row).equals(3);
                    expect(cursor.column).equals(10);
                    done();
                });
            });
            describe("split(), pane.unload()", function() {
                it('should split a pane horizontally, making the existing pane the left one', function(done) {
                    var pane = tabs.focussedTab.pane;
                    var righttab = pane.hsplit(true);
                    tabs.focussedTab.attachTo(righttab);
                    done();
                });
                it('should remove the left pane from a horizontal split', function(done) {
                    var pane = tabs.getPanes()[0];
                    var tab = tabs.getPanes()[1].getTab();
                    pane.unload();
                    expect(tabs.getPanes()).length(1);
                    expect(tabs.getTabs()).length(2);
                    tabs.focusTab(tab);
                    done();
                });
            });
            describe("focus(), blur()", function() {
                it.skip('should get the right className and take keyboard input when focussed', function(done) {
                    done();
                });
                it.skip(`should get the right className and not take any keyboard input when blurred`, function(done) {
                    done();
                });
            });
            describe("customType", function() {
                it('should remember custom types set on known extensions', function(done) {
                    
                    //@todo check if it is recorded in settings
                    done();
                });
                it('should remember custom types set on unknown extensions', function(done) {
                    
                    //@todo check if it is recorded in settings
                    done();
                });
            });
            
            function render() {
                var editor = tabs.focussedTab.editor;
                var changes = editor.ace.renderer.$loop.changes;
                editor.ace.renderer.$loop.changes = 0;
                editor.ace.renderer.$renderChanges(changes, true);
            }
            
            describe("setOption()", function() {
                this.timeout(10000);
                var lineHeight, session, editor, charWidth, doc;
                
                before(function(done) {
                    doc = tabs.focussedTab.document;
                    editor = doc.editor;
                    session = doc.getSession().session;
                    lineHeight = doc.editor.ace.renderer.lineHeight;
                    charWidth = doc.editor.ace.renderer.characterWidth;
                    
                    done();
                });
                
                it('should change a theme', function(done) {
                    function checkTheme(id, className, callback) {
                        editor.ace.renderer.on("themeLoaded", function me(e) {
                            if (e.theme.cssClass != className) return;
                            editor.ace.renderer.removeListener("themeLoaded", me);
                            expect.html(getTabHtml(tabs.focussedTab).childNodes[1]).className(className);
                            callback();
                        });
                        ace.setTheme(id);
                    }
                    checkTheme("ace/theme/textmate", "ace-tm", function() {
                        checkTheme("ace/theme/tomorrow_night_bright", "ace-tomorrow-night-bright", function() {
                            done();
                        });
                    });
                });
                it('should allow setting useWrapMode', function(done) {
                    var charW = editor.ace.renderer.layerConfig.characterWidth;
                    expect(charW).to.ok;
                    bar.$ext.style.width = 150 * charW + "px";
                    
                    doc.value = Array(17).join("a very long string to be wrapped ");
                    
                    render();
                    bar.$ext.style.width = "1000px";
                    
                    expect(document.querySelector(".ace_gutter-cell").offsetHeight).to.equal(lineHeight);
                    editor.setOption("useWrapMode", true);
                    
                    render();
                    expect(Math.ceil(document.querySelector(".ace_gutter-cell").offsetHeight)).to.equal(lineHeight * 7);
                    
                    // check that wrap to view setting is not lost when user settings are changes
                    settings.set("user/ace/@selectionStyle", "line");
                    expect(editor.ace.getOption("selectionStyle")).to.equal("line");
                    settings.set("user/ace/@selectionStyle", "text");
                    render();
                    expect(editor.ace.getOption("selectionStyle")).to.equal("text");
                    expect(editor.ace.session.getOption("wrap")).to.equal("printMargin");
                    
                    done();
                });
                it('should allow setting wrapToView', function(done) {
                    expect(document.querySelector(".ace_gutter-cell").offsetHeight).to.equal(lineHeight * 7);
                    editor.setOption("wrapToView", true);
                    
                    render();
                    var ace = editor.ace;
                    var cols = Math.floor((ace.container.offsetWidth - ace.renderer.gutterWidth - 2 * ace.renderer.$padding) / charWidth);
                    
                    expect(cols).to.equal(ace.session.getWrapLimit());
                    expect(document.querySelector(".ace_gutter-cell").offsetHeight).to.equal(lineHeight * ace.session.getRowLength(0));
                    
                    done();
                });
                it('should allow setting wrapBehavioursEnabled', function(done) {
                    done();
                });
                it('should allow setting newLineMode', function(done) {
                    editor.setOption("newLineMode", "windows");
                    doc.value = "line1\nline2\nline3\nline4\nline5";
                    
                    render();
                    
                    expect(session.getValue(session.doc.$fsNewLine)).to.match(/\r/);
                    
                    editor.setOption("newLineMode", "unix");
                    
                    expect(session.getValue()).to.not.match(/\r/);
                    
                    editor.setOption("newLineMode", "auto");
                    
                    expect(session.getValue()).to.not.match(/\r/);
                    
                    done();
                });
                it('should allow setting tabSize', function(done) {
                    doc.value = "\tline1\n\t\tline2\n\t\tline3\n\tline4\nline5";
                    render();
                    
                    editor.setOption("tabSize", 4);
                    
                    render();
                    expect.html(doc.tab, "tabSize: 4").text(/\s{8}/);
                    
                    editor.setOption("tabSize", 8);
                    render();
                    
                    expect.html(doc.tab, "tabSize: 8").text(/\s{16}/);
                    
                    done();
                });
                it('should allow setting useSoftTabs', function(done) {
                    doc.value = "    line1\n        line2\n        line3\n    line4\nline5";
                    render();
                    
                    editor.setOption("tabSize", 4);
                    editor.setOption("useSoftTabs", true);
                    
                    editor.ace.moveCursorTo(1, 0);
                    // command isAvailable works only if editor is focussed
                    // which might break the test when debugger is focussed
                    editor.ace.isFocused = function() {return true;};
                    commands.exec("gotoright", editor, null, 
                        document.createEvent("KeyboardEvent"));
                    delete editor.ace.isFocused;
                    
                    expect(editor.ace.getCursorPosition()).deep.equal({ row: 1, column: 4 });
                    
                    done();
                });
                it('should allow setting fontSize', function(done) {
                    expect(document.querySelector(".ace_gutter-cell").offsetHeight).equal(lineHeight);
                    
                    editor.setOption("fontSize", 30);
                    
                    expect(document.querySelector(".ace_gutter-cell").offsetHeight).gt(lineHeight);
                    
                    editor.setOption("fontSize", 12);
                    
                    done();
                });
                it('should allow setting fontFamily', function(done) {
                    editor.setOption("fontFamily", "Courier New");
                    render();
                    
                    expect(editor.ace.container.style.fontFamily).to.match(/Courier New/);
                    
                    var font = "Monaco, Menlo, 'Ubuntu Mono', Consolas, source-code-pro, monospace";
                    editor.setOption("fontFamily", font);
                    render();
                    
                    expect(editor.ace.container.style.fontFamily).to.match(/Monaco/)
                        .and.to.not.match(/Courier/);
                    
                    done();
                });
                it('should allow setting selectionStyle', function(done) {
                    session.getSelection().setSelectionRange({
                        start: {
                            row: 0,
                            column: 0
                        },
                        end: {
                            row: 4,
                            column: 0
                        }
                    }, false);
                    
                    editor.setOption("selectionStyle", "text");
                    render();
                    
                    function selectionElementWidth() {
                        var el = document.querySelectorAll(".ace_selection")[0];
                        return el.getBoundingClientRect().width;
                    }
                    
                    var chars = selectionElementWidth() / charWidth;
                    expect(chars - 10).to.lt(1 / 100);
                    
                    editor.setOption("selectionStyle", "line");
                    render();
                    
                    chars = selectionElementWidth() / charWidth;
                    expect(chars).to.gt(10);
                    
                    done();
                });
                it('should allow setting highlightActiveLine', function(done) {
                    session.getSelection().clearSelection();
                    
                    editor.setOption("highlightActiveLine", false);
                    render();
                    expect(document.querySelector(".ace_active-line")).to.not.ok;
                    
                    editor.setOption("highlightActiveLine", true);
                    render();
                    expect(document.querySelector(".ace_active-line")).to.ok;
                    
                    done();
                });
                it('should allow setting highlightGutterLine', function(done) {
                    editor.setOption("highlightGutterLine", false);
                    render();
                    expect(document.querySelector(".ace_gutter-active-line")).to.not.ok;
                    
                    editor.setOption("highlightGutterLine", true);
                    render();
                    expect(document.querySelector(".ace_gutter-active-line").offsetHeight).to.ok;
                    
                    done();
                });
                it('should allow setting showInvisibles', function(done) {
                    editor.setOption("showInvisibles", true);
                    render();
                    expect(document.querySelectorAll(".ace_invisible").length).ok;
                    editor.setOption("showInvisibles", false);
                    render();
                    expect(document.querySelectorAll(".ace_invisible").length).not.ok;
                    
                    done();
                });
                it('should allow setting showPrintMargin', function(done) {
                    editor.setOption("showPrintMargin", false);
                    expect(document.querySelector(".ace_print-margin").style.visibility).equal("hidden");
                    editor.setOption("showPrintMargin", true);
                    expect(document.querySelector(".ace_print-margin").style.visibility).equal("visible");
                    done();
                });
                it('should allow setting printMarginColumn', function(done) {
                    editor.setOption("printMarginColumn", 100);
                    var value = Math.floor(parseInt(document.querySelector(".ace_print-margin").style.left) / charWidth);
                    expect(value).equal(100);
                    editor.setOption("printMarginColumn", 80);
                    var value = Math.floor(parseInt(document.querySelector(".ace_print-margin").style.left) / charWidth);
                    expect(value).equal(80);
                    done();
                });
                it('should allow setting displayIndentGuides', function(done) {
                    editor.setOption("displayIndentGuides", false);
                    render();
                    expect(document.querySelector(".ace_indent-guide")).to.not.ok;
                    editor.setOption("displayIndentGuides", true);
                    render();
                    expect(document.querySelector(".ace_indent-guide")).to.ok;
                    done();
                });
                it('should allow setting behavioursEnabled', function(done) {
                    editor.setOption("syntax", "javascript");
                    expect(editor.ace.session.$mode.$id).to.equal("ace/mode/javascript");
                    
                    editor.setOption("behavioursEnabled", false);
                    doc.value = "test";
                    render();
                    editor.ace.moveCursorTo(0, 4);
                    render();
                    editor.ace.insert("(");
                    render();
                    expect(doc.value).to.equal("test(");
                    
                    editor.setOption("behavioursEnabled", true);
                    doc.value = "test";
                    render();
                    editor.ace.moveCursorTo(0, 4);
                    render();
                    editor.ace.insert("(");
                    render();
                    expect(doc.value).to.equal("test()");

                    done();
                });
                it('should allow setting showGutter', function(done) {
                    editor.setOption("showGutter", false);
                    expect.html(document.querySelector(".ace_gutter")).not.visible;
                    editor.setOption("showGutter", true);
                    expect.html(document.querySelector(".ace_gutter")).visible;
                    done();
                });
                it('should allow setting showFoldWidgets', function(done) {
                    doc.value = "function(){\n\t\n}";
                    editor.setOption("showFoldWidgets", false);
                    render();
                    expect.html(document.querySelector(".ace_fold-widget").offsetHeight).not.ok;
                    editor.setOption("showFoldWidgets", true);
                    render();
                    expect.html(document.querySelector(".ace_fold-widget")).ok;
                    done();
                });
                it('should allow setting highlightSelectedWord', function(done) {
                    doc.value = "test\ntest\ntest";
                    session.getSelection().setSelectionRange({
                        start: {
                            row: 0,
                            column: 0
                        },
                        end: {
                            row: 0,
                            column: 4
                        }
                    }, false);
                    editor.setOption("highlightSelectedWord", false);
                    render();
                    expect.html(document.querySelector(".ace_selected-word")).not.ok;
                    editor.setOption("highlightSelectedWord", true);
                    render();
                    expect.html(document.querySelector(".ace_selected-word")).ok;
                    done();
                });
                it('should allow setting animatedScroll', function(done) {
                    var i = 0;
                    doc.value = Array(100).join("x").split("x").map(function() {return "Line " + i++;}).join("\n");
                    render();
                    
                    editor.setOption("animatedScroll", false);
                    editor.scrollTo(50, 0);
                    render();
                    expect.html(doc.tab).text("50");
                    
                    editor.setOption("animatedScroll", true);
                    editor.scrollTo(0, 0);
                    render();
                    expect.html(doc.tab).text("50");
                    done();
                });
                it('should not lose undomanager state', function(done) {
                    var u = editor.activeDocument.undoManager;
                    u.setState({ mark: -1, position: -1, stack: []});
                    var state = u.getState();
                    expect(state.mark).to.equal(-1);
                    expect(state.position).to.equal(-1);
                    expect(state.stack.length).to.equal(0);
                    
                    u.setState({ mark: -2, position: -1, stack: []});
                    state = u.getState();
                    expect(state.mark).to.equal(-2);
                    expect(state.position).to.equal(-1);
                    expect(state.stack.length).to.equal(0);
                    done();
                });
            });
            
            // @todo test split api and menu
            
           if (!onload.remain) {
               after(function(done) {
                   tabs.unload();
                   
                   document.body.style.marginBottom = "";
                   done();
               });
           }
        });
        
        register();
    }
