/*global describe it before*/

"use client";

require(["lib/architect/architect", "lib/chai/chai"], function (architect, chai) {
    var expect = chai.expect;
    
    expect.setupArchitectTest([
        {
            packagePath: "plugins/c9.core/c9",
            startdate: new Date(),
            debug: true,
            hosted: true,
            local: false
        },
        "plugins/c9.core/http-xhr",
        "plugins/c9.core/ext",
        "plugins/c9.fs/proc",
        "plugins/c9.vfs.client/vfs_client",
        "plugins/c9.vfs.client/endpoint",
        "plugins/c9.ide.auth/auth",
        // Mock plugins
        {
            consumes: [],
            provides: ["auth.bootstrap", "info", "dialog.error"],
            setup: expect.html.mocked
        },
        {
            consumes: ["proc"],
            provides: [],
            setup: main
        }
    ], architect);
    
    function main(options, imports, register) {
        var proc = imports.proc;

        describe('proc', function() {
            describe('spawn()', function() {
                this.timeout(10000);
                
                it("should spawn a child process", function(done) {
                    var args = ["-e", "process.stdin.pipe(process.stdout);try{process.stdin.resume()}catch(e) {};"];
                    proc.spawn("node", {
                        args: args
                    }, 
                    function(err, child) {
                        if (err) throw err.message;
                        expect(child).ok;
                        expect(child).property("stdout").ok;
                        expect(child).property("stdin").ok;
                        child.stderr.on("data", function(data) {
                            throw new Error(data);
                        });
                        child.stdin.on("data", function(data) {
                            throw new Error(data);
                        });
                        child.stdout.on("data", function(data) {
                            expect(data).equal("echo me");
                            child.stdout.on("end", function() {
                                done();
                            });
                            child.stdin.end();
                        });
                        child.stdin.write("echo me");
                    });
                });
                
                // should test the kill() method - which is broken now
                // Another test - see that cwd defaults to the root vfs dir when resolve is set to true
            });
            describe('execFile()', function() {
                this.timeout(10000);
                
                it("should have environment variables from process, fsOptions, and call", function(done) {
                    var args = ["-e", "console.log([process.env.SHELL, process.env.CUSTOM, process.env.LOCAL].join(','))"];
                    proc.spawn("node", {
                        args: args,
                        env: {
                            LOCAL: 44
                        }
                    }, 
                    function(err, child) {
                        if (err) throw err.message;
                        var stdout = [];
                        child.stderr.on("data", function(data) {
                            throw new Error(data);
                        });
                        child.stdin.on("data", function(data) {
                            throw new Error(data);
                        });
                        child.stdout.on("data", function(data) {
                            stdout.push(data);
                        });
                        child.stdout.on("end", function() {
                            stdout = stdout.join("");
                            expect(stdout).match(/[\/\w]+,43,44\n/);
                            done();
                        });
        
                    });
                });
                
                it('should pass stdout and stderr', function(done) {
                    proc.execFile("node", {
                        args: ["-v"]
                    }, function(e, stdout, stderr) {
                        expect(stdout[0]).to.equal("v");
                        expect(stderr).to.equal("");
                        expect(e).to.not.ok;
                        done();
                    });
                });
                
                // should test the kill() method - which is broken now
                // Another test - see that cwd defaults to the root vfs dir when resolve is set to true
            });
            describe('pty()', function() {
                this.timeout(30000);
                
                it("Terminal Test", function(done) {
                    var look = "--color=auto";
                    
                    var args = ["-is"];
                    proc.pty("bash", {
                        args: args,
                        env: {},
                        cwd: "/"
                    },
                    function(err, pty) {
                        if (err) throw err.message;
                        var stdout = [];
                        pty.resize(80, 80);
                        
                        var hadRows = false;
                        
                        pty.on("data", function(data) {
                            if (typeof data == "object" && data.rows) {
                                expect(data).property("rows").is.equal(80);
                                expect(data).property("cols").is.equal(80);
                                hadRows = true;
                            } else {
                                stdout.push(data);
                                if (hadRows && stdout.join("").indexOf(look) > -1)
                                    pty.kill();
                            }
                        });
                        pty.on("exit", function() {
                            done();
                        });
                        
                        pty.write("ls --color=auto\n");
                    });
                });
                
                // Test resize();
            });
        });
        
        onload && onload();
    }
});