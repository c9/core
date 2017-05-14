var crc32 = require('buffer-crc32');

/**
 * Hash the given `sess` object omitting changes
 * to `.cookie`.
 *
 * @param {Object} sess
 * @return {String}
 * @api private
 */

function hash(sess) {
  return crc32.signed(JSON.stringify(sess, function(key, val){
    if ('cookie' != key) return val;
  }));
}

module.exports.hash = hash;
