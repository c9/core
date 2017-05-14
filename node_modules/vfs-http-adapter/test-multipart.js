var fs = require('fs');
var assert = require('assert');

function join(buffers) {
    var size = 0;
    buffers.forEach(function (buffer) {
        size += buffer.length;
    });
    var total = new Buffer(size);
    var offset = 0;
    buffers.forEach(function (buffer) {
        buffer.copy(total, offset);
        offset += buffer.length;
    });
    return total;
}

var multipart = require('./multipart');
var boundary = "---------------------------1530233567340623049784027732";
var body = new Buffer(256 * 2);
for (var i = 0; i < 256; i++) {
    body[i] = i;
    body[i + 256] = i;
}
//var body = new Buffer('12345\r\n--67890\n');
var headers = { 'content-disposition': 'form-data; name="module.js"; filename="module.js"', 'content-type': 'application/javascript' };
var data = [new Buffer('--' + boundary + '\r\n'),
            new Buffer('Content-Disposition: ' + headers['content-disposition'] + '\r\n'),
            new Buffer('Content-Type: ' + headers['content-type'] + '\r\n'),
            new Buffer('\r\n'),
            body,
            new Buffer('\r\n'),
            new Buffer('--' + boundary + '--\r\n')];
data = join(data);
fs.writeFileSync("multipart2.log", data);
var size = data.length;

var left = size;
var runs = [];
var done;
next(1);
function next(bufferSize) {
	var files = [];
	var input = require('fs').createReadStream("multipart2.log", {bufferSize: bufferSize});
	var parser = multipart(input, boundary);
	parser.on("part", function (stream) {
		var data = [];
        assert.deepEqual(stream.headers, headers);
		stream.on("data", function (chunk) {
			data.push(chunk);
            console.log("data", chunk);
			if (!chunk.length) throw new Error("Empty buffer");
		});
		stream.on("end", function () {
			if (files.hasOwnProperty(bufferSize)) {
				throw new Error("Duplicate bufferSize " + bufferSize);
			}
            data = join(data);
			files.push(data);
            var actual = data.toString("hex");
            var expected = body.toString("hex");
            if (actual !== expected) {
                console.error("bufferSize " + bufferSize);
                console.error({a:data,e:body});
                assert.equal(actual, expected);
            }
		});
	});
	parser.on("end", function () {
        console.log("Successfully parsed using chunks of size " + bufferSize);
        if (bufferSize < size) {
            next(bufferSize + 1);
        } else {
            console.log("All tests passed!");
            done = true;
        }
	});
}

process.on("exit", function () {
    if (!done) throw new Error("Failed to finish all tests.");
});

