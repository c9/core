/*global describe:false, it:false */

"use client";

require(["lib/chai/chai", "events"], function(chai, events) {
    var expect = chai.expect;
    var Emitter = events.EventEmitter;

    var ev = new Emitter();
    
    describe('events', function() {
        it("should register an event listener and catch an event", function(done) {
            ev.on("myevent", onEvent);
            
            ev.emit("myevent", 42);

            function onEvent(data) {
                expect(data).equal(42);
                ev.off("myevent", onEvent);
                done();
            }
        });
        it("should catch multiple events of the same type", function(done) {
            var times = 0;
            ev.on("myevent", onEvent);
            ev.emit("myevent", 43);
            ev.emit("myevent", 43);

            function onEvent(data) {
                expect(data).equal(43);
                if (++times === 2) {
                    ev.off("myevent", onEvent);
                    done();
                }
            }
        });
        it("should call multiple listeners for a single event", function(done) {
            var times = 0;
            ev.on("myevent", onEvent1);
            ev.on("myevent", onEvent2);
            ev.emit("myevent", 44);

            function onEvent1(data) {
                expect(data).equal(44);
                times++;
            }

            function onEvent2(data) {
                expect(data).equal(44);
                if (++times === 2) {
                    ev.off("myevent", onEvent1);
                    ev.off("myevent", onEvent2);
                    done();
                }
            }
        });
        it("should return a return value from multiple listeners for a single event", function(done) {
            ev.on("myevent", onEvent1);
            ev.on("myevent", onEvent2);
            var result = ev.emit("myevent", 44);
            expect(result).to.equal(858);
            ev.off("myevent", onEvent1);
            ev.off("myevent", onEvent2);
            done();

            function onEvent1(data) {
                expect(data).equal(44);
                return 456;
            }

            function onEvent2(data) {
                expect(data).equal(44);
                return 858;
            }
        });
        it("should stop listening after a handler is removed", function(done) {
            ev.on("myevent", onEvent);
            ev.emit("myevent", 45);
            ev.off("myevent", onEvent);
            ev.emit("myevent", 46);
            done();

            function onEvent(data) {
                expect(data).equal(45);
            }
        });
        it("should not remove all listeners", function(done) {
            var times = 0;
            ev.on("myevent", onEvent);
            ev.on("myevent", onEvent);
            ev.off("myevent", onEvent);
            ev.emit("myevent", 45);
            expect(times).equal(1);
            done();

            function onEvent(data) {
                times++;
                expect(data).equal(45);
            }
        });
    });
    
    onload();
});