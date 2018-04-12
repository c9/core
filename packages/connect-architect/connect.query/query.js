"use strict";

module.exports = function(options, imports, register) {
    imports.connect.useSetup(imports.connect.getModule().query());
    register(null, {
        "connect.query": {}
    });
};
