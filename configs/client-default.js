var assert = require("assert");

module.exports = function(options) {
    assert(options.staticPrefix, "Option 'staticPrefix' must be set");
    assert(options.workspaceDir, "Option 'workspaceDir' must be set");
    assert(options.workspaceId, "Option 'workspaceId' must be set");
    assert(options.workspaceName, "Option 'workspaceName' must be set");
    assert(options.home, "Option 'home' must be set");
    assert(options.platform, "Option 'platform' must be set");
    
    // normalize workspacedir and home paths
    function normalize(path) {
        path = path.replace(/([^/])\/$/, "$1");
        if (options.platform == "win32")
            path = path.replace(/\\/g, "/");
        return path;
    }
    options.workspaceDir = normalize(options.workspaceDir);
    options.installPath = normalize(options.installPath);
    options.home = normalize(options.home);

    var workspaceDir = options.workspaceDir;
    var debug = options.debug !== undefined ? options.debug : false;
    
    var collab = options.collab;
    var packaging = options.packaging;
    var staticPrefix = options.staticPrefix;

    var nodeBin = options.nodeBin || ["node"];
    var nodePath = options.nodePath || "";

    var runners = options.runners || {};
    var builders = options.builders || {};
    var hosted = !options.local && !options.dev;
    var devel = options.standalone && !options.local || options.mode === "devel" || options.mode == "onlinedev" || options.dev;
    
    var localExtendFiles = options.localExtend || options.standalone;
    
    var plugins = [
        // C9
        {
            packagePath: "plugins/c9.core/c9",
            
            startdate: new Date(),
            version: options.manifest.version + " (" + options.manifest.revision + ")",
            debug: debug,
            workspaceId: options.workspaceId,
            workspaceDir: workspaceDir,
            name: options.workspaceName,
            readonly: options.readonly,
            isAdmin: options.isAdmin,
            staticUrl: staticPrefix,
            hosted: hosted,
            hostname: options.appHostname,
            local: options.local,
            env: options.env || "devel",
            home: options.home,
            platform: options.platform,
            arch: options.arch,
            installed: options.installed,
            projectId: options.project.id,
            projectName: options.projectName || "Project",
            configName: options.configName,
            standalone: options.standalone,
            dashboardUrl: options.dashboardUrl
        },
        {
            packagePath: "plugins/c9.core/settings",
            settings: options.settings,
            userConfigPath: options.settingDir,
            hosted: hosted
        },
        "plugins/c9.core/ext",
        {
            packagePath: "plugins/c9.core/http-xhr",
            debug: !options.packed
        },
        // {
        //     packagePath: "plugins/c9.core/client",
        //     baseUrl: options.apiUrl
        // },
        "plugins/c9.core/util",
        {
            packagePath: "plugins/c9.ide.plugins/loader",
            plugins: options.plugins || [],
            loadFromDisk: options.standalone
        },
        {
            packagePath: "plugins/c9.ide.plugins/installer",
            updates: options.pluginUpdates || []
        },
        {
            packagePath: "plugins/c9.ide.plugins/manager",
            staticPrefix: staticPrefix + "/plugins/c9.ide.plugins",
            devel: devel
        },
        {
            packagePath: "plugins/c9.ide.plugins/debug"
        },
        {
            packagePath: "plugins/c9.ide.plugins/packages"
        },
        {
            packagePath: "plugins/c9.ide.plugins/test",
            staticPrefix: staticPrefix + "/plugins/c9.ide.plugins"
        },
        
        // VFS
        "plugins/c9.vfs.client/vfs.ping",
        "plugins/c9.vfs.client/vfs.log",
        {
            packagePath: "plugins/c9.vfs.client/vfs_client",
            debug: debug,
            installPath: options.installPath,
            dashboardUrl: options.dashboardUrl,
            accountUrl: options.accountUrl
        },
        {
            packagePath: "plugins/c9.vfs.client/endpoint",
            readonly: options.readonly,
            region: options.region,
            pid: options.project.id,
            servers: options.vfsServers,
            updateServers: hosted,
            strictRegion: options.strictRegion
                || options.mode === "beta" && "beta",
            ignoreProtocolVersion: options.ignoreProtocolVersion,
        },
        {
            packagePath: "plugins/c9.ide.auth/auth",
            accessToken: options.accessToken || "token",
            ideBaseUrl: options.ideBaseUrl,
            apiUrl: options.apiUrl,
            userId: options.user.id
        },
        {
            packagePath: "plugins/c9.core/api",
            apiUrl: options.apiUrl,
            projectId: options.project.id
        },
        
        // Editors
        "plugins/c9.ide.editors/document",
        {
            packagePath: "plugins/c9.ide.editors/editors",
            defaultEditor: "ace"
        },
        "plugins/c9.ide.editors/editor",
        "plugins/c9.ide.editors/imgview",
        {
            packagePath: "plugins/c9.ide.imgeditor/imgeditor",
            staticPrefix: staticPrefix + "/plugins/c9.ide.imgeditor"
        },
        "plugins/c9.ide.editors/urlview",
        // "plugins/c9.ide.editors/htmlview",
        "plugins/c9.ide.editors/tab",
        {
            packagePath: "plugins/c9.ide.editors/tabmanager",
            loadFilesAtInit: false
        },
        {
            packagePath: "plugins/c9.ide.editors/metadata"
        },
        "plugins/c9.ide.editors/pane",
        "plugins/c9.ide.editors/undomanager",
        
        "plugins/c9.ide.newresource/newresource",
        "plugins/c9.ide.newresource/open",
        "plugins/c9.ide.undo/undo",
        {
            packagePath: "plugins/c9.ide.closeconfirmation/closeconfirmation",
            defaultValue: options.local
        },
        {
            packagePath: "plugins/c9.ide.openfiles/openfiles",
            staticPrefix: staticPrefix + "/plugins/c9.ide.layout.classic",
            defaultShow: options.local
        },
        {
            packagePath: "plugins/c9.ide.metrics/metrics",
            hosted: hosted
        },

        // Ace && Commands
        "plugins/c9.ide.keys/commands",
        "plugins/c9.ide.keys/editor",
        {
            packagePath: "plugins/c9.ide.ace/ace",
            staticPrefix: staticPrefix + "/plugins/c9.ide.layout.classic",
            workerPrefix: options.workerPrefix
        },
        "plugins/c9.ide.ace/themes",
        "plugins/c9.ide.ace.stripws/stripws",
        "plugins/c9.ide.ace.repl/editor",
        // "plugins/c9.ide.ace.split/split",
        {
            packagePath: "plugins/c9.ide.ace.gotoline/gotoline",
            staticPrefix: staticPrefix + "/plugins/c9.ide.ace.gotoline"
        },
        {
            packagePath: "plugins/c9.ide.ace.statusbar/statusbar",
            staticPrefix: staticPrefix + "/plugins/c9.ide.layout.classic"
        },
        "plugins/c9.ide.ace.keymaps/keymaps",
        "plugins/c9.ide.ace.keymaps/cli",
        
        
        "plugins/c9.ide.ace.emmet/emmet",
        // Find
        {
            packagePath: "plugins/c9.ide.find/find",
            basePath: workspaceDir
        },
        {
            packagePath: "plugins/c9.ide.find/find.nak",
            ignore: "",
            useHttp: true,
            basePath: workspaceDir,
            installPath: options.installPath,
            nak: options.nakBin || "~/.c9/node_modules/nak/bin/nak",
            node: options.nodeBin,
            local: options.local,
        },
        {
            packagePath: "plugins/c9.ide.find.infiles/findinfiles",
            staticPrefix: staticPrefix + "/plugins/c9.ide.find.infiles"
        },
        {
            packagePath: "plugins/c9.ide.find.replace/findreplace",
            staticPrefix: staticPrefix + "/plugins/c9.ide.find.replace"
        },
        
        // UI
        {
            packagePath: "plugins/c9.ide.ui/ui",
            staticPrefix: staticPrefix + "/plugins/c9.ide.ui"
        },
        "plugins/c9.ide.ui/anims",
        "plugins/c9.ide.ui/tooltip",
        {
            packagePath: "plugins/c9.ide.ui/menus",
            autoInit: !options.local
        },
        "plugins/c9.ide.ui/forms",
        {
            packagePath: "plugins/c9.ide.ui/widgets.list",
            staticPrefix: staticPrefix + "/plugins/c9.ide.layout.classic"
        },
        "plugins/c9.ide.ui/widgets.tree",
        "plugins/c9.ide.ui/widgets.datagrid",
        "plugins/c9.ide.ui/widgets.terminal",
        "plugins/c9.ide.ui/focus",
        "plugins/c9.ide.ui/lib_apf",
        
        "plugins/c9.ide.dialog/dialog",
        "plugins/c9.ide.dialog.common/alert",
        "plugins/c9.ide.dialog.common/alert_internal",
        "plugins/c9.ide.dialog.common/confirm",
        "plugins/c9.ide.dialog.common/filechange",
        "plugins/c9.ide.dialog.common/fileoverwrite",
        "plugins/c9.ide.dialog.common/fileremove",
        "plugins/c9.ide.dialog.common/info",
        "plugins/c9.ide.dialog.common/question",
        "plugins/c9.ide.dialog.common/upsell",
        {
            packagePath: "plugins/c9.ide.dialog.common/error",
            staticPrefix: staticPrefix + "/plugins/c9.ide.layout.classic"
        },
        {
            packagePath: "plugins/c9.ide.dialog.common/notification",
            staticPrefix: staticPrefix + "/plugins/c9.ide.layout.classic"
        },
        {
            packagePath: "plugins/c9.ide.dialog.login/login",
            noLogout: !options.local
        },
        "plugins/c9.ide.dialog.file/file",
        "plugins/c9.ide.dialog.wizard/wizard",
        
        // VFS
        "plugins/c9.fs/proc",
        "plugins/c9.fs/proc.apigen", // used only by disabled deploy plugins
        "plugins/c9.fs/net",
        {
            packagePath: "plugins/c9.fs/fs",
            baseProc: workspaceDir
        },
        "plugins/c9.fs/fs.errors",
        "plugins/c9.fs/fs.cache.xml",
        {
            packagePath: "plugins/c9.ide.readonly/access_control",
            dashboardUrl: options.dashboardUrl,
            readonly: options.readonly
        },
        
        // Watcher
        "plugins/c9.ide.threewaymerge/threewaymerge",
        "plugins/c9.ide.watcher/watcher",
        {
            packagePath: "plugins/c9.ide.watcher/gui",
            collab: collab
        },
        
        // Language
        {
            packagePath: "plugins/c9.ide.language/language",
            workspaceDir: workspaceDir,
            staticPrefix: staticPrefix,
            workerPrefix: options.CORSWorkerPrefix // "/static/standalone/worker"
        },
        "plugins/c9.ide.language/keyhandler",
        "plugins/c9.ide.language/complete",
        "plugins/c9.ide.language/quickfix",
        "plugins/c9.ide.language/marker",
        "plugins/c9.ide.language/refactor",
        "plugins/c9.ide.language/tooltip",
        "plugins/c9.ide.language/jumptodef",
        "plugins/c9.ide.language/worker_util_helper",
        {
            packagePath: "plugins/c9.ide.language.generic/generic",
            mode_completer: options.ssh,
        },
        "plugins/c9.ide.language.css/css",
        "plugins/c9.ide.language.html/html",
        "plugins/c9.ide.language.javascript/javascript",
        "plugins/c9.ide.language.javascript.immediate/immediate",
        "plugins/c9.ide.language.javascript.infer/jsinfer",
        {
            packagePath: "plugins/c9.ide.language.javascript.tern/tern",
            plugins: [
                {
                    name: "angular",
                    path: "tern/plugin/angular",
                    enabled: true,
                    hidden: false,
                },
                {
                    name: "doc_comment",
                    path: "tern/plugin/doc_comment",
                    enabled: true,
                    hidden: true,
                },
                {
                    name: "es_modules",
                    path: "tern/plugin/es_modules",
                    enabled: true,
                    hidden: true,
                },
                {
                    name: "modules",
                    path: "tern/plugin/modules",
                    enabled: true,
                    hidden: true,
                },
                {
                    name: "node",
                    path: "tern/plugin/node",
                    enabled: true,
                    hidden: false,
                },
                {
                    name: "requirejs",
                    path: "tern/plugin/requirejs",
                    enabled: true,
                    hidden: false,
                },
                {
                    name: "architect_resolver",
                    path: "./architect_resolver_worker",
                    enabled: true,
                    hidden: true,
                },
            ],
            defs: [{
                name: "ecma5",
                enabled: true,
                experimental: false,
                firstClass: true,
                path: "lib/tern/defs/ecma5.json"
            }, {
                name: "jQuery",
                enabled: true,
                experimental: false,
                path: "lib/tern/defs/jquery.json"
            }, {
                name: "browser",
                enabled: true,
                experimental: false,
                firstClass: true,
                path: "lib/tern/defs/browser.json"
            }, {
                name: "underscore",
                enabled: false,
                experimental: false,
                path: "lib/tern/defs/underscore.json"
            }, {
                name: "chai",
                enabled: false,
                experimental: false,
                path: "lib/tern/defs/chai.json"
            }]
        },
        "plugins/c9.ide.language.javascript.tern/ui",
        "plugins/c9.ide.language.javascript.tern/architect_resolver",
        "plugins/c9.ide.language.javascript.eslint/eslint",
        {
            packagePath: "plugins/c9.ide.language.python/python",
            pythonPath:  "/usr/local/lib/python2.7/dist-packages:/usr/local/lib/python3.4/dist-packages:/usr/local/lib/python3.5/dist-packages",
        },
        "plugins/c9.ide.language.go/go",
        {
            packagePath: "plugins/c9.ide.language.jsonalyzer/jsonalyzer",
            workspaceDir: workspaceDir,
            homeDir: options.home,
            bashBin: options.bashBin,
            useCollab: collab,
            useSend: !collab && (options.local || options.standalone),
            maxServerCallInterval: 2000
        },

        // Run
        {
            packagePath: "plugins/c9.ide.run/run",
            base: workspaceDir,
            staticPrefix: staticPrefix + "/plugins/c9.ide.run",
            tmux: options.tmux,
            runners: runners,
            installPath: options.correctedInstallPath,
            local: options.local
        },
        {
            packagePath: "plugins/c9.ide.run/gui",
            staticPrefix: staticPrefix + "/plugins/c9.ide.layout.classic",
            defaultConfigs: {}
        },
        {
            packagePath: "plugins/c9.ide.run.build/build",
            base: workspaceDir,
            builders: builders
        },
        {
            packagePath: "plugins/c9.ide.run.build/gui"
        },
        // "plugins/c9.ide.run.debug/debuggers/sourcemap",
        {
            packagePath: "plugins/c9.ide.run.debug/debuggers/debugger",
            staticPrefix: staticPrefix + "/plugins/c9.ide.layout.classic"
        },
        {
            packagePath: "plugins/c9.ide.run.debug/debuggers/v8/v8debugger",
            basePath: workspaceDir
        },
        {  
            packagePath: "plugins/c9.ide.run.debug/debuggers/socket",
            nodeBin: nodeBin
        },
        "plugins/c9.ide.run.debug/breakpoints",
        "plugins/c9.ide.run.debug/debugpanel",
        "plugins/c9.ide.run.debug/callstack",
        {
            packagePath: "plugins/c9.ide.immediate/immediate",
            staticPrefix: staticPrefix + "/plugins/c9.ide.layout.classic"
        },
        "plugins/c9.ide.immediate/evaluator",
        "plugins/c9.ide.immediate/evaluators/browserjs",
        "plugins/c9.ide.immediate/evaluators/debugnode",
        "plugins/c9.ide.immediate/evaluators/bash",
        "plugins/c9.ide.run.debug/variables",
        "plugins/c9.ide.run.debug/watches",
        "plugins/c9.ide.run.debug/liveinspect",

        "plugins/c9.ide.run.debug.xdebug/xdebug",
        "plugins/c9.ide.run.debug/debuggers/gdb/gdbdebugger",
        
        // Console
        {
            packagePath: "plugins/c9.ide.terminal/terminal",
            tmux: options.tmux,
            root: workspaceDir,
            tmpdir: options.tmpdir,
            shell: options.shell || "",
            staticPrefix: staticPrefix + "/plugins/c9.ide.terminal",
            installPath: options.correctedInstallPath
        },
        {
            packagePath: "plugins/c9.ide.terminal/predict_echo"
        },
        {
            packagePath: "plugins/c9.ide.terminal/link_handler",
            previewUrl: options.previewUrl
        },
        {
            packagePath: "plugins/c9.ide.terminal.monitor/monitor",
            bashBin: options.bashBin
        },
        {
            packagePath: "plugins/c9.ide.terminal.monitor/message_view",
            staticPrefix: options.staticPrefix + "/plugins/c9.ide.layout.classic"
        },
        "plugins/c9.ide.terminal/opentermhere",
        {
            packagePath: "plugins/c9.ide.run/output",
            staticPrefix: options.staticPrefix + "/plugins/c9.ide.layout.classic",
            tmux: options.tmux,
            basePath: workspaceDir
        },
        {
            packagePath: "plugins/c9.ide.console/console",
            staticPrefix: staticPrefix + "/plugins/c9.ide.layout.classic",
            defaultState: options.project.scmurl ? {
                type: "pane", 
                nodes: [{
                    type: "tab",
                    editorType: "terminal",
                    active: "true",
                    document: {
                        changed: false,
                        meta: {
                            timestamp: Date.now()
                        },
                        filter: true,
                        title: "bash - \"Cloning ...\"",
                        tooltip: "bash - \"Cloning ...\"",
                        terminal: {
                            id: "clone",
                            cwd: ""
                        }
                    }
                }, {
                    type: "tab",
                    editorType: "immediate",
                    document: {
                        title: "Immediate"
                    }
                }]
            } : null
        },
        
        // Layout & Panels
        {
            packagePath: "plugins/c9.ide.layout.classic/layout",
            staticPrefix: staticPrefix + "/plugins/c9.ide.layout.classic",
            dashboardUrl: options.dashboardUrl,
            cdn: options.useCdn
        },
        "plugins/c9.ide.theme.flat/flat-light",
        "plugins/c9.ide.theme.flat/flat-dark",
        {
            packagePath: "plugins/c9.ide.layout.classic/preload",
            themePrefix: options.themePrefix,
            defaultTheme: options.defaultTheme || "dark"
        },
        {
            packagePath: "plugins/c9.ide.tree/tree",
            staticPrefix: staticPrefix + "/plugins/c9.ide.layout.classic",
            defaultExpanded: true
        },
        {
            packagePath: "plugins/c9.ide.tree/favorites",
            startEmpty: options.local,
            alwaysScope: options.local,
            realRoot: true,
            home: options.local ? options.home : "~"
        },
        "plugins/c9.ide.mount/mount",
        {
            packagePath: "plugins/c9.ide.mount/ftp",
            curlftpfsBin: options.mount.curlftpfsBin,
            fusermountBin: options.mount.fusermountBin,
            ssh: options.ssh
        },
        {
            packagePath: "plugins/c9.ide.mount/sftp",
            sshfsBin: options.mount.sshfsBin,
            fusermountBin: options.mount.fusermountBin,
            ssh: options.ssh
        },
        {
            packagePath: "plugins/c9.ide.upload/dragdrop",
            treeAsPane: options.local
        },
        {
            packagePath: "plugins/c9.ide.upload/upload",
            staticPrefix: staticPrefix + "/plugins/c9.ide.upload"
        },
        {
            packagePath: "plugins/c9.ide.upload/upload_manager",
            workerPrefix: "plugins/c9.ide.upload"
        },
        {
            packagePath: "plugins/c9.ide.upload/upload_progress",
            staticPrefix: staticPrefix + "/plugins/c9.ide.layout.classic"
        },        
        {
            packagePath: "plugins/c9.ide.navigate/navigate",
            loadListAtInit: false
        },
        {
            packagePath: "plugins/c9.ide.keys/panel"
        },
        {
            packagePath: "plugins/c9.ide.language/outline",
            staticPrefix: staticPrefix + "/plugins/c9.ide.language"
        },
        {
            packagePath: "plugins/c9.ide.panels/panels",
            staticPrefix: staticPrefix + "/plugins/c9.ide.layout.classic",
            defaultActiveLeft: "tree"
        },
        "plugins/c9.ide.panels/panel",
        "plugins/c9.ide.panels/area",
        "plugins/c9.ide.processlist/processlist",
        
        // Installer
        {
            packagePath: "plugins/c9.ide.installer/gui",
            staticPrefix: staticPrefix + "/plugins/c9.ide.layout.classic",
        },
        "plugins/c9.automate/automate",
        "plugins/c9.ide.installer/commands/centos",
        "plugins/c9.ide.installer/commands/darwin",
        "plugins/c9.ide.installer/commands/bash",
        "plugins/c9.ide.installer/commands/npm",
        "plugins/c9.ide.installer/commands/npm-g",
        "plugins/c9.ide.installer/commands/pip",
        "plugins/c9.ide.installer/commands/gem",
        "plugins/c9.ide.installer/commands/zip",
        "plugins/c9.ide.installer/commands/symlink",
        "plugins/c9.ide.installer/commands/message",
        {
            packagePath: "plugins/c9.ide.installer/commands/tar.gz",
            bashBin: options.bashBin
        },
        "plugins/c9.ide.installer/commands/ubuntu",
        {
            packagePath: "plugins/c9.ide.installer/installer",
            homeDir: options.homeDir,
            installSelfCheck: true,
            installPath: options.installPath
        },
        
        // Previewer
        {
            packagePath: "plugins/c9.ide.preview/preview",
            staticPrefix: staticPrefix + "/plugins/c9.ide.preview",
            defaultPreviewer: "preview.browser",
            previewUrl: options.previewUrl,
            local: options.local
        },
        "plugins/c9.ide.preview/previewer",
        "plugins/c9.ide.preview/previewers/raw",
        {
            packagePath: "plugins/c9.ide.preview.browser/browser",
            local: options.local,
            staticPrefix: staticPrefix + "/plugins/c9.ide.preview.browser"
        },
        {
            packagePath: "plugins/c9.ide.preview.markdown/markdown",
            staticPrefix: staticPrefix,
            htmlPath: "/plugins/c9.ide.preview.markdown/markdown.html",
            local: options.local
        },
        "plugins/c9.ide.remote/manager",
        "plugins/c9.ide.remote/documents/htmldocument",
        "plugins/c9.ide.remote/documents/cssdocument",
        "plugins/c9.ide.remote/documents/jsdocument",
        {
            packagePath: "plugins/c9.ide.remote/transports/postmessage",
            previewBaseUrl: options.previewBaseUrl
        },
        // "plugins/c9.ide.remote/transports/debugger",
        // "plugins/c9.ide.remote/transports/websocket",
        
        // Formatters
        "plugins/c9.ide.format/format",
        "plugins/c9.ide.format/formatters/jsbeautify",
        
        // Other
        "plugins/c9.ide.download/download",
        
        {
            packagePath: "plugins/c9.ide.info/info",
            installPath: options.installPath,
            user: {
                id: options.user.id,
                name: options.user.name,
                fullname: options.user.fullname,
                email: options.user.email,
                pubkey: options.user.pubkey,
                date_add: options.user.date_add,
                active: options.user.active,
                c9version: options.user.c9version,
                premium: options.user.premium,
                region: options.user.region,
            },
            project: {
                id: options.project.id,
                name: options.project.name,
                contents: options.project.contents,
                descr: options.project.descr,
                remote: options.project.remote,
                premium: options.project.premium,
            }
        },
        {
            packagePath: "plugins/c9.ide.welcome/welcome",
            staticPrefix: staticPrefix + "/plugins/c9.ide.welcome",
            intro: "Welcome to Cloud9. Use this welcome screen "
              + "to tweak the look &amp; feel of the Cloud9 user interface. ",
            checkOS: true
        },
        {
            packagePath: "plugins/c9.cli.bridge/bridge",
            startBridge: options.startBridge
        },
        {
            packagePath: "plugins/c9.cli.bridge/bridge_commands",
            basePath: workspaceDir
        },
        {
            packagePath: "plugins/c9.ide.help/help",
            staticPrefix: staticPrefix + "/plugins/c9.ide.help"
        },
        {
            packagePath: "plugins/c9.ide.guide/guide",
            staticPrefix: staticPrefix + "/plugins/c9.ide.guide"
        },
        {
            packagePath: "plugins/c9.ide.guide/default"
        },
        {
            packagePath: "plugins/c9.ide.configuration/configure",
            dashboardUrl: options.dashboardUrl,
        },
        "plugins/c9.ide.save/save",
        "plugins/c9.ide.recentfiles/recentfiles",
        {
            packagePath: "plugins/c9.ide.save/autosave"
        },
        {
            packagePath: "plugins/c9.ide.clipboard/clipboard",
            local: options.local
        },
        {
            packagePath: "plugins/c9.ide.clipboard/html5"
        },
        "plugins/c9.ide.behaviors/tabs",
        // {
        //     packagePath: "plugins/c9.ide.behaviors/dashboard",
        //     staticPrefix : staticPrefix + "/plugins/c9.ide.behaviors"
        // },
        {
            packagePath: "plugins/c9.ide.behaviors/page",
            staticPrefix: staticPrefix + "/plugins/c9.ide.behaviors"
        },
        "plugins/c9.ide.browsersupport/browsersupport",
        {
            packagePath: "plugins/c9.ide.preferences/preferences",
            staticPrefix: staticPrefix + "/plugins/c9.ide.preferences"
        },
        "plugins/c9.ide.preferences/preferencepanel",
        {
            packagePath: "plugins/c9.ide.preferences/general",
            installPath: options.installPath,
            local: options.local
        },
        {
            packagePath: "plugins/c9.ide.preferences/project",
            basePath: workspaceDir,
            local: options.local
        },
        "plugins/c9.ide.preferences/experimental",
        {
            packagePath: "plugins/c9.ide.login/login",
            staticPrefix: staticPrefix + "/plugins/c9.ide.login",
            ideBaseUrl: options.ideBaseUrl,
            dashboardUrl: options.dashboardUrl,
            accountUrl: options.accountUrl,
            local: options.local
        },
        {
            packagePath: "plugins/c9.ide.pubsub/pubsub-client",
        },
        {
            packagePath: "plugins/c9.ide.collab/notifications/bubble",
            staticPrefix: staticPrefix + "/plugins/c9.ide.collab/notifications"
        },
        
        // Test
        {
            packagePath: "plugins/c9.ide.test/test"
        },
        "plugins/c9.ide.test/testpanel",
        "plugins/c9.ide.test/testrunner",
        {
            packagePath: "plugins/c9.ide.test/all",
            staticPrefix: staticPrefix + "/plugins/c9.ide.test"
        },
        "plugins/c9.ide.test/results",
        "plugins/c9.ide.test/coverage",
        "plugins/c9.ide.test/coverageview",
        
        "plugins/c9.ide.test.mocha/mocha",
        
        // git integration v2
        // {
        //     packagePath: "plugins/c9.ide.scm/scm.commit",
        //     staticPrefix: staticPrefix + "/plugins/c9.ide.scm"
        // },
        // "plugins/c9.ide.scm/scm",
        // "plugins/c9.ide.scm/scm.branches",
        // "plugins/c9.ide.scm/dialog.localchanges",
        // "plugins/c9.ide.scm/scm.log",
        // "plugins/c9.ide.scm/git",
        // "plugins/c9.ide.scm/diff.split",
        // "plugins/c9.ide.scm/diff.unified",

        // // git integration v1
        "plugins/c9.ide.scm/v1/scm",
        "plugins/c9.ide.scm/v1/scmpanel",
        "plugins/c9.ide.scm/v1/detail",
        "plugins/c9.ide.scm/v1/log",
        "plugins/c9.ide.scm/v1/git",
        "plugins/c9.ide.scm/v1/editor",
        
        // git integration
        "plugins/c9.ide.scm/mergetool"
    ];
    
    
    if (packaging || !devel) {
        plugins.push({
            packagePath: "plugins/c9.ide.errorhandler/raygun_error_handler",
            version: options.manifest.version,
            revision: options.manifest.revision,
            apiKey: options.raygun.apiKey || options.raygun.client.apiKey
        });
    }
    if (packaging || devel) {
        plugins.push({
            packagePath: "plugins/c9.ide.errorhandler/simple_error_handler",
            version: options.manifest.version,
            revision: options.manifest.revision
        });
    }
    if (!hosted) {
        plugins.push(
            "plugins/c9.ide.analytics/mock_analytics",
            "plugins/c9.ide.services/linked-services-mock"
        );
    }
    
    // Collab
    if (packaging || !collab) {
        plugins.push(
            "plugins/c9.ide.language.jsonalyzer/mock_collab"
        );
    } 
    if (packaging || collab) {
        plugins.push(
        {
            packagePath: "plugins/c9.ide.collab/connect",
            enable: collab,
            debug: debug,
            localServerFile: localExtendFiles,
            nodeBin: nodeBin,
            nodePath: nodePath,
            basePath: workspaceDir
        },
        "plugins/c9.ide.collab/collab",
        "plugins/c9.ide.collab/collabpanel",
        {
            packagePath: "plugins/c9.ide.collab/workspace",
            hosted: hosted,
            isAdmin: options.isAdmin
        },
        "plugins/c9.ide.collab/util",
        {
            packagePath: "plugins/c9.ide.collab/ot/document",
            minDelay: 500,
            maxDelay: 10000
        },
        {
            packagePath: "plugins/c9.ide.collab/cursor_layer",
            staticPrefix: staticPrefix + "/plugins/c9.ide.collab"
        },
        "plugins/c9.ide.collab/author_layer",
        {
            packagePath: "plugins/c9.ide.collab/timeslider/timeslider",
            staticPrefix: staticPrefix + "/plugins/c9.ide.collab/timeslider"
        },
        // Collab panels
        {
            packagePath: "plugins/c9.ide.collab/notifications/notifications",
            hosted: hosted,
            isAdmin: options.isAdmin
        },
        "plugins/c9.ide.collab/members/members_panel",
        {
            packagePath: "plugins/c9.ide.collab/share/share",
            previewUrl: options.previewUrl,
            local: options.local
        },
        {
            packagePath: "plugins/c9.ide.collab/members/members",
            staticPrefix: staticPrefix + "/plugins/c9.ide.layout.classic"
        },
        {
            packagePath: "plugins/c9.ide.collab/chat/chat",
            staticPrefix: staticPrefix + "/plugins/c9.ide.collab/chat"
        });
    }
    
    if (options.platform !== "win32") {
        plugins.push({
            packagePath: "plugins/c9.ide.language.codeintel/codeintel",
            preinstalled: hosted && !options.ssh,
        });
    }

    return plugins;
};







