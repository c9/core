/**
 * Password encrypting and verifying
 * Passwords are first hashed using md5 then encrypted using bcrypt. 
 * 
 */
 
var hashing = require('./hashing');
var bcrypt;
var SALT_LENGTH = 8;

function loadBcrypt() {
    if (bcrypt) return;
    
    try {
        bcrypt = require('bcrypt');
    } catch (e) {
        console.error("Failed to load bcrypt - binary version mismatch?", e.stack);
        process.exit(1);
    }
}

exports.encrypt = function(password, callback) {
    loadBcrypt();
    var passwordHashed = hashing.md5(password);
    bcrypt.hash(passwordHashed, SALT_LENGTH, function(err, passwordEncrypted) {
        if (err) return callback(err);
        callback(null, passwordEncrypted);
    });
};

exports.compare = function(password, encrypted, callback) {
    loadBcrypt();
    var passwordHashed = hashing.md5(password);
    if (passwordHashed == encrypted) { // Some passwords may still only be hashed, not bcrypted, so see if that worked first. 
       return callback(null, true);
    }
    bcrypt.compare(passwordHashed, encrypted, function (err, result) { // Password is stored hashed then bcrypted, so we compare using the hashed password. 
        if (err) return callback(err);
        callback(null, result);
    });
};