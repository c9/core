// Mini test framework for async tests.
var assert = require('assert');
global.setImmediate = global.setImmediate || process.nextTick;

var expectations = {};
function expect(message) { expectations[message] = new Error("Missing expectation: " + message); }
function fulfill(message) { delete expectations[message]; }
process.addListener('exit', function () {
  Object.keys(expectations).forEach(function (message) {
    throw expectations[message];
  });
});

global.assert = assert;
global.expect = expect;
global.fulfill = fulfill;

var Stream = require('stream').Stream;
var Transport = require('..').Transport;

// Make a fake pipe pair for testing.
global.makePair = function makePair(a, b, log) {
  var left = new Stream();
  var right = new Stream();
  left.writable = true;
  left.readable = true;
  right.writable = true;
  right.readable = true;
  left.write = function (chunk) {
    setImmediate(function () {
      if (log) console.log(a,"->",b,chunk);
      right.emit("data", chunk);
    });
  };
  right.write = function (chunk) {
    setImmediate(function () {
      if (log) console.log(b,"->",a,chunk);
      left.emit("data", chunk);
    });
  };
  var pair = {};
  pair[a] = new Transport(left);
  pair[b] = new Transport(right);
  return pair;
}
