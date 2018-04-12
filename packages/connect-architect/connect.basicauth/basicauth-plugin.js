"use strict";

module.exports = function(options, imports, register) {
    if (!options.username || !options.password)
        return register();

    var connect = imports.connect;
    connect.useSetup(connect.getModule().basicAuth(options.username, options.password));

    console.log("Using basic authentication");

    register();
};

