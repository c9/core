if (typeof require === 'function') {
  var Rusha = require('../dist/rusha.js');
  var randomBytes = require('crypto').pseudoRandomBytes;
}

var sizes = [4*1024, 65535, 1024*1024, 4*1024*1024, 8*1024*1024];

var _rush = new Rusha(Math.max.apply(Math, sizes));

var i, j, bytes, t0, t1;

for (i = 0; i < sizes.length; i++) {
  bytes = randomBytes(sizes[i]);
  t0 = (new Date()).getTime();
  for (j = 0; j < 3; j++) _rush.digestFromBuffer(bytes);
  t1 = (new Date()).getTime();
  console.log('Emitted in ' + ((t1-t0)/3) + ' milliseconds');
}
