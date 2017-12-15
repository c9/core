if (typeof require === 'function') {
  var crypto = require('crypto');
  var johnston = require('./bench/johnston');
  var Rusha = require('../dist/rusha.js');
  var cifre_utils = require('./bench/cifre/utils.js');
  var cifre_sha1 = require('./bench/cifre/sha1.js');
  var random = require('./random');
  var fnNative = random.fnNative,
      randomBytes = random.randomBytes;
}

var _rush = new Rusha(),
    fnRusha = function (bytes) {
  return _rush.digestFromBuffer(bytes);
};

var fnJohnston = function (bytes) {
  return johnston(bytes);
};

var fnCifre = function (bytes) {
  return cifre_utils.tohex(cifre_sha1(bytes));
};

var ids = ['Native  ', 'Rusha   ', 'Cifre   '];
var fns = [fnNative, fnRusha/*, fnCifre*/];

var bench = function () {
  for (size=0;size<1024*8;size++) {
    // use random test data
    var bytes = randomBytes(size);//"Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquy".substr(0, size);
    var ref = "";
    fns.forEach(function (fn, i) {
      var res = fn(bytes);
      if (ref == "")
        ref = res;
      else if (ref != res)
        console.log(ids[i] + ' hash mismatch on size ' + size + ': ' + res + ' expected: ' + ref);
    });
    if (!(size % 1000))
        console.log(size);
  };
}

bench();

