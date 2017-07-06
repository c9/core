define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "ui", "commands", "menus", "tabManager", "dialog.alert", "preferences"
    ];
    main.provides = ["format"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var ui = imports.ui;
        var commands = imports.commands;
        var tabManager = imports.tabManager;
        var menus = imports.menus;
        var alert = imports["dialog.alert"].show;
        var prefs = imports.preferences;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var count = 300;
        var mnuFormat;
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            commands.addCommand({
                name: "formatcode",
                hint: "reformat selected JavaScript code in the editor",
                msg: "Beautifying selection.",
                bindKey: { mac: "Command-Shift-B", win: "Ctrl-Shift-B" },
                exec: function(editor, args) {
                    formatCode(args.mode, editor, args.all);
                }
            }, plugin);
            
            commands.addCommand({
                name: "formatprefs",
                hint: "open language & formatting preferences",
                exec: function(editor, args) {
                    commands.exec("openpreferences", null, {
                        panel: "preferences.project",
                        section: "JavaScript Support"
                    });
                }
            }, plugin);
            
            mnuFormat = new ui.menu({
                onitemclick: function(e) {
                    if (e.value && e.value != "auto")
                        formatCode(e.value);
                }
            });
            menus.addItemByPath("Edit/Code Formatting", mnuFormat, 1400, plugin);
            
            menus.addItemByPath("Edit/Code Formatting/Apply Code Formatting", new ui.item({
                selected: true,
                value: "auto",
                command: "formatcode"
            }), 100, plugin);
            
            menus.addItemByPath("Edit/Code Formatting/Open Language & Formatting Preferences...", new ui.item({
                selected: true,
                value: "auto",
                command: "formatprefs"
            }), 200, plugin);
        }
        
        /***** Methods *****/
        
        function getMode(editor) {
            return editor.ace.session.syntax;
        }
        
        function formatCode(mode, editor, all) {
            if (!editor)
                editor = tabManager.focussedTab.editor;
            
            if (!mode || mode === "auto")
                mode = getMode(editor);
            
            if (editor.ace.selection.isEmpty())
                all = true;
            
            if (!emit("format", { mode: mode, editor: editor, all: all })) {
                alert("Error",
                    "This code could not be beautified",
                    '"' + mode + "\" is not supported yet");
            }
        }
        
        function addFormatter(caption, mode, plugin) {
            if (count === 300)
                menus.addItemByPath("Edit/Code Formatting/~", new ui.divider(), 300, plugin);
            menus.addItemByPath("Edit/Code Formatting/" + caption, new ui.item({
                value: mode,
                isAvailable: commands.commands.formatcode.isAvailable
            }), count += 100, plugin);
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("enable", function() {
            
        });
        plugin.on("disable", function() {
            
        });
        plugin.on("unload", function() {
            loaded = false;
            mnuFormat = null;
        });
        
        /***** Register and define API *****/
        
        /**
         * 
         **/
        plugin.freezePublicAPI({
            /**
             * 
             */
            formatCode: formatCode,
            
            /**
             * 
             */
            addFormatter: addFormatter,
            
            _events: [
                /**
                 * @event format
                 * @param {Object} e
                 * @param {String} e.mode
                 */
                "format"
            ]
        });
        
        register(null, {
            format: plugin
        });
    }
});