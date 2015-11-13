/*global describe it before after = */

"use client";

require(["lib/architect/architect", "lib/chai/chai", "/vfs-root"], 
  function (architect, chai, baseProc) {
    var expect = chai.expect;
    
    expect.setupArchitectTest([
        {
            packagePath: "plugins/c9.core/c9",
            workspaceId: "javruben/dev",
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
        "plugins/c9.ide.ui/forms",
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
        {
            packagePath: "plugins/c9.ide.editors/tabmanager",
            testing: 2
        },
        "plugins/c9.ide.ui/focus",
        "plugins/c9.ide.editors/pane",
        "plugins/c9.ide.editors/tab",
        "plugins/c9.ide.run/output",
        "plugins/c9.ide.console/console",
        {
            packagePath: "plugins/c9.ide.terminal/terminal",
            testing: true
        },
        "plugins/c9.ide.run/run",
        "plugins/c9.fs/proc",
        "plugins/c9.vfs.client/vfs_client",
        "plugins/c9.vfs.client/endpoint",
        "plugins/c9.ide.auth/auth",
        {
            packagePath: "plugins/c9.fs/fs",
            baseProc: baseProc
        },
        "plugins/c9.fs/fs.cache.xml",
        
        // Mock plugins
        {
            consumes: ["apf", "ui", "Plugin"],
            provides: [
                "commands", "menus", "commands", "layout", "watcher", 
                "preferences", "anims", "clipboard", "dialog.alert", "auth.bootstrap",
                "dialog.question", "debugger", "run.gui", "info", "dialog.error",
                "dialog.file"
            ],
            setup: expect.html.mocked
        },
        {
            consumes: ["console", "tabManager", "terminal", "output"],
            provides: [],
            setup: main
        }
    ], architect);
     
    function main(options, imports, register) {
        var tabs = imports.tabManager;
        var cnsl = imports.console;
        
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
        
        var startCount;
        
        describe('console', function() {
            before(function(done) {
                apf.config.setProperty("allow-select", false);
                apf.config.setProperty("allow-blur", false);
      
                document.documentElement.style.paddingBottom = "200px";
                
                cnsl.once("ready", function(){
                    bar.$ext.style.background = "rgba(220, 220, 220, 0.93)";
                    bar.$ext.style.position = "fixed";
                    bar.$ext.style.left = "20px";
                    bar.$ext.style.right = "20px";
                    bar.$ext.style.bottom = "20px";
                    bar.$ext.style.height = "150px";
                    
                    cnsl.getPanes()[0].focus();
                    startCount = tabs.getTabs().length;
                    done();
                });
            });
            
           describe("open(), openFile(), openEditor() and reload()", function(){
               it('should open a pane with just an editor', function(done) {
                   cnsl.openEditor("terminal", true, function(err, tab) {
                       expect(tabs.getTabs()).length(startCount + 1);
                       
                       expect(tabs.focussedTab)
                           .to.exist
                           .to.equal(tab)
                           //.property("path").to.equal(vpath);
                       done();
                   });
               });
           });
           describe("getTabs(), getPanes()", function(){
               it('should return a list containing all the pages', function(done) {
                   expect(tabs.getTabs()).length.gt(startCount);
                   done();
               });
               it('should return a list containing all the tabs', function(done) {
                   expect(tabs.getPanes()).length(1);
                   done();
               });
               it('should return an editor of a tab', function(done) {
                   var pages = tabs.getTabs();
                   expect(pages[pages.length - 1].editor)
                       .property("type").to.equal("terminal");
                   done();
               });
           });
           describe("clear(), getState() and setState()", function(){
               var state, info = {};
               it('should retrieve the state', function(done) {
                   state = cnsl.getState();
                   info.pages = tabs.getTabs().map(function(tab) {
                       return tab.path || tab.id;
                   });
                   done();
               });
               it('should clear all tabs and pages', function(done) {
                   var count = 0, expected = 0;
                   tabs.getTabs().forEach(function(tab) {
                       expected += 2;
                       tab.on("unload", function(){
                           count++;
                       });
                       tab.document.on("unload", function(){
                           count++;
                       });
                   });
                   
                   cnsl.getPanes()[0];
                   cnsl.clear();
                   expect(tabs.getTabs(), "pages").length(0);
                   expect(cnsl.getPanes(), "tabManager").length(0);

                   countEvents(count, expected, done);
               });
               it('should restore the state', function(done) {
                   cnsl.setState(state, false, function(err) {
                       if (err) throw err.message;
                   });
                   var l = info.pages.length;
                   var pages = tabs.getTabs();
                   
                   expect(pages).length(l);
                   expect(tabs.getPanes()[0].getTabs()).length(l);
                   expect(tabs.focussedTab.pane.getTabs()).length(l);
                   
                   // Wait for the title to load
                   setTimeout(function(){
                       expect(tabs.getTabs().map(function(tab) {
                           return tab.path || tab.id;
                       })).to.deep.equal(info.pages);
                       done();
                   }, 1000);
               });
           });
           describe("vsplit(), hsplit(), removeTab()", function(){
               this.timeout(10000);
               
               it('should split a pane vertically, making the existing pane the top one', function(done) {
                   var tab = tabs.focussedTab;
                   var pane = tabs.focussedTab.pane;
                   
                   tabs.focusTab(tabs.getTabs()[0]);
                   var name = tabs.getTabs()[0].editor.name;
                   tabs.focusTab(tab);
                   
                   var btmtab = pane.vsplit(true);
                   expect(pane.aml.getTop()).lt(btmtab.aml.getTop());
                   tabs.focussedTab.attachTo(btmtab);
                   tabs.on("tabAfterActivate", function c1(){
                       expect(tabs.focussedTab.editor.name).to.equal(name);
                       expect(tab.isActive()).to.ok;
                       tabs.off("tabAfterActivate", c1)
                       done();
                   });
                   tabs.focusTab(tabs.getTabs()[0]);
               });
               it('should remove the bottom pane from a vertical split', function(done) {
                   var pane = tabs.getPanes()[1];
                   var tab = pane.getTab();
                   pane.unload();
                   expect(tabs.getPanes()).length(1);
                   expect(tabs.getTabs()).length(startCount + 1);
                   tabs.focusTab(tab);
                   expect(tab.editor.name).to.match(/^terminal/);
                   expect(tab.pane.aml.getPage("editor::terminal").$ext.style.display).to.not.equal("none");
                   done();
               });
               it('should split a pane vertically, making the existing pane the bottom one', function(done) {
                   var pane = tabs.focussedTab.pane;
                   var toptab = pane.vsplit();
                   expect(toptab.aml.getTop()).lt(pane.aml.getTop());
                   var tab = tabs.getTabs()[0];
                   tab.attachTo(toptab);
                   tabs.focusTab(tab);
                   done();
               });
               it('should remove the top pane from a vertical split', function(done) {
                   var pane = tabs.getPanes()[0];
                   var tab = pane.getTab();
                   pane.unload();
                   expect(tabs.getPanes()).length(1);
                   expect(tabs.getTabs()).length(3);
                   tabs.focusTab(tab);
                   expect(tab.editor.name).to.match(/^terminal/);
                   expect(tab.pane.aml.getPage("editor::terminal").$ext.style.display).to.not.equal("none");
                   done();
               });
               it('should split a pane horizontally, making the existing pane the left one', function(done) {
                   var pane = tabs.focussedTab.pane;
                   var righttab = pane.hsplit(true);
                   expect(pane.aml.getLeft()).lt(righttab.aml.getLeft());
                   tabs.focussedTab.attachTo(righttab);
                   tabs.focusTab(tabs.getTabs()[0]);
                   
                   setTimeout(function(){
                       expect(tabs.focussedTab.title).to.match(/^bash - |^Terminal/);
                       done();
                   }, 1000);
               });
               it('should remove the left pane from a horizontal split', function(done) {
                   var pane = tabs.getPanes()[0];
                   var tab = tabs.getPanes()[1].getTab();
                   pane.unload();
                   expect(tabs.getPanes()).length(1);
                   expect(tabs.getTabs()).length(3);
                   tabs.focusTab(tab);
                   expect(tab.editor.name).to.match(/^terminal/);
                   expect(tab.pane.aml.getPage("editor::terminal").$ext.style.display).to.not.equal("none");
                   done();
               });
               it('should split a pane horizontally, making the existing pane the right one', function(done) {
                   var pane = tabs.focussedTab.pane;
                   var leftPane = pane.hsplit();
                   expect(leftPane.aml.getLeft()).lt(pane.aml.getLeft());
                   tabs.focussedTab.attachTo(leftPane);
                   var newTab = tabs.getTabs()[1];
                   tabs.focusTab(newTab);
                   expect(tabs.focussedTab.title).to.equal(newTab.title);
                   done();
               });
               it('should remove the right pane from a horizontal split', function(done) {
                   var pane = tabs.getPanes()[1];
                   var tab = pane.getTab();
                   pane.unload();
                   expect(tabs.getPanes()).length(1);
                   expect(tabs.getTabs()).length(3);
                   tabs.focusTab(tab);
                   expect(tab.editor.name).to.match(/^terminal/);
                   done();
               });
               it('should properly serialize and deserialize', function(done) {
                   var cstate = cnsl.getState();
                   var state = cnsl.getState();
                   cnsl.clear();
                   expect(tabs.getPanes()).length(0);
                   expect(tabs.getTabs()).length(0);
                   
                   cnsl.setState(state, function(err) {
                       if (err) throw err.message;
                   });
                   expect(cstate).to.deep.equal(cnsl.getState());
                   
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
           describe("unload()", function(){
               it('should destroy all ui elements when it is unloaded', function(done) {
                   var els = tabs.getPanes();
                   cnsl.unload();
                   
                   els.forEach(function(pane) {
                       expect(pane.aml.$amlDestroyed).to.equal(true);
                   });
                   done();
               });
           });
            
            //@todo Idea: show in the tabs whether the editor is running atm
            // @todo test fs integration
            
            after(function(done) {
                tabs.unload();
                
                document.documentElement.style.paddingBottom = "";
                done();
            });
        });
        
        onload && onload();
    }
});