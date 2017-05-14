var crypto = require("crypto");

module.exports = function(length) {
    var uid = "";
    while (uid.length <= length) {
        uid += crypto
            .randomBytes(256)
            .toString("base64")
            .replace(/[^a-zA-Z0-9]/g, "");
    }
    // HACK: make sure unique id is never syntactically valid JavaScript
    // See http://balpha.de/2013/02/plain-text-considered-harmful-a-cross-domain-exploit/
    uid = "9c" +uid.slice(0, length - 2);
    return uid;
};