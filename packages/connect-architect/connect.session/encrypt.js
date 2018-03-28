"use strict";

var signature = require("cookie-signature");

function encrypt(sessionID, key, cookie, secret) {
  var val = 's:' + signature.sign(sessionID, secret);
  val = cookie.serialize(key, val);

  return val;
}

module.exports = encrypt;