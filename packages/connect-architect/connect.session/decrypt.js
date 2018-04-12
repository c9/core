"use strict";

var utils = require("./session/utils");

function decrypt(secret, rawCookie) {
    // ensure secret is available or bail
    if (!secret) throw new Error('`secret` option required for sessions');

    // secret is always an array of secrets
    secret = [].concat(secret);

    for (var i = 0; i < secret.length; i++) {
        var unsignedCookie = utils.parseSignedCookie(rawCookie, secret[i]);

        if (unsignedCookie && unsignedCookie !== rawCookie) {
            var usedSecret = secret[i];

            return {
                unsignedCookie: unsignedCookie,
                usedSecret: usedSecret
            };
        }
    }
    
    return {};
}

module.exports.decrypt = decrypt;