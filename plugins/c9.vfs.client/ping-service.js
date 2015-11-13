module.exports = function(vfs, options, register) {
    register(null, {
        ping: function (payload, callback) {
            // We simply return the payload, while vfs-socket adds a time stamp
            callback(null, payload);
        }
    });
};
