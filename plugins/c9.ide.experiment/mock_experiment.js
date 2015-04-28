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
            configureExperiment: function() {},
            onStart: function() {
                var chain = {
                    variation: function() {
                        return chain;
                    }
                }
                return chain;
            }
        }
    });
}