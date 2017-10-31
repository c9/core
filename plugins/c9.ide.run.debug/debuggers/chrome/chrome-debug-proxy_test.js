"use strict";
"use server";

require("c9/inline-mocha")(module);
require("amd-loader");

var childProcess = require("child_process");
var fs = require("fs");
var net = require("net");

var socketPath = process.env.HOME + "/chrome.sock";
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
        exit: p1.kill.bind(p1),
    };
}

describe(__filename, function() {
    var p1, p2, p3;
    this.timeout(10000);
    it("should exit if another server is running", function(done) {
        try {
            fs.unlinkSync(socketPath);
        } catch (e) {}
        p1 = debuggerProxy("p1", {
            onStart: function() {
                
            },
            onExit: function() {
                
            }
        });
        p2 = debuggerProxy("p2", {
            onExit: function() {
                done();
            }
        });
    });
    it("should connect to node", function(done) {
        p3 = childProcess.spawn(process.execPath, [
            "--inspect=58974", "-e", "setTimeout(x=>x, 10000)"
        ], { stdio: "inherit" });
        var client = net.connect(socketPath, function() {
            console.log("=====");
            
            client.on("data", function handShake(data) {
                // logVerbose("[vfs-collab]", "Client handshaked", data.toString());
                console.log("=====" + data);
            });
            client.write(JSON.stringify({ m: "ping" }) + "\0");
            client.write(JSON.stringify({ m: "connect", port: 58974 }) + "\0");
        });
    });
    after(function() {
        p1 && p1.kill();
        p2 && p2.kill();
        p3 && p3.kill();
    });
});
