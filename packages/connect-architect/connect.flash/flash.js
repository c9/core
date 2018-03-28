"use strict";

var flash = require('connect-flash');

module.exports = function(options, imports, register) {
    imports.session.use(flash());
    register(null, {
        "connect.flash": {}
    });
};
