"use strict";

plugin.consumes = [];
plugin.provides = ["connect", "http"];

module.exports = plugin;

function plugin(options, imports, register) {
    var connect = require("connect");
    
    var globalOptions = {};
    
    register(null, {
        "connect": {
            getModule: function() { return connect; },
            useStart: function() {},
            useSetup: function() {},
            useMain: function() {},
            useSession: function() {},
            useError: function() {},
            use: function() {},
            setGlobalOption: function(name, value) {
                globalOptions[name] = value;
            },
            getGlobalOptions: function() {
                return globalOptions;
            },
            addResponseMethod: function() {}
        },
        "http": {
            getServer: function() {
                return {
                    on: function() {}
                };
            }
        }
    });
}