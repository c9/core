#!/usr/bin/env node
"use strict";

"use server";

var async = require("async");

//
// fast sender
//

var engine = require("engine.io");
var kaefer = require("../..");

var server = new kaefer.Server(engine.listen(7878));

var N = 5000;
var M = 100;

server.on("connection", function (socket) {
    // send as fast as possible
    async.timesSeries(N, function(n, next) {
        socket.send({
            msg: new Array(M).join("-"),
            n: n
        });
        setImmediate(next);
    }, function() {
        console.log("DONE sending");
        socket.on("drain", function() {
            console.log("DRAIN");
        });
    });
});

//
// slow receiver
//

var client = require("engine.io-client");
var connectClient = kaefer.connectClient;

function connect() {
    return client("ws://localhost:7878");
}

var socket = connectClient(connect);
socket.connect();

var i = 0;
socket.on("message", function(data) {
    if (i++ % 100 === 0)
        console.log("Data", data, i);
    if (data.n === N-1) {
        console.log(data);
        done();
    }
});


var start = Date.now();
function done() {
    console.log("Sending", N, "messages of size", M, "took", Date.now() - start, "ms");
    process.exit();
}