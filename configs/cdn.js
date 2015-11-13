module.exports = function(config) {
    return [{
            packagePath: "connect-architect/connect",
            port: config.cdn.port,
            host: config.cdn.host
        },
        "connect-architect/connect.static",
        {
            packagePath: "./c9.static/cdn",
            cacheFiles: true
        }, {
            packagePath: "./c9.static/build",
            version: config.cdn.version,
            cache: config.cdn.cacheDir,
            compress: config.cdn.compress,
            baseUrl: config.cdn.baseUrl + "/" + config.cdn.version
        }, {
            packagePath: "connect-architect/connect.cors"
        }, {
            packagePath: "./c9.logger/stdout-logger"
        }, {
            packagePath: "./c9.core/ext"
        }, {
            packagePath: "./c9.logtimestamp/logtimestamp",
            mode: config.mode
        },
    ];
};
