"use strict";

module.exports = function(options, imports, register) {
    imports.connect.useSetup(imports.connect.getModule().cookieParser());
    register(null, {
        "connect.cookieparser": {}
    });
};
