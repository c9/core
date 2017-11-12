define(function(require, module, exports) {
    main.consumes = [
        "Plugin", "build", "settings", "commands", "fs", "save",
        "menus", "tabManager", "ui", "dialog.error"
    ];
    main.provides = ["build.gui"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var settings = imports.settings;
        var commands = imports.commands;
        var menus = imports.menus;
        var save = imports.save;
        var build = imports.build;
        var fs = imports.fs;
        var ui = imports.ui;
        var tabs = imports.tabManager;
        var showError = imports["dialog.error"].show;
        var uCaseFirst = require("c9/string").uCaseFirst;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        // var emit = plugin.getEmitter();
        
        var process, currentBuilder;
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            // Commands
            commands.addCommand({
                name: "build",
                group: "Run & Debug",
                hint: "builds the current file (focussed document)",
                bindKey: { mac: "Command-B", win: "Ctrl-B" },
                isAvailable: function() {
                    return getFocusTab() ? true : false;
                },
                exec: function() {
                    buildFocusTab();
                }
            }, plugin);
    
            commands.addCommand({
                name: "stopbuild",
                group: "Run & Debug",
                hint: "stop a running build",
                bindKey: { mac: "Ctrl-Shift-C", win: "Ctrl-Shift-C" },
                isAvailable: function() {
                    return process && process.running;
                },
                exec: function() { 
                    process && process.stop();
                }
            }, plugin);
    
            // Settings
            settings.on("read", function() {
                settings.setDefaults("project/build", [
                    ["saveall", true],
                    ["builder", "auto"]
                ]);
                settings.setDefaults("user/build", [
                    ["autobuild", "false"]
                ]);
                
                var name = settings.get("project/build/@builder");
                setCurrentBuilder(name, function() {});
            });
            
            // Menus
            var c = 10000;
            menus.addItemByPath("Run/~", new ui.divider(), c += 100, plugin);
            
            var mnuBuildSystem = new ui.menu({
                "onprop.visible": function(e) {
                    if (e.value) {
                        build.listBuilders(function(err, names) {
                            var nodes = mnuBuildSystem.childNodes;
                            for (var i = nodes.length - 3; i >= 2; i--) {
                                mnuBuildSystem.removeChild(nodes[i]);
                            }
                            
                            var builder = settings.get("project/build/@builder");
                            if (builder == "auto")
                                nodes[0].select();
                            
                            var c = 300;
                            names.sort().forEach(function(name) {
                                menus.addItemToMenu(mnuBuildSystem, new ui.item({
                                    type: "radio",
                                    caption: uCaseFirst(name),
                                    value: name,
                                    selected: builder == name
                                }), c++, plugin);
                            });
                        });
                    }
                },
                "onitemclick": function(e) {
                    if (e.value == "new-build-system") {
                        tabs.open({
                            path: settings.get("project/build/@path") 
                              + "/My Builder.build",
                            active: true,
                            value: '// Create a custom Cloud9 build system - similar to the Sublime build system\n'
                              + '// For more information see https://docs.c9.io/custom_runners.html\n'
                              + '{\n'
                              + '    "cmd" : ["ls", "$file", "$args"],\n'
                              + '    "env" : {},\n'
                              + '    "info" : "Building $project_path/$file_name",\n'
                              + '    "selector": "source.ext"\n'
                              + '}',
                            document: {
                                meta: {
                                    newfile: true
                                },
                                ace: {
                                    customSyntax: "javascript"
                                }
                            }
                        }, function() {});
                        return;
                    }
                    
                    setCurrentBuilder(e.value, function() {});
                    settings.set("project/build/@builder", e.value);
                }
            });
            
            menus.addItemByPath("Run/Build", new ui.item({
                command: "build"
            }), c += 100, plugin);
            menus.addItemByPath("Run/Cancel Build", new ui.item({
                command: "stopbuild"
            }), c += 100, plugin);
            menus.addItemByPath("Run/Build System/", mnuBuildSystem, 
                c += 100, plugin);
            menus.addItemByPath("Run/Show Build Result", new ui.item({
                onclick: function() {
                    commands.exec("showoutput", null, { id: "build" });
                }
            }), c += 100, plugin);
            menus.addItemByPath("Run/~", new ui.divider(), c += 100, plugin);
            menus.addItemByPath("Run/Automatically Build Supported Files", new ui.item({
                type: "check",
                checked: "user/build/@autobuild"
            }), c += 100, plugin);
            menus.addItemByPath("Run/Save All on Build", new ui.item({
                type: "check",
                checked: "project/build/@saveall"
            }), c += 100, plugin);
            
            c = 0;
            menus.addItemByPath("Run/Build System/Automatic", new ui.item({
                type: "radio",
                value: "auto"
            }), c += 100, plugin);
            menus.addItemByPath("Run/Build System/~", new ui.divider(), c += 100, plugin);
            menus.addItemByPath("Run/Build System/~", new ui.divider(), c += 1000, plugin);
            menus.addItemByPath("Run/Build System/New Build System", new ui.item({
                value: "new-build-system"
            }), c += 100, plugin);
            
            // Hook into FS and build file when writeFile is triggered
            save.on("afterSave", function(e) {
                if (!settings.getBool("user/build/@autobuild"))
                    return;
                
                var ext = fs.getExtension(e.path);
                if (!ext)
                    return;
                
                // @todo consider making this a hash map
                if (currentBuilder == "auto") {
                    if (Object.keys(build.builders).every(function(name) {
                        return build.builders[name].selector != "source." + ext;
                    })) return;
                }
                else if (currentBuilder.selector != "source." + ext)
                    return;
                
                buildFocusTab(true, e.path);
            });
        }
        
        /***** Methods *****/
        
        function setCurrentBuilder(name, callback) {
            currentBuilder = name;
            if (currentBuilder != "auto") {
                build.getBuilder(currentBuilder, true, function(err, builder) {
                    if (err)
                        currentBuilder = "auto";
                    else
                        currentBuilder = builder;
                    callback(err, builder);
                });
            }
        }
        
        function getFocusTab() {
            var tab = tabs.focussedTab;
            if (!tab) return false;
            if (tab.path) return tab;
            if (tab.editor.type != "output") return false;
            
            var splits = tab.pane.aml
                .parentNode.parentNode.getElementsByTagName("tab");
            if (splits.length > 1) {
                var idx = splits[0].cloud9pane == tab.pane ? 1 : 0;
                tab = splits[idx].cloud9pane.getTab();
                return tab;
            }
            return false;
        }
        
        function buildFocusTab(onlyBuild, path) {
            if (!path) {
                var tab = getFocusTab();
                if (!tab) return;
                path = tab.path;
            }
            
            if (!onlyBuild)
                commands.exec("showoutput", null, { id: "build" });
            
            if (settings.get("project/build/@saveall"))
                save.saveAll(done);
            else
                done();
            
            function done() {
                process = build.build(currentBuilder, 
                    { path: path.substr(1) }, "build", function(err, pid) {
                        if (err && err.code != "EBUILDERNOTFOUND")
                            return showError(err);
                    });
            }
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
        });
        
        /***** Register and define API *****/
        
        /**
         * UI for the {@link build} plugin. This plugin is responsible for the Run
         * menu in the main menu bar, as well as the settings and the 
         * preferences UI for the run plugin.
         * @singleton
         */
        /**
         * @command build Builds the currently focussed tab.
         */
        /**
         * @command stopbuild Stops the running build.
         */
        plugin.freezePublicAPI({
            
        });
        
        register(null, {
            "build.gui": plugin
        });
    }
});
