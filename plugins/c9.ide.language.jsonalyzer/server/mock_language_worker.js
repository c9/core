// Supported

module.exports.asyncForEach = function(array, fn, callback) {
    array = array.slice(); // copy before use
    function processOne() {
        var item = array.shift();
        fn(item, function processNext(result, err) {
            if (array.length > 0) {
                processOne();
            }
            else if (callback) {
                callback(err, result);
            }
        });
    }
    if (array.length > 0) {
        processOne();
    }
    else if (callback) {
        callback();
    }
};

// Unsupported

["$lastWorker", "sender"].forEach(function(p) {
    Object.defineProperty(module.exports, p, {
        get: function() {
            throw new Error('Unavailable in server context: worker.' + p);
        }
    });
});