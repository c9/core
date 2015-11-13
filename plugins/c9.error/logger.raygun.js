/**
 * This error handler is for server side error logging.
 * 
 **/
 
"use strict";

plugin.consumes = ["raygun"];
plugin.provides = ["error.logger"];

module.exports = plugin;

function plugin(options, imports, register) {
    var raygun = imports.raygun;
    
    function error(err, customData, user) {
        if (typeof err == "string")
            err = new Error(err);
        raygun.errorClient.setUser(user);
        raygun.errorClient.send(err, customData);
    }
    
    function warn(err, customData, user) {
        if (typeof err == "string")
            err = new Error(err);
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
