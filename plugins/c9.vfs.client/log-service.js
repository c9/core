
module.exports = function(vfs, options, register) {
    register(null, {
        log: function(message, callback) {
            console.log("VFSLOG: " + message);
            console.error("VFSERROR: " + message);
            callback();
        }
    })
}