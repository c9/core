module.exports = function(vfs, options, register) {
    register(null, {
        log: function (message, callback) {
            callback = callback || function(){};
            
            console.log(message);
            callback();
        }
    })
}