"use strict";

module.exports = function(options, imports, register) {
    imports.connect.useStart(imports.connect.getModule().logger(options.format || "tiny"));
    register(null, {
        "connect.logger": {}
    });
};
