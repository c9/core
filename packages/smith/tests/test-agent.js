require('./helpers');
var Agent = require('..').Agent;
var Transport = require('..').Transport;

var a = new Agent({
	add: function (a, b, callback) {
		callback(a + b);
	}
});
var b = new Agent();
process.nextTick(testFakeTransport)

expect("test1");
function testFakeTransport() {
	fulfill("test1");
	console.log("Testing fake transport");
	var pair = makePair("A", "B", true)
	expect("connect AB");
	a.connect(pair.A, function (err, AB) {
		if (err) throw err;
		fulfill("connect AB");
		console.log("A is connected to B!");
	});
	expect("connect BA");
	b.connect(pair.B, function (err, BA) {
		if (err) throw err;
		fulfill("connect BA");
		console.log("B is connected to A!");
		expect("result");
		BA.add(1, 2, function (result) {
			fulfill("result");
			console.log("Result", result);
			assert.equal(result, 3);
			testSocketTransport();
		});
	});
}

expect("alldone");
expect("test2");
function testSocketTransport() {
	console.log("Test 2 using real tcp server");
	fulfill("test2");
	var net = require('net');
	expect("connect1");
	var server = net.createServer(function (socket) {
		fulfill("connect1");
		socket.on('data', function (chunk) {
			console.log("B->A (%s):", chunk.length, chunk);
		});
		expect("connectAB");
		a.connect(new Transport(socket), function (err, AB) {
			if (err) throw err;
			fulfill("connectAB");
			console.log("A is connected to B!");
		});
		console.log("connection");
	});
	server.listen(function () {
		var port = server.address().port;
		expect("connect2");
		var socket = net.connect(port, function () {
			fulfill("connect2");
			expect("connectBA");
			b.connect(new Transport(socket), function (err, BA) {
				if (err) throw err;
				fulfill("connectBA");
				console.log("B is connected to A!");
				expect("result2");
				BA.add(1, 2, function (result) {
					fulfill("result2");
					console.log("Result", result);
					assert.equal(result, 3);
					socket.end();
					server.close();
					fulfill("alldone");
				});
			});
		});
		socket.on("data", function (chunk) {
			console.log("A->B (%s):", chunk.length, chunk);
		});
	});
}
