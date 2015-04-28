/**
 * Dummy implementation of experiments.
 */
"use strict";

plugin.consumes = [];
plugin.provides = ["experiment"];

module.exports = plugin;

function plugin(options, imports, register) {
    
     register(null, {
        "experiment": {
            configure: function() {},
            onStart: function() {
                var chain = {
                    variation: function() {
                        return chain;
                    }
                };
                return chain;
            }
        }
    });
}