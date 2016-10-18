var crypto = require("crypto");

exports.crypt = function(sessionId, secret) {
    secret = [].concat(secret);
    secret = secret[1] || secret[0];

    var cipher = crypto.createCipher("aes256", secret);

    return (
        cipher.update(sessionId, "ascii", "base64") +
        cipher.final("base64")
    ).replace(/\=+$/, "");
};

exports.decrypt = function(encrypted, secret) {
    var secrets = [].concat(secret);

    var data;

    for (var i = 0; i < secrets.length; i++) {
        secret = secrets[i];
        var cipher = crypto.createDecipher("aes256", secret);

        try {
            data = [
                cipher.update(encrypted, "base64", "ascii"),
                cipher.final("ascii")
            ];
        }
        catch (err) { /** ignore failed decrypt **/ }
        if (data) return data.join("").replace(/\=+$/, "");
    }
};

exports.uid = function(length) {
    return (require("crypto")
        .randomBytes(length)
        .toString("base64")
        .slice(0, length)
    );
};