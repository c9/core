/*global describe it before after bar =*/

"use client";

require(["lib/architect/architect", "lib/chai/chai", "/vfs-root"], function (architect, chai, baseProc) {
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
        
        {
            consumes: ["tabManager", "proc", "terminal"],
            provides: [],
            setup: main
        }
    ], architect);
    
    function main(options, imports, register) {
        var tabs = imports.tabManager;
        var proc = imports.proc;
        
        expect.html.setConstructor(function(tab) {
            if (typeof tab == "object")
                return tab.pane.aml.getPage("editor::" + tab.editorType).$ext;
        });
        
        describe('terminal', function() {
            before(function(done) {
                apf.config.setProperty("allow-select", false);
                apf.config.setProperty("allow-blur", false);
                
                bar.$ext.style.background = "rgba(220, 220, 220, 0.93)";
                bar.$ext.style.position = "fixed";
                bar.$ext.style.left = "20px";
                bar.$ext.style.right = "20px";
                bar.$ext.style.bottom = "20px";
                bar.$ext.style.height = "33%";
      
                document.body.style.marginBottom = "33%";
                
                proc.execFile("~/.c9/bin/tmux", { args: ["-L", "cloud9test", "kill-server"] }, function(err) {
                    tabs.once("ready", function(){
                        tabs.getPanes()[0].focus();
                        done();
                    });
                });
            });
            
            describe("open", function(){
                this.timeout(15000);
                
                var sessId;
                it('should open a pane with just an editor', function(done) {
                    tabs.openEditor("terminal", function(err, tab) {
                        expect(err).to.not.ok;
                        expect(tabs.getTabs()).length(1);
                        
                        var doc = tab.document;
                        doc.on("setTitle", function c1(){
                            // expect(doc.title).match(new RegExp("^bash - "));
                            
                            sessId = doc.getSession().id;
                            
                            doc.off("setTitle", c1);
                            done();
                        });
                    });
                });
                // @todo Test mouse
                // @todo Test menu

                it('should reconnect when the connection has been lost', function(done) {
                    var doc = tabs.focussedTab.document;
                    var session = doc.getSession();
                    
                    session.once("connected", function(){
                        doc.once("setTitle", function(){
                            // expect(doc.title).to.match(/^bash - /);
                            expect(session.id).to.equal(sessId);
                            done();
                        });
                    });
                    
                    // Kill connection
                    session.pty.kill();
                });
                
                it.skip('should reconnect when the session has been lost', function(done) {
                    var doc = tabs.focussedTab.document;
                    var session = doc.getSession();
                    
                    proc.execFile("tmux", {
                        args: ["kill-session", "-t", session.id]
                    }, function(err) {
                        // Ignore errors for now
                        if (err)
                            throw err.message;
                    });
                    
                    session.on("connected", function c0(){
                        doc.on("setTitle", function c1(){
                            expect(session.id).to.not.equal(sessId);
                            doc.off("setTitle", c1);
                            done();
                        });
                        session.off("connected", c0);
                    })
                });
                
                it('should handle multiple terminals in the same pane', function(done) {
                    tabs.openEditor("terminal", function(err, tab) {
                        expect(tabs.getTabs()).length(2);
                        
                        tab.activate();
                        
                        var doc = tab.document;
                        doc.on("setTitle", function c1(){
                            // expect(doc.title).match(new RegExp("^bash - "));
                            
                            doc.off("setTitle", c1);
                            done();
                        });
                    });
                });
            });
            describe("clear(), getState() and setState()", function(){
                this.timeout(10000);
                
                var state, info = {};
                before(function(done) {
                    tabs.getTabs()[0].activate();
                    tabs.focussedTab.editor.write("echo 123\r");
                    tabs.focussedTab.document.getSession().terminal.once("afterWrite", function() {
                        done();
                    });
                });
                
                it('should retrieve the state', function(done) {
                    state = tabs.getState();
                    info.pages = tabs.getTabs().map(function(tab) {
                        return tab.path || tab.id;
                    });
                    done();
                });
                it('should clear all tabs and pages', function(done) {
                    tabs.getPanes()[0];
                    var pages = tabs.getTabs();
                    pages.forEach(function(tab) {
                        tab.document.getSession().disregard();
                    })
                    tabs.clear(true, true); //Soft clear, not unloading the pages
                    expect(tabs.getTabs(), "pages").length(0);
                    expect(tabs.getPanes(), "tabManager").length(0);
                    //expect(pane.getTabs(), "aml").length(0);
                    done();
                });
                it('should restore the state', function(done) {
                    tabs.setState(state, false, function(err) {
                        if (err) throw err.message;
                    });
                    var l = info.pages.length;
                    expect(tabs.getTabs()).length(l);
                    expect(tabs.getPanes()[0].getTabs()).length(l);
                    tabs.getPanes()[0].focus();
                    expect(tabs.focussedTab.pane.getTabs()).length(l);
                    
                    expect(tabs.getTabs().map(function(tab) {
                        return tab.path || tab.id;
                    })).to.deep.equal(info.pages);
                    done();
                });
            });
            describe("split(), kill-server, pane.unload()", function(){
                this.timeout(30000);
                it('should split a pane horizontally, making the existing pane the left one', function(done) {
                    var pane = tabs.focussedTab.pane;
                    var righttab = pane.hsplit(true);
                    tabs.focussedTab.attachTo(righttab);

                    setTimeout(function(){
                        done();
                    });
                });
                if (!onload.remain) {
                    it('should reconnect both terminals when doing kill-server', function(done) {
                        var count = 0;
                        tabs.getTabs().forEach(function(tab) {
                            var session = tab.document.getSession();
                            session.on("connected", function c0(){
                                if (++count == 2)
                                    done();
                                
                                session.off("connected", c0);
                            });
                        });
                        
                        tabs.focussedTab.editor.write(String.fromCharCode(2) + ":kill-server\r");
                    });
                }
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
            
            describe("pageUnload()", function(){
                this.timeout(10000)
                
                it('should terminate tmux session when tab is unloaded', function(done) {
                    var doc = tabs.focussedTab.document;
                    var session = doc.getSession();
                    var id = session.id;
                    
                    tabs.focussedTab.unload();
                    done();
                    
                    // setTimeout(function(){
                    //     proc.execFile("tmux", {
                    //         args: ["list-sessions"]
                    //     }, function(err, stdout, stderr) {
                    //         // Ignore errors for now
                    //         if (err)
                    //             throw err.message;

                    //         expect(id).is.ok
                    //         expect(stdout.indexOf(id) > -1).is.not.ok;
                    //         done();
                    //     });
                    // }, 3000);
                });
            });
            
            // @todo test split api and menu
            
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
