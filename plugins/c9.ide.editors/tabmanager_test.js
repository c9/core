/*global describe it before after bar = */

"use client";

require(["lib/architect/architect", "lib/chai/chai"], 
  function (architect, chai, baseProc) {
    var expect = chai.expect;
    
    expect.setupArchitectTest([
        {
            packagePath: "plugins/c9.core/c9",
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
        {
            packagePath: "plugins/c9.ide.ui/ui",
            staticPrefix: "plugins/c9.ide.ui"
        },
        "plugins/c9.ide.editors/document",
        "plugins/c9.ide.editors/undomanager",
        {
            packagePath: "plugins/c9.ide.editors/editors",
            defaultEditor: "texteditor"
        },
        "plugins/c9.ide.editors/editor",
        "plugins/c9.ide.editors/tabmanager",
        "plugins/c9.ide.ui/focus",
        "plugins/c9.ide.editors/pane",
        "plugins/c9.ide.editors/tab",
        "plugins/c9.ide.editors/texteditor",
        "plugins/c9.ide.editors/timeview",
        "plugins/c9.ide.editors/imgview",
        {
            packagePath: "plugins/c9.vfs.client/vfs_client"
        },
        "plugins/c9.vfs.client/endpoint",
        "plugins/c9.ide.auth/auth",
        "plugins/c9.core/api",
        {
            packagePath: "plugins/c9.fs/fs",
            baseProc: baseProc
        },
        "plugins/c9.fs/fs.cache.xml",
        
        {
            consumes: ["tabManager", "ui", "fs.cache", "fs"],
            provides: [],
            setup: main
        }
    ], architect);
    
    function main(options, imports, register) {
        var tabs = imports.tabManager;
        var fs = imports.fs;
        
        function countEvents(count, expected, done) {
            if (count == expected) 
                done();
            else
                throw new Error("Wrong Event Count: "
                    + count + " of " + expected);
        }
        
        expect.html.setConstructor(function(tab) {
            if (typeof tab == "object")
                return tab.pane.aml.getPage("editor::" + tab.editorType).$ext;
        });
        
        describe('tabs', function() {
            this.timeout(20000);
            
            before(function(done) {
                bar.$ext.style.background = "rgba(220, 220, 220, 0.93)";
                bar.$ext.style.position = "fixed";
                bar.$ext.style.left = "20px";
                bar.$ext.style.right = "20px";
                bar.$ext.style.bottom = "20px";
                bar.$ext.style.height = "33%";
      
                document.body.style.marginBottom = "33%";
                
                tabs.once("ready", function() {
                    tabs.getPanes()[0].focus();
                    done();
                });
            });
            
            var text;
            describe("open(), openFile(), openEditor() and reload()", function() {
                it('should recover from state with no panes', function(done) {
                    var oldState = tabs.getState();
                    tabs.setState({
                        "nodes": [],
                        "type": "hsplitbox"
                    }, function() {});
                    tabs.openEditor("timeview", function(err, tab) {
                        expect(tabs.getTabs()).length(1);
                        
                        expect(tabs.focussedTab)
                            .to.exist
                            .to.equal(tab);
                        tabs.setState(oldState, done);
                    });
                });
                it('should open a pane from a path', function(done) {
                    var vpath = "/file.txt";
                    tabs.openFile(vpath, function(err, tab) {
                        expect(tabs.getTabs()).length(1);
                        
                        expect(tabs.focussedTab)
                            .to.exist
                            .property("path").to.equal(vpath);
                        expect(tab.title).to.equal(vpath.substr(1));
                        
                        fs.readFile(vpath, "utf8", function(err, data) {
                            text = data;
                            expect(tab.document.value).to.equal(data);
                            done();
                        });
                    });
                });
                it('should open a pane with just an editor', function(done) {
                    tabs.openEditor("timeview", function(err, tab) {
                        expect(tabs.getTabs()).length(2);
                        
                        expect(tabs.focussedTab)
                            .to.exist
                            .to.not.equal(tab);
                            //.property("path").to.equal(vpath);
                        done();
                    });
                });
                it('should handle multiple docs on the same editor well', function(done) {
                    var vpath = "/listing.json";
                    tabs.open({
                        path: vpath,
                        active: true
                    }, function(err, tab) {
                        expect(tabs.getTabs()).length(3);
                        expect(tab.title).to.equal(vpath.substr(1));
                        
                        expect(tabs.focussedTab)
                            .to.exist
                            .property("path").to.equal(vpath);
                            
                        fs.readFile(vpath, "utf8", function(err, data) {
                            expect(tab.document.value).to.equal(data);
                            
                            tabs.activateTab("/file.txt");
                            expect(tabs.focussedTab.document.value)
                                .to.equal(text);
                            
                            tabs.openEditor("timeview", function(err, tab) {
                                expect(tabs.getTabs()).length(4);
                                
                                tabs.activateTab(tab);
                                expect(tabs.focussedTab)
                                    .to.exist
                                    .to.equal(tab);
                                
                                tabs.activateTab(tabs.getTabs()[1]);
                                expect.html(tabs.focussedTab).is.visible;
                                done();
                            });
                        });
                    });
                });
                it('should reload the contents of an editor on a tab', function(done) {
                    var tab = tabs.findTab("/file.txt");
                    tabs.activateTab(tab);
                    tab.document.value = "Testing";
                    tabs.reload(tab, function(err) {
                        if (err) throw err.message;
                        expect(tab.document.value).to.equal(text);
                        done();
                    });
                });
                it('should open a non-existing file with empty content passed as value', function(done) {
                    var vpath = "/Untitled1";
                    tabs.open({
                        path: vpath,
                        value: "",
                        active: true,
                    }, function(err, tab) {
                        expect(tabs.getTabs()).length(5);
                        expect(tab.title).to.equal(vpath.substr(1));
                        expect(tabs.focussedTab)
                            .to.exist
                            .property("path").to.equal(vpath);
                        
                        expect(tabs.focussedTab.document.value).to.equal("");
                        
                        done();
                    });
                });
                it('should open a non-existing file with set content passed as value', function(done) {
                    var vpath = "/Untitled2";
                    var text = "This is a test";
                    tabs.open({
                        path: vpath,
                        value: text,
                        active: true,
                    }, function(err, tab) {
                        expect(tabs.getTabs()).length(6);
                        expect(tab.title).to.equal(vpath.substr(1));
                        expect(tabs.focussedTab)
                            .to.exist
                            .property("path").to.equal(vpath);
                        
                        expect(tabs.focussedTab.document.value)
                            .to.equal(text);
                        
                        done();
                    });
                });
            });

            describe("File system rename hooks - change open tab paths", function() {
                it('should rename a file  - change page path', function(done) {
                    var vpath = "/dir/stuff.json";
                    var newVpath = "/dir/stuff2.json";
                    tabs.openFile(vpath, function(err, tab) {
                        expect(tab.path).to.equal(vpath);
                        expect(tab.title).to.equal("stuff.json");
                        
                        fs.rename(vpath, newVpath, function(err) {
                            if (err)
                                throw err;
                            expect(tab.path).to.equal(newVpath);
                            tab.unload();
                            fs.rename(newVpath, vpath, function (err) {
                                if (err)
                                    throw err;
                                done();
                            });
                        });
                    });
                });

                it('should rename a directory  - change tab path', function(done) {
                    var vpath = "/dir/stuff.json";
                    fs.rmdir("/dir2", { recursive: true }, function() {
                        tabs.openFile(vpath, function(err, tab) {
                            expect(tab.path).to.equal(vpath);
                            expect(tab.title).to.equal("stuff.json");
                            
                            fs.rename("/dir", "/dir2", function(err) {
                                if (err)
                                    throw err;
                                expect(tab.path).to.equal("/dir2/stuff.json");
                                expect(tab.title).to.equal("stuff.json");
                                tab.unload();
                                fs.rename("/dir2", "/dir", function (err) {
                                    if (err)
                                        throw err;
                                    done();
                                });
                            });
                        });
                    });
                });
            });

            describe("getTabs(), getPanes()", function() {
                it('should return a list containing all the pages', function(done) {
                    expect(tabs.getTabs()).length.gt(4);
                    done();
                });
                it('should return a list containing all the tabs', function(done) {
                    expect(tabs.getPanes()).length(1);
                    done();
                });
                it('should return an editor of a tab', function(done) {
                    expect(tabs.findTab("/file.txt").editor)
                        .property("type").to.equal("texteditor");
                    done();
                });
            });
            describe("switchEditor()", function() {
                it('should switch to another editor for the selected tab', function(done) {
                    var tab = tabs.focusTab("/file.txt");
                    tab.switchEditor("imgview", function() {
                        expect(tabs.focussedTab.editor)
                            .property("type").to.equal("imgview");
                        tab.switchEditor("texteditor", function() {
                            expect(tabs.focussedTab.document.value).to.equal(text);
                            done();
                        });
                    });
                });
                it('should switch to another editor for a given tab (not selected)', function(done) {
                    var tab = tabs.findTab("/listing.json");
                    tab.switchEditor("imgview", function() {
                        expect(tab.editor)
                            .property("type").to.equal("imgview");
                        tab.switchEditor("texteditor", function() {
                            expect(tabs.focussedTab.document.value).to.equal(text);
                            done();
                        });
                    });
                });
            });

            describe("clear(), getState() and setState()", function() {
                var state, info = {};
                it('should retrieve the state', function(done) {
                    state = tabs.getState();
                    info.pages = tabs.getTabs().map(function(tab) {
                        return tab.path || tab.id;
                    });
                    done();
                });
                it('should clear all tabs and pages', function(done) {
                    var count = 0, expected = 0;
                    tabs.getTabs().forEach(function(tab) {
                        expected += 2;
                        tab.on("unload", function() {
                            count++;
                        });
                        tab.document.on("unload", function() {
                            count++;
                        });
                    });
                    
                    tabs.getPanes()[0];
                    tabs.clear();
                    expect(tabs.getTabs(), "pages").length(0);
                    expect(tabs.getPanes(), "tabManager").length(0);

                    countEvents(count, expected, done);
                });
                it('should restore the state', function(done) {
                    tabs.setState(state, false, function(err) {
                        if (err) throw err.message;
                    });
                    var l = info.pages.length;
                    expect(tabs.getTabs()).length(l);
                    expect(tabs.getPanes()[0].getTabs()).length(l);
                    expect(tabs.focussedTab.pane.getTabs()).length(l);
                    expect(tabs.getTabs()[2].title).to.equal("listing.json");
                    expect(tabs.getTabs().map(function(tab) {
                        return tab.path || tab.id;
                    })).to.deep.equal(info.pages);
                    done();
                });
            });
//            describe("pauseTabResize() and continueTabResize()", function(){
//                it('should stop resizing of tabs', function(done) {
//                    var pane = tabs.focussedTab.pane;
//                    var w = pane.aml.getWidth();
//                    var pw = pane.getTab().aml.getWidth();
//                    tabs.pauseTabResize();
//                    pane.$ext.style.width = (200) + "px";
//                    expect(pane.getTab().aml.getWidth()).to.equal(pw);
//                    done();
//                });
//                it('should restore resizing of tabs', function(done) {
//                    done();
//                });
//            });

            describe("vsplit(), hsplit(), removeTab()", function() {
                it('should split a pane vertically, making the existing pane the top one', function(done) {
                    var pane = tabs.focussedTab.pane;
                    var btmtab = pane.vsplit(true);
                    expect(pane.aml.getTop()).lt(btmtab.aml.getTop());
                    tabs.focussedTab.attachTo(btmtab);
                    tabs.on("tabAfterActivate", function c1() {
                        expect(tabs.focussedTab.title).to.equal("file.txt");
                        expect(tabs.focussedTab.document.value).to.equal(text);
                        expect(tabs.focussedTab.editor).to.equal(tabs.focussedTab.pane.aml.getPage("editor::texteditor").editor);
                        tabs.off("tabAfterActivate", c1);
                        done();
                    });
                    tabs.focusTab("/file.txt");
                });
                it('should remove the bottom pane from a vertical split', function(done) {
                    var pane = tabs.getPanes()[1];
                    var tab = pane.getTab();
                    pane.unload();
                    expect(tabs.getPanes()).length(1);
                    expect(tabs.getTabs()).length(6);
                    tabs.focusTab(tab);
                    expect(tab.editor.name).to.equal("texteditor1");
                    expect.html(tab.pane.aml.getPage("editor::texteditor").$ext).visible;
                    done();
                });
                it('should split a pane vertically, making the existing pane the bottom one', function(done) {
                    var pane = tabs.focussedTab.pane;
                    var toptab = pane.vsplit();
                    expect(toptab.aml.getTop()).lt(pane.aml.getTop());
                    tabs.focussedTab.attachTo(toptab);
                    tabs.on("tabAfterActivate", function c1() {
                        expect(tabs.focussedTab.title).to.equal("file.txt");
                        expect(tabs.focussedTab.document.value).to.equal(text);
                        expect(tabs.focussedTab.editor).to.equal(tabs.focussedTab.pane.aml.getPage("editor::texteditor").editor);
                        tabs.off("tabAfterActivate", c1);
                        done();
                    });
                    tabs.focusTab("/file.txt");
                });
                it('should remove the top pane from a vertical split', function(done) {
                    var pane = tabs.getPanes()[0];
                    var tab = pane.getTab();
                    pane.unload();
                    expect(tabs.getPanes()).length(1);
                    expect(tabs.getTabs()).length(6);
                    tabs.focusTab(tab);
                    expect(tab.editor.name).to.equal("texteditor3");
                    expect(tab.pane.aml.getPage("editor::texteditor").$ext.style.display).to.not.equal("none");
                    done();
                });
                it('should split a pane horizontally, making the existing pane the left one', function(done) {
                    var pane = tabs.focussedTab.pane;
                    var righttab = pane.hsplit(true);
                    expect(pane.aml.getLeft()).lt(righttab.aml.getLeft());
                    tabs.focussedTab.attachTo(righttab);
                    tabs.focusTab("/file.txt");
                    expect(tabs.focussedTab.title).to.equal("file.txt");
                    expect(tabs.focussedTab.document.value).to.equal(text);
                    expect(tabs.focussedTab.editor).to.equal(tabs.focussedTab.pane.aml.getPage("editor::texteditor").editor);
                    done();
                });
                it('should remove the left pane from a horizontal split', function(done) {
                    var pane = tabs.getPanes()[0];
                    var tab = tabs.getPanes()[1].getTab();
                    pane.unload();
                    expect(tabs.getPanes()).length(1);
                    expect(tabs.getTabs()).length(6);
                    tabs.focusTab(tab);
                    expect(tab.editor.name).to.equal("texteditor4");
                    expect(tab.pane.aml.getPage("editor::texteditor").$ext.style.display).to.not.equal("none");
                    done();
                });
                it('should split a pane horizontally, making the existing pane the right one', function(done) {
                    var pane = tabs.focussedTab.pane;
                    var lefttab = pane.hsplit();
                    expect(lefttab.aml.getLeft()).lt(pane.aml.getLeft());
                    tabs.focussedTab.attachTo(lefttab);
                    tabs.focusTab("/file.txt");
                    expect(tabs.focussedTab.title).to.equal("file.txt");
                    expect(tabs.focussedTab.document.value).to.equal(text);
                    expect(tabs.focussedTab.editor).to.equal(tabs.focussedTab.pane.aml.getPage("editor::texteditor").editor);
                    done();
                });
                it('should remove the right pane from a horizontal split', function(done) {
                    var pane = tabs.getPanes()[1];
                    var tab = pane.getTab();
                    pane.unload();
                    expect(tabs.getPanes()).length(1);
                    expect(tabs.getTabs()).length(6);
                    tabs.focusTab(tab);
                    expect(tab.editor.name).to.equal("texteditor4");
                    expect(tab.pane.aml.getPage("editor::texteditor").$ext.style.display).to.not.equal("none");
                    done();
                });
                it('should be able to create a complex 5 pane layout', function(done) {
                    var first = tabs.getPanes()[0];
                    var right = first.hsplit(true);
                    right.width = "20%";
                    
                    var other = first.vsplit();
                    other.hsplit();
                    first.hsplit();
                
                    var pages = tabs.getTabs();
                    expect(pages).length(6);
                    tabs.getPanes().forEach(function(pane) {
                        pages.pop().attachTo(pane);
                    });
                    
                    expect(tabs.getPanes()).length(5);
                    expect(tabs.getTabs()).length(6);
                    
                    done();
                });
                it('should propertly serialize and deserialize', function(done) {
                    var cstate = tabs.getState();
                    var state = tabs.getState();
                    tabs.clear();
                    expect(tabs.getPanes()).length(0);
                    expect(tabs.getTabs()).length(0);
                    apf.z = 1;
                    tabs.setState(state, function(err) {
                        if (err) throw err.message;
                    });
                    console.log(cstate, tabs.getState());
                    expect(cstate).to.deep.equal(tabs.getState());
                    
                    expect(tabs.getPanes()).length(5);
                    expect(tabs.getTabs()).length(6);
                    
                    //Loop through state to check all the widths/heights
                    
//                    (function recur(parent, list) {
//                        list.forEach(function(state) {
//                            var p;
//                            
//                            if (state.type == "pane") {
//                                p = createPane(state).aml;
//                                parent.appendChild(p);
//                            }
//                            else if (state.type == "hsplitbox" || state.type == "vsplitbox") {
//                                p = parent.appendChild(new ui[state.type]({
//                                    splitter : true,
//                                    padding  : 3,
//                                    width    : state.width,
//                                    height   : state.height
//                                }));
//                            }
//                            else if (state.type == "tab") {
//                                var tab = findTab(state.id);
//                                if (!tab) {
//                                    state.pane = parent.cloud9pane;
//                                    state.init = init;
//                                    
//                                    open(state, function(err, tab) {
//                                        callback(err, tab);
//                                    });
//                                }
//                                else {
//                                    tab.attachTo(parent);
//                                }
//                                return;
//                            }
//                            recur(p, state.nodes);
//                        });
//                    })(bar, [cstate]);
                    done();
                });
            });
//            describe("activateTab() and focusTab()", function(){
//                it('should focus a tab', function(done) {
//                    tabs.activateTab();
//                    done();
//                });
//                it('should activate a tab on a focussed pane', function(done) {
//                    done();
//                });
//                it('should activate a tab but not focus it', function(done) {
//                    done();
//                });
//            });
//            describe("toggleButtons() and resizePanes()", function(){
//                it('should hide and show the pane buttons', function(done) {
//                    done();
//                });
//                it('should force resize the pane buttons', function(done) {
//                    done();
//                });
//            });
//            describe("All kinds of character sets and symbols", function(){
//                it('should display characters properly', function(done) {
//                    done();
//                });
//            });

            if (!onload.remain) {
                describe("unload()", function() {
                    it('should destroy all ui elements when it is unloaded', function(done) {
                        expect(tabs.getPanes()).length(5);
                        var els = tabs.getPanes();
                        tabs.unload();
                        
                        expect(tabs.getPanes()).length(0);
    
                        els.forEach(function(pane) {
                            expect(pane.aml.$amlDestroyed).to.equal(true);
                        });
                        done();
                    });
                });
                
                //@todo Idea: show in the tabs whether the editor is running atm
                // @todo test fs integration
                
                after(function(done) {
                    document.body.style.marginBottom = "";
                    done();
                });
            }
        });
        
        register();
    }
});