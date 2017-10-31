define(function(require, exports, module) {
    
    module.exports = function(vfs, options) {
        vfs.extend("chromeDebugProxyLauncher", {
            code: options.standalone ? undefined : require("text!./bridge-service.js"),
            file: options.standalone ? "c9.cli.bridge/bridge-service.js" : undefined,
            redefine: true
        }, function(err, remote) {
            
        });
    };
    
    
    
    
    
});