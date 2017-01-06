/**
 * Cloud9 Go support
 *
 * @copyright 2015, Ajax.org B.V.
 */
define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "language", "jsonalyzer", "settings",
        "preferences", "preferences.experimental"
    ];
    main.provides = ["language.go"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var language = imports.language;
        var jsonalyzer = imports["jsonalyzer"];
        var preferences = imports.preferences;
        var settings = imports.settings;
        var plugin = new Plugin("Ajax.org", main.consumes);
        
        plugin.on("load", function() {
            
            preferences.add({
                "Project": {
                    "Go Support": {
                        position: 1400,
                        "Enable Go code completion": {
                            position: 510,
                            type: "checkbox",
                            path: "project/golang/@completion",
                        },
                        "Format Code on Save": {
                            position: 520,
                            type: "checkbox",
                            path: "project/golang/@formatOnSave",
                        },
                        "Custom Code Formatter": {
                            position: 530,
                            type: "textbox",
                            path: "project/golang/@formatter",
                        }
                    }
                }
            }, plugin);
            settings.on("read", function(e) {
                settings.setDefaults("project/golang", [
                    ["completion", true],
                    ["formatOnSave", true],
                    ["formatter", 'gofmt -w "$file"'],
                ]);
            }, plugin);
            
            language.registerLanguageHandler("plugins/c9.ide.language.go/worker/go_completer", function(err, handler) {
                if (err) return console.error(err);
                setupHandler(handler);
            });
        });
            
        function setupHandler(handler) {
            settings.on("project/golang", sendSettings.bind(null, handler), plugin);
            sendSettings(handler);
        }
        
        function sendSettings(handler) {
            handler.emit("set_go_config", {
                enabled: settings.get("project/golang/@completion"),
            });
        }
        
        plugin.on("unload", function() {
            jsonalyzer.unregisterWorkerHandler("plugins/c9.ide.language.go/worker/go_completer");
        });
        
        /** @ignore */
        register(null, {
            "language.go": plugin
        });
    }
});