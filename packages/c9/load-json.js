"use strict";

var fs = require("fs");

/**
 * A "safe" JSON loader. 
 * 
 * When parsing JSON we must wrap it in a try/catch block to prevent parsing 
 * errors from crashing our process.
 * 
 * By wrapping json-parse as an async funciton we circumvent this problemn and
 * follow the node-conventions for next(err, result)
 */

function parse(str, done) {
    /**
     * JSON.parse can block the event loop. setImmediate will push calls to .parse
     * on a callback queue.
     */
    setImmediate(function(){
        try {
            var data = JSON.parse(str);
            return done(null, data);
        }
        catch (err) {
            return done(err);
        }
    });
}

module.exports.parse = parse;

function load(path, done) {
    fs.readFile(path, function(err, buf) {
        if (err) return done(err);
        return parse(buf.toString(), done);
    });
}

module.exports.load = load;
