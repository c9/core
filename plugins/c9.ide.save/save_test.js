/*global describe it before after bar */

"use client";

require(["lib/architect/architect", "lib/chai/chai", "/vfs-root", "async"], 
  function (architect, chai, baseProc) {
    var expect = chai.expect;
    var async = require("async");
    
    document.body.appendChild(document.createElement("div"))
        .setAttribute("id", "saveStatus");
    
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
        "plugins/c9.ide.editors/pane",
        "plugins/c9.ide.editors/tab",
        "plugins/c9.ide.ace/ace",
        "plugins/c9.ide.save/save",
        "plugins/c9.vfs.client/vfs_client",
        "plugins/c9.vfs.client/endpoint",
        "plugins/c9.ide.auth/auth",
        "plugins/c9.core/api",
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
            consumes: ["tabManager", "save", "fs", "dialog.file", "dialog.question"],
            provides: [],
            setup: main
        }
    ], architect);
    
    function main(options, imports, register) {
        var tabs = imports.tabManager;
        var fs = imports.fs;
        var save = imports.save;
        var filesave = imports["dialog.file"];
        var question = imports["dialog.question"];
        
        expect.html.setConstructor(function(tab) {
            if (typeof tab == "object")
                return tab.pane.aml.getPage("editor::" + tab.editorType).$ext;
        });
        
        function changeTab(path, callback) {
            var tab = tabs.findTab(path);
            
            tab.document.undoManager.once("change", function() {
                expect(tab.document.changed).to.ok;
                setTimeout(function() {
                    callback(null, tab);
                }, 0);
            });
            tabs.focusTab(tab);
            expect(tab.document.changed).to.not.ok;
            var length = tab.document.undoManager.length;
            tab.document.getSession().session.$undoManager.startNewGroup();
            tab.document.editor.ace.insert("test");
            expect(tab.document.undoManager.length).to.equal(length + 1);
            expect(tab.document.changed).to.ok;
        }
        
        function createAndOpenFiles(done) {
            var count = 0;
            files.slice(0, 3).forEach(function(path, i) {
                count++;
                fs.writeFile(path, path, function(err) {
                    if (err) return done(err);
                    tabs.openFile(path, function(err) {
                        if (err) return done(err);
                        if (--count === 0)
                            done();
                    });
                });
            });
        }
        
        function destroyTabs(done) {
            tabs.getTabs().forEach(function(tab) {
                tab.unload();
            });
            done();
        }

        var TIMEOUT = 15;
        var files = [];
        describe('save', function() {
            this.timeout(10000);
            
            before(function(done) {
                files = ["/save1.txt", "/save2.txt", "/save3.txt"];
                
                bar.$ext.style.background = "rgba(220, 220, 220, 0.93)";
                bar.$ext.style.position = "fixed";
                bar.$ext.style.left = "20px";
                bar.$ext.style.right = "20px";
                bar.$ext.style.bottom = "20px";
                bar.$ext.style.height = "150px";
      
                document.body.style.marginBottom = "180px";
                
                tabs.once("ready", function() {
                    tabs.getPanes()[0].focus();
                    done();
                });
            });
            after(function(done) {
                async.each(files, function(path, next) {
                    fs.unlink(path, function() {
                        next();
                    });
                }, done);
            });
            
            describe("save", function() {
                before(createAndOpenFiles);
                
                it('should save a tab that is changed', function(done) {
                    var path = "/save1.txt";
                    var count = 0;
                    
                    var c1 = function() { count++; };
                    
                    save.on("beforeSave", c1);
                    save.on("afterSave", c1);
                    
                    changeTab(path, function(e, tab) {
                        save.save(tab, null, function(err) {
                            if (err) throw err;
                            expect(tab.document.changed).to.not.ok;
                            
                            fs.readFile(path, function(err, data) {
                                if (err) throw err;
                                expect(data).to.equal("test" + path);
                                expect(count).to.equal(2);
                                save.off("beforeSave", c1);
                                save.off("afterSave", c1);
                                done();
                            });
                        });
                    });
                });
                it('should queue saves when called sequentially', function(done) {
                    var tab = tabs.focussedTab;
                    var count = 0;
                    save.save(tab, null, function(err) {
                        if (err) throw err;
                        expect(count).to.equal(0);
                        count++;
                    });
                    tab.editor.ace.insert("test");
                    setTimeout(function() {
                        save.save(tab, null, function(err) {
                            if (err) throw err;
                            expect(count).to.equal(1);
                            done();
                        });
                    });
                });
                it('should save a tab at a new path/filename', function(done) {
                    changeTab("/save2.txt", function(e, tab) {
                        var path = "/save2b.txt";
                        files.push(path); // cleanup
                        
                        save.save(tab, { path: path }, function(err) {
                            if (err) throw err;
                            
                            expect(tab.path).to.equal(path);
                            expect(tab.document.changed).to.not.ok;
                            
                            fs.readFile(path, function(err, data) {
                                if (err) throw err;
                                expect(data).to.equal("test/save2.txt");
                                
                                fs.unlink(path, function() {
                                    setTimeout(function() {
                                        // give some time for tab to finish animation
                                        expect(tabs.getTabs().indexOf(tab)).to.equal(-1);
                                        done();
                                    }, 10);
                                });
                            });
                        });
                    });
                });
                it('should show the saveAs dialog when saving a newfile without path in the options', function(done) {
                    var path = "/shouldnotsave.txt";
                    files.push(path); // cleanup
                    
                    tabs.open({
                        active: true,
                        path: path,
                        document: {
                            value: "test",
                            meta: {
                                newfile: true
                            }
                        }
                    }, function(err, tab) {
                        expect(err).to.not.ok;
                        save.save(tab, null, function(err) {
                            expect(err).to.ok;
                            expect(seen).to.ok;
                            tab.close();
                            done();
                        });
                    });
                    
                    var seen = false;
                    setTimeout(function() {
                        var win = filesave.getElement("window");
                        var input = filesave.getElement("txtFilename");
                        expect(win.visible).to.ok;
                        expect(input.value).to.equal(path.substr(1));
                        seen = true;
                        win.hide();
                    }, TIMEOUT);
                });
                it('should not show the saveAs dialog when saving a newfile with path in the options', function(done) {
                    var path = "/shouldnotsave.txt";
                    
                    tabs.open({
                        active: true,
                        document: {
                            value: "test",
                            meta: {
                                newfile: true
                            }
                        }
                    }, function(err, tab) {
                        expect(err).to.not.ok;
                        save.save(tab, { path: path }, function(err) {
                            expect(err).to.not.ok;
                            expect(tab.document.changed).not.ok;
                            expect(tab.document.meta.newfile).not.ok;
                            tab.close();
                            done();
                        });
                    });
                });
                it('should be triggered when closing a changed tab', function(done) {
                    var path = "/save3.txt";
                    changeTab(path, function(e, tab) {
                        save.once("beforeWarn", function() {
                            question.once("show", function() {
                                save.once("afterSave", function() {
                                    fs.readFile(path, function(err, data) {
                                        if (err) throw err;
                                        expect(data).to.equal("test" + path);
                                        done();
                                    });
                                });
                                
                                question.getElement("yes").dispatchEvent("click");
                            });
                        });
                        
                        tab.close();
                    });
                });
                it('should not be triggered when closing an unchanged tab', function(done) {
                    var path = "/save1.txt";
                    var tab = tabs.findTab(path);
                    save.once("beforeWarn", function() {
                        if (tab)
                            throw new Error();
                    });
                    tab.close();
                    setTimeout(function() {
                        tab = tabs.findTab(path);
                        expect(tab).to.not.ok;
                        done();
                    });
                });
                it('should not be triggered when closing a new empty file', function(done) {
                    tabs.open({
                        active: true,
                        document: {
                            value: "",
                            meta: {
                                newfile: true
                            }
                        }
                    }, function(err, tab) {
                        expect(err).to.not.ok;
                        save.once("beforeWarn", function(_tab) {
                            if (tab !== _tab) return;
                            throw new Error();
                        });
                        
                        setTimeout(function() {
                            tab.close();
                            
                            setTimeout(function() {
                                tab = tabs.findTab(tab.path);
                                expect(tab).to.not.ok;
                                done();
                            });
                        });
                    });
                });
            });
            describe("saveAs", function() {
                before(createAndOpenFiles);
                after(destroyTabs);
                
                it('should save a file under a new filename', function(done) {
                    var tab = tabs.focussedTab;
                    files.push("/save1b.txt");
                    fs.unlink("/save1b.txt", function() {
                        save.saveAs(tab, function(err) {
                            expect(err).to.not.ok;
                            expect(seen).to.ok;
                            done();
                        });
                        
                        var seen = false;
                        setTimeout(function() {
                            var win = filesave.getElement("window");
                            expect(win.visible).to.ok;
                            seen = true;
                            filesave.getElement("txtFilename").setValue("save1b.txt");
                            filesave.getElement("btnChoose").dispatchEvent("click");
                        }, TIMEOUT);
                    });
                });
                it('should trigger saveAs and then cancel it', function(done) {
                    var tab = tabs.focussedTab;
                    save.saveAs(tab, function(err) {
                        expect(err).to.ok;
                        expect(seen).to.ok;
                        done();
                    });
                    
                    var seen = false;
                    setTimeout(function() {
                        var win = filesave.getElement("window");
                        expect(win.visible).to.ok;
                        filesave.getElement("txtFilename").setValue("save1.txt");
                        filesave.getElement("btnChoose").dispatchEvent("click");
                        setTimeout(function() {
                            var win = question.getElement("window");
                            seen = true;
                            expect(win.visible).to.ok;
                            question.getElement("no").dispatchEvent("click");
                        }, TIMEOUT);
                    }, TIMEOUT);
                });
            });
            describe("revertToSaved", function() {
                before(createAndOpenFiles);
                after(destroyTabs);
                
                it('should revert changed tab', function(done) {
                    changeTab("/save1.txt", function(e, tab) {
                        save.revertToSaved(tab, function(err) {
                            expect(err).to.not.ok;
                            expect(tab.document.changed).to.not.ok;
                            expect(tab.document.value).to.equal("/save1.txt");
                            expect(tab.document.undoManager.length).to.equal(2);
                            expect(tab.document.undoManager.position).to.equal(1);
                            expect(tab.document.undoManager.isAtBookmark()).to.ok;
                            expect(tab.classList.names.indexOf("loading")).to.equal(-1);
                            done();
                        });
                    });
                });
            });
            describe("saveAll", function() {
                before(createAndOpenFiles);
                after(destroyTabs);
                
                it('should save all changed files', function(done) {
                    var page3 = tabs.findTab("/save3.txt");
                    changeTab("/save1.txt", function(e, page1) {
                        changeTab("/save2.txt", function(e, page2) {
                            expect(page1.document.changed).to.ok;
                            expect(page2.document.changed).to.ok;
                            expect(page3.document.changed).to.not.ok;
                            
                            save.saveAll(function(err) {
                                if (err) throw err;
                                
                                expect(page1.document.changed).to.not.ok;
                                expect(page2.document.changed).to.not.ok;
                                expect(page3.document.changed).to.not.ok;
                                done();
                            });
                        });
                    });
                });
            });
            describe("saveAllInteractive", function() {
                before(createAndOpenFiles);
                after(destroyTabs);
                
                it.skip('should be triggered when closing multiple pages that are changed', function(done) {
                    changeTab("/save1.txt", function(e, page1) {
                        changeTab("/save2.txt", function(e, page2) {
                            changeTab("/save3.txt", function(e, page3) {
                                var pages = [page1, page2, page3];
                                
                                save.saveAllInteractive(pages, function(result) {
                                    expect(result).to.equal(save.YESTOALL);
                                    done();
                                });
                                
                                question.once("show", function() {
                                    question.getElement("yestoall").dispatchEvent("click");
                                });
                            });
                        });
                    });
                });
            });
            if (!onload.remain) {
                describe("unload()", function() {
                    it('should destroy all ui elements when it is unloaded', function(done) {
                        save.unload();
                        done();
                    });
                });
                
                // @todo Idea: show in the tabs whether the editor is running atm
                // @todo test fs integration
                
                after(function(done) {
                    document.body.style.marginBottom = "";
                    tabs.unload();
                    done();
                });
            }
        });
        
        register();
    }
});