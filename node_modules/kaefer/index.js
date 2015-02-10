require("amd-loader");

if (process.env.CONNECT_COV) {
    exports.Server = require("./lib-cov/server");
    exports.connectClient = require("./lib-cov/client");
    exports.ReliableSocket = require("./lib-cov/reliable_socket");
    exports.ReconnectSocket = require("./lib-cov/reconnect_socket");
    exports.version = require("./lib-cov/version");
}
else {
    exports.Server = require("./lib/server");
    exports.connectClient = require("./lib/client");
    exports.ReliableSocket = require("./lib/reliable_socket");
    exports.ReconnectSocket = require("./lib/reconnect_socket");
    exports.version = require("./lib/version");
}
