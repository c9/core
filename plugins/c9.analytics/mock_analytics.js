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
            log: function() {},
            track: function() {},
            identify: function() {},
            logClean: function() {},
            trackClean: function() {},
            identifyClean: function() {},
        }
    });
}