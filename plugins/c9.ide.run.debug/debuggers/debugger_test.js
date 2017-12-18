/*global describe it before after = */
"use client";

require([
    "lib/architect/architect", 
    "lib/chai/chai", 
    "text!plugins/c9.ide.layout.classic/skins.xml",
    "text!plugins/c9.ide.run.debug/mock/test.js",
    "text!plugins/c9.ide.run.debug/mock/test.js.map",
    "text!plugins/c9.ide.run.debug/mock/test.ts",
    "/vfs-root"
    // "text!plugins/c9.ide.run.debug/mock/example.js",
    // "text!plugins/c9.ide.run.debug/mock/example.map",
    // "text!plugins/c9.ide.run.debug/mock/example.coffee"
], function (architect, chai, skin, jsFile, mapFile, tsFile, baseProc) {
    var expect = chai.expect;

    var bar, column, devnull;
    
    expect.setupArchitectTest([
        {
            packagePath: "plugins/c9.core/c9",
            workspaceId: "ubuntu/ip-10-35-77-180",
            startdate: new Date(),
            debug: true,
            hosted: true,
            local: false,
            hostname: "dev.javruben.c9.io",
            workspaceDir: baseProc,
            davPrefix: "/"
        },
        
        "plugins/c9.core/ext",
        "plugins/c9.core/http-xhr",
        "plugins/c9.core/util",
        "plugins/c9.ide.ui/lib_apf",
        {
            packagePath: "plugins/c9.core/settings",
            settings: { state: { console: {
                type: "pane", 
                skin: "tab_console",
                nodes: [
                    {
                        type: "tab",
                        editorType: "output",
                        active: true
                    },
                    {
                        type: "tab",
                        editorType: "immediate",
                        document: {
                            title: "Immediate"
                        }
                    }
                ]
            }}}
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
        {
            packagePath: "plugins/c9.ide.editors/tabmanager",
            testing: 2
        },
        "plugins/c9.ide.ui/focus",
        "plugins/c9.ide.editors/pane",
        "plugins/c9.ide.editors/tab",
        {
            packagePath: "plugins/c9.ide.ace/ace",
            staticPrefix: "plugins/c9.ide.layout.classic"
        },
        "plugins/c9.ide.terminal/terminal",
        "plugins/c9.ide.run/output",
        "plugins/c9.ide.console/console",
        "plugins/c9.fs/proc",
        "plugins/c9.fs/net",
        "plugins/c9.fs/fs",
        "plugins/c9.vfs.client/vfs_client",
        "plugins/c9.vfs.client/endpoint",
        "plugins/c9.ide.auth/auth",
        "plugins/c9.core/api",
        {
            packagePath: "plugins/c9.ide.run/run",
            testing: true,
            base: baseProc,
            runners: {
                "node": {
                    "caption": "Node.js (current)",
                    "cmd": ["node", "${debug?--debug-brk=15454}", "$file"],
                    "debugger": "v8",
                    "debugport": 15454,
                    "file_regex": "^[ ]*File \"(...*?)\", line ([0-9]*)",
                    "selector": "source.python",
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
        "plugins/c9.ide.keys/commands",
        "plugins/c9.ide.ui/menus",
        "plugins/c9.ide.run.debug/debuggers/sourcemap",
        {
            packagePath: "plugins/c9.ide.run.debug/debuggers/debugger",
            staticPrefix: "plugins/c9.ide.layout.classic"
        },
        "plugins/c9.ide.run.debug/debuggers/v8/v8debugger",
        "plugins/c9.ide.run.debug/breakpoints",
        "plugins/c9.ide.run.debug/callstack",
        "plugins/c9.ide.run.debug/variables",
        "plugins/c9.ide.run.debug/watches",
        //"plugins/c9.ide.run.debug/quickwatch",
        "plugins/c9.ide.run.debug/debuggers/socket",
        "plugins/c9.ide.run.debug/debugpanel",
        {
            consumes: ["run", "debugger", "fs", "tabManager", "sourcemap", "v8debugger"],
            provides: [],
            setup: main
        }
    ], architect);
    
    function main(options, imports, register) {
        var run = imports.run;
        var fs = imports.fs;
        var tabs = imports.tabManager;
        var debug = imports["debugger"];
        var v8dbg = imports["v8debugger"];
        
        expect.html.setConstructor(function(tab) {
            if (typeof tab == "object")
                return tab.pane.aml.getPage("editor::" + tab.editorType).$ext;
        });
        
        function countEvents(count, expected, done) {
            if (count == expected) 
                done();
            else
                throw new Error("Wrong Event Count: "
                    + count + " of " + expected);
        }
        
        describe('debug', function() {
            before(function(done) {

                document.body.style.marginBottom = "200px";
                done();
            });
            
            describe("debug()", function() {
                this.timeout(10000);
                
                /*it('should debug a file with a runner', function(done) {
                    var foundPid, count = 0;
                    
                    function c2(){ count++; }
                    debug.on("attach", c2);
                    debug.on("detach", c2);
                    debug.on("break", c2);
                    
                    run.getRunner("node", false, function(err, runner) {
                        if (err) throw err.message;
                        
                        expect(runner).to.ok;
                        
                        var c = "console.log('Hello World', new Date());";
                        
                        fs.writeFile("/helloworld.js", c, "utf8", function(err) {
                            if (err) throw err.message;
                            
                            run.run(runner, {
                                path: baseProc + "/helloworld.js",
                                debug: true
                            }, function(err, pid) {
                                if (err) throw err.message;

                                expect(parseInt(pid, 10))
                                    .to.ok;
                                expect(run.running).to.not.equal(run.STARTING);
                                
                                debug.debug(runner, function(err) {
                                    if (err) throw err.message;
                                    c2();
                                });
                                
                                foundPid = true;
                            })
                            expect(run.running).to.equal(run.STARTING);
                        });
                        
                        expect(run.running).to.equal(run.STOPPED);
                    });
                    
                    run.on("stopped", function c1(){
                        //expect(run.running).is.equal(run.STOPPED);
                        
                        debug.off("attach", c2);
                        debug.off("detach", c2);
                        debug.off("break", c2);
                        
                        expect.html(tabs.focussedTab, "Output Mismatch")
                            .text(/Hello\sWorld/);
                        
                        fs.rmfile("/helloworld.js", function(){
                            countEvents(count, 3, done);
                        });
                    });
                });
                it('should debug a file with a runner and set a breakpoint', function(done) {
                    var count = 0;
                    
                    function c2(){ count++; }
                    debug.on("attach", c2);
                    debug.on("detach", c2);
                    debug.on("break", c2);
                    
                    run.getRunner("node", false, function(err, runner) {
                        if (err) throw err.message;
                        
                        expect(runner).to.ok;
                        
                        var c = "var ruben = 'test';\nsetInterval(function(){\n    var env = process.env;\n    console.log('Hello World', new Date(), ruben);\n}, 500)";
                        //var c = "var ruben = 'test';\nsetInterval(function(){\n    var env = process.env;\n    while (true){console.log('Hello World', new Date(), ruben);}\n}, 500)";
                        
                        fs.writeFile("/helloworld.js", c, "utf8", function(err) {
                            if (err) throw err.message;
                            
                            run.run(runner, {
                                path: baseProc + "/helloworld.js",
                                debug: true
                            }, function(err, pid) {
                                if (err) throw err.message;
                                
                                expect(parseInt(pid, 10)).to.ok.to.gt(0);
                                //expect(run.running).to.equal(run.STARTED);
                                
                                debug.on("break", function(){

//                                    debug.resume();
//                                    
//                                    setTimeout(function(){
//                                        run.stop(function(err, e) {
//                                            if (err) throw err.message;
//                                        });
//                                    }, 1000);
                                });

                                debug.debug(runner, function(err) {
                                    if (err) throw err.message;
                                    
                                    debug.setBreakpoint({
                                        path: "/helloworld.js",
                                        line: 3,
                                        enabled: true,
                                        text: "helloworld.js",
                                        content: "some/code().here()",
                                        lineOffset: 0
                                    });
                                    debug.setBreakpoint({
                                        path: "/helloworld.js",
                                        line: 2,
                                        enabled: true,
                                        text: "helloworld.js",
                                        content: "x = 1+1",
                                        lineOffset: 0
                                    });
                                    debug.setBreakpoint({
                                        path: "/helloworld.js",
                                        line: 4,
                                        enabled: false,
                                        text: "helloworld.js",
                                        content: "console.log(x)",
                                        lineOffset: 0
                                    });
                                    
                                    c2();
                                });
                                
                                run.on("stopped", function c1(){
                                    //expect(run.running).is.equal(run.STOPPED);
                                    
                                    debug.off("attach", c2);
                                    debug.off("detach", c2);
                                    debug.off("break", c2);
                                    
            //                        fs.rmfile("/helloworld.js", function(){
                                        countEvents(count, 3, done);
            //                        });
                                });
                                //expect(run.running).to.equal(run.STARTING);
                            });
                        });
                    });
                });*/
                
                it('should debug a file that has a source map with a runner and set a breakpoint', function(done) {
                    var count = 0;
                    
                    function c2() { count++; }
                    debug.on("attach", c2);
                    debug.on("detach", c2);
                    debug.on("break", c2);
                    
                    run.getRunner("node", false, function(err, runner) {
                        if (err) throw err.message;
                        
                        expect(runner).to.ok;
                        
                        //jsFile, mapFile, tsFile
                        
                        fs.writeFile("/test.ts", tsFile, "utf8", function(err) {
                            fs.writeFile("/test.js.map", mapFile, "utf8", function(err) {
                                fs.writeFile("/test.js", jsFile, "utf8", function(err) {
                                    if (err) throw err.message;
                                    
                                    run.run(runner, {
                                        path: baseProc + "/test.js",
                                        debug: true
                                    }, function(err, pid) {
                                        if (err) throw err.message;
                                        
                                        expect(parseInt(pid, 10)).to.ok.to.gt(0);
                                        //expect(run.running).to.equal(run.STARTED);
                                        
                                        debug.on("break", function() {
        
        //                                    debug.resume();
        //                                    
        //                                    setTimeout(function(){
        //                                        run.stop(function(err, e) {
        //                                            if (err) throw err.message;
        //                                        });
        //                                    }, 1000);
                                        });
        
//                                        debug.setBreakpoint({
//                                            path       : "/test.ts",
//                                            line       : 3,
//                                            column     : 0,
//                                            enabled    : true,
//                                            text       : "test.ts",
//                                            content    : "some/code().here()"
//                                        });
//                                        debug.setBreakpoint({
//                                            path       : "/test.ts",
//                                            line       : 13,
//                                            column     : 0,
//                                            enabled    : true,
//                                            text       : "test.ts",
//                                            content    : "x = 1+1"
//                                        });
                                        debug.setBreakpoint({
                                            path: "/test.ts",
                                            line: 0,
                                            column: 0,
                                            enabled: true,
                                            text: "test.ts",
                                            content: "console.log(x)"
                                        });
                                        
                                        debug.debug(runner, function(err) {
                                            if (err) throw err.message;
                                            
                                            // v8dbg.setBreakpoint({
                                            //     line   : 6,
                                            //     column : 12,
                                            //     path   : "/test.js"
                                            // }, function(bp, info) {
                                            //     expect(bp.actual.line).equals(6);
                                            //     expect(bp.actual.column).equals(12);
                                            // })
                                            
                                            c2();
                                        });
                                        
                                        run.on("stopped", function c1() {
                                            //expect(run.running).is.equal(run.STOPPED);
                                            
                                            debug.off("attach", c2);
                                            debug.off("detach", c2);
                                            debug.off("break", c2);
                                            
                                            // @todo test if markers are removed
                                            
                                           fs.rmfile("/test.js", function() {
                                               fs.rmfile("/test.js.map", function() {
                                                   fs.rmfile("/test.ts", function() {
                                                       countEvents(count, 3, done);
                                                   });
                                               });
                                           });
                                        });
                                        //expect(run.running).to.equal(run.STARTING);
                                    });
                                });
                            });
                        });
                    });
                    
                });
            });
            
            
//            after(function(done) {
//                tabs.unload();
//                bar.parentNode.removeChild(bar);
//                
//                document.body.style.marginBottom = "";
//                done();
//            });
        });

        register();
    }
});