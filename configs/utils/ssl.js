module.exports = function(config, optimist) {
    var fs = require("fs");
    var path = require("path");

    var argv = optimist.argv;
    if (argv.secure || argv.ssl) {
        var key = getFile(argv.secure || argv.ssl);
        config.secure = {
            key: key.match(/^(-+BEGIN (\w+ )?PRIVATE KEY[\s\S]*END (\w+ )?PRIVATE KEY-+)/m)[0],
            cert: key.match(/^(-+BEGIN CERTIFICATE[\s\S]*END CERTIFICATE-+)/m)[0],
        };
    }
    else if (argv["ssl.key"] && argv["ssl.cert"]) {
        config.secure = {
            key: getFile(argv["ssl.key"]),
            cert: getFile(argv["ssl.cert"]),
        };
    }
    
    function getFile(filepath) {
        if (!path.isAbsolute(filepath))
            filepath = path.join(__dirname, "../..", filepath);
        return fs.readFileSync(filepath, "utf8");
    }
};

