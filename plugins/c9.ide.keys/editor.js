define(function(require, exports, module) {
    main.consumes = [
        "PreferencePanel", "commands", "settings", "ui", "util", "Form",
        "c9", "dialog.alert", "tabManager", "save", "dialog.confirm", "layout"
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
            className: "keybindings",
            form: true,
            noscroll: true,
            index: 200
        });
        // var emit = plugin.getEmitter();
        
        var model, datagrid, changed, container, filterbox;
        var appliedCustomSets, intro;
        
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
                    applyFilter();
                }
            }, plugin);
            
            settings.on("read", function(e) {
                updateCommandsFromSettings();
            }, plugin);
            
            commands.on("update", function(){
                changed = true;
                updateCommandsFromSettings();
            }, plugin);
            
            save.on("beforeSave", function(e) {
                if (e.document.meta.keybindings) {
                    // Doing save as, it is now a normal document
                    if (e.path != "~/.c9/keybindings.settings") {
                        delete e.document.meta.keybindings;
                        return;
                    }
                    
                    var value = e.document.value
                        .replace(/\/\/.*/g, "");
                        
                    var json;
                    try {
                        json = JSON.parse(value);
                    } catch (e) {
                        alert("Syntax Error", 
                            "Found a Syntax Error in Keybindings", 
                            "Please correct it and try saving again.");
                        return false;
                    }
                    
                    settings.setJson("user/key-bindings", json);
                    updateCommandsFromSettings();
                    
                    // e.document.meta.$ignoreSave = true;
                    // e.document.tab.close();
                    e.document.undoManager.bookmark();
                    
                    return false;
                }
            }, plugin);
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
                width: "100",
                editor: "textbox" 
            }, {
                caption: "Description",
                value: "info",
                width: "100%"
            }];
            
            layout.on("eachTheme", function(e){
                var height = parseInt(ui.getStyleRule(".bar-preferences .blackdg .tree-row", "height"), 10) || 24;
                model.rowHeightInner = height;
                model.rowHeight = height + 1;
                
                if (e.changed) datagrid.resize(true);
            });
            
            reloadModel();
            
            plugin.form.add([
                {
                    type: "custom",
                    title: "Introduction",
                    position: 1,
                    node: intro = new ui.bar({
                        height: 149,
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
                                reset();
                            }, function(){});
                    },
                    position: 90
                },
                {
                    title: "Keyboard Mode",
                    type: "dropdown",
                    path: "user/ace/@keyboardmode",
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
                        style: "padding:44px 10px 10px 10px;position:relative"
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
                }
            ]);
            
            filterbox.ace.on("input", function(e) {
                applyFilter();
            });
            
            container.on("contextmenu", function(){
                return false;
            });
            
            datagrid.on("createEditor", function(e) {
                var ace = e.ace;
                
                var lastKey, displayKey;
                
                ace.keyBinding.addKeyboardHandler(function(data, hashId, keyString, keyCode, e) {
                    var key = [];
                    var disable = { command: "null" };
                    
                    if (!e) return disable;
                    
                    if (e.ctrlKey)  key.push("Ctrl");
                    if (e.metaKey)  key.push(apf.isMac ? "Command" : "Meta");
                    if (e.altKey)   key.push(apf.isMac ? "Option" : "Alt");
                    if (e.shiftKey) key.push("Shift");
                    
                    // do not allow binding to enter and escape without modifiers
                    if (!key.length) {
                        if (e.keyCode == 8) {
                            ace.setValue("");
                            lastKey = displayKey = "";
                            return disable;
                        }
                        if (e.keyCode == 27)
                            return disable;
                        if (e.keyCode == 13) {
                            var node = datagrid.selection.getCursor();
                            var name = node.name;
                            node.keys = displayKey;
                            node.actualKeys = lastKey;
                            
                            // Make sure key is not already used
                            if (commands.findKey(lastKey)) {
                                alert();
                            }
                            
                            // Add key
                            commands.bindKey(lastKey, commands.commands[name]);
                            
                            datagrid.resize(true);
                            datagrid.focus();
                            
                            return disable;
                        }
                    }
                    
                    if (keys[e.keyCode]) {
                        if (!keys.MODIFIER_KEYS[e.keyCode])
                          key.push(keys[e.keyCode].toUpperCase());
                    } 
                    else if (e.keyIdentifier.substr(0, 2) == "U+") {
                        key.push(String.fromCharCode(
                            parseInt(e.keyIdentifier.substr(2), 16)
                        ));
                    }
                    
                    displayKey = lastKey = key.join("-");
                    if (commands.platform == "mac")
                        displayKey = apf.hotkeys.toMacNotation(displayKey);
                    ace.setValue(displayKey);
                    
                    return disable;
                });
            });
            
            datagrid.on("rename", function(e) {
                var node = e.node;
                var n = {
                    command: node.name,
                    keys: (node.actualKeys || node.keys).split("|")
                };
                
                var cmds = settings.getJson("user/key-bindings") || [];
                if (!cmds.some(function(node, i) {
                    if (node.command == n.command) {
                        cmds[i] = n;
                        return true;
                    }
                })) cmds.push(n);
                
                settings.setJson("user/key-bindings", cmds);
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
                        if (Array.isArray(keys))
                            keys = keys.join("|");
                        if (typeof keys == "string")
                            commands.bindKey(keys, commands.commands[cmd.command]);
                    });
                    
                    appliedCustomSets = true;
                }
            
                reloadModel();
            });
        }
        
        function reset(noReload) {
            commands.reset(noReload);
            
            if (!noReload) {
                settings.setJson("user/key-bindings", []);
                reloadModel();
            }
        }
        
        function getObject(node) {
            return {
                command: node.name,
                keys: node.keys,
            };
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
            model.setRoot(model.cachedRoot);
        }
        
        function applyFilter(){
            if (!filterbox) return;
            
            model.keyword = filterbox.getValue();
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
            var keys = settings.getJson("user/key-bindings") || [];
            var value = "// Edit this keymap file and save to apply.\n[\n";
            
            value += keys.map(function(key) {
                return "    " + JSON.stringify(key)
                    .replace(/":/g, "\": ")
                    .replace(/,/g, ", ")
                    .replace(/\{/g, "{ ")
                    .replace(/\}/g, " }");
            }).join(",\n");
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
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("draw", function(e) {
            draw(e);
        });
        plugin.on("activate", function(e) {
            datagrid && datagrid.resize();
        });
        plugin.on("resize", function(e) {
            datagrid && datagrid.resize();
        });
        plugin.on("enable", function() {
            
        });
        plugin.on("disable", function() {
            
        });
        plugin.on("unload", function() {
            loaded = false;
            drawn = false;
        });
        
        /***** Register and define API *****/
        
        /**
         * 
         **/
        plugin.freezePublicAPI({
            /**
             * 
             */
            editUserKeys: editUserKeys
        });
        
        register(null, { 
            "preferences.keybindings" : plugin 
        });
    }
});