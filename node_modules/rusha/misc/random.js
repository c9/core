if (typeof require === 'function') {
  var crypto = require('crypto');
  var johnston = require('./bench/johnston');
  var Rusha = require('../dist/rusha.js');
  var cifre_utils = require('./bench/cifre/utils.js');
  var cifre_sha1 = require('./bench/cifre/sha1.js');
}

if (typeof module !== 'undefined') {

  module.exports = {

    fnNative: function (bytes) {
      var shasum = crypto.createHash('sha1');
      shasum.update(bytes);
      return shasum.digest('hex');
    },

    randomBytes: function (size) {
      return crypto.pseudoRandomBytes(size);
    },

  };

} else {

  function fnNative () { return 'unavailable'; }

  function randomBytes (size) {
    var bytes = new Uint8Array(size);
    var r;
    for (var i = 0, r; i < size; i++) {
      if ((i & 0x03) == 0) r = Math.random() * 0x100000000;
      bytes[i] = r >>> ((i & 0x03) << 3) & 0xff;
    }
    return bytes;
  }

}
