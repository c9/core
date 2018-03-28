"use strict";

module.exports = function(options, imports, register) {
    imports.connect.useSetup(imports.connect.getModule().urlencoded());
    imports.connect.useSetup(imports.connect.getModule().json());
    register(null, {
        "connect.bodyparser": {}
    });
};
