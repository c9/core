"use strict";

module.exports = function(options, imports, register) {
    imports.connect.useSetup(remoteAddress);
    register(null, {
        "connect.remote-address": {}
    });
};

function remoteAddress(req, res, next) {
    req.remoteAddress = 
        req.headers['x-forwarded-for'] || 
        req.socket.remoteAddress ||
        req.connection.remoteAddress || 
        req.connection.socket.remoteAddress;

    req.proto = 
        req.headers["x-forwarded-proto"] || 
        (req.socket.encrypted ? "https" : "http");
        
    next();
}