module.exports = function(options, optimist) {
    var plugins = require("./standalone")(options, optimist);
    
    options.inProcessLocalFs = true;
    
    plugins.forEach(function(p) {
        if (p.packagePath)
            p.packagePath = p.packagePath.replace("vfs.connect.standalone", "vfs.connect.local");
    });
    
    return plugins;
};

if (!module.parent) require("../server")([__filename].concat(process.argv.slice(2)));
