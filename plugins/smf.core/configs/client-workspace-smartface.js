/* global module, require */
// Smartface workspace file
module.exports = function(options) {
    "use strict";
    var config = require("configs/client-default-hosted")(options);
    var staticPrefix = options.staticPrefix;
    var workspaceDir = options.workspaceDir;
    
    var includes = [{
            packagePath: "plugins/c9.ide.editors/tabmanager",
            loadFilesAtInit: false,
            ideProviderName: "Smartface"
        }, {
            packagePath: "plugins/c9.ide.language.javascript.tern/tern",
            tern: {
                plugins: {
                    doc_comment: "tern/plugin/doc_comment",
                    smartface: "plugins/@smartface/smartface.language/loadInclude"

                },
                defs: [{
                    name: "ecma5",
                    enabled: true,
                    path: "lib/tern/defs/ecma5.json"
                }, {
                    name: "Smartface",
                    enabled: true,
                    path: "plugins/@smartface/smartface.language/SMF.json"
                }]
            }
        }, {
            packagePath: "plugins/c9.ide.terminal/terminal",
            tmux: options.tmux,
            root: workspaceDir,
            tmpdir: options.tmpdir,
            shell: options.shell || "",
            staticPrefix: staticPrefix + "/plugins/c9.ide.terminal",
            installPath: options.correctedInstallPath,
            defaults: {
                "dark": ["#0d6168", "#FFFFFF", "#515D77", true],
                "dark-gray": ["#0d6168", "#FFFFFF", "#515D77", true]
            }
        },

        // end of original C9 plugin configuration
        "plugins/@smartface/smartface.language/tern", {
            packagePath: "plugins/@smartface/smartface.ide.theme/theme",
            staticPrefix: staticPrefix + "/plugins/@smartface/smartface.ide.theme"
        },
        "plugins/@smartface/smartface.publish.wizard/smf.utils", {
            packagePath: "plugins/@smartface/smartface.publish.wizard/smf.publish.wizard",
            staticPrefix: staticPrefix + "/plugins/@smartface/smartface.publish.wizard"
        }, {
            packagePath: "plugins/c9.ide.closeconfirmation/closeconfirmation",
            defaultValue: options.local,
            ideProviderName: "Smartface"
        }, {
            packagePath: "plugins/@smartface/smartface.about/about",
            staticPrefix: staticPrefix + "/plugins/@smartface/smartface.about"
        }, {
            packagePath: "plugins/@smartface/smartface.welcome/welcome",
            staticPrefix: staticPrefix + "/plugins/@smartface/smartface.welcome"
        }
    ];

    var excludes = {
        "plugins/c9.ide.hackhands/hackhands": true,
        "plugins/c9.ide.hackhands/hackhands_analytics": true,
        "plugins/c9.ide.run/run": true,
        "plugins/c9.ide.run/gui": true,
        "plugins/c9.ide.run.build/build": true,
        "plugins/c9.ide.run/run_analytics": true,
        "plugins/c9.ide.run.debug/debuggers/debugger": true,
        "plugins/c9.ide.run.debug/debuggers/sourcemap": true,
        "plugins/c9.ide.run.debug/debuggers/v8/v8debugger": true,
        "plugins/c9.ide.run.debug/debuggers/gdb/gdbdebugger": true,
        "plugins/c9.ide.immediate/evaluators/debugnode": true,
        "plugins/c9.ide.run.debug.xdebug/xdebug": true,
        "plugins/c9.ide.run.debug/liveinspect": true,
        "plugins/c9.ide.run.debug/breakpoints": true,
        "plugins/c9.ide.run.debug/debugpanel": true,
        "plugins/c9.ide.run.debug/callstack": true,
        "plugins/c9.ide.run.debug/variables": true,
        "plugins/c9.ide.run.debug/watches": true,
        "plugins/c9.ide.run/output": true,
        "plugins/c9.ide.deploy.mongolab/mongolab": true,
        "plugins/c9.ide.deploy.heroku/heroku": true,
        "plugins/c9.ide.deploy.heroku/libheroku": true,
        "plugins/c9.ide.deploy.openshift/openshift": true,
        "plugins/c9.ide.deploy.gae/gae": true,
        "plugins/c9.ide.deploy.gae/libgae": true,
        "plugins/c9.ide.run.build/gui": true,
        "plugins/c9.ide.deploy.openshift/libopenshift": true,
        "plugins/c9.ide.deploy/deploy": true,
        "plugins/c9.ide.deploy/instance": true,
        "plugins/c9.ide.deploy/target": true,
        "plugins/c9.ide.preview/preview": true,
        "plugins/c9.ide.plugins/test": true,
        "plugins/c9.ide.test/all": true,
        "plugins/c9.ide.test/testrunner": true,
        "plugins/c9.ide.test/testpanel": true,
        "plugins/c9.ide.test/results": true,
        "plugins/c9.ide.test/coverage": true,
        "plugins/c9.ide.test/coverageview": true,
        "plugins/c9.ide.test.mocha/mocha": true,
        "plugins/c9.ide.mount/mount": true,
        "plugins/c9.ide.mount/ftp": true,
        "plugins/c9.ide.mount/sftp": true,
        "plugins/c9.ide.preview/previewer": true,
        "plugins/c9.ide.preview/previewers/raw": true,
        "plugins/c9.ide.preview.browser/browser": true,
        "plugins/c9.ide.preview.markdown/markdown": true,
        "plugins/saucelabs.preview/preview": true,
        "plugins/c9.ide.welcome/welcome": true,
        "plugins/c9.ide.performancestats/stats": true,
        "plugins/c9.ide.performancestats/stats_analytics": true
    };
    
    var includedPluginIndex, includedPlugin;
    for (includedPluginIndex in includes) {
        includedPlugin = includes[includedPluginIndex];
        includedPlugin = includedPlugin.packagePath || includedPlugin;
        excludes[includedPlugin] = true;
    }

    config = config.filter(function(p) {
        if (p.packagePath === "plugins/c9.ide.layout.classic/preload") {
            p.defaultTheme = "dark";
        }
        return !excludes[p] && !excludes[p.packagePath];
    }).concat(includes);
    return config;
};