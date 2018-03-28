#!/usr/bin/env node
"use strict";

"use server";

var smith = require("smith");

//
// SERVER
//

var engine = require("engine.io");
var kaefer = require("../..");
var VfsWorker = require('vfs-socket/worker').Worker;
var vfsLocal = require("vfs-local");

var server = new kaefer.Server(engine.listen(7878));

server.on("connection", function (socket) {
    var transport = new smith.EngineIoTransport(socket, true);
    var worker = new VfsWorker(vfsLocal({root: __dirname + "/.." }));
    worker.connect(transport);

    socket.on("message", function(msg){
        console.log("->", msg);
    });
});

//
// CLIENT
//

var Consumer = require("vfs-socket/consumer").Consumer;
var client = require("engine.io-client");
var connectClient = kaefer.connectClient;

function connect() {
    return client("ws://localhost:7878");
}

var socket = connectClient(connect);
socket.connect();

var consumer = new Consumer();
var transport = new smith.EngineIoTransport(socket, true); 
consumer.connect(transport, function(err, vfs) {
    vfs.stat("/", {}, function() {
        console.log(arguments);
        process.exit();
    });
});