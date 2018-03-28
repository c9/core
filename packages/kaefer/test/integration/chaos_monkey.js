#!/usr/bin/env node
"use strict";

var assert = require("assert");
var engine = require("engine.io");
var client = require("engine.io-client");

var kaefer = require("../..");

var server = new kaefer.Server(engine.listen(7878), { debug: false });

var messages = {
    "a": [],
    "b": [],
    "c": [],
    "d": []
};

server.on("connection", function (socket) {
    send(socket, 100);

    socket.on("away", function() { console.log("server away"); });
    socket.on("back", function() { console.log("server back"); });

    socket.on("message", function(msg) {
        console.log("<-", msg);
        messages[msg.l].push(msg);
        if (msg.l == "b") {
            send(socket, msg.i + 1, msg.f);
        }
    });
});

function connect() {
    return client("ws://localhost:7878");
}

var socket = kaefer.connectClient(connect, { debug: false });
socket.on("away", function() { console.log("client away"); });
socket.on("back", function() { console.log("client back"); });

socket.on("message", function(msg){
    console.log("->", msg);
    messages[msg.l].push(msg);
    if (msg.l == "c") {
        send(socket, msg.i + 1);
    }
    
    if (msg.i > 110) {
        ["a", "b", "c", "d"].forEach(function(l) {
            messages[l] = messages[l].sort(function(a, b) {
                return a.i > b.i ? 1 : -1; 
            });
        });
        console.log(messages);
        ["a", "b", "c", "d"].forEach(function(l) {
            for (var i = 0; i < messages[l].length; i++) {
                assert(messages[l][i].i == 100+i);
            }
        });
        process.exit();
    }
});

socket.connect();

function send(socket, i) {
    setTimeout(function() {
        ["a", "b", "c", "d"].forEach(function(l) {
            socket.send({
                l: l,
                i: i
            });
        });
    }, Math.random() * 100);
}

// chaos monkey

// simulate 20% packet loss
var sendOriginal = socket.socket.send;
socket.socket.send = function() {
    if (Math.random() > 0.2)
        return sendOriginal.apply(this, arguments);
};

// disconnect randomly
(function loop() {
    setTimeout(function() {
        console.log("close connection");
        socket.socket.close();
        loop();
    }, Math.random() * 1000 + 100);
})();
