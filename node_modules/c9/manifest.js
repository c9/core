var git = require("./git");
var hostname = require("./hostname");
var os = require("os");

exports.load = function(root) {
    var manifest = require(root + "/package.json");
    manifest.revision = 
        manifest.revision ||
        git.getHeadRevisionSync(root);

    manifest.hostname = hostname.get();
    manifest.internalIP = os.networkInterfaces().eth0 && os.networkInterfaces().eth0[0].address;

    return manifest;
};

