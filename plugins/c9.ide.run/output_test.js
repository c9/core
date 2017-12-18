/*global describe it before after bar */

"use client";

require(["lib/architect/architect", "lib/chai/chai", "/vfs-root"], 
  function (architect, chai, baseProc) {
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
        {
            packagePath: "plugins/c9.ide.console/console",
            testing: 2
        },
        "plugins/c9.ide.editors/pane",
        "plugins/c9.ide.editors/tab",
        "plugins/c9.ide.terminal/terminal",
        "plugins/c9.ide.run/output",
        {
            packagePath: "plugins/c9.ide.run/run",
            testing: true,
            base: baseProc,
            staticPrefix: "plugins/c9.ide.run",
            runners: {
                "node": {
                    "caption": "Node.js (current)",
                    "cmd": ["node", "${debug?--debug-brk=15454}", "$file"],
                    "debugger": "v8",
                    "debugport": 15454,
                    "file_regex": "^[ ]*File \"(...*?)\", line ([0-9]*)",
                    "selector": "source.js",
                    "info": "Your code is running at \\033[01;34m$hostname\\033[00m.\n"
                        + "\\033[01;31mImportant:\\033[00m use \\033[01;32mprocess.env.PORT\\033[00m as the port and \\033[01;32mprocess.env.IP\\033[00m as the host in your scripts!\n"
                },
                "pythoni": {
                    "caption": "Python in interactive mode",
                    "cmd": ["python", "-i"],
                    "selector": "source.python",
                    "info": "Hit \\033[01;34mCtrl-D\\033[00m to exit.\n"
                }
            }
        },
        "plugins/c9.ide.preferences/preferences",
        "plugins/c9.ide.ui/forms",
        "plugins/c9.fs/fs",
        "plugins/c9.fs/proc",
        "plugins/c9.vfs.client/vfs_client",
        "plugins/c9.vfs.client/endpoint",
        "plugins/c9.ide.auth/auth",
        "plugins/c9.core/api",
        
        
        "plugins/c9.ide.ace/ace",
        
        // "plugins/c9.ide.panels/panels",
        // "plugins/c9.ide.panels/panel",
        // "plugins/c9.ide.panels/area",
        "plugins/c9.ide.run.debug/debuggers/debugger",
        "plugins/c9.ide.run.debug/breakpoints",
        "plugins/c9.ide.run.debug/debugpanel",
        "plugins/c9.ide.run.debug/callstack",
        "plugins/c9.ide.run.debug/debuggers/socket",
        
        "plugins/c9.fs/net",
        "plugins/c9.ide.ui/menus",
        
        {
            consumes: ["tabManager", "proc", "output", "fs", "ext"],
            provides: [],
            setup: main
        }
    ], architect);
    
    function main(options, imports, register) {
        var tabs = imports.tabManager;
        var output = imports.output;
        var fs = imports.fs;
        var ext = imports.ext;
        
        expect.html.setConstructor(function(tab) {
            if (typeof tab == "object")
                return tab.pane.aml.getPage("editor::" + tab.editorType).$ext;
        });
        
        describe('terminal', function() {
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
            
            this.timeout(10000);
            
            it('should open an output window and run with a runner', function(done) {
                
                var c = "console.log('Hello World', new Date());";
                fs.writeFile("/helloworld.js", c, "utf8", function(err) {
                    if (err) throw err.message;
                
                    tabs.open({
                        editorType: "output",
                        document: {
                            title: "Output",
                            output: {
                                id: "testoutput",
                                config: {
                                    command: "./helloworld.js",
                                    debug: false
                                },
                                runner: "auto",
                                run: true
                            }
                        }
                        
                    }, function(err, tab) {
                        expect(err).to.not.ok;
                        var ace = tabs.focussedTab.editor.ace;
                        tab.editor.once("connect", function() {
                            ace.session.term.once('afterWrite', function() {
                                ace.renderer.on('afterRender', function afterRender() {
                                    if (tab.classList.names.indexOf("running") == -1
                                      && ace.getValue().match(/Hello\s*World/)) {
                                        expect.html(ace.container).text(/Hello\s*World/);
                                        ace.renderer.off('afterRender', afterRender);
                                        done();
                                    }
                                });
                            });
                        });
                    });
                });
            });
            
            if (!onload.remain) {
                after(function(done) {
                    ext.unloadAllPlugins();
                    
                    document.body.style.marginBottom = "";
                    done();
                });
            }
        });
        
        register();
    }
});