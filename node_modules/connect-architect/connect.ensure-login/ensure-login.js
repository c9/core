"use strict";

var login = require("connect-ensure-login");

module.exports = function(options, imports, register) {
    var loginUrl = options.loginUrl || "/login.html";

    register(null, {
        "connect.ensure-login": {
            ensureLoggedIn: login.ensureLoggedIn.bind(null, loginUrl)
        }
    });
};
