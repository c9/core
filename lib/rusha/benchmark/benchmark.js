if (typeof require === 'function') {
  var crypto = require('crypto');
  var johnston = require('../examples/bench/johnston');
  var Rusha = require('../rusha');
  var cifre_utils = require('../examples/bench/cifre/utils.js');
  var cifre_sha1 = require('../examples/bench/cifre/sha1.js');
  var random = require('../examples/random');
  var fnNative = random.fnNative,
      randomBytes = random.randomBytes;
  var Benchmark = require('benchmark');
}

var _rush = new Rusha(1 * 1024 * 1024);

var bytes = randomBytes(1 * 1024 * 1024);

(new Benchmark.Suite)

.add('Rusha', function() {
  _rush.digest(bytes);
})
.add('Johnston', function() {
  johnston(bytes);
})
.add('Cifre', function () {
  cifre_utils.tohex(cifre_sha1(bytes));
})

.on('cycle', function(event) {
  console.log(String(event.target));
})
.on('complete', function() {
  console.log('Fastest is ' + this.filter('fastest').pluck('name'));
})

.run();
