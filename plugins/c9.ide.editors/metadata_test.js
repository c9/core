/*global describe it before after bar apf*/

"use client";

require(["lib/architect/architect", "lib/chai/chai", "/vfs-root"], 
  function (architect, chai, baseProc) {
    var expect = chai.expect;
    
    expect.setupArchitectTest([
        {
            packagePath: "plugins/c9.core/c9",
            startdate: new Date(),
            debug: true,
            hosted: true,
            local: false,
            workspaceId: "javruben/dev",
            davPrefix: "/"
        },
        
        "plugins/c9.core/ext",
        "plugins/c9.core/http-xhr",
        "plugins/c9.core/util",
        "plugins/c9.ide.ui/lib_apf",
        "plugins/c9.ide.ui/menus",
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
        "plugins/c9.ide.editors/metadata",
        "plugins/c9.ide.editors/pane",
        "plugins/c9.ide.editors/tab",
        "plugins/c9.ide.ace/ace",
        {
            packagePath: "plugins/c9.ide.terminal/terminal",
            testing: true
        },
        {
            packagePath: "plugins/c9.vfs.client/vfs_client"
        },
        "plugins/c9.vfs.client/endpoint",
        "plugins/c9.ide.auth/auth",
        "plugins/c9.core/api",
        "plugins/c9.fs/proc",
        {
            packagePath: "plugins/c9.fs/fs",
            baseProc: baseProc
        },
        "plugins/c9.fs/fs.cache.xml",
        
        "plugins/c9.ide.dialog/dialog",
        "plugins/c9.ide.dialog.common/alert",
        "plugins/c9.ide.dialog.common/alert_internal",
        "plugins/c9.ide.dialog.common/confirm",
        "plugins/c9.ide.dialog.common/filechange",
        "plugins/c9.ide.dialog.common/fileoverwrite",
        "plugins/c9.ide.dialog.common/fileremove",
        "plugins/c9.ide.dialog.common/question",
        "plugins/c9.ide.dialog.file/file",
        
        {
            consumes: ["tabManager", "fs", "settings", "metadata", "dialog.question"],
            provides: [],
            setup: main
        }
    ], architect);
    
    function main(options, imports, register) {
        var tabs = imports.tabManager;
        var fs = imports.fs;
        var settings = imports.settings;
        var metadata = imports.metadata;
        var question = imports["dialog.question"];
        
        expect.html.setConstructor(function(tab) {
            if (typeof tab == "object")
                return tab.pane.aml.getPage("editor::" + tab.editorType).$ext;
        });
        
        describe('metadata', function() {
            this.timeout(20000);
            
            before(function(done) {
                bar.$ext.style.background = "rgba(220, 220, 220, 0.93)";
                bar.$ext.style.position = "fixed";
                bar.$ext.style.left = "20px";
                bar.$ext.style.right = "20px";
                bar.$ext.style.bottom = "20px";
                bar.$ext.style.height = "33%";
      
                // document.body.style.marginBottom = "33%";
                
                fs.rmdir("/.c9/metadata", { recursive: true }, function(err) {
                    if (err) throw err;
                    
                    tabs.once("ready", function() {
                        tabs.getPanes()[0].focus();
                        tabs.openFile("/file.js", true, function() {
                            tabs.openFile("/file.txt", false, function() {
                                tabs.openFile("/fileLink.txt", false, function() {
                                    done();
                                });
                            });
                        });
                    });
                });
            });
            
            describe("Triggering save", function() {
                it('should trigger save when a tab is active and changed', function(done) {
                    var editor = tabs.focussedTab.editor;
                    fs.once("afterMetadata", function() {
                        fs.exists("/.c9/metadata/workspace/file.js", function(exists) {
                            done();
                        });
                    });
                    
                    editor.scrollTo(100, 5);
                    
                    setTimeout(function() {
                        settings.save(true);
                    }, 100);
                });
                it('should trigger save when a tab is changed and closed', function(done) {
                    var tab = tabs.findTab("/file.txt");
                    tabs.focusTab(tab);
                    var editor = tabs.focussedTab.editor;
                    editor.scrollTo(0, 10);
                    
                    setTimeout(function() {
                        fs.once("afterMetadata", function() {
                            fs.exists("/.c9/metadata/workspace/file.txt", function(exists) {
                                expect(exists).to.ok;
                                done();
                            });
                        });
                    
                        tab.close();
                    }, 100);
                });
            });
            describe("Loading metadata", function() {
                it('should load metadata properly when a file has metadata', function(done) {
                    fs.exists("/.c9/metadata/workspace/file.txt", function(exists) {
                        expect(exists).to.ok;
                        
                        tabs.openFile("/file.txt", true, function(err, tab) {
                            if (err) throw err;
                            
                            var state = tab.document.getState();
                            if (state.ace.selection.start.column === 10
                              && state.ace.selection.start.row === 0
                              && state.ace.selection.end.column === 10
                              && state.ace.selection.end.row === 0
                              && !tab.document.changed)
                                done();
                            else
                                throw new Error("Selection is not correct: ", 
                                    state.ace.selection);
                            
                            tab.close();
                        });
                    });
                });
                it('should load metadata properly even when the file is not active when it\'s opened', function(done) {
                    tabs.openFile("/file.txt", false, function(err, tab) {
                        if (err) throw err;
                        
                        tab.activate();
                        
                        var state = tab.document.getState();
                        if (state.ace.selection.start.column === 10
                          && state.ace.selection.start.row === 0
                          && state.ace.selection.end.column === 10
                          && state.ace.selection.end.row === 0
                          && !tab.document.changed)
                            done();
                        else
                            throw new Error("Selection is not correct");
                    });
                });
                it('should load metadata for a new file', function(done) {
                    fs.writeFile("/.c9/metadata/workspace/newfile.txt", 
                        '{"changed":true,"filter":false,"title":"Untitled1","tooltip":"/Untitled1","value":"asdasdasdasd","undoManager":{"mark":-1,"position":11,"stack":[[{"group":"doc","deltas":[{"action":"insertText","range":{"start":{"row":0,"column":0},"end":{"row":0,"column":1}},"text":"a"}]}],[{"group":"doc","deltas":[{"action":"insertText","range":{"start":{"row":0,"column":1},"end":{"row":0,"column":2}},"text":"s"}]}],[{"group":"doc","deltas":[{"action":"insertText","range":{"start":{"row":0,"column":2},"end":{"row":0,"column":3}},"text":"d"}]}],[{"group":"doc","deltas":[{"action":"insertText","range":{"start":{"row":0,"column":3},"end":{"row":0,"column":4}},"text":"a"}]}],[{"group":"doc","deltas":[{"action":"insertText","range":{"start":{"row":0,"column":4},"end":{"row":0,"column":5}},"text":"s"}]}],[{"group":"doc","deltas":[{"action":"insertText","range":{"start":{"row":0,"column":5},"end":{"row":0,"column":6}},"text":"d"}]}],[{"group":"doc","deltas":[{"action":"insertText","range":{"start":{"row":0,"column":6},"end":{"row":0,"column":7}},"text":"a"}]}],[{"group":"doc","deltas":[{"action":"insertText","range":{"start":{"row":0,"column":7},"end":{"row":0,"column":8}},"text":"s"}]}],[{"group":"doc","deltas":[{"action":"insertText","range":{"start":{"row":0,"column":8},"end":{"row":0,"column":9}},"text":"d"}]}],[{"group":"doc","deltas":[{"action":"insertText","range":{"start":{"row":0,"column":9},"end":{"row":0,"column":10}},"text":"a"}]}],[{"group":"doc","deltas":[{"action":"insertText","range":{"start":{"row":0,"column":10},"end":{"row":0,"column":11}},"text":"s"}]}],[{"group":"doc","deltas":[{"action":"insertText","range":{"start":{"row":0,"column":11},"end":{"row":0,"column":12}},"text":"d"}]}]]},"ace":{"folds":[],"scrolltop":0,"scrollleft":0,"selection":{"start":{"row":0,"column":12},"end":{"row":0,"column":12},"isBackwards":false},"options":{"newLineMode":"auto","tabSize":4,"useSoftTabs":true,"useWrapMode":null,"wrapToView":null},"firstLineState":0}}', 
                    function(err, data) {
                        expect(err).to.not.ok;
                        
                        tabs.open({
                            path: "/newfile.txt", 
                            active: true, 
                            init: true,
                            document: { meta: { newfile: true }}
                        }, function(err, tab) {
                            if (err) throw err;
                            
                            expect(tab.document.value).to.equal("asdasdasdasd");
                            tab.close();
                            done();
                        });
                    });
                });
                it('should load metadata properly for loading an existing pane that is not a file', function(done) {
                    tabs.openEditor("terminal", true, function(err, tab) {
                        if (err) throw err;
                        
                        setTimeout(function() {
                            var state = tab.getState(true);
                            var name = tab.name;
                            
                            tab.editor.write("ls -l\n");
                            
                            setTimeout(function() {
                                var docstate = tab.getState().document;
                                var value = docstate.terminal.scrolltop;
                                
                                fs.once("afterUnlink", function(e) {
                                    fs.metadata("/_/_/" + name, docstate, function(err) {
                                        if (err) throw err;
                                        
                                        state.name = name;
                                        state.active = true;
                                        
                                        fs.exists("/.c9/metadata/" + name, function(exists) {
                                            if (!exists)
                                                throw new Error("File not found");
                                        
                                            fs.once("afterReadFile", function(e) {
                                                setTimeout(function() {
                                                    var state = tab.document.getState();
                                                    expect(state.terminal.scrolltop, 
                                                        "State did not get preserved").equals(value);
                                                    done();
                                                }, 1000);
                                            });
                                            tabs.open(state, function(err, pg) {
                                                if (err) throw err;
                                                tab = pg;
                                            });
                                        });
                                    });
                                });
                                
                                tab.close();
                                settings.save(true);
                            }, 1000);
                        }, 1000);
                    });
                });
                it('should work well together with state set when opening tab', function(done) {
                    var tab = tabs.findTab("/file.js");
                    tabs.once("tabDestroy", function() {
                        setTimeout(function() {
                            fs.exists("/.c9/metadata/workspace/file.js", function(exists) {
                                expect(exists, "File not found").ok;
                                    
                                tabs.open({
                                    path: "/file.js",
                                    active: true,
                                    document: {
                                        ace: {
                                            jump: {
                                                row: 200,
                                                column: 10,
                                                select: {
                                                    row: 202,
                                                    column: 20
                                                }
                                            }
                                        }
                                    }
                                }, function(err, tab) {
                                    setTimeout(function() {
                                        var state = tab.document.getState();
                                        expect(state.ace.selection.start.column).equals(10);
                                        expect(state.ace.selection.start.row).equals(200);
                                        expect(state.ace.selection.end.column).equals(20);
                                        expect(state.ace.selection.end.row).equals(202);
                                        done();
                                    });
                                });
                            });
                        });
                    });
                    tab.close();
                });
            });
            describe("Content Collision", function() {
                it('should load contents stored in metadata', function(done) {
                    var path = "/collision.js";
                    fs.writeFile(path, String(Date.now()), function(err) {
                        if (err) throw err;
                        
                        tabs.openFile(path, true, function(err, tab) {
                            if (err) throw err;
                            
                            var state = tab.getState(true);
                            var value = String(Date.now());
                            
                            // Timeout to give the change the chance to propagate
                            setTimeout(function() {
                                expect(tab.document.meta.timestamp, "Timing issue").to.ok;
                                
                                fs.once("afterMetadata", function(e) {
                                    tabs.open(state, function(err, tab) {
                                        expect(tab.document.value).equals(value);
                                        expect(tab.document.undoManager.position).equals(0);
                                        expect(tab.document.undoManager.length).equals(1);
                                        expect(tab.document.changed).equals(true);
                                        done();
                                    });
                                });
                                
                                tab.document.value = value;
                                
                                setTimeout(function() {
                                    tab.close(); // Forces saving metadata
                                }, 10);
                            }, 1000); // Give time to collect timestamp
                        });
                    });
                });
                it('should warn if file contents on disk is newer than stored in metadata', function(done) {
                    var path = "/collision2.js";
                    fs.writeFile(path, Date.now() + "a", function(err) {
                        if (err) throw err;
                        
                        tabs.openFile(path, true, function(err, tab) {
                            if (err) throw err;
                            
                            var state = tab.getState(true);
                            var value = Date.now() + "b";
                            
                            // Timeout to give the change the chance to propagate
                            setTimeout(function() {
                                expect(tab.document.meta.timestamp, "Timing issue").to.ok;
                                
                                fs.once("afterMetadata", function(e) {
                                    setTimeout(function() {
                                        fs.writeFile(path, Date.now() + "c", function(err) {
                                            if (err) throw err;
                                            
                                            var curTab;
                                            
                                            question.once("show", function() {
                                                expect(question.getElement("window").visible).ok;
                                                question.getElement("yes").dispatchEvent("click");
                                                
                                                setTimeout(function() {
                                                    expect(curTab.document.value, "value").not.equals(value);
                                                    expect(curTab.document.undoManager.position, "position").equals(1);
                                                    expect(curTab.document.undoManager.length, "length").equals(2);
                                                    expect(curTab.document.changed, "changed").equals(false);
                                                    done();
                                                }, 10);
                                            });
                                            
                                            expect(state.value).to.not.equal(value);
                                            tabs.open(state, function(err, tab) {
                                                curTab = tab;
                                            });
                                        });
                                    }, 1100); // wait at least a second because Node 10 and lower has that change granularity
                                });
                                
                                tab.document.value = value;
                                
                                setTimeout(function() {
                                    tab.close(); // Forces saving metadata
                                }, 10); // Time to process setting of value
                            }, 1000); // Give time to collect timestamp
                        });
                    });
                });
                it('should warn remove undo data from metadata if file on disk is different', function(done) {
                    var path = "/collision3.js";
                    fs.writeFile(path, Date.now() + "a", function(err) {
                        if (err) throw err;
                        
                        tabs.openFile(path, true, function(err, tab) {
                            if (err) throw err;
                            
                            var state = tab.getState(true);
                            var value = Date.now() + "b";
                            
                            tab.document.value = value;
                            
                            // Timeout to give the change the chance to propagate
                            setTimeout(function() {
                                tab.document.undoManager.bookmark();
                                expect(tab.document.changed).not.ok;
                                
                                fs.once("afterMetadata", function(e) {
                                    setTimeout(function() {
                                        fs.writeFile(path, Date.now() + "c", function(err) {
                                            if (err) throw err;
                                            
                                            tabs.open(state, function(err, tab) {
                                                setTimeout(function() {
                                                    expect(tab.document.value).not.equals(value);
                                                    expect(tab.document.undoManager.position).equals(-1);
                                                    expect(tab.document.undoManager.length).equals(0);
                                                    expect(tab.document.changed).equals(false);
                                                    
                                                    fs.unlink(path, function() {
                                                        done();
                                                    });
                                                }, 500);
                                            });
                                        });
                                    }, 1100);
                                });
                                
                                tab.close(); // Forces saving metadata
                            });
                        });
                    });
                });
            });
            if (!onload.remain) {
                after(function(done) {
                    // document.body.style.marginBottom = "";
                    metadata.unload();
                    tabs.unload();
                    bar.destroy(true, true);
                    done();
                });
            }
        });
        
        register();
    }
});