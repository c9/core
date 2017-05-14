"use strict";

module.exports = function startup(options, imports, register) {
    var logger = new LogService();

    register(null, {
        log: {
            log: logger.log.bind(logger),
            info: logger.info.bind(logger),
            warn: logger.warn.bind(logger),
            error: logger.error.bind(logger)
        }
    });
};

var LogService = module.exports.LogService = function() {};

(function() {

    this.log = function() {
        console.log.apply(console, arguments);
    };
    
    this.info = function() {
        console.info.apply(console, arguments);
    };

    this.warn = function() {
        console.warn.apply(console, arguments);
    };

    this.error = function() {
        console.error.apply(console, arguments);
    };

}).call(LogService.prototype);