/**
 * Dummy implementation of metrics.
 */
"use strict";

plugin.consumes = [];
plugin.provides = ["metrics"];

module.exports = plugin;

function plugin(options, imports, register) {
    
     register(null, {
        "metrics": {
            log: function() {},
            increment: function() {},
            timing: function() {}
        }
    });
}