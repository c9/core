require('./helpers');
var Agent = require('..').Agent;
var Transport = require('..').Transport;

var a = new Agent({
  add: function (a, b, callback) {
    callback(a + b);
  }
});
var b = new Agent();
var samples = [];

var pair = makePair("A", "B");
a.connect(pair.A, function (err, AB) {
  if (err) throw err;
  console.log("A is connected to B!");
});
b.connect(pair.B, function (err, BA) {
  if (err) throw err;
  console.log("B is connected to A!");
  var left = 300000;
  for (var i = 0; i < 100; i++) {
    test();
  }

  function test() {
    BA.add(1, 2, function (result) {
      assert.equal(result, 3);
      if (left % 10000 === 0) {
        var sample = process.memoryUsage();
        console.log(sample);
        samples.push(sample);
      }
      if (--left > 0) test();
      else if (left === 0) done();
    });
  }
});


expect("done");
function done() {
  // Trim the first few samples to not include startup time
  samples = samples.slice(4);
  getSlope("rss");
  fulfill("done");
}

function getSlope(key) {
  var sum = 0;
  var max = 0;
  var min = Infinity;
  samples.forEach(function (sample) {
    var value = sample[key];
    sum += value;
    if (value > max) max = value;
    if (value < min) min = value;
  });
  var mean = sum / samples.length;
  var deviation = 0;
  samples.forEach(function (sample) {
    var diff = mean - sample[key];
    deviation += diff * diff;
  });
  deviation = Math.sqrt(deviation / (samples.length - 1));
  var limit = mean / 10;
  console.log("%s: min %s, mean %s, max %s, standard deviation %s", key, min, mean, max, deviation);
  if (deviation > limit) {
    throw new Error("Deviation for " + key + " over " + limit + ", probably a memory leak");
  }
}
