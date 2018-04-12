require('./helpers');
var deFramer = require('..').deFramer;

// Given an array of message buffers, this returns a single buffer that contains
// all the messages framed.
function frameMessages(messages) {
    var i, l = messages.length;

    // Calculate total size of final buffer
    var total = l * 10;
    for (i = 0; i < l; i++) {
        total += messages[i].length;
    }

    // Create and fill in final buffer
    var buffer = new Buffer(total);
    var offset = 0;
    for (i = 0; i < l; i++) {
        var message = messages[i];
        var length = message.length;
        buffer.writeUInt32BE(length, offset);

        // Compute 4 byte hash
        var a = length >> 24,
            b = (length >> 16) & 0xff,
            c = (length >> 8) & 0xff,
            d = length & 0xff;

        // Little bit inlined, but fast
        var hash = 0;
        hash += a;
        hash += hash << 10;
        hash += hash >> 6;
        hash += b;
        hash += hash << 10;
        hash += hash >> 6;
        hash += c;
        hash += hash << 10;
        hash += hash >> 6;
        hash += d;
        hash += hash << 10;
        hash += hash >> 6;

        // Shuffle bits
        hash += hash << 3;
        hash = hash ^ (hash >> 11);
        hash += hash << 15;
        hash |= 0;
        buffer.writeInt32BE(hash, offset + 4);

        // Reserved bytes
        buffer.writeUInt16BE(0, offset + 8);

        message.copy(buffer, offset + 10);
        offset += length + 10;
    }

    return buffer;
};

// Test the de-framer by creating a sample message stream and simulating packet
// sizes from one-byte-per-packet to all-messages-in-one-packet.
var input = [
  {hello: "world"},
  {Goodbye: "Sanity"},
  [1,2,3,4,5,6,7,6,5,4,3,2,1],

  // Big string that will use multiple bytes for length
  // (Regression test for hashing)
  new Array(300).join('A')
];
var message = frameMessages(input.map(function (item) {
  return new Buffer(JSON.stringify(item)); }));
var length = message.length;
for (var step = 1; step < length; step++) {
  var output = [];
  var parser = deFramer(function (err, message) {
    if (err) throw err;
    output.push(JSON.parse(message.toString()));
  });
  for (var offset = 0; offset < length; offset += step) {
    var end = offset + step
    if (end > length) { end = length; }
    var chunk = message.slice(offset, end);
    console.log(chunk);
    parser(chunk);
  }
  assert.deepEqual(input, output);
}

