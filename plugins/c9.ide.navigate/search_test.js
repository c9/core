/*global describe it before*/
"use strict";
"use server";


if (typeof process !== "undefined")
    require("amd-loader");

define(function(require, exports, module) {
    var assert = require("chai").assert;
    var search = require("./search");
    
    describe("Search", function() {
        this.timeout(30000);
    
        it("test searching", function(next) {
            var fileList = [
                "/.test", // excluded
                "/etc/config.js", // excluded
                "/etc/code", // first
                "/etc/code.xml", // prio because of in filename match
                "/blah/code/others.png", //included but no prio
                "/etc/code_test.xml", //included and prio because of in word
                "/blah/code/me.jpg" //included but no prio
            ];
    
            var search1 = search.fileSearch(fileList, "code");
            var search2 = search.fileSearch(fileList, "etc.xml");
    
            delete search1.newlist;
            delete search2.newlist;
            
            assert.deepEqual(search1, ["/etc/code", "/etc/code.xml", "/etc/code_test.xml", "/blah/code/me.jpg", "/blah/code/others.png"]);
            assert.deepEqual(search2, ["/etc/code.xml", "/etc/code_test.xml"]);
            next();
        });
    
        it("test match", function (next) {
            var matches = search.matchPath("etc/code_test.xml", "etc/xml");
            assert.equal(matches.length, 4);
            assert.equal(matches.map(function (m) { return m.val; }).join(""), "etc/code_test.xml");
            assert.equal(matches.map(function (m) { return m.match && m.val; }).join(""), "etc/xml");
            next();
        });
    
        it("test measure", function (next) {
            var spawn = require("child_process").spawn;
            var process = spawn("find", [".", "-type", "f"],
                { cwd: __dirname + "/../../" });
            var stdout = [];
            process.stdout.on("data", function (data) {
                stdout.push(data.toString());
            });
            process.on("exit", function (code) {
                var fileList = stdout.join("").split("\n");
                console.log("Num:", fileList.length);
                fileList.splice(fileList.length - 1, 1);
                var sd = new Date();
                var result = search.fileSearch(fileList, "noderunner");
                console.log("took: " + (new Date() - sd));
                next();
            });
        });
    });
});