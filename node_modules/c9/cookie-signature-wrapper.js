"use strict";

var cookieSignature = require("cookie-signature");

function unsign(hash, secret) {
    var secrets = [].concat(secret);

    for (var i = 0; i < secrets.length; i++) {
        var encrypted = cookieSignature.unsign(hash, secrets[i]);
        if (encrypted) return encrypted;
    }
    return false;
}

module.exports.unsign = unsign;

function sign(hash, secret) {
    var secrets = [].concat(secret);
    secret = secrets[1] || secrets[0];
    
    return cookieSignature.sign(hash, secret);
}

module.exports.sign = sign;