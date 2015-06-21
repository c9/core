"use strict";

var debug = require("debug")("node:defaults");

main.consumes = [];
main.provides = ["node.defaults"];

module.exports = main;

/**
 * initialize gloabl nodejs settings
 */

function main(options, imports, register) {
    
    if ("tls_reject_unauthorized" in options) {
        debug("setting NODE_TLS_REJECT_UNAUTHORIZED to %s", options.tls_reject_unauthorized);
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = options.tls_reject_unauthorized;
        
    }
    
    if (options.maxSockets) {
        debug("setting maxSockets to %s", options.maxSockets);
        require("http").globalAgent.maxSockets = options.maxSockets;
        require("https").globalAgent.maxSockets = options.maxSockets;
    }
    
    register(null, {
        "node.defaults": {}
    });
}
