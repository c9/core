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
    assert(options.baseUrl, "baseUrl must be set");
    assert(options.ideBaseUrl, "ideBaseUrl must be set");
    
    var balancers = [
        baseUrl + "/uph",
    ];
    if (!options.avoidSubdomains)
        balancers.push(
            ideBaseUrl
            // We could include others but dogfooding URLs like
            // vfs.newclient-lennartcl.c9.io don't have a cert, so
            // let's not
            // apiBaseUrl + "/uph",
            // vfsBaseUrl + "/uph"
        );
    
    connectStatic.getRequireJsConfig().baseUrlLoadBalancers = balancers;
    assert(connectStatic.getRequireJsConfig().baseUrlLoadBalancers);
    
    register(null, {
        "unpacked_helper": {}
    });
}