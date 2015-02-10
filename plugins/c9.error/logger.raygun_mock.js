"use strict";

plugin.consumes = [];
plugin.provides = ["error.logger"];

module.exports = plugin;

function plugin(options, imports, register) {
    var sinon = require("sinon");
    
    register(null, {
        "error.logger": {
            log: sinon.stub(),
            error: sinon.stub(),
            warn: sinon.stub()
        }
    });
}
