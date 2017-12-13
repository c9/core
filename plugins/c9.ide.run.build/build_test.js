/*global describe it before after bar */

"use client";

require(["lib/architect/architect", "lib/chai/chai", "/vfs-root"], 
  function (architect, chai, baseProc) {
    var expect = chai.expect;
    
    expect.setupArchitectTest([
        {
            packagePath: "plugins/c9.core/c9",
            workspaceId: "ubuntu/ip-10-35-77-180",
            startdate: new Date(),
            debug: true,
            hosted: true,
            local: false,
            hostname: "dev.javruben.c9.io",
            davPrefix: "/"
        },
        
        "plugins/c9.core/ext",
        "plugins/c9.core/http-xhr",
        "plugins/c9.core/util",
        "plugins/c9.ide.ui/lib_apf",
        "plugins/c9.ide.ui/anims",
        {
            packagePath: "plugins/c9.core/settings",
            settings: { state: { console: {
                "json()": {
                    type: "pane", 
                    nodes: [
                        {
                            type: "tab",
                            editorType: "output",
                            active: "true",
                            document: {
                                title: "Build",
                                output: {
                                    id: "build"
                                }
                            }
                        }
                    ]
                }}}
            }
        },
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
        {
            packagePath: "plugins/c9.ide.terminal/terminal",
            installPath: "~/.c9"
        },
        "plugins/c9.ide.run/output",
        "plugins/c9.ide.console/console",
        "plugins/c9.fs/proc",
        "plugins/c9.fs/fs",
        {
            packagePath: "plugins/c9.vfs.client/vfs_client",
            debug: true
        },
        "plugins/c9.vfs.client/endpoint",
        "plugins/c9.ide.auth/auth",
        "plugins/c9.core/api",
        {
            packagePath: "plugins/c9.ide.run/run",
            staticPrefix: "plugins/c9.ide.run",
            testing: true,
            base: baseProc,
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
                "coffee": {
                    "caption": "Coffee",
                    "cmd": ["coffee", "$file"],
                    "debug": ["--debug-brk=5454"],
                    "file_regex": "^[ ]*File \"(...*?)\", line ([0-9]*)",
                    "selector": "source.coffee",
                    "info": "Your code is running at \\033[01;34m$hostname\\033[00m.\n"
                        + "\\033[01;31mImportant:\\033[00m use \\033[01;32mprocess.env.PORT\\033[00m as the port and \\033[01;32mprocess.env.IP\\033[00m as the host in your scripts!\n"
                },
                "pythoni": {
                    "caption": "Python in interactive mode",
                    "cmd": ["python", "-i"],
                    "selector": "source.python",
                    "info": "Hit \\033[01;34mCtrl-D\\033[00m to exit.\n"
                },
                "typescript": {
                    "caption": "Typescript",
                    "cmd": ["tsc", "-e", "$file"],
                    "selector": "source.ts",
                    "info": "Your code is running at \\033[01;34m$hostname\\033[00m.\n"
                        + "\\033[01;31mImportant:\\033[00m use \\033[01;32mprocess.env.PORT\\033[00m as the port and \\033[01;32mprocess.env.IP\\033[00m as the host in your scripts!\n"
                }
            }
        },
        {
            packagePath: "plugins/c9.ide.run.build/build",
            base: baseProc,
            builders: {
                "coffee": {
                    "caption": "Coffee",
                    "cmd": ["coffee", "-c", "$file"],
                    "selector": "source.coffee",
                },
                "scss": {
                    "caption": "SASS (scss)",
                    "cmd": ["sass", "${debug?--debug-info}", "--scss", "--update", "$file:${file/\\.scss/\\.css/}"],
                    "selector": "source.scss"
                },
                "less": {
                    "caption": "LESS",
                    "cmd": ["lessc", "$file", ">", "${file/\\.less/\\.css/}"],
                    "selector": "source.less"
                },
                "typescript": {
                    "caption": "Typescript",
                    "cmd": ["tsc", "--out", "${file/\\.ts/\\.js/}", "$file"],
                    "selector": "source.ts"
                }
            }
        },
        
        {
            consumes: ["build", "run", "fs", "tabManager", "console", "output"],
            provides: [],
            setup: main
        }
    ], architect);
    
    function main(options, imports, register) {
        var run = imports.run;
        var build = imports.build;
        var fs = imports.fs;
        var tabs = imports.tabManager;
        var cnsl = imports.console;
        
        function getHtmlElement(tab) {
            if (typeof tab == "object")
                return tab.pane.aml.getPage("editor::" + tab.editorType).$ext;
        }
        expect.html.setConstructor(getHtmlElement);
        
        function countEvents(count, expected, done) {
            if (count == expected) 
                done();
            else
                throw new Error("Wrong Event Count: "
                    + count + " of " + expected);
        }
        
        var maxTries = 15, retries = 0;
        function waitForOutput(match, callback) {
            setTimeout(function() {
                var value = tabs.focussedTab.editor.ace.session.getValue();
                
                if (retries < maxTries && !value.match(match)) {
                    retries++;
                    return waitForOutput(match, callback);
                }
                
                expect(value, "Output Mismatch").match(match);
                
                callback();
            }, 500);
        }
        
        describe('build', function() {
            before(function(done) {

                bar.$ext.style.background = "rgba(220, 220, 220, 0.93)";
                bar.$ext.style.position = "fixed";
                bar.$ext.style.left = "20px";
                bar.$ext.style.right = "20px";
                bar.$ext.style.bottom = "20px";
                bar.$ext.style.height = "150px";
                
                document.querySelector(".console").style.height = "100%";
      
                document.body.style.marginBottom = "150px";
                done();
            });
            
            describe("listBuilders()", function() {
                it('should list all builders', function(done) {
                    build.listBuilders(function(err, builders) {
                        if (err) throw err.message;
                        
                        expect(builders).length.gt(0);
                        done();
                    });
                });
            });
            
            describe("getBuilder()", function() {
                it('should retrieve the builder of a certain type', function(done) {
                    build.getBuilder("coffee", false, function(err, builder) {
                        if (err) throw err.message;
                        
                        expect(builder).to.ok;
                        done();
                    });
                });
            });
            
            describe("build()", function() {
                this.timeout(10000);
                
                it('should build a file with a builder', function(done) {
                    var foundPid, count = 0;
                    
                    build.getBuilder("coffee", false, function(err, builder) {
                        if (err) throw err.message;
                        
                        builder.selector = "";

                        expect(builder).to.ok;
                        
                        var c = "console.log 'Hello Coffee'";
                        
                        fs.rmfile("/helloworld.js", function() {
                            fs.writeFile("/helloworld.coffee", c, "utf8", function(err) {
                                if (err) throw err.message;
                                
                                var process = build.build(builder, {
                                    path: "helloworld.coffee"
                                }, "build", function(err, pid) {
                                    if (err) throw err.message;
    
                                    expect(parseInt(pid, 10))
                                        .to.ok;
                                    expect(process.running).to.not.equal(run.STARTING);
    
                                    foundPid = true;
                                });
                                
                                expect(process.running).to.equal(run.STARTING);
                                
                                function c2() { count++; }
                                process.on("started", c2);
                                process.on("stopping", c2);
                                
                                process.on("stopped", function c1() {
                                    expect(process.running).is.equal(run.STOPPED);
                                    expect(foundPid, "found-pid").to.ok;
                                    
                                    process.off("started", c2);
                                    process.off("stopping", c2);
                                    process.off("stopped", c1);
                                    count++;
                                    
                                    fs.readFile("/helloworld.js", "utf8", function(err, data) {
                                        expect(data).to.match(/console.log\('Hello Coffee'\)/);
                                        
                                        fs.rmfile("/helloworld.js", function() {
                                            fs.rmfile("/helloworld.coffee", function() {
                                                countEvents(count, 3, done);
                                            });
                                        });
                                    });
                                });
                                
                                //expect(process.running).to.equal(run.STOPPED);
                            });
                        });
                    });
                });
                
                it('should build, then run a file with a builder and a runner', function(done) {
                    var foundPid, count = 0;
                    
                    build.getBuilder("coffee", false, function(err, builder) {
                        run.getRunner("node", false, function(err, runner) {
                            if (err) throw err.message;
                            
                            expect(runner).to.ok;
                            
                            var c = "console.log 'Hello Coffee'";
                            
                            fs.rmfile("/helloworld.js", function() {
                                fs.writeFile("/helloworld.coffee", c, "utf8", function(err) {
                                    if (err) throw err.message;
                                    
                                    var process = run.run([builder, runner], [
                                        { path: "helloworld.coffee" }, 
                                        { path: "helloworld.js" }
                                    ], "build",
                                    function(err, pid) {
                                        if (err) throw err.message;
        
                                        expect(parseInt(pid, 10))
                                            .to.ok;
                                        expect(process.running).to.not.equal(run.STARTING);
        
                                        foundPid = true;
                                    });
                                    
                                    expect(process.running).to.equal(run.STARTING);
                                    
                                    function c2() { count++; }
                                    process.on("started", c2);
                                    process.on("stopping", c2);
                                    
                                    process.on("stopped", function c1() {
                                        expect(process.running).is.equal(run.STOPPED);
                                        expect(foundPid, "found-pid").to.ok;
                                        
                                        process.off("started", c2);
                                        process.off("stopping", c2);
                                        process.off("stopped", c1);
                                        count++;
                                        
                                        fs.exists("/helloworld.js", function(exists) {
                                            expect(exists, "JS file generated").to.ok;
                                            
                                            waitForOutput(/Hello\sCoffee/, function() {
                                                fs.rmfile("/helloworld.coffee", function() {
                                                    fs.rmfile("/helloworld.js", function() {
                                                        countEvents(count, 3, done);
                                                    });
                                                });
                                            });
                                        });
                                    });
                                    
                                    //expect(process.running).to.equal(run.STOPPED);
                                });
                            });
                        });
                    });
                });
            });
            
            if (!onload.remain) {
               after(function(done) {
                    run.unload();
                    build.unload();
                    tabs.unload();
                    cnsl.unload();
                   
                   document.body.style.marginBottom = "";
                   done();
               });
            }
        });
        
        register();
    }
});