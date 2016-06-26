"use strict";

plugin.consumes = [];
plugin.provides = ["error.logger"];

module.exports = plugin;

function plugin(options, imports, register) {
    var noop = function() {};
    
    register(null, {
        "error.logger": {
            log: noop,
            error: noop,
            warn: noop
        }
    });
}
