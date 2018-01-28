"use strict";
"use server";

require("c9/inline-mocha")(module);
require("amd-loader");

var childProcess = require("child_process");
var fs = require("fs");
var net = require("net");

var socketPath = process.env.HOME + "/.c9/chrome.sock";
if (process.platform == "win32")
    socketPath = "\\\\.\\pipe\\" + socketPath.replace(/\//g, "\\");

process.chdir(__dirname);

function debuggerProxy(id, handlers) {
    var p1 = childProcess.spawn(process.execPath, ["./chrome-debug-proxy.js"]);
    p1.stdout.once("data", function(data) {
        handlers.onStart && handlers.onStart();
    });
    p1.stdout.on("data", function(data) {
        console.log(id, data + "");
    });
    p1.stderr.on("data", function(data) {
        console.log(id, data + "");
    });
    p1.on("close", function(code) {
        console.log(id, code);
    });
    p1.on("exit", function(code) {
        handlers.onExit && handlers.onExit(code);
        console.log(id, code);
    });
    p1.on("error", function(code) {
        console.log(id, code);
    });
    return {
        kill: p1.kill.bind(p1),
    };
}

describe.skip(__filename, function() {
    var p1, p2, p3;
    this.timeout(100000);
    it("should exit if another server is running", function(done) {
        try {
            fs.unlinkSync(socketPath);
        } catch (e) {}
        p1 = debuggerProxy("p1", {
            onStart: function() {
                
            },
            onExit: function() {
                done();
            }
        });
        p2 = debuggerProxy("p2", {
            onExit: function() {
                done();
            }
        });
    });
    it("should connect to new node", function(done) {
        var port = 58974;
        p3 = childProcess.spawn(process.execPath, [
            "--inspect=" + port, "-e", "var fs=require('fs'); path=process.argv[1];"
                + "setInterval(x=>fs.existsSync(path) || process.exit(1), 100)", socketPath
        ], { stdio: "inherit" });
        var client = net.connect(socketPath, function() {
            client.on("data", function handShake(data) {
                console.log("=====" + data);
                var msg = JSON.parse(data.slice(0, -1));
                if (msg.$ == "connected") {
                    p3.kill();
                    done();
                }
            });
            client.write(JSON.stringify({ m: "ping" }) + "\0");
            client.write(JSON.stringify({ $: "connect", port: port }) + "\0");
        });
    });
    
    it("should connect to old node", function(done) {
        var port = 58374;
        p3 = childProcess.spawn(process.execPath, [
            "--debug=" + port, "-e", "var fs=require('fs'); path=process.argv[1];"
                + "setInterval(x=>fs.existsSync(path) || process.exit(1), 100)", socketPath
        ], { stdio: "inherit" });
        var client = net.connect(socketPath, function() {
            client.on("data", function handShake(data) {
                data = data.toString("utf8");
                console.log("=====" + data.toString("utf8"));
                var msg = data[0] == "{" && JSON.parse(data.slice(0, -1));
                console.log(msg)
                if (msg.$ == "connected") {
                    var req = {
                        seq: 3,
                        type: 'request',
                        command: 'scripts',
                        arguments: { types: 4, includeSource: false }
                    };
                    client.write(JSON.stringify(req) + "\0");
                }
                else if (msg.request_seq == 3) {
                    p3.kill();
                    done();
                }
            });
            client.write(JSON.stringify({ $: "connect", port: port }) + "\0");
        });
    });
    after(function() {
        p1 && p1.kill();
        p2 && p2.kill();
        p3 && p3.kill();
        fs.unlinkSync(socketPath);
    });
});
