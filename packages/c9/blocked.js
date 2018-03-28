module.exports = function (callback) {
    var start = Date.now();
    // setInterval is handled after setImmediate and setTimeout handlers
    var interval = setTimeout(function () {
        clearInterval(interval);
        var took = Date.now() - start;
        return callback(took);
    }, 0);
};