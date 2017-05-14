/**
 * Dummy implementation of analytics.
 */
"use strict";

plugin.consumes = [];
plugin.provides = ["analytics"];

module.exports = plugin;

function plugin(options, imports, register) {
    
     register(null, {
        "analytics": {
            track: function() {},
            identify: function() {},
            updateTraits: function() {},
            alias: function() {},
            logClean: function() {} // huh??
        }
    });
}