// A very simple API
exports.ping = function (callback) {
    callback(null, process.pid + " pong");
}
