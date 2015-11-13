require("..");
var assert = require("assert");

console.log("Running amd-loader tests");
console.log("========================\n");

console.log("resolve relative id");
var a = require("./node_modules/a");
var b = require("./node_modules/b");

assert.equal(a.A, "A");
assert.equal(a.B, "B");
assert.equal(a.text, "hello world");
assert.equal(a.D, "D");

assert.equal(b.B, "B");

console.log("resolve fully qualified id");
var a = require("a");
var b = require("b");

assert.equal(a.A, "A");
assert.equal(a.B, "B");
assert.equal(a.text, "hello world");
assert.equal(b.B, "B");

console.log("resolve from node_modules");
var d = require("d");

assert.equal(d.D, "D");

// TODO
// node_modules + package
// async require
