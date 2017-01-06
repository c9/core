// Supported

module.exports.getMaxFileSizeSupported = function() {
    return 10000 * 80; // from base_handler
};

// Unsupported

[
    "getHandlerFor",
    "getAllHandlers",
    "handlesLanguage",
    "registerPlugin"
].forEach(function(p) {
    Object.defineProperty(module.exports, p, {
        get: function() {
            throw new Error('Unavailable in server context: worker.' + p);
        }
    });
});