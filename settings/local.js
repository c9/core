module.exports = function(manifest, installPath, settingDir) {
    var path = require("path");
    var fs = require("fs");
    
    if (typeof installPath != "string") {
        installPath = process.platform == "darwin" && false // disabled for sdk
            ? "/Library/Application Support/Cloud9"
            : path.join(process.env.HOME, ".c9");
    }
     
    var config = require("./standalone")(manifest, installPath);
    
    // Support legacy installations
    if (!config.settingDir) {
        if (settingDir)
            config.settingDir = settingDir;
        else {
            config.settingDir = installPath;
            if (installPath === "/Library/Application Support/Cloud9")
                config.settingDir = path.join(process.env.HOME, installPath);
        }
    }
   
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
    
    // config.nodeBin = [process.platform == "win32"
    //     ? path.join(process.execPath, "..\\node.exe")
    //     : path.join(installPath, "node/bin/node")];
    config.bashBin = process.platform == "win32"
        ? process.env.C9_BASH_BIN || "C:\\cygwin\\bin\\bash.exe"
        : "/bin/bash";
        
    config.raygun.client.apiKey = "sraXwWUvvI6TQT6d45u4bw==";
    config.raygun.server.apiKey = "sraXwWUvvI6TQT6d45u4bw==";
    
    config.packed = false;
    return config;
};
