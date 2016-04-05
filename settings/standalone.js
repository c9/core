module.exports = function(manifest, installPath) {
    if (!manifest) {
        manifest = require(__dirname + "/../package.json");
        manifest.revision = 
            manifest.revision ||
            require("c9/git").getHeadRevisionSync(__dirname + "/..");
    }
    
    var path = require("path");
    var os = require("os");
    var runners = require("../plugins/c9.ide.run/runners_list").local;
    var builders = require("../plugins/c9.ide.run.build/builders_list");
    
    var workspaceDir = path.resolve(__dirname + "/../");
    var sdk = !manifest.sdk;
    var win32 = process.platform == "win32";
    
    if (win32) {
        if (process.env.HOME === undefined)
            process.env.HOME = process.env.HOMEDRIVE + process.env.HOMEPATH;
        if (!/msys\/bin|Git\/bin/.test(process.env.PATH))
            process.env.PATH = path.join(process.env.HOME, ".c9", "msys/bin") + ";" + process.env.PATH;
    }
    
    var home = process.env.HOME;
    
    if (!installPath)
        installPath = path.join(home, ".c9");
    
    var correctedInstallPath = installPath.substr(0, home.length) == home
        ? "~" + installPath.substr(home.length)
        : installPath;
    var inContainer = os.hostname().match(/-\d+$/);
    
    var config = {
        standalone: true,
        startBridge: true,
        manifest: manifest,
        workspaceDir: workspaceDir,
        projectName: path.basename(workspaceDir),
        homeDir: home,
        workspaceId: "devel",
        workspaceName: "devel",
        tmpdir: "/tmp",
        home: home,
        uid: "-1",
        dev: true,
        sdk: sdk,
        pid: process.pid,
        port: process.env.PORT || 8181,
        host: process.env.IP || (inContainer ? "0.0.0.0" : "127.0.0.1"),
        testing: false,
        platform: process.platform,
        arch: process.arch,
        tmux: path.join(installPath, "bin/tmux"),
        nakBin: path.join(__dirname, "../node_modules/nak/bin/nak"),
        bashBin: "bash",
        nodeBin: [path.join(installPath, win32 ? "node.exe" : "node/bin/node"), process.execPath],
        installPath: installPath,
        correctedInstallPath: correctedInstallPath,
        staticPrefix: "/static",
        projectUrl: "/workspace",
        ideBaseUrl: "http://c9.io",
        previewUrl: "/preview",
        dashboardUrl: "https://c9.io/dashboard.html",
        accountUrl: "https://c9.io/account",
        apiUrl: "/api",
        homeUrl: "/home",
        collab: false,
        installed: true,
        packed: false,
        packedThemes: true,
        readonly: false,
        role: "a",
        isAdmin: true,
        runners: runners,
        builders: builders,
        themePrefix: "/static/standalone/skin",
        cdn: {
            version: "standalone",
            cacheDir: __dirname + "/../build",
            compress: false,
            baseUrl: ""
        },
        mount: {
            fusermountBin: "fusermount",
            curlftpfsBin: "curlftpfs",
            sshfsBin: "sshfs"
        },
        saucelabs: {
            serverURL: null, // testing: "https://jlipps.dev.saucelabs.net"
            account: {
                username: "saucefree000093",
                apikey: "3227f6a3-3861-4a56-8b27-e756ce0bba20"
            },
            assumeConnected: true
        },
        support: {
            userSnapApiKey: "e3d3b232-1c21-4961-b73d-fbc8dc7be1c3"
        },
        user: {
            id: -1,
            name: "johndoe",
            fullname: "John Doe",
            email: "johndoe@example.org",
            pubkey: null
        },
        project: {
            id: 2,
            name: "projectname",
            contents: null,
            descr: "descr"
        },
        analytics: {
            segmentio: {
                secret: "12346",
                flushAt: 1, // The number of messages to enqueue before flushing.
                integrations: {
                    "All": true
                }
            }
        },
        raygun: {
            server: {
                apiKey: "1234"
            },
            client: {
                apiKey: "1234"
            }
        },
        pricing: { containers: [] },
        zuora: {},
        localExtend: true,
        extendDirectory: __dirname + "/../plugins"
    };

    config.extendOptions = {
        user: config.user,
        project: config.project,
        readonly: config.readonly
    };

    return config;
};
