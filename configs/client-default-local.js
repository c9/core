var join = require("path").join;

module.exports = function(options) {
    options.collab = false;
    var config = require("./client-default")(options);
    return module.exports.makeLocal(config, options);
};

module.exports.makeLocal = function(config, options) {
    var c9Ws = options.remoteWorkspace; // true when opening c9 workspace as local
    var root = options.workspaceDir;

    var nodeBin = options.nodeBin || ["node"];
    var settingDir = options.settingDir || options.installPath;
    
    if (!c9Ws) {
        // Local version
        options.local = true;
        options.projectName = root.substr(root.lastIndexOf("/") + 1);
        options.debug = 2;
        options.env = "local";
        options.defaultTheme = "dark";
    }

    for (var i = config.length - 1; i >= 0; i--) {
        // if (config[i].packagePath == "plugins/c9.cli.bridge/bridge")
        //     config[i].port = 55556;
        if (config[i].packagePath == "plugins/c9.ide.welcome/welcome" && !c9Ws) {
            config[i].intro = 
                "Welcome to your brand new Cloud9. Use this welcome screen "
              + "to tweak the look &amp; feel of the Cloud9 user interface. "
              + "If you prefer a more advanced IDE experience, you can choose "
              + "to change the layout below. "
              + "\n\n"
              + "On the right you can find videos and documentation for Cloud9 "
              + "IDE. Happy Coding!";
        }
        // else if (config[i].packagePath == "plugins/c9.ide.login/login") {
        //     config.splice(i, 1);
        // }
        else if (config[i].packagePath == "plugins/c9.ide.run/run" && !c9Ws) {
            config[i].runnerPath = join(settingDir, "/runners");
        }
        else if (config[i].packagePath == "plugins/c9.ide.ui/menus") {
            config[i].autoInit = false;
        }
        else if (config[i].packagePath == "plugins/c9.ide.save/autosave") {
            config[i].slowChangeTimeout = 500;
        }
        else if (config[i].packagePath == "plugins/c9.ide.run.build/build" && !c9Ws) {
            config[i].builderPath = join(settingDir, "/builders");
        }
        else if (config[i].packagePath == "plugins/c9.ide.editors/metadata" && !c9Ws) {
            config[i].path = join(settingDir, "/metadata");
            config[i].changeCheckInterval = 2000;
        }

        else if (config[i].packagePath == "plugins/c9.core/c9") {
            config[i].local = true;
        }
        else if (config[i].packagePath == "plugins/c9.ide.clipboard/html5")
            config[i].packagePath = "plugins/c9.ide.local/clipboard"; 
        else if (config[i].packagePath == "plugins/c9.ide.configuration/configure")
            config[i].pathFromFavorite = true;
        else if (config[i].packagePath == "plugins/c9.core/settings" && !c9Ws) {
            // todo: Don't show console when opening a file?
            // config[i].template = ;
            config[i].projectConfigPath = join(settingDir, "");
            config[i].userConfigPath = join(settingDir, "");
            config[i].stateConfigPath = join(settingDir, "");
        } else if (config[i].packagePath == "plugins/c9.ide.info/info" && c9Ws) {
            config[i].packagePath = "plugins/c9.ide.local/info";
        } else if (config[i].packagePath == "plugins/c9.ide.ui/menus" && c9Ws) {
            config[i].autoInit = false;
        } else if (config[i].packagePath == "plugins/c9.ide.tree/tree") {
            config[i].defaultExpanded = !config.hosted;
        } else if (config[i].packagePath == "plugins/c9.ide.errorhandler/raygun_error_handler") {
            // TODO fix cycle introduced by local/info and raygun_error_handler
            config[i].packagePath = "plugins/c9.ide.errorhandler/simple_error_handler";
        }
    }

    // Add local modules
    var includes = [{
        packagePath: "plugins/c9.ide.local/local",
        options: options,
    }, {
        packagePath: "plugins/c9.ide.local/windowframe",
        staticPrefix: options.staticPrefix + "/plugins/c9.ide.local"
    }, {
        packagePath: "plugins/c9.ide.local/update",
        host: options.update && options.update.host || "localhost", // "update.c9.io",
        port: options.update && options.update.port || "8888", // "443"
        path: options.update && options.update.path,
        protocol: options.update && options.update.protocol,
        installPath: options.correctedInstallPath,
        bashBin: options.bashBin,
        nodeBin: nodeBin
    }, {
        packagePath: "plugins/c9.ide.local/projectmanager"
    }, {
        packagePath: "plugins/c9.ide.local/open"
    }, {
        packagePath: "plugins/c9.ide.local/nativemenus"
    }, !c9Ws && {
        packagePath: "plugins/c9.ide.local/info",
        installPath: options.correctedInstallPath,
        settingDir: settingDir,
        cookie: options.user.cookie,
        user: {
            id: options.user.id,
            name: options.user.name,
            fullname: options.user.fullname,
            email: options.user.email,
            pubkey: options.user.pubkey
        },
        project: {
            id: options.project.id,
            name: options.project.name,
            contents: options.project.contents,
            descr: options.project.descr
        }
    },
    c9Ws && "plugins/c9.ide.analytics/mock_analytics",
    ].filter(Boolean);

    var excludes = c9Ws ? {
        "plugins/c9.ide.analytics/analytics": true,
    } : {
        "plugins/c9.ide.newresource/open": true,
        "plugins/c9.ide.info/info": true,
        // "plugins/c9.ide.login/login": true,
        "plugins/c9.ide.download/download": true
    };

    config = config.concat(includes).filter(function (p) {
        return !excludes[p] && !excludes[p.packagePath];
    });

    return config; 
};
