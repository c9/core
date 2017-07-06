/**
 * Cloud9 Language Foundation
 *
 * @copyright 2013, Ajax.org B.V.
 */
define(function(require, exports, module) {
    main.consumes = ["Plugin", "language", "preferences", "settings"];
    main.provides = ["language.javascript"];
    return main;

    function main(options, imports, register) {
        var language = imports.language;
        var settings = imports.settings;
        var Plugin = imports.Plugin;
        var plugin = new Plugin("Ajax.org", main.consumes);
        var prefs = imports.preferences;
        
        plugin.on("load", function() {
            prefs.add({
                "Project": {
                    "JavaScript Support": {
                        position: 1100,
                        "Format Code on Save": {
                            position: 320,
                            type: "checkbox",
                            path: "project/javascript/@formatOnSave",
                        },
                        "Custom Code Formatter": {
                            position: 340,
                            type: "textbox",
                            path: "project/javascript/@formatter",
                            realtime: true,
                            onchange: function(e) {
                                if (e.value)
                                    settings.set("project/javascript/@use_jsbeautify", false);
                            }
                        }
                    }
                }
            }, plugin);
            
            settings.on("read", function() {
                settings.setDefaults("project/javascript", [
                    ["formatOnSave", "false"],
                    ["formatter", 'esformatter -i "$file"'],
                ]);
            });

            language.registerLanguageHandler('plugins/c9.ide.language.javascript/parse');
            language.registerLanguageHandler('plugins/c9.ide.language.javascript/scope_analyzer');
            
            language.registerLanguageHandler('plugins/c9.ide.language.javascript/debugger');
            language.registerLanguageHandler('plugins/c9.ide.language.javascript/outline');
            language.registerLanguageHandler('plugins/c9.ide.language.javascript/jumptodef');
        });
        plugin.on("unload", function() {
            
        });
        
        register(null, {
            "language.javascript": plugin
        });
    }
});