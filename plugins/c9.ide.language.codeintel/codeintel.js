/**
 * Cloud9 codeintel support
 *
 * @copyright 2015, Ajax.org B.V.
 */
define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "language", "jsonalyzer", "settings",
        "preferences", "c9", "dialog.question"
    ];
    main.provides = ["language.codeintel"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var language = imports.language;
        var c9 = imports.c9;
        var preferences = imports.preferences;
        var settings = imports.settings;
        var question = imports["dialog.question"];
        var preinstalled = options.preinstalled;
        var plugin = new Plugin("Ajax.org", main.consumes);
        var server = require("text!./server/codeintel_server.py")
            .replace(/ {4}/g, " ").replace(/'/g, "'\\''");
        var launchCommand = require("text!./server/launch_command.sh")
            .replace(/ {2,}/g, " ");
        
        var showedInstaller = false;
        
        var CATALOGS = [
            { "lang": "PHP", "name": "PECL", "description": "A collection of PHP Extensions" },
            { "lang": "PHP", "name": "Drupal", "description": "A full-featured PHP content management/discussion engine" },
            { "lang": "Ruby", "name": "Rails", "description": "Rails" },
            /*
            {"lang": "Python", "name": "PyWin32", "description": "Python Extensions for Windows"},
            {"lang": "Python3", "name": "PyWin32 (Python3)", "description": "Python Extensions for Windows"},
            {"lang": "JavaScript", "name": "dojo", "description": "Dojo Toolkit API"},
            {"lang": "JavaScript", "name": "Ext_30", "description": "Ext JavaScript framework"},
            {"lang": "JavaScript", "name": "HTML5", "description": "HTML5 (Canvas, Web Messaging, Microdata)"},
            {"lang": "JavaScript", "name": "jQuery", "description": "jQuery JavaScript library"},
            {"lang": "JavaScript", "name": "MochiKit", "description": "A lightweight JavaScript library"},
            {"lang": "JavaScript", "name": "Mozilla Toolkit", "description": "Mozilla Toolkit API"},
            {"lang": "JavaScript", "name": "Prototype", "description": "JavaScript framework for web development"},
            {"lang": "JavaScript", "name": "XBL", "description": "XBL JavaScript support"},
            {"lang": "JavaScript", "name": "XPCOM", "description": "Mozilla XPCOM Components"},
            {"lang": "JavaScript", "name": "YUI", "description": "Yahoo! User Interface Library1"}
            */
        ];
        
        plugin.on("load", function() {
            // FIXME: language.registerLanguageHandler("plugins/c9.ide.language.codeintel/worker/ruby_completer", onLoad, plugin);
            language.registerLanguageHandler("plugins/c9.ide.language.codeintel/worker/codeintel_worker", onLoadHandler, plugin);
            language.registerLanguageHandler("plugins/c9.ide.language.codeintel/worker/php_completer", onLoadHandler, plugin);
            language.registerLanguageHandler("plugins/c9.ide.language.codeintel/worker/css_less_completer", onLoadHandler, plugin);

            preferences.add({
                "Project": {
                    "PHP Support": {
                        position: 1200,
                        "Enable PHP code completion": {
                            position: 410,
                            type: "checkbox",
                            path: "project/php/@completion",
                        },
                        "PHP Completion Include Paths": {
                            position: 420,
                            type: "textbox",
                            width: 300,
                            path: "project/php/@path",
                        },
                        "Format Code on Save": {
                            position: 430,
                            type: "checkbox",
                            path: "project/php/@formatOnSave",
                        },
                        "Custom Code Formatter": {
                            position: 440,
                            type: "textbox",
                            path: "project/php/@formatter",
                        }
                    }
                }
            }, plugin);
            
            settings.on("read", function(e) {
                settings.setDefaults("project/php", [
                    ["path", options.paths.php],
                    ["completion", true],
                ]);
            }, plugin);
        });
            
        function onLoadHandler(err, handler) {
            if (err) return console.error(err);
            
            settings.on("project/php", sendSettings);
            handler.on("not_installed", onNotInstalled);
            sendSettings();
            
            function sendSettings() {
                handler.emit("setup", {
                    server: server,
                    launchCommand: launchCommand,
                    hosted: !options.testing && c9.hosted,
                    enabled: settings.get("project/php/@completion"),
                    paths: {
                        php: makeAbsolutePaths(settings.get("project/php/@path")),
                    },
                });
            }
            
            function makeAbsolutePaths(pathSetting) {
                return pathSetting.split(":").map(function(path) {
                    if (["/", "~", "\\"].indexOf(path[0]) > -1 || path[1] === ":")
                        return path;
                    return c9.workspaceDir + "/" + path;
                }).join(":");
            }
        }
        
        function onNotInstalled(e) {
            if (preinstalled || showedInstaller || e.language === "css"
                || settings.getBool("project/codeintel/@dismiss_installer"))
                return;
            showedInstaller = true;
                
            question.show(
                "Code Intelligence",
                "Code completion is available for the language you are currently working with.",
                "To install it on your own host, please follow our installation guide. Would you like to open the guide now?",
                onYes,
                onNo,
                {
                    showDontAsk: true,
                    yes: "Open installation guide",
                    no: "Not now",
                }
            );
            
            function onYes() {
                if (question.dontAsk)
                    settings.set("project/codeintel/@dismiss_installer", true);
                // Open guide in a new window (it's blocked from opening in an iframe)
                window.open("https://github.com/c9/c9.ide.language.codeintel/blob/master/README.md", "_blank");
            }
            
            function onNo() {
                if (question.dontAsk)
                    settings.set("project/codeintel/@dismiss_installer", true);
            }
        }
        
        plugin.on("unload", function() {
            
        });
        
        /** @ignore */
        register(null, {
            "language.codeintel": plugin
        });
    }
});
