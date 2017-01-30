define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "settings", "ui", "menus", "preferences", "tabManager", 
        "commands", "dialog.alert"
    ];
    main.provides = ["formatjson"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var settings = imports.settings;
        var ui = imports.ui;
        var prefs = imports.preferences;
        var commands = imports.commands;
        var menus = imports.menus;
        var tabs = imports.tabManager;
        var alert = imports["dialog.alert"].show;
        
        var Range = require("ace/range").Range;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        // var emit = plugin.getEmitter();
        
        function load() {
            commands.addCommand({
                name: "formatjson",
                group: "Format",
                bindKey: { mac: "Shift-Command-J", win: "Ctrl-Shift-J" },
                exec: function() { formatJson(); },
                isAvailable: function(editor) {
                    if (editor && editor.ace)
                        return !editor.ace.selection.isEmpty();
                    return false;
                }
            }, plugin);
            
            settings.on("read", function() {
                settings.setDefaults("user/formatjson", [["indentation", "4"]]);
            }, plugin);
            
            prefs.add({
                "Formatters": {
                    position: 10,
                    "JSON": {
                        "Indentation": {
                            type: "spinner",
                            path: "user/formatjson/@indentation",
                            min: "1",
                            max: "20",
                            position: 100
                        }
                    }
                }
            }, plugin);
            
            menus.addItemByPath("Tools/Format Json", new ui.item({
                command: "formatjson"
            }), 1000, plugin);
        }
        
        /***** Methods *****/
        
        function formatJson() {
            var tab = tabs.focussedTab;
            var ace = tab && tab.editor && tab.editor.ace;
            if (!ace) return;
    
            var sel = ace.getSelection();
            var doc = ace.session.getDocument();
            var range = sel.getRange();
            var value = doc.getTextRange(range);
            var indent = settings.getNumber("user/formatjson/@indentation");
            
            try {
                value = JSON.stringify(JSON.parse(value), null, indent);
            }
            catch (e) {
                alert(
                    "Invalid JSON", 
                    "The selection contains an invalid or incomplete JSON string",
                    "Please correct the JSON and try again");
                return;
            }
            
            var end = doc.replace(range, value);
            sel.setSelectionRange(Range.fromPoints(range.start, end));
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("unload", function() {
            
        });
        
        /***** Register and define API *****/
        
        /**
         **/
        plugin.freezePublicAPI({
            /**
             * Format's a json string
             */
            formatJson: formatJson
        });
        
        register(null, {
            formatjson: plugin
        });
    }
});