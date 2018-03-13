/*global describe it before after bar */

"use client";

require(["lib/chai/chai"], function (chai) {
    var expect = chai.expect;
    
    document.body.appendChild(document.createElement("div"))
        .setAttribute("id", "saveStatus");
    
    expect.setupArchitectTest([
        {
            packagePath: "plugins/c9.core/c9",
            startdate: new Date(),
            debug: true,
            hosted: true,
            local: false,
        },
        
        "plugins/c9.core/ext",
        "plugins/c9.core/http-xhr",
        "plugins/c9.core/util",
        "plugins/c9.ide.ui/lib_apf",
        "plugins/c9.ide.ui/tooltip",
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
            defaultEditor: "ace"
        },
        "plugins/c9.ide.editors/editor",
        "plugins/c9.ide.editors/tabmanager",
        "plugins/c9.ide.ui/focus",
        "plugins/c9.ide.editors/pane",
        "plugins/c9.ide.editors/tab",
        "plugins/c9.ide.ace/ace",
        "plugins/c9.ide.save/save",
        {
            packagePath: "plugins/c9.ide.save/autosave",
            ignoreFocusForTesting: true,
            changeTimeout: 5,
        },
        {
            packagePath: "plugins/c9.vfs.client/vfs_client_mock",
            storage: false
        },
        "plugins/c9.core/api",
        {
            packagePath: "plugins/c9.fs/fs",
            cli: true
        },
        "plugins/c9.fs/fs.cache.xml",
        
        {
            consumes: ["tabManager", "save", "fs", "autosave", "settings"],
            provides: [],
            setup: main
        }
    ]);
    
    function main(options, imports, register) {
        var settings = imports.settings
        var tabs = imports.tabManager;
        var fs = imports.fs;
        var save = imports.save;
        var autosave = imports.autosave;
        
        function changeTab(path, done) {
            var tab = tabs.findTab(path);
            tabs.focusTab(tab);
            tab.document.undoManager.once("change", function(argument) {
                done(tab);
            });
            tab.document.editor.ace.insert("test");
            return tab;
        }
        
        function createAndChangeTab(path, options, done) {
            if (!done) {
                done = options;
                options = {};
            }
            fs.writeFile(path, path, function(err) {
                if (err) throw err;
                
                options.path = path;
                tabs.open(options, function() {
                    changeTab(path, done);
                });
            });
        }
        
        describe('autosave', function() {
            this.timeout(5000);
            
            beforeEach(function(done) {
                tabs.once("ready", function() {
                    tabs.setState(null, function() {
                        tabs.getPanes()[0].focus();
                        done();
                    });
                });
            });
            
            it("should not autosave when restoring state", function(done) {
                settings.set("user/general/@autosave", false);
                var pane = tabs.getPanes()[0].hsplit(true);
                
                prepareTabs(testRestoreState);
                
                function prepareTabs(callback) {
                    createAndChangeTab("/autosave1.txt", function(tab) {
                        expect(tab.document.changed).to.ok;
                        createAndChangeTab("/__proto__", function() {
                            createAndChangeTab("/<h1>", function() {
                                createAndChangeTab("/__lookupSetter__", { pane: pane }, function() {
                                    callback();
                                });
                            });
                        });
                    });
                }
                function testRestoreState() {
                    settings.set("user/general/@autosave", true);
                    expect(tabs.getTabs().length).to.equal(4);
                    var state = tabs.getState(null, true);
                    tabs.setState(null, function() {
                        expect(tabs.getTabs().length).to.equal(0);
                        setTimeout(function() {
                            tabs.setState(state, function() {
                                expect(tabs.getTabs().length).to.equal(4);
                                expect(tabs.getTabs()[0].document.changed).to.ok;
                                setTimeout(function() {
                                    tabs.setState(null, function() {
                                        save.off("afterSave", preventSave);
                                        done();
                                    });
                                });
                            });
                        });
                    });
                }
                
                function preventSave() {
                    done(new Error("Save is called"));
                }
                save.once("afterSave", preventSave);
            });
            
            it("should automatically save a tab that is changed when editor is blurred", function(done) {
                settings.set("user/general/@autosave", true);
                var path = "/autosave2.txt";
                createAndChangeTab(path, function(tab) {
                    expect(tab.document.changed).to.ok;
                    createAndChangeTab("/__proto__", function() {
                    });
                    save.once("afterSave", function() {
                        fs.readFile(path, function(err, data) {
                            if (err) throw err;
                            expect(data).to.equal("test" + path);
                            expect(tab.document.changed).to.not.ok;
                            
                            fs.unlink(path, function() {
                                done();
                            });
                        });
                    });
                });
            });
            
            it("should automatically save after delay", function(done) {
                settings.set("user/general/@autosave", "afterDelay");
                var path = "/autosave2.txt";
                createAndChangeTab(path, function(tab) {
                    expect(tab.document.changed).to.ok;
                    
                    setTimeout(function() {
                        expect(tab.document.changed).to.ok;
                        tab.editor.ace.execCommand("insertstring", "x");
                    }, 10);
                    save.once("afterSave", function() {
                        fs.readFile(path, function(err, data) {
                            if (err) throw err;
                            expect(data).to.equal("testx" + path);
                            expect(tab.document.changed).to.not.ok;
                            
                            fs.unlink(path, function() {
                                done();
                            });
                        });
                    });
                });
            });
            
            if (!onload.remain) {
                describe("unload()", function() {
                    it('should destroy all ui elements when it is unloaded', function(done) {
                        autosave.unload();
                        done();
                    });
                });
                
                //@todo Idea: show in the tabs whether the editor is running atm
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