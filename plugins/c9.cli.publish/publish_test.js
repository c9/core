/*global describe it before after beforeEach afterEach define*/
"use strict";
"use server";
"use mocha";

require("c9/inline-mocha")(module);

if (typeof define === "undefined") {
    require("amd-loader");
    require("../../test/setup_paths");
}

var fs = require("fs");
var http = require('http');
var baseTest = require('../c9.api/base_test');
var child = require("child_process");

var expect = require("chai").expect;
var assert = require("assert");
var sinon = require("sinon");
var join = require("path").join;

var HOST = "localhost:16565";
var USERNAME = "fjakobs";
var PASSWORD = "open";
var BASE = "/tmp/c9.ide.example";
var VERBOSE = false;
var PID = 123;

describe("cli.publish", function(){
    this.timeout(10000);
    
    var services;
    
    before(function(next) {
        baseTest(function (err, s) {
            // Services can be tested immediately by mocking API signatures params - (req, res, next) - or (user, params, callback)
            services = s;
            next(err);
        });
    });

    describe("publish, unpublish and list", function(done) {
        var packagePath = join(BASE, "package.json");
        var readmePath = join(BASE, "README.md");
        var packageJson, readmeMD;
        
        var json = {
          "name": "c9.ide.example",
          "latest": "1.0.0",
          "owner": "https://api.c9.dev/user/2000",
          "enabled": true,
          "categories": [
             "example"
          ],
          "repository": {
             "type": "git",
             "url": "http://github.com/javruben/example.git"
          },
          "longname": "c9.ide.example",
          "website": "",
          "description": "Cloud9 Custom Example Plugin",
          "star_avg": 0,
          "screenshots": [
             "example"
          ]
       };
        
        before(function(done){
            // Create git repo that contains a plugin we'll use to test
            var p = child.spawn(join(__dirname, "publish_test.git.sh"));
            
            if (VERBOSE) {
                p.stdout.on("data", function(c){
                    process.stdout.write(c.toString("utf8"));
                });
                p.stderr.on("data", function(c){
                    process.stderr.write(c.toString("utf8"));
                });
            }
            p.on("close", function(code){
                if (code) 
                    return done(new Error("Git setup failed"));
                
                packageJson = fs.readFileSync(packagePath, "utf8");
                readmeMD = fs.readFileSync(readmePath, "utf8");
                
                done();
            });
        });
        
        it("should warn if the package.json is missing", function(done){
            fs.unlinkSync(packagePath);
            runCLI("publish", ["major"], function(err, stdout, stderr){
                expect(stderr).to.match(/ERROR: Could not find package.json/);
                done();
            });
        });
        it("should fail if the package.json cannot be parsed", function(done){
            fs.writeFileSync(packagePath, packageJson + "!@#!@#", "utf8");
            runCLI("publish", ["major"], function(err, stdout, stderr){
                expect(stderr).to.match(/ERROR: Could not parse package.json/);
                done();
            });
        });
        it("should fail if the name in the package.json is missing", function(done){
            fs.writeFileSync(packagePath, packageJson.replace('"name": "c9.ide.example",', ''));
            runCLI("publish", ["major"], function(err, stdout, stderr){
                expect(stderr).to.match(/ERROR: Missing name property in package.json/);
                done();
            });
        });
        it("should fail if the name in the package.json is not equal to the directory", function(done){
            fs.writeFileSync(packagePath, packageJson.replace('"name": "c9.ide.example"', '"name": "wrongname"'));
            runCLI("publish", ["major"], function(err, stdout, stderr){
                expect(stderr).to.match(/WARNING: The name property in package.json is not equal to the directory name/);
                done();
            });
        });
        it("should fail if the description in the package.json is missing", function(done){
            fs.writeFileSync(packagePath, packageJson.replace(/"description":.*/, ''));
            runCLI("publish", ["major"], function(err, stdout, stderr){
                expect(stderr).to.match(/ERROR: Missing description property in package.json/);
                done();
            });
        });
        it("should fail if the repository in the package.json is missing", function(done){
            fs.writeFileSync(packagePath, packageJson.replace(/"repository[\s\S]*?\},/, ""));
            runCLI("publish", ["major"], function(err, stdout, stderr){
                expect(stderr).to.match(/ERROR: Missing repository property in package.json/);
                done();
            });
        });
        it("should fail if the category length is < 1 in the package.json is missing", function(done){
            fs.writeFileSync(packagePath, packageJson.replace(/"categories[\s\S]*?\],/, ""));
            runCLI("publish", ["major"], function(err, stdout, stderr){
                expect(stderr).to.match(/ERROR: At least one category is required in package.json/);
                done();
            });
        });
        it("should warn if a plugin is not listed in the package.json", function(done){
            fs.writeFileSync(packagePath, packageJson.replace('"example": {}', ''));
            runCLI("publish", ["major"], function(err, stdout, stderr){
                expect(stderr).to.match(/WARNING: Plugin 'example.js' is not listed in package.json./);
                done();
            });
        });
        it("should warn if the README.md is missing", function(done){
            fs.writeFileSync(packagePath, packageJson);
            fs.unlink(readmePath);
            runCLI("publish", ["major"], function(err, stdout, stderr){
                expect(stderr).to.match(/WARNING: README.md is missing./);
                done();
            });
        });
        it("should publish when using force and increase the patch version", function(done){
            var strJson = packageJson.replace(/"version": "[\d\.]+"/, '"version": "0.0.0"');
            fs.writeFileSync(packagePath, strJson);
            runCLI("publish", ["patch", "--force"], function(err, stdout, stderr){
                assert(!err, err);
                expect(stdout).to.match(/Succesfully published version 0.0.1/);
                
                runCLI("list", ["--json"], function(err, stdout, stderr){
                    assert(!err, err);
                    
                    json.latest = "0.0.1";
                    
                    var list = JSON.parse(stdout);
                    if (!list.some(function(item){
                        if (item.name == "c9.ide.example") {
                            expect(item).deep.equal(json);
                            return true;
                        }
                    })) throw new Error("Could not find plugin in list");
                    
                    done();
                });
            });
        });
        it("should increase the minor version", function(done){
            fs.writeFileSync(readmePath, readmeMD);
            runCLI("publish", ["minor"], function(err, stdout, stderr){
                assert(!err, err);
                expect(stdout).to.match(/Succesfully published version 0.1.0/);
                
                runCLI("list", ["--json"], function(err, stdout, stderr){
                    assert(!err, err);
                    
                    json.latest = "0.1.0";
                    
                    var list = JSON.parse(stdout);
                    if (!list.some(function(item){
                        if (item.name == "c9.ide.example") {
                            expect(item).deep.equal(json);
                            return true;
                        }
                    })) throw new Error("Could not find plugin in list");
                    
                    done();
                });
            });
        });
        it("should increase the major version", function(done){
            runCLI("publish", ["major"], function(err, stdout, stderr){
                assert(!err, err);
                expect(stdout).to.match(/Succesfully published version 1.0.0/);
                
                runCLI("list", ["--json"], function(err, stdout, stderr){
                    assert(!err, err);
                    
                    json.latest = "1.0.0";
                    
                    var list = JSON.parse(stdout);
                    if (!list.some(function(item){
                        if (item.name == "c9.ide.example") {
                            expect(item).deep.equal(json);
                            return true;
                        }
                    })) throw new Error("Could not find plugin in list");
                    
                    done();
                });
            });
        });
        it("should hide the package when it is unpublished", function(done){
            runCLI("unpublish", [], function(err, stdout, stderr){
                assert(!err, err);
                expect(stdout).to.match(/Succesfully disabled package/);
                
                runCLI("list", ["--json"], function(err, stdout, stderr){
                    assert(!err, err);
                    expect(stdout).to.not.match(/c9\.ide\.example/);
                    done();
                });
            });
        });
    });
    
    describe("install and remove (uninstall)", function() {
        var pluginDir = join(process.env.HOME, ".c9/plugins/c9.ide.example");
        
        // Lets make sure there is at least one package in the database
        before(function(done){
            // Create git repo that contains a plugin we'll use to test
            var p = child.spawn(join(__dirname, "publish_test.git.sh"));
            
            if (VERBOSE) {
                p.stdout.on("data", function(c){
                    process.stdout.write(c.toString("utf8"));
                });
                p.stderr.on("data", function(c){
                    process.stderr.write(c.toString("utf8"));
                });
            }
            p.on("close", function(code){
                if (code) 
                    return done(new Error("Git setup failed"));
                
                runCLI("publish", ["10.0.0"], function(err, stdout, stderr){
                    done();
                });
            });
        });
        
        it("should install a package locally", function(done){
            runCLI("install", ["--local", "c9.ide.example"], function(err, stdout, stderr){
                expect(stdout).to.match(/Succesfully installed c9.ide.example@10.0.0/);
                expect(fs.existsSync(pluginDir)).ok;
                done();
            });
        });
        it("should warn if a package is already installed", function(done){
            runCLI("install", ["--debug", "c9.ide.example"], function(err, stdout, stderr){
                expect(stderr).to.match(/WARNING: Directory not empty/);
                done();
            });
        });
        it("should install a package in debug mode", function(done){
            runCLI("install", ["--force", "--debug", "c9.ide.example"], function(err, stdout, stderr){
                expect(stdout).to.match(/Succesfully installed c9.ide.example/);
                expect(fs.existsSync(join(pluginDir, "/.git"))).ok;
                done();
            });
        });
        it("should install a package via the database", function(done){
            runCLI("install", ["c9.ide.example"], function(err, stdout, stderr){
                expect(stdout).to.match(/Succesfully installed c9.ide.example/);
                
                // @TODO check if it's actually in the database - add list --own to cli
                
                done();
            });
        });
        it("should remove a package locally", function(done){
            runCLI("remove", ["--local", "c9.ide.example"], function(err, stdout, stderr){
                expect(stdout).to.match(/Succesfully removed c9.ide.example/);
                expect(fs.existsSync(pluginDir)).not.ok;
                done();
            });
        });
        it("should remove a from the database", function(done){
            runCLI("remove", ["c9.ide.example"], function(err, stdout, stderr){
                expect(stdout).to.match(/Succesfully removed c9.ide.example/);
                
                // @TODO check if it's actually in the database - add list --own to cli
                
                done();
            });
        });
    });
});

function runCLI(command, options, callback){
    var env = Object.create(process.env);
    env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;
    env["C9_APIHOST"] = HOST;
    env["C9_PID"] = PID;
    env["C9_TEST_AUTH"] = USERNAME + ":" + PASSWORD;
    env["C9_TEST_MODE"] = 1;
    
    options.push("--verbose");
    var p = child.spawn(join(__dirname, "../../bin/c9"), [command].concat(options), {
        cwd: BASE,
        env: env
    });
    
    if (VERBOSE)
        process.stdout.write("\n");
    
    var stdout = "";
    p.stdout.on("data", function(c){
        c = c.toString("utf8");
        stdout += c;
        if (VERBOSE) process.stdout.write(c);
    });
    var stderr = "";
    p.stderr.on("data", function(c){
        c = c.toString("utf8");
        stderr += c;
        if (VERBOSE) process.stderr.write(c);
    });
    p.on("close", function(code){
        if (code) return callback(new Error(stderr), stdout, stderr);
        callback(null, stdout, stderr);
    });
}