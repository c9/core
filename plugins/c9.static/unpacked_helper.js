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
        baseUrl + "/uph",
    ];
    /* UNDONE: for now we put all static content on one domain
               because of reports of CORS errors
    if (!options.avoidSubdomains)
        balancers.push(
            ideBaseUrl
            // We could include others but dogfooding URLs like
            // vfs.newclient-lennartcl.c9.io don't have a cert, so
            // let's not
            // apiBaseUrl + "/uph",
            // vfsBaseUrl + "/uph"
        );
    */
    
    connectStatic.getRequireJsConfig().baseUrlLoadBalancers = balancers;
    assert(connectStatic.getRequireJsConfig().baseUrlLoadBalancers);
    
    register(null, {
        "unpacked_helper": {}
    });
}