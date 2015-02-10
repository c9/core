var Crypto = require("crypto");

/**
 * Return md5 hash of the given string and optional encoding,
 * defaulting to hex.
 *
 * @param {String} str
 * @param {String} encoding
 * @return {String}
 * @api public
 */
exports.md5 = function(str, encoding){
    return Crypto.createHash("md5").update(str).digest(encoding || "hex");
};