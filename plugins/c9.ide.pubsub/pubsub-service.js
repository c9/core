module.exports = function (vfs, options, register) {
    var Stream = require('stream');
    
    var stream = new Stream();
    stream.readable = true;

    register(null, {
        subscribe: function (callback) {
            callback(null, { stream: stream });
        },

        publish: function(message) {
            stream.emit("data", message);
        }
    });
};
