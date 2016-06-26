define(function(require, exports, module) {
    main.consumes = [
        "PreferencePanel", "commands", "settings", "ui", "util", "Form",
        "c9", "dialog.alert", "tabManager", "save", "dialog.confirm", "layout",
        "menus"
    ];
    main.provides = ["preferences.keybindings"];
    return main;

    function main(options, imports, register) {
        var PreferencePanel = imports.PreferencePanel;
        var commands = imports.commands;
        var settings = imports.settings;
        var layout = imports.layout;
        var ui = imports.ui;
        var c9 = imports.c9;
        var util = imports.util;
        var save = imports.save;
        var menus = imports.menus;
        var tabManager = imports.tabManager;
        var alert = imports["dialog.alert"].show;
        var confirm = imports["dialog.confirm"].show;
        
        var search = require("../c9.ide.navigate/search");
        var keys = require("ace/lib/keys");
        var Tree = require("ace_tree/tree");
        var TreeData = require("./editordp");
        var TreeEditor = require("ace_tree/edit");
        
        /***** Initialization *****/
        
        var plugin = new PreferencePanel("Ajax.org", main.consumes, {
            caption: "Keybindings",
            className: "keybindings flatform",
            form: true,
            noscroll: true,
            index: 200
        });
        // var emit = plugin.getEmitter();
        
        var customKeymaps = {};
        
        var model, datagrid, changed, container, filterbox;
        var appliedCustomSets, intro, reloading;
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            settings.on("user/key-bindings", function(){
                var platform = settings.get("user/key-bindings/@platform");
                if (platform == "auto")
                    platform = apf.isMac ? "mac" : "win";
                    
                if (commands.platform != platform) {
                    commands.changePlatform(platform);
                    reloadModel();
                }
            }, plugin);
            
            settings.on("user/ace/@keyboardmode", function(){
                var mode = settings.getJson("user/ace/@keyboardmode");
                if (customKeymaps[mode]) {
                    settings.set("user/ace/@keyboardmode", "default");
                    settings.setJson("user/key-bindings", customKeymaps[mode]);
                    updateCommandsFromSettings();
                }
            });
            
            settings.on("read", function(e) {
                updateCommandsFromSettings();
            }, plugin);
            
            commands.on("update", function(){
                if (!reloading) {
                    changed = true;
                    updateCommandsFromSettings();
                }
            }, plugin);
            
            save.on("beforeSave", function(e) {
                if (e.document.meta.keybindings) {
                    // Doing save as, it is now a normal document
                    if (e.path != "~/.c9/keybindings.settings") {
                        delete e.document.meta.keybindings;
                        return;
                    }
                    
                    var value = e.document.value
                        .replace(/\/\/.*/g, "")
                        .replace(/("(?:\\.|[^"])")|(?:,\s*)+([\]\}])|(\w+)\s*:|([\]\}]\s*[\[\{])/g,
                            function(_, str, extraComma, noQuote, missingComma) {
                                if (missingComma)
                                    return missingComma[0] + "," + missingComma.slice(1);
                                return str || extraComma || '"' + noQuote + '":';
                        })
                        .trim() || "[]";
                        
                    var json;
                    try {
                        json = JSON.parse(value);
                        if (!Array.isArray(json))
                            throw new Error("");
                    } catch (e) {
                        alert("Syntax Error", 
                            "Found a Syntax Error in Keybindings", 
                            "Please correct it and try saving again.");
                        return false;
                    }
                    
                    settings.setJson("user/key-bindings", json);
                    updateCommandsFromSettings();
                    
                    e.document.undoManager.bookmark();
                    
                    return false;
                }
            }, plugin);
            
            menus.addItemByPath("Help/Key Bindings Editor", new ui.item({
                onclick: function(){
                    commands.exec("openpreferences", null, {
                        panel: plugin
                    });
                }
            }), 250, plugin);
        }
        
        var drawn;
        function draw(e) {
            if (drawn) return;
            drawn = true;
            
            model = new TreeData();
            model.emptyMessage = "No keybindings to display";
            
            model.columns = [{
                caption: "Name",
                value: "name",
                width: "150",
                type: "tree"
            }, {
                caption: "Keystroke",
                value: "keys",
                width: "20%",
                editor: "textbox" 
            }, {
                caption: "Description",
                value: "info",
                width: "80%"
            }];
            
            layout.on("eachTheme", function(e){
                var height = parseInt(ui.getStyleRule(".bar-preferences .blackdg .tree-row", "height"), 10) || 24;
                model.rowHeightInner = height;
                model.rowHeight = height;
                
                if (e.changed) datagrid.resize(true);
            });
            
            reloadModel();
            
            plugin.form.add([
                {
                    type: "custom",
                    title: "Introduction",
                    position: 1,
                    node: intro = new ui.bar({
                        "class" : "intro",
                        style: "padding:12px;position:relative;"
                    })
                },
                {
                    type: "button",
                    title: "Reset to Default Keybindings",
                    caption: "Reset to Defaults",
                    width: 140,
                    onclick: function(){
                        confirm("Reset Settings", 
                            "Are you sure you want to reset your keybindings?", 
                            "By resetting your keybindings to their "
                            + "defaults you will lose all custom keybindings.", 
                            function(){
                                settings.setJson("user/key-bindings", []);
                                settings.set("user/ace/@keyboardmode", "default");
                                settings.set("user/key-bindings/@platform", "auto");
                                commands.reset(false, true);
                            },
                            function(){},
                            {
                                yes: "Reset Settings",
                                no: "Cancel"
                            });
                    },
                    position: 90
                },
                {
                    title: "Keyboard Mode",
                    type: "dropdown",
                    path: "user/ace/@keyboardmode",
                    name: "kbmode",
                    items: [
                        { caption: "Default", value: "default" },
                        { caption: "Vim", value: "vim" },
                        { caption: "Emacs", value: "emacs" },
                        { caption: "Sublime", value: "sublime" }
                    ],
                    position: 100
                },
                {
                   type: "dropdown",
                   title: "Operating System",
                   path: "user/key-bindings/@platform",
                   items: [
                       {caption: "Auto", value: "auto"},
                       {caption: "Apple OSX", value: "mac"},
                       {caption: "Windows / Linux", value: "win"},
                   ],
                   position: 110
                },
                {
                    type: "custom",
                    title: "Keybindings Editor",
                    position: 120,
                    node: container = new ui.bar({
                        anchors: "269 0 0 0",
                        "class" : "keybindings",
                        style: "padding:44px 10px 10px 10px"
                    })
                }
            ], commands);
            
            intro.$int.innerHTML = 
                '<h1>Keybindings</h1><p>Change these settings to configure '
                + 'how Cloud9 responds to your keyboard commands.</p>'
                + '<p>You can also manually edit <a href="javascript:void(0)" '
                + '>your keymap file</a>.</p>'
                + '<p class="hint">Hint: Double click on the keystroke cell in the table below to change the keybinding.</p>';
            
            intro.$int.querySelector("a").onclick = function(){ editUserKeys(); };
            
            var div = container.$ext.appendChild(document.createElement("div"));
            div.style.width = div.style.height = "100%";
            
            datagrid = new Tree(div);
            datagrid.setTheme({ cssClass: "blackdg" });
            datagrid.setDataProvider(model);
            datagrid.edit = new TreeEditor(datagrid);
            
            layout.on("resize", function(){ datagrid.resize() }, plugin);
            
            filterbox = new apf.codebox({
                realtime: true,
                skin: "codebox",
                "class": "dark",
                clearbutton: true,
                focusselect: true,
                height: 27,
                left: 10,
                top: 10,
                width: 250,
                singleline: true,
                "initial-message": "Search Keybindings"
            });
            container.appendChild(filterbox);
            
            function setTheme(e) {
                filterbox.setAttribute("class", 
                    e.theme.indexOf("dark") > -1 ? "dark" : "");
            }
            layout.on("themeChange", setTheme);
            setTheme({ theme: settings.get("user/general/@skin") });
            
            filterbox.ace.commands.addCommands([
                {
                    bindKey: "Enter",
                    exec: function(){ }
                }, {
                    bindKey: "Esc",
                    exec: function(ace){ ace.setValue(""); }
                }
            ]);
            
            filterbox.ace.on("input", function(e) {
                applyFilter();
            });
            
            container.on("contextmenu", function(){
                return false;
            });
            
            var lastKey, displayKey;
            datagrid.on("createEditor", function(e) {
                displayKey = lastKey = "";
                e.ace.keyBinding.addKeyboardHandler(function(data, hashId, keyString, keyCode, e) {
                    var ace = data.editor;
                    var disable = { command: "null" };
                    
                    var mod = keys.KEY_MODS[hashId];
                    var isTextInput = keyString.length == 1 && (!mod || mod == "shift-");
                    if (!e || isTextInput || keyCode <= 0) return;
                    
                    var key = mod.split("-").filter(Boolean);
                    // do not allow binding to enter and escape without modifiers
                    if (!key.length) {
                        if (e.keyCode == 8) {
                            ace.setValue("");
                            lastKey = displayKey = "";
                            return disable;
                        }
                        if (e.keyCode == 27) {
                            ace.treeEditor.endRename(true);
                            return disable;
                        }
                        if (e.keyCode == 13) {
                            key = ace.getValue().split("-");
                            keyString = key.pop();
                            setTimeout(function() {
                                ace.treeEditor.endRename(false);
                            });
                            return disable;
                        }
                    }
                    
                    if (keyCode > 0)
                        key.push(keys[keys[keyString]] || keyString);
                    
                    displayKey = lastKey = key.map(function(x) {
                        return x.uCaseFirst();
                    }).join("-");
                    if (commands.platform == "mac")
                        displayKey = apf.hotkeys.toMacNotation(displayKey);
                    ace.setValue(displayKey);
                    
                    return disable;
                });
            });
            
            datagrid.on("rename", function(e) {
                var node = e.node;
                var name = node.name;
                node.keys = displayKey;
                node.actualKeys = lastKey;
                
                // Make sure key is not already used
                var used = commands.findKey(lastKey);
                if (used.length > 1 || (used[0] && used[0].name != name)) {
                    alert("Notice",
                        "There are other commands bound to this key combination",
                        "[" + used.map(function(x) { return x.name }).join(", ") + "]"
                    );
                }
                
                // Add key
                commands.bindKey(lastKey, commands.commands[name]);
                var keys = {};
                keys[commands.platform] = (node.actualKeys || node.keys).split("|");
                
                var n = {
                    command: node.name,
                    keys: keys
                };
                
                var cmds = settings.getJson("user/key-bindings") || [];
                if (!cmds.some(function(node, i) {
                    if (node.command == n.command) {
                        cmds[i] = n;
                        return true;
                    }
                })) cmds.push(n);
                
                reloadModel();
                
                settings.setJson("user/key-bindings", cmds);
            });
            
            // when tab is restored datagrids size might be wrong
            // todo: remove this when apf bug is fixed
            datagrid.once("mousemove", function() {
                datagrid.resize(true);
            });
        }
        
        /***** Methods *****/
        
        // @todo move this to commands
        function updateCommandsFromSettings() {
            c9.once("ready", function() {
                if (appliedCustomSets)
                    reset(true);
                
                var cmds = settings.getJson("user/key-bindings");
                if (cmds) {
                    cmds.forEach(function(cmd) {
                        if (!cmd || !cmd.command)
                            return;
                        var keys = cmd.keys;
                        if (typeof keys == "object" && keys[commands.platform])
                            keys = keys[commands.platform];
                        if (Array.isArray(keys))
                            keys = keys.join("|");
                        if (typeof keys == "string")
                            commands.bindKey(keys, commands.commands[cmd.command]);
                    });
                    
                    appliedCustomSets = true;
                }
            
                reloadModel();
                reloading = true;
                commands.flushUpdateQueue();
                reloading = false;
            });
        }
        
        function reset(noReload) {
            reloading = true;
            commands.reset(true);
            
            if (!noReload) {
                settings.setJson("user/key-bindings", []);
                reloadModel();
            }
            reloading = false;
        }
        
        function reloadModel() {
            if (!model) return;
            var groups = {};
            var root = [];
            var platform = commands.platform;
            
            Object.keys(commands.commands).forEach(function(name) {
                var item = commands.commands[name];
                if (!item.name) return;
                
                var groupName = item.group || "General";
                if (groupName == "ignore") return;
                
                var group = groups[groupName];
                if (!group)
                    root.push(group = groups[groupName] = { 
                        items: [], 
                        isOpen: true,
                        className: "group",
                        noSelect: true,
                        name: groupName 
                    });
                    
                var keys = commands.commandManager[item.name] || "";
                //item.bindKey && item.bindKey[platform] || "";
                group.items.push({
                    name: item.name,
                    enabled: "true",
                    info: item.hint || "",
                    keys: platform == "mac"
                        ? apf.hotkeys.toMacNotation(keys)
                        : keys
                });
            });
            
            model.cachedRoot = { items: root };
            applyFilter();
        }
        
        function applyFilter() {
            model.keyword = filterbox && filterbox.getValue();
            if (!model.keyword) {
                model.reKeyword = null;
                model.setRoot(model.cachedRoot);
            }
            else {
                model.reKeyword = new RegExp("(" 
                    + util.escapeRegExp(model.keyword) + ")", 'i');
                var root = search.treeSearch(model.cachedRoot.items, model.keyword, true);
                model.setRoot(root);
            }
        }
        
        function editUserKeys(tab) {
            // preferences.hide();
            
            var keys = settings.getJson("user/key-bindings") || [];
            var value = "// Edit this keymap file and save to apply.\n[\n";
            
            value += keys.map(function(key) {
                return "    " + JSON.stringify(key)
                    .replace(/":/g, "\": ")
                    .replace(/,/g, ", ")
                    .replace(/\{/g, "{ ")
                    .replace(/\}/g, " }");
            }).join(",\n");
            
            if (!keys.length)
                value += '    // { "command": "nexttab", "keys": { win: "Ctrl-Tab", mac: "Cmd-Tab" } }';
            
            value += "\n]";
            
            if (tab) {
                tab.document.value = value;
            }
            else {
                tabManager.open({
                    path: "~/.c9/keybindings.settings",
                    value: value,
                    active: true,
                    editorType: "ace",
                    document: {
                        ace: { customSyntax: "javascript" },
                        meta: { keybindings: true, nofs: true }
                    }
                }, function(err, tab) {
                    
                });
            }
        }
        
        function addCustomKeymap(name, keymap, plugin){
            customKeymaps[name] = keymap;
            
            if (!Object.keys(customKeymaps).length) {
                menus.addItemByPath("Edit/Keyboard Mode/~", 
                    new ui.divider(), 10000, plugin);
            }
            
            menus.addItemByPath("Edit/Keyboard Mode/" + name, new ui.item({
                type: "radio",
                value: name.toLowerCase(), 
                onclick: function(e) {
                    settings.set("user/ace/@keyboardmode", name);
                }
            }), 10000 + Object.keys(customKeymaps).length, plugin);
            
            plugin.addOther(function(){ delete customKeymaps[name]; });
            
            if (plugin.visible)
                updateKeymaps();
        }
        
        function updateKeymaps(){
            var items = [
                { caption: "Default", value: "default" },
                { caption: "Vim", value: "vim" },
                { caption: "Emacs", value: "emacs" },
                { caption: "Sublime", value: "sublime" }
            ];
            
            for (var name in customKeymaps) {
                items.push({ caption: name, value: name });
            }
            
            plugin.form.update([{
                id: "kbmode",
                items: items
            }])
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("draw", function(e) {
            draw(e);
        });
        plugin.on("activate", function(e) {
            if (!drawn) return;
            
            datagrid.resize();
            updateKeymaps();
        });
        plugin.on("resize", function(e) {
            datagrid && datagrid.resize();
        });
        plugin.on("unload", function() {
            loaded = false;
            drawn = false;
            
            model = null;
            datagrid = null;
            changed = null;
            container = null;
            filterbox = null;
            appliedCustomSets = null;
            intro = null;
            reloading = null;
        });
        
        /***** Register and define API *****/
        
        /**
         * 
         **/
        plugin.freezePublicAPI({
            /**
             * 
             */
            editUserKeys: editUserKeys,
            
            /**
             * 
             */
            addCustomKeymap: addCustomKeymap
        });
        
        register(null, { 
            "preferences.keybindings" : plugin 
        });
    }
});