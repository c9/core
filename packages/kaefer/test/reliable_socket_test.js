#!/usr/bin/env node

/*global describe it before after beforeEach afterEach */
"use strict";

"use server";

require("c9/inline-mocha")(module);

var kaefer = require("..");
var ReliableSocket = kaefer.ReliableSocket;
var ReconnectSocket = kaefer.ReconnectSocket;
var EventEmitter = require("events").EventEmitter;

var expect = require("chai").expect;
var sinon = require("sinon");

describe("Reliable Socket", function(){
    this.timeout(2000);

    var clock;
    beforeEach(function() {
        clock = sinon.useFakeTimers();
    });

    afterEach(function () {
        clock.restore();
    });

    describe("buffer messages while away", function() {
        
        var reconnect = new ReconnectSocket();
        var socket = new ReliableSocket(reconnect);
        
        it("should add messages to the buffer while away", function() {
            expect(reconnect.readyState).to.equal("away");
            expect(socket.buffer).to.have.length(0);
            
            socket.send("msg");
            expect(socket.buffer).to.have.length(1);
        });
        
        it("should flush the buffer once the connection is back", function() {
            //var mockEio = new EventEmitter();
            var mockEio = createMockEio();
            expect(socket.buffer).to.have.length(1);
            reconnect.setSocket(mockEio);
            sinon.assert.called(mockEio.send);
            expect(socket.buffer).to.have.length(0);
        });
    });
    
    describe("acknowledge packets", function() {

        var eio, reconnect, socket;
        
        beforeEach(function() {
            eio = createMockEio();
            reconnect = new ReconnectSocket(eio);
            socket = new ReliableSocket(reconnect, {
                debug: false,
                ackTimeout: 200,
                seq: 500
            });
        });

        it("should automatically acknowledge packets after ack timeout", function() {
            socket._ack = sinon.spy();
            eio.emit("message", JSON.stringify({
                seq: 123,
                d: "msg",
                ack: 500
            }));
            
            sinon.assert.notCalled(socket._ack);
            clock.tick(199);
            sinon.assert.notCalled(socket._ack);
            clock.tick(2);
            sinon.assert.called(socket._ack);
        });
       
        it("should not acknowledge packets if a packet is sent before the ack timeout", function() {
            socket._ack = sinon.spy();
            eio.emit("message", JSON.stringify({
                seq: 123,
                d: "msg",
                ack: 500
            }));
            
            sinon.assert.notCalled(socket._ack);
            clock.tick(199);
            socket.send("message");
            sinon.assert.notCalled(socket._ack);
            clock.tick(2);
            sinon.assert.notCalled(socket._ack);
        });
       
    });
});

function createMockEio() {
    var mock = new EventEmitter();
    mock.readyState = "open";
    mock.send = sinon.spy();
    return mock;
}