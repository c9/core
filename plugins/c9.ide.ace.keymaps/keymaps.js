define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "ui", "ace", "menus", "settings", "vim.cli", "tabManager",
        "commands", "c9", "tree", "dialog.error", "tabbehavior"
    ];
    main.provides = ["keymaps"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var ui = imports.ui;
        var ace = imports.ace;
        var menus = imports.menus;
        var commands = imports.commands;
        var tabManager = imports.tabManager;
        var settings = imports.settings;
        var cli = imports["vim.cli"];
        var c9 = imports.c9;
        var tree = imports.tree; // TODO: find a way to make dependency on tree optional
        var showError = imports["dialog.error"].show;
        var tabbehavior = imports.tabbehavior;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        // var emit = plugin.getEmitter();
        
        var currentMode, activeMode;
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            var mnuKbModes = new ui.menu({
                "onprop.visible": function(e) {
                    if (e.value) {
                        var value = settings.get("user/ace/@keyboardmode");
                        mnuKbModes.select(null, value);
                    }
                }
            });
            menus.addItemByPath("Edit/~", new ui.divider(), 650, plugin);
            menus.addItemByPath("Edit/Keyboard Mode/", mnuKbModes, 660, plugin);
            
            var c = 1000;
            ["Default", "Vim", "Emacs", "Sublime"].forEach(function(label) {
                menus.addItemByPath("Edit/Keyboard Mode/" + label, new ui.item({
                    type: "radio",
                    value: label.toLowerCase(), 
                    onclick: function(e) {
                        setMode(mnuKbModes.getValue());
                    }
                }), c += 100, plugin);
            });
            
            settings.on("read", function() {
                settings.setDefaults("user/ace", [
                    ["keyboardmode", "default"]
                ]);
                
                var mode = settings.get("user/ace/@keyboardmode");
                if (mode && mode != "default")
                    setMode(mode);
            }, plugin);
            
            settings.on("user/ace", function() {
                var mode = settings.get("user/ace/@keyboardmode");
                if (currentMode != mode)
                    setMode(mode);
            }, plugin);
    
            ace.on("create", function(e) { setMode(null, e); }, plugin);
            
            setTimeout(checkHostileExtensions, 1000);
        }
        
        /***** Methods *****/
        
        function setMode(mode, tab) {
            if (!settings.model.loaded)
                return;
                
            if (!mode) 
                mode = settings.get("user/ace/@keyboardmode");
            else if (currentMode != mode) {
                currentMode = mode;
                settings.set("user/ace/@keyboardmode", mode);
            }
    
            if (mode == "emacs" || mode == "vim" || mode == "sublime") {
                mode = "plugins/c9.ide.ace.keymaps/" + mode + "/keymap";
            } else {
                mode = null;
            }
            
            if (mode)
                require([mode], setKeymap);
            else
                setKeymap({});
            
            function setKeymap(keymap) {
                if (keymap.showCli)
                    cli.show();
                else
                    cli.hide();
                
                (tab ? [tab] : tabManager.getTabs()).forEach(function(tab) {
                    if (tab.editor && tab.editor.type == "ace") {
                        var editor = tab.editor.ace;
                        // Set Mode
                        editor.setKeyboardHandler(keymap.aceKeyboardHandler);
                        
                        editor.showCommandLine = showCommandLine;
                    }
                });
                
                if (activeMode == mode)
                    return;
                    
                updateIdeKeymap(mode);
                activeMode = mode;
            }
        }
        
        function updateIdeKeymap(path) {
            tree.once("ready", function() {
                var kb = path ? require(path) : {};
                tree.tree.keyBinding.setKeyboardHandler(kb.treeKeyboardHandler);
            });
            c9.once("ready", function() {
                var allCommands = commands.commands;
                Object.keys(allCommands).forEach(function(name) {
                    var cmd = allCommands[name];
                    if (cmd && cmd.originalBindKey)
                        cmd.bindKey = cmd.originalBindKey;
                });
                
                var kb = path ? require(path) : {};
                if ("execIdeCommand" in kb)
                    kb.execIdeCommand = commands.exec;
                if ("tabbehavior" in kb)
                    kb.tabbehavior = tabbehavior;
                
                if (kb.ideCommands) {
                    kb.ideCommands.forEach(function(x) {
                        commands.addCommand(x, plugin);
                    });
                }
                
                if (kb.editorCommands) {
                    kb.editorCommands.forEach(function(x) {
                        x.findEditor = findEditor;
                        x.isAvailable = isAvailableAce;
                        commands.addCommand(x, plugin);
                    });
                }
                
                if (kb.ideKeymap)
                    kb.ideKeymap.forEach(bindKey);
                if (kb.editorKeymap)
                    kb.editorKeymap.forEach(bindKey);
    
                commands.reset();
                
                function bindKey(x) {
                    var cmd = allCommands[x.name];
                    if (cmd && x.bindKey) {
                        x.bindKey.mac = normalize(x.bindKey.mac);
                        x.bindKey.win = normalize(x.bindKey.win);
                        cmd.bindKey = x.bindKey;
                    }
                }
                
                function normalize(str) {
                    return str && str.replace(/(^|-| |\|)(\w)/g, function(_, a, b) {
                        return a + b.toUpperCase();
                    });
                }
            });
        }
        
        function showCommandLine(val, options) {
            if (!options) options = {};
            cli.show();
            this.cmdLine = cli.ace;
            this.cmdLine.editor = this;
            if (options.focus !== false) {
                cli.aml.focus();
            }
            if (options.message != null) {
                if (options.timeout)
                    cli.ace.setTimedMessage(options.message, options.timeout);
                else
                    cli.ace.setMessage(options.message);
            }
            
            if (typeof val == "string")
                this.cmdLine.setValue(val, 1);
        }
        
        
        function isAvailableAce(editor, args, event) {
            if (!editor || !editor.ace) return false;
            
            // using this instead of editor.type == "ace" to make 
            // commands avaliable in editors inheriting from ace
            if (event instanceof KeyboardEvent && (!editor.ace.isFocused()))
                return false;
            
            return true;
        }
    
        function findEditor(editor) {
            return editor && editor.ace || editor;
        }
        
        function checkHostileExtensions() {
            var messages = [];
            try {
                var d = document.body.nextSibling;
                if (d && d.shadowRoot && d.shadowRoot.querySelector
                    && d.shadowRoot.querySelector("[class*=vimium]")) {
                    messages.push("Vimium breaks cloud9 keyboard shortcuts, please disable it on this site.");
                }
            } catch (e) {
            }
            if (messages.length)
                showError(messages.join("\n"));
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
            currentMode = activeMode = null;
            loaded = false;
        });
        
        /***** Register and define API *****/
        
        plugin.freezePublicAPI({
            
        });
        
        register(null, {
            keymaps: plugin
        });
    }
});