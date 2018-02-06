/*global describe it before after = */

"use client";

require(["lib/architect/architect", "lib/chai/chai", "text!plugins/c9.ide.layout.classic/skins.xml"], function (architect, chai, skin) {
    var expect = chai.expect;
    var bar;
    
    expect.setupArchitectTest([
        {
            packagePath: "plugins/c9.core/c9",
            workspaceId: "ubuntu/ip-10-35-77-180",
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
        "plugins/c9.ide.ui/menus",
        {
            packagePath: "plugins/c9.core/settings",
            settings: { user: { general: { animateui: true }}}
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
        {
            packagePath: "plugins/c9.ide.find.replace/findreplace",
        },
        "plugins/c9.ide.keys/commands",
        "plugins/c9.ide.ui/anims",
        "plugins/c9.ide.ui/tooltip",
        "plugins/c9.fs/proc",
        "plugins/c9.vfs.client/vfs_client",
        "plugins/c9.vfs.client/endpoint",
        "plugins/c9.ide.auth/auth",
        "plugins/c9.core/api",
        "plugins/c9.fs/fs",

        {
            consumes: ["ui"],
            provides: ["layout"],
            setup: function(options, imports, register) {
                register(null, {
                    layout: (function() {
                        // Load the skin
                        imports.ui.insertSkin({
                            "data": skin,
                            "media-path": "plugins/c9.ide.layout.classic/images/",
                            "icon-path": "plugins/c9.ide.layout.classic/icons/"
                        }, { addElement: function() {} });
                        
                        return {
                            proposeLayoutChange: function() {},
                            initMenus: function() {},
                            setFindArea: function() {},
                            findParent: function() {
                                if (!bar) {
                                    bar = apf.document.documentElement.appendChild(
                                        new imports.ui.vsplitbox());
                                    bar.$ext.style.position = "fixed";
                                    bar.$ext.style.background = "rgba(220, 220, 220, 0.93)";
                                    bar.$ext.style.left = "20px";
                                    bar.$ext.style.right = "20px";
                                    bar.$ext.style.bottom = "20px";
                                    bar.$ext.style.height = "33%";
                                }
                                
                                return bar;
                            },
                            on: function() {}
                        };
                    })()
                });
            }
        },
        {
            consumes: ["tabManager", "ace", "findreplace", "commands", "settings"],
            provides: [],
            setup: main
        }
    ], architect);

    function main(options, imports, register) {
        var tabs = imports.tabManager;
        var settings = imports.settings;
        var findreplace = imports.findreplace;
        var commands = imports.commands;

        var Range = require("ace/range").Range;

        var txtFind, txtReplace;

        function getTabHtml(tab) {
            return tab.pane.aml.getPage("editor::" + tab.editorType).$ext;
        }

        expect.html.setConstructor(function(tab) {
            if (typeof tab == "object")
                return getTabHtml(tab);
        });

        describe('ace', function() {
            this.timeout(10000);

            before(function(done) {
                tabs.getPanes()[0].focus();

                document.body.style.marginBottom = "33%";
                done();
            });

            describe("open", function() {
                var ace, tab;
                it('should open a pane with just an editor', function(done) {
                    tabs.open({
                        path: "/nofile.md",
                        value: "",
                        document: {
                            meta: {
                                newfile: true
                            }
                        }
                    }, function(err, page_) {
                        expect(tabs.getTabs()).length(1);
                        tab = tabs.getTabs()[0];
                        ace = tab.editor.ace;
                        done();
                    });
                });
                it('should open findbar and select text', function(done) {
                    var str = [];
                    for (var i = 0; i < 100; i++) {
                        str.push("a " + i + " b " + (i % 10));
                    }

                    tab.editor.focus();
                    ace.setValue(str.join("\n"));

                    ace.selection.setRange(new Range(0, 0, 0, 1));
                    commands.exec("find");

                    txtFind = findreplace.getElement("txtFind").ace;
                    txtReplace = findreplace.getElement("txtReplace").ace;

                    expect(txtFind.getValue()).equal("a");

                    tab.editor.focus();
                    ace.selection.setRange(new Range(0, 4, 0, 7));

                    commands.exec("find");
                    expect(txtFind.getValue()).equal("b 0");

                    ace.once("changeSelection", function() {
                        expect(ace.selection.getRange().end.row).equal(10);
                        done();
                    });
                    setTimeout(function() {
                        findreplace.findNext();
                    }, 100);
                });
                it('should find again and again', function() {
                    commands.exec("findnext");
                    expect(ace.selection.getRange().end.row).equal(20);

                    ace.selection.setRange(new Range(0, 0, 0, 7));

                    commands.exec("findnext");
                    expect(ace.selection.getRange().start.column).equal(0);

                    var kb = txtFind.keyBinding.$handlers[1].commands;
                    var prev = kb["Shift-Return"];
                    var next = kb["Return"];

                    ace.selection.setRange(new Range(10, 5, 10, 5));
                    txtFind.execCommand(next);
                    expect(ace.selection.getRange()).to.deep.equal(new Range(10, 5, 10, 8));

                    txtReplace.setValue("b 0");
                    findreplace.replace();
                    expect(ace.selection.getRange()).to.deep.equal(new Range(20, 5, 20, 8));
                    findreplace.replace(true);
                    expect(ace.selection.getRange()).to.deep.equal(new Range(10, 5, 10, 8));

                    ace.selection.setRange(new Range(10, 8, 10, 8));
                    txtFind.execCommand(prev);
                    expect(ace.selection.getRange()).to.deep.equal(new Range(10, 5, 10, 8));

                    ace.selection.setRange(new Range(10, 7, 10, 7));
                    txtFind.execCommand(next);
                    expect(ace.selection.getRange()).to.deep.equal(new Range(20, 5, 20, 8));

                    ace.selection.setRange(new Range(20, 7, 20, 7));
                    txtFind.execCommand(prev);
                    expect(ace.selection.getRange()).to.deep.equal(new Range(10, 5, 10, 8));
                });
                it('should remember replace history', function() {
                    // reset replace textbox history
                    settings.setJson("state/search-history/" + txtReplace.session.listName, null);
                    txtReplace.setValue("foo");
                    
                    commands.exec("replacenext");
                    txtReplace.setValue("bar");
                    commands.exec("replacenext");
                    
                    var kb = txtReplace.keyBinding.$handlers[1].commands;
                    var prev = kb.Up;
                    var next = kb.Down;
                    
                    txtReplace.execCommand(prev);
                    expect(txtReplace.getValue()).equal("foo");
                    txtReplace.execCommand(prev);
                    expect(txtReplace.getValue()).equal("foo");
                    
                    txtReplace.execCommand(next);
                    expect(txtReplace.getValue()).equal("bar");
                    
                    txtReplace.execCommand(next);
                    expect(txtReplace.getValue()).equal("");
                    
                    txtReplace.setValue("baz");
                    txtReplace.execCommand(next);
                    expect(txtReplace.getValue()).equal("");
                    txtReplace.execCommand(prev);
                    expect(txtReplace.getValue()).equal("baz");
                    txtReplace.execCommand(prev);
                    expect(txtReplace.getValue()).equal("bar");
                });
                it('should replace all in selection', function(done) {
                    var range = new Range(5, 2, 7, 1);
                    ace.selection.setRange(range);
                    findreplace.getElement("chkSearchSelection").check();
                    findreplace.getElement("chkRegEx").check();
                    txtFind.setValue("(a)|(b)");
                    txtReplace.setValue("\\u$2x");
                    
                    findreplace.replaceAll(function() {
                        expect(ace.selection.getRange() + "").equal(range + "");
                        expect(ace.session.getTextRange(range)).equal("5 Bx 5\nX 6 Bx 6\nX");
                        done();
                    });
                });
                it('should close findbar', function() {
                    commands.exec("find");
                    window.app.services.findreplace.getElement("winSearchReplace").visible;
                });
            });
            describe("unload", function() {
                it('should open a pane with just an editor', function(done) {
                    if (!onload.remain)
                        findreplace.unload();
                    done();
                });
            });

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
});
