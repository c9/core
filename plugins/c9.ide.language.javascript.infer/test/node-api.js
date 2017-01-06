var assert = require("assert");
assert;
//# ^ nodejs_latest:assert

var buffer = new Buffer();

var n = Buffer.INSPECT_MAX_BYTES;
    n;
//# ^ es5:Number

var l = buffer._charsWritten;
    l;
//# ^ es5:Number

var u = process.getuid();
    u;
//# ^ es5:Number

var fun = require("readline").createInterface;
    fun;
//# ^ es5:Function

var server1 = require("http").createServer();
    server1;
//# ^ nodejs_latest:http/Server/prototype

var http = require('http');
http.createServer(function (req, res) {
    req;
//# ^ nodejs_latest:http/ServerRequest
});
