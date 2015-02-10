"use strict";

plugin.consumes = ["raygun"];
plugin.provides = ["error.logger"];

module.exports = plugin;

function plugin(options, imports, register) {
    var raygun = imports.raygun;
    
    function error(err, customData, user) {
        raygun.errorClient.setUser(user);
        raygun.errorClient.send(err, customData);
    }
    
    function warn(err, customData, user) {
        raygun.warningClient.setUser(user);
        raygun.warningClient.send(err, customData);
    }
    
    register(null, {
        "error.logger": {
            log: error,
            error: error,
            warn: warn
        }
    });
}
