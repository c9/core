module.exports = function(config, optimist) {
    optimist
        .describe("config", "name of the client config to compile")
        .describe("server-config", "name of the client server config to take the statics from")
        .default("server-config", "ide")
        .describe("server-settings", "name of the server settings")
        .default("server-settings", "devel")
        .describe("skin", "name of the skin to compile")
        .describe("module", "name of the module to compile")
        .describe("worker", "name of the worker to compile")
        .describe("compress", "whether to uglify the output", config.cdn.compress)
        .boolean("compress")
        .describe("obfuscate", "whether to obfuscate variable names in the output", config.cdn.obfuscate)
        .boolean("obfuscate")
        .describe("local", "whether to compile for the local version", false)
        .boolean("local")
        .describe("keep-less", "whether to keep less/css in the compiled config", false)
        .boolean("keep-less")
        .describe("compress-output-dir-prefix", "folder prefix to add compressed files in addition to uncompressed files")
        .boolean("link-cdn-files")
        .default("link-cdn-files", false)
        .boolean("skip-duplicates")
        .describe("skip-duplicates", "whether to build files for identical configs", false)
        .boolean("copy-static-resources")
        .describe("cache", "cache directory", config.cdn.cacheDir)
        .describe("version", "overrride version", config.cdn.version);

    var argv = optimist.argv;
    if (argv.help)
        return null;
        
    return [
        "./c9.static/connect-static",
        {
            packagePath: "./c9.static/build",
            version: argv.version,
            cache: argv.cache,
            compress: argv.compress,
            obfuscate: argv.obfuscate,
            baseUrl: config.cdn.baseUrl + "/" + config.cdn.version,
            config: argv["server-config"],
            settings: argv["server-settings"],
            keepLess: argv["keep-less"],
            link: argv["link-cdn-files"]
        }, {
            packagePath: "./c9.static/cdn.cli",
            skin: argv.skin,
            config: argv.config,
            worker: argv.worker,
            module: argv.module,
            withSkins: argv["with-skins"],
            skipDuplicates: argv["skip-duplicates"],
            copyStaticResources: argv["copy-static-resources"],
            compressOutputDirPrefix: argv["compress-output-dir-prefix"],
            compress: argv.compress,
            obfuscate: argv.obfuscate,
        }, {
            packagePath: "./c9.core/ext"
        }, {
            packagePath: "./c9.logtimestamp/logtimestamp",
            mode: config.mode
        },
    ];
};
