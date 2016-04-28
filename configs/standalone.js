module.exports = function(config, optimist) {
    
    var path = require("path");
    
    if (!optimist.local) {
        optimist
            .boolean("t")
            .describe("t", "Start in test mode")
            .describe("k", "Kill tmux server in test mode")
            .default("b", false)
            .describe("b", "Start the bridge server - to receive commands from the cli")
            .default("w", config.workspaceDir)
            .describe("w", "Workspace directory")
            .alias("p", "port")
            .default("port", process.env.PORT || config.port)
            .describe("port", "Port")
            .alias("d", "debug")
            .default("debug", false)
            .describe("debug", "Turn debugging on")
            .alias("l", "listen")
            .default("listen", process.env.IP || config.host)
            .describe("listen", "IP address of the server")
            .boolean("help")
            .describe("workspacetype", "The workspace type to use")
            .alias("ws", "workspacetype")
            .describe("readonly", "Run in read only mode")
            .alias("ro", "readonly")
            .describe("packed", "Whether to use the packed version.")
            .boolean("packed")
            .default("packed", config.packed)
            .alias("a", "auth")
            .boolean("hosted")
            .describe("hosted", "Use default config of the hosted version")
            .default("hosted", false)
            .describe("auth", "Basic Auth username:password")
            .describe("collab", "Whether to enable collab.")
            .default("collab", config.collab)
            .describe("cache", "use cached version of cdn files")
            .default("cache", true)
            .describe("setting-path", "The path to store the settings.")
            .boolean("inProcessLocalFs")
            .describe("inProcessLocalFs", "Whether to run localfs in same process for debugging.")
            .default("inProcessLocalFs", config.inProcessLocalFs)
            .boolean("useBrowserCache");
    }
    
    var argv = optimist.argv;
    if (argv.help)
        return null;
    
    var testing = argv.t;
    var baseProc = path.normalize(testing
        ? __dirname + "/../plugins/c9.fs/mock"
        : argv.w || (__dirname + "/../"));
    
    // if (testing && !argv["setting-path"])
    //     argv["setting-path"] = "/tmp/.c9";

    if (baseProc != "/" && baseProc != "\\") // special case / for windows
        baseProc = path.resolve(baseProc);

    process.env.BASE_PROC = baseProc;

    var port = argv.p;
    var host = argv.l;
    var debug = argv.d;
    var readonly = argv.readonly;
    var startBridge = argv.b;
    
    config.port = port || argv.port;
    config.host = host || argv.listen;
    
    if (argv.collab != null)
        config.collab = argv.collab;
    
    var workspaceType = argv.workspacetype || null;
    
    if (argv.hosted)
        config.client_config = "default-hosted";
    
    config.workspaceDir = baseProc;
    config.settingDir = argv["setting-path"];
    config.projectName = path.basename(baseProc);
    config.testing = testing;
    config.debug = debug;
    
    if (!config.startBridge)
        config.startBridge = startBridge;
    
    if (testing && argv.k)
        require("child_process").exec("tmux -L cloud91.9 kill-server", function(){});

    var isLocalhost = host == "localhost" || host == "127.0.0.1";
    if (!/:/.test(argv.auth) && !isLocalhost) {
        console.log("Authentication is required when not running on localhost.");
        console.log("If you would like to expose this service to other hosts or the Internet");
        console.log("at large, please specify -a user:pass to set a username and password");
        console.log("(or use -a : to force no login).");
        console.log("Use --listen localhost to only listen on the localhost interface and");
        console.log("and suppress this message.\n");
        host = config.host = "127.0.0.1";
    }
    if (/:/.test(argv.auth) && !isLocalhost && !process.env.C9_HOSTNAME) {
        console.log("Warning: running Cloud9 without using HTTP authentication.");
        console.log("Run using --listen localhost instead to only expose Cloud9 to localhost,");
        console.log("or use -a username:password to setup HTTP authentication\n");
    }
    var auth = (argv.auth + "").split(":");

    var plugins = [
        {
            packagePath: "connect-architect/connect",
            port: port,
            host: host,
            websocket: true,
            showRealIP: !config.mode
        },
        {
            packagePath: "connect-architect/connect.basicauth",
            username: auth[0],
            password: auth[1]
        },
        {
            packagePath: "connect-architect/connect.static",
            prefix: "/static"
        },
        {
            packagePath: "./c9.error/error_handler",
            mode: config.mode,
            scope: "standalone",
            hostname: config.hostname
        },
        "connect-architect/connect.remote-address",
        "connect-architect/connect.render",
        "connect-architect/connect.render.ejs",
        {
            packagePath: "connect-architect/connect.redirect",
            trustedDomainsRe: /.*/,
        }, 
        "connect-architect/connect.cors",
        "./c9.connect.favicon/favicon",
        // "./c9.logger/stdout-logger",
        
        "./c9.core/ext",
        
        {
            packagePath: "./c9.ide.server/plugins",
            // allow everything in standalone mode
            blacklist: {
                "c9.ide.server": true,
                "c9.ide.test.selenium": true
            },
            whitelist: {
                "c9.core": true,
                "c9.fs": true,
                "c9.automate": true,
                "c9.login.client": true,
                "c9.vfs.client": true,
                "c9.cli.bridge": true,
                "c9.nodeapi": true,
                "c9.ide.experiment": true,
                "saucelabs.preview": true,
                "salesforce.sync": true,
                "salesforce.language": true
            }
        },
        "./c9.preview/statics",
        "./c9.nodeapi/nodeapi",
        {
            packagePath: "./c9.vfs.standalone/standalone",
            sdk: config.sdk,
            local: config.local,
            packed: argv.packed,
            collab: config.collab,
            version: config.cdn.version,
            options: config,
            installPath: config.installPath,
            settingDir: config.settingDir,
            correctedInstallPath: config.correctedInstallPath,
            debug: debug,
            workspaceDir: baseProc,
            projectUrl: config.projectUrl,
            homeUrl: config.homeUrl,
            workspaceType: workspaceType,
            readonly: readonly
        },
        "./c9.vfs.server/vfs.server",
        "./c9.error/logger.raygun_noop",
        "./c9.preview/preview.handler",
        "./c9.vfs.server/cache",
        "./c9.vfs.server/download",
        "./c9.vfs.server/filelist",
        "./c9.vfs.server/fetchcache",
        "./c9.vfs.server/statics",
        "./c9.analytics/mock_analytics",
        "./c9.metrics/mock_metrics",
        "./c9.ide.experiment/mock_experiment",
        {
            packagePath: "./c9.vfs.server/vfs.connect.standalone",
            workspaceDir: baseProc,
            readonly: readonly,
            extendDirectory: config.extendDirectory,
            extendOptions: config.extendOptions,
            installPath: config.installPath,
            settingDir: config.settingDir,
            collab: config.collab,
            nakBin: config.nakBin,
            nodeBin: config.nodeBin,
            tmuxBin: config.tmux,
            vfs: {
                defaultEnv: { CUSTOM: 43 },
                local: config.local,
                debug: debug,
                inProcess: argv.inProcessLocalFs
            }
        /* ### BEGIN #*/
        }, {
            packagePath: "./c9.static/cdn",
            useBrowserCache: argv.useBrowserCache,
            cacheFiles: argv.cache
        }, {
            packagePath: "./c9.static/build",
            version: config.cdn.version,
            cache: config.cdn.cacheDir,
            compress: config.cdn.compress,
            baseUrl: config.cdn.baseUrl,
            virtual: config.cdn.virtual,
            config: "standalone"
        /* ### END #*/
        }
    ];
    
    if (config.collab && !config.mode && !config.local) {
        try {
            var addApi = require("./api.standalone").addApi;
        } catch(e) {}
        if (addApi) {
            plugins = addApi(plugins, config);
        }
    }
    
    return plugins;
};

if (!module.parent) require("../server")([__filename].concat(process.argv.slice(2)));
