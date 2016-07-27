module.exports = function(options, optimist) {
    var config = require("./standalone")(options, optimist);
    
    // TODO: cleanup unneeded plugins?
    
    options.client_config = "default-terminal";
    
    return config;
};

if (!module.parent) require("../server")([__filename].concat(process.argv.slice(2)));
