/*global describe it before after apf bar */

"use client";

require(["lib/architect/architect", "lib/chai/chai"], function (architect, chai) {
    var expect = chai.expect;
    
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
        {
            packagePath: "plugins/c9.core/settings",
            settings: { user: { general: { animateui: true }}}
        },
        "plugins/c9.ide.ui/lib_apf",
        "plugins/c9.ide.ui/anims",
        "plugins/c9.ide.ui/menus",
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
        "plugins/c9.ide.ace.gotoline/gotoline",
        "plugins/c9.ide.keys/commands",
        "plugins/c9.fs/proc",
        "plugins/c9.vfs.client/vfs_client",
        "plugins/c9.vfs.client/endpoint",
        "plugins/c9.ide.auth/auth",
        "plugins/c9.core/api",
        "plugins/c9.fs/fs",
        
        // Mock plugins
        {
            consumes: ["tabManager", "ace", "settings"],
            provides: [],
            setup: main
        }
    ], architect);
    
    function main(options, imports, register) {
        var tabs = imports.tabManager;
        var ace = imports.ace;
        
        function getTabHtml(tab) {
            return tab.pane.aml.getPage("editor::" + tab.editorType).$ext;
        }
        
        expect.html.setConstructor(function(tab) {
            if (typeof tab == "object")
                return tab.$ext;
        });
        
        describe('gotoline', function() {
            before(function(done) {
                bar.$ext.style.background = "rgba(220, 220, 220, 0.93)";
                bar.$ext.style.position = "fixed";
                bar.$ext.style.left = "20px";
                bar.$ext.style.right = "20px";
                bar.$ext.style.bottom = "20px";
                bar.$ext.style.height = "33%";
      
                imports.settings.set("user/ace/@animatedscroll", "true");
      
                document.body.style.marginBottom = "33%";
                tabs.once("ready", function() {
                    tabs.getPanes()[0].focus();
                    done();
                });
            });
            
            describe("open", function() {
                this.timeout(10000);
                
                it('should open a pane with just an editor', function(done) {
                    tabs.openFile("/file.js", function(err, tab) {
                        setTimeout(function() {
                            expect(tabs.getTabs()).length(1);

    //                        var sb = tab.document.getSession().statusBar;
    //                        var bar = sb.getElement("bar");
    //                        expect.html(bar, "rowcol").text("1:1");
    //                        
    //                        tab.document.editor.ace.selectAll();
    //                        setTimeout(function(){
    //                            expect.html(bar, "rowcol sel").text("2:1");
    //                            expect.html(bar, "sel").text("23 Bytes");
    //                            
    //                            done();
    //                        }, 100);
                            done();
                        }, 50);
                    });
                });
                it('should handle multiple documents in the same pane', function(done) {
                    tabs.openFile("/listing.json", function(err, tab) {
                        setTimeout(function() {
                            expect(tabs.getTabs()).length(2);

                            tab.activate();

    //                        setTimeout(function(){
    //                            var sb = tab.document.getSession().statusBar;
    //                            expect.html(sb.getElement("bar"), "caption").text("1:1");

                                done();
    //                        }, 100);
                        });
                    });
                });
            });
            describe("split(), pane.unload()", function() {
                it('should split a pane horizontally, making the existing pane the left one', function(done) {
                    var pane = tabs.focussedTab.pane;
                    var righttab = pane.hsplit(true);
                    tabs.focussedTab.attachTo(righttab);
                    done();
//                    setTimeout(function(){
//                        expect.html(pane.aml, "pane").text("2:1");
//                        expect.html(righttab.aml, "righttab").text("1:1");
                    
                        //done();
//                    }, 100);
                });
//                it('should remove the left pane from a horizontal split', function(done) {
//                    var pane = tabs.getPanes()[0];
//                    var tab = tabs.getPanes()[1].getTab();
//                    pane.unload();
//                    expect(tabs.getPanes()).length(1);
//                    expect(tabs.getTabs()).length(2);
//                    tabs.focusTab(tab);
//                    done();
//                });
            });
//            describe("Change Theme", function(){
//                this.timeout(10000);
//                
//                it('should change a theme', function(done) {
//                    var editor = tabs.focussedTab.editor;
//                    ace.on("themeInit", function setTheme(){
//                        ace.off("theme.init", setTheme);
//                        expect.html(getTabHtml(tabs.focussedTab).childNodes[1]).className("ace-monokai");
//                        editor.setOption("theme", "ace/theme/textmate");
//                        done();
//                    });
//                    editor.setOption("theme", "ace/theme/monokai");
//                });
//            });
            
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
});