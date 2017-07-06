module.exports = function(manifest, installPath) {
    var path = require("path");
    var fs = require("fs");
    
    var config = require("./standalone")(manifest, installPath);
     
    config.local = true;
    config.standalone = false;
    config.host = "localhost";
    config.startBridge = true;
    config.collab = false;
    config.apiUrl = "https://api.c9.io",
    config.ideBaseUrl = "https://c9.io",
    config.authorizationUrl = "https://c9.io/api/nc/auth";
    config.projectName = process.env.HOSTNAME || "/";
    if (process.platform == "win32" && config.projectName == "/")
        config.projectName = "Computer";
    
    config.saucelabs.serverURL = null;
    config.saucelabs.account = null;
    
    config.update = {
        path: require("path").join(__dirname, ".."),
        host: "update.c9.io",
        port: "443",
        protocol: "https"
    };
    // for development
    // config.update.host = "localhost"
    // config.update.port = "8888"
    // config.update.host = "http"
    
    config.raygun.client.apiKey = "sraXwWUvvI6TQT6d45u4bw==";
    config.raygun.server.apiKey = "sraXwWUvvI6TQT6d45u4bw==";
    
    config.packed = false;
    return config;
};
