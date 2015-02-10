module.exports = function(vfs, options, register) {
    register(null, {
        ping: function (payload, callback) {
            callback(null, payload);
        }
    });
};
