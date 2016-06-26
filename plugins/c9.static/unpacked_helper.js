/**
 * unpacked_helper speeds up the unpacked version of Cloud9
 * by using more parallel connections and avoiding
 * subsubdomains on dogfooding (e.g., ide.dev-lennartcl.c9.io, where
 * Chrome doesn't support any caching).
 */
"use strict";

plugin.consumes = [
    "db", "connect.static"
];
plugin.provides = [
    "unpacked_helper"
];

module.exports = plugin;

function plugin(options, imports, register) {
    var connectStatic = imports["connect.static"];
    var assert = require("assert");
    var baseUrl = options.baseUrl;
    var ideBaseUrl = options.ideBaseUrl;
    assert(baseUrl, "baseUrl must be set");
    assert(ideBaseUrl, "ideBaseUrl must be set");
    
    var balancers = [
        baseUrl + "/_unp",
        baseUrl + ":8080/_unp",
        baseUrl + ":8081/_unp",
        baseUrl + ":8082/_unp",
    ];
    
    connectStatic.getRequireJsConfig().baseUrlLoadBalancers = balancers;
    assert(connectStatic.getRequireJsConfig().baseUrlLoadBalancers);
    
    register(null, {
        "unpacked_helper": {}
    });
}