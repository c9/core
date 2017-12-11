define(function(require, module, exports) {
    main.consumes = [
        "c9", "Plugin", "run", "settings", "menus", "tabbehavior", "ace",
        "commands", "layout", "tabManager", "preferences", "ui", "fs",
        "layout", "debugger", "tree", "dialog.error", "util", "console", "save"
    ];
    main.provides = ["run.gui"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var settings = imports.settings;
        var menus = imports.menus;
        var commands = imports.commands;
        var run = imports.run;
        var util = imports.util;
        var c9 = imports.c9;
        var ui = imports.ui;
        var fs = imports.fs;
        var layout = imports.layout;
        var tree = imports.tree;
        var tabs = imports.tabManager;
        var tabbehavior = imports.tabbehavior;
        var debug = imports.debugger;
        var prefs = imports.preferences;
        var c9console = imports.console;
        var ace = imports.ace;
        var save = imports.save;
        var showError = imports["dialog.error"].show;
        var assert = require("c9/assert");

        var Tree = require("ace_tree/tree");
        var TreeData = require("./runcfgdp");

        var basename = require("path").basename;
        var uCaseFirst = require("c9/string").uCaseFirst;

        /***** Initialization *****/

        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();

        var defaultConfigs = options.defaultConfigs;

        var btnRun, lastRun, mnuRunWith, process, mnuRunCfg;
        var model, datagrid, defConfig;

        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;

            // Commands
            commands.addCommand({
                name: "run",
                group: "Run & Debug",
                "hint": "run or debug an application",
                bindKey: { mac: "Option-F5", win: "Alt-F5" },
                exec: function(editor, args) {
                    runNow(null, null, null, args.callback);
                }
            }, plugin);

            commands.addCommand({
                name: "stop",
                group: "Run & Debug",
                "hint": "stop a running node program on the server",
                bindKey: { mac: "Shift-F5", win: "Shift-F5" },
                exec: function() { stop(function() {}); }
            }, plugin);

            commands.addCommand({
                name: "runlast",
                group: "Run & Debug",
                "hint": "run or debug the last run file",
                bindKey: { mac: "F5", win: "F5" },
                exec: function() { runLastFile(); },
                isAvailable: function() {
                    return lastRun ? true : false;
                }
            }, plugin);

            // Tree context menu
            // Needs to be hidden in readonly mode
            var itemCtxTreeRunFile = new ui.item({
                match: "file",
                enabled: !c9.readonly,
                caption: "Run",
                isAvailable: function() {
                    return tree.selectedNode && !tree.selectedNode.isFolder;
                },
                onclick: function() {
                    runNow("auto", tree.selected.replace(/^\//, ""));
                }
            });
            tree.getElement("mnuCtxTree", function(mnuCtxTree) {
                menus.addItemToMenu(mnuCtxTree, itemCtxTreeRunFile, 150, plugin);
            });

            // Check after state.change
            c9.on("stateChange", function(e) {
                // @todo consider moving this to the run plugin
                if (itemCtxTreeRunFile && !c9.readonly)
                    itemCtxTreeRunFile.setAttribute("disabled", !(e.state & c9.PROCESS));
            }, plugin);

            run.on("started", function() {
                if (settings.getBool("user/preview/@running_app")) {
                    commands.exec("preview", null, {
                        server: true,
                        nocheck: true,
                        pane: tabs.getPanes(tabs.container)[0]
                    });
                }
            });

            // Menus
            var c = 1000;
            menus.setRootMenu("Run", 600, plugin);
            var itmRun = new ui.item({
                isAvailable: function() {
                    var tab = tabs.focussedTab;
                    var path = tab && tab.path;

                    if (process && process.running) {
                        itmRun.setAttribute("caption", "Stop");
                        itmRun.setAttribute("command", "stop");
                        return true;
                    }
                    else {
                        var runner = path && getRunner(path);
                        if (runner) {
                            itmRun.setAttribute("command", "run");
                            itmRun.setAttribute("caption", "Run "
                                + basename(path) + " with "
                                + runner.caption);
                            return true;
                        }
                        else {
                            itmRun.setAttribute("command", "run");
                            itmRun.setAttribute("caption", "Run");
                            return false;
                        }
                    }
                }
            });
            menus.addItemByPath("Run/Run", itmRun, c += 100, plugin);
            var itmRunLast = new ui.item({
                command: "runlast",
                isAvailable: function() {
                    if (process && process.running || !lastRun) {
                        itmRunLast.setAttribute("caption", "Run Last");
                        return false;
                    }
                    else {
                        var runner = lastRun[0] == "auto"
                            ? getRunner(lastRun[1])
                            : lastRun[0];

                        itmRunLast.setAttribute("caption", "Run Last ("
                            + basename(lastRun[1]) + ", "
                            + (runner.caption || "auto") + ")");
                        return true;
                    }
                }
            });
            menus.addItemByPath("Run/Run Last", itmRunLast, c += 100, plugin);
            menus.addItemByPath("Run/~", new ui.divider(), c += 100, plugin);

            var lastOpener, preventLoop;
            var mnuRunAs = new ui.menu({
                id: "mnuRunAs",
                "onprop.visible": function(e) {
                    if (e.value && !preventLoop) {
                        run.listRunners(function(err, names) {
                            var nodes = mnuRunAs.childNodes;
                            for (var i = nodes.length - 4; i >= 0; i--) {
                                mnuRunAs.removeChild(nodes[i]);
                            }

                            var c = 300;
                            names.sort().forEach(function(name) {
                                menus.addItemToMenu(mnuRunAs, new ui.item({
                                    caption: uCaseFirst(name),
                                    value: name
                                }), c++, plugin);
                            });

                            if (mnuRunAs.visible && mnuRunAs.opener
                              && mnuRunAs.opener.localName == "button") {
                                preventLoop = true;
                                mnuRunAs.display(null,
                                    null, true, mnuRunAs.opener);
                                preventLoop = false;
                            }
                        });

                        lastOpener = this.opener;

                        // Show edit menu only in Output tab
                        var editMenu = mnuRunAs.childNodes[mnuRunAs.childNodes.length - 1];
                        if (this.opener && this.opener.getAttribute("caption") !== "Run With") {
                            editMenu.setAttribute("visible", true);
                            // Make sure caption doesn't break edit-run-system
                            assert(this.opener.getAttribute("caption").match(/Runner: .*/));
                        }
                        else {
                            editMenu.setAttribute("visible", false);
                        }
                    }
                },
                "onitemclick": function(e) {
                    if (e.value == "new-run-system") {
                        tabs.open({
                            path: settings.get("project/run/@path")
                              + "/My Runner.run",
                            active: true,
                            value: '// Create a custom Cloud9 runner - similar to the Sublime build system\n'
                              + '// For more information see https://docs.c9.io/custom_runners.html\n'
                              + '{\n'
                              + '    "cmd" : ["ls", "$file", "$args"],\n'
                              + '    "info" : "Started $project_path$file_name",\n'
                              + '    "env" : {},\n'
                              + '    "selector" : "source.ext"\n'
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
                    else if (e.value === "edit-run-system") {
                        var runnerName = lastOpener.getAttribute("caption").match(/Runner: (.*)/)[1];
                        var path = settings.get("project/run/@path") + "/" + runnerName + ".run";
                        run.getRunner(runnerName, function(err, runner) {
                            if (err) {
                                showError(err); // warn and continue
                            }
                            if (runner) {
                                delete runner.caption;
                                delete runner.$builtin;
                            }
                            fs.exists(path, function(exists) {
                                tabs.open({
                                    path: path,
                                    active: true,
                                    value: exists
                                      ? undefined
                                      : "// This file overrides the built-in " + runnerName + " runner\n"
                                        + '// For more information see http://docs.c9.io:8080/#!/api/run-method-run\n'
                                        + JSON.stringify(runner, null, 2),
                                    document: !exists && {
                                        meta: {
                                            newfile: true
                                        },
                                        ace: {
                                            customSyntax: "javascript"
                                        }
                                    }
                                }, function() {});
                            });
                        });
                        return;
                    }

                    if (lastOpener && lastOpener.onitemclick)
                        return lastOpener.onitemclick(e.value);

                    run.getRunner(e.value, function(err, runner) {
                        if (err)
                            return showError(err);

                        runNow(runner);
                    });

                    settings.set("project/run/@runner", e.value);
                }
            });
            mnuRunCfg = new ui.menu({
                id: "mnuRunCfg",
                "onprop.visible": function(e) {
                    if (e.value) {
                        var nodes = mnuRunCfg.childNodes;
                        for (var i = nodes.length - 4; i >= 0; i--) {
                            mnuRunCfg.removeChild(nodes[i]);
                        }

                        var configs = settings.getJson("project/run/configs") || {};
                        for (var name in configs) {
                            var c = 0;
                            menus.addItemToMenu(mnuRunCfg, new ui.item({
                                caption: name,
                                value: configs[name]
                            }), c++, plugin);
                        }
                    }
                },
                "onitemclick": function(e) {
                    if (e.value == "new-run-config") {
                        commands.exec("showoutput", null, {});
                        return;
                    }
                    else if (e.value == "manage") {
                        commands.exec("openpreferences", null, {
                            panel: "preferences.project",
                            section: "Run Configuration"
                        });
                        return;
                    }

                    commands.exec("showoutput", null, {
                        run: true,
                        config: e.value
                    });
                }
            });
            plugin.addElement(mnuRunAs, mnuRunCfg);

            menus.addItemByPath("Run/Run With/", mnuRunAs, c += 100, plugin);
            menus.addItemByPath("Run/Run History/", new ui.item({
                isAvailable: function() { return false; }
            }), c += 100, plugin);
            menus.addItemByPath("Run/Run Configurations/", mnuRunCfg, c += 100, plugin);
            
            menus.addItemByPath("Run/~", new ui.divider(), c += 1000, plugin);
            // menus.addItemByPath("Run/Enable Source Maps", new ui.item({
            //     type    : "check",
            //     checked : "project/debug/@sourcemaps"
            // }), c += 100, plugin);
            menus.addItemByPath("Run/Show Debugger at Break", new ui.item({
                type: "check",
                checked: "user/debug/@autoshow"
            }), c += 100, plugin);

            c = 0;
            menus.addItemByPath("Run/Run Configurations/~", new ui.divider(), c += 1000, plugin);
            menus.addItemByPath("Run/Run Configurations/New Run Configuration", new ui.item({
                value: "new-run-config"
            }), c += 100, plugin);
            menus.addItemByPath("Run/Run Configurations/Manage...", new ui.item({
                value: "manage"
            }), c += 100, plugin);

            c = 0;
            menus.addItemByPath("Run/Run With/~", new ui.divider(), c += 1000, plugin);
            menus.addItemByPath("Run/Run With/New Runner", new ui.item({
                value: "new-run-system"
            }), c += 100, plugin);
            menus.addItemByPath("Run/Run With/Edit Runner", new ui.item({
                value: "edit-run-system"
            }), c += 100, plugin);

            // Other Menus
            
            menus.addItemToMenu(tabs.getElement("mnuEditors"), 
                new ui.item({
                    caption: "New Run Configuration",
                    hotkey: "commands.showoutput",
                    onclick: function(e) {
                        commands.exec("showoutput", null, {
                            pane: this.parentNode.pane
                        });
                    }
                }), 250, plugin);

            var mnuContext = tabbehavior.contextMenu;
            // menus.addItemByPath("~", new ui.divider(), 800, mnuContext, plugin);
            menus.addItemByPath("Run This File", new ui.item({
                onclick: function() {
                    var tab = mnuContext.$tab;
                    if (tab && tab.path)
                        runNow("auto", tab.path.replace(/^\//, ""));
                },
                isAvailable: function() {
                    var tab = mnuContext.$tab;
                    return tab && tab.path && (!process || !process.running);
                }
            }), 150, mnuContext, plugin);

            // Draw
            draw();

            // Preferences
            prefs.add({
                "Run": {
                    position: 600,
                    "Run & Debug": {
                        position: 100,
                        "Save All Unsaved Tabs Before Running": {
                           type: "checkbox",
                           path: "user/runconfig/@saveallbeforerun",
                           position: 100
                        }
                    }
                }
            }, plugin);

            prefs.add({
                "Project": {
                    "Run & Debug": {
                        position: 300,
                        "Runner Path in Workspace": {
                            type: "textbox",
                            path: "project/run/@path",
                            position: 1000
                        }
                    },
                    "Run Configurations": {
                        position: 200,
                        "Run Configurations": {
                            type: "custom",
                            name: "runcfg",
                            title: "Run Configurations",
                            position: 120,
                            node: new ui.bar({
                                style: "padding:10px"
                            })
                        }
                    }
                }
            }, plugin);

            plugin.getElement("runcfg", function(hbox) {
                model = new TreeData();
                model.emptyMessage = "No run configurations";

                model.columns = [{
                    caption: "Name",
                    value: "name",
                    width: "15%",
                }, {
                    caption: "Command",
                    value: "command",
                    width: "30%",
                }, {
                    caption: "CWD",
                    value: "cwd",
                    width: "15%"
                }, {
                    caption: "Debug",
                    value: "debug",
                    width: "10%"
                }, {
                    caption: "Runner",
                    value: "runner",
                    width: "20%"
                }, {
                    caption: "Default",
                    value: "default",
                    width: "10%"
                }];
                
                layout.on("eachTheme", function(e) {
                    var height = parseInt(ui.getStyleRule(".bar-preferences .blackdg .tree-row", "height"), 10) || 24;
                    model.rowHeightInner = height;
                    model.rowHeight = height;
                    
                    if (e.changed) (datagrid).resize(true);
                });

                var container = hbox.$ext.appendChild(document.createElement("div"));
                container.style.width = "600px";
                container.style.marginBottom = "30px";

                datagrid = new Tree(container);
                datagrid.setTheme({ cssClass: "blackdg" });
                datagrid.setOption("maxLines", 200);
                datagrid.setDataProvider(model);

                datagrid.on("afterChoose", function() {
                    var nodes = datagrid.selection.getSelectedNodes();
                    var cfgs = settings.getJson("project/run/configs");
                    nodes.forEach(function (node) {
                        commands.exec("showoutput", null, {
                            config: cfgs[node.name]
                        });
                    });
                });

                datagrid.on("delete", function(e) {
                    var nodes = datagrid.selection.getSelectedNodes();
                    nodes.forEach(function (node) {
                        removeConfig(node.name);
                        datagrid.provider._signal("remove", node);
                    });
                });

                new ui.hbox({
                    htmlNode: container.parentNode,
                    style: "position:absolute;left:10px;bottom:10px",
                    childNodes: [
                        new ui.button({
                            caption: "Remove Selected Configs",
                            skin: "c9-toolbarbutton-glossy",
                            onclick: function() {
                                datagrid.execCommand("delete");
                            }
                        }),
                        new ui.button({
                            caption: "Add New Config",
                            skin: "c9-toolbarbutton-glossy",
                            onclick: function() {
                                commands.exec("showoutput", null, {});
                            }
                        }),
                        new ui.button({
                            caption: "Set As Default",
                            skin: "c9-toolbarbutton-glossy",
                            onclick: function() {
                                var node = datagrid.selection.getSelectedNodes()[0];
                                if (!node) return;
        
                                var json = settings.getJson("project/run/configs") || {};
                                var wasDefault = json[node.name]["default"];
                                for (var name in json) { delete json[name]["default"]; }
                                json[node.name]["default"] = !wasDefault;
                                settings.setJson("project/run/configs", json);
        
                                defConfig = wasDefault ? null : node.name;
        
                                reloadModel();
                                transformButton();
                            }
                        })
                    ]
                });

                reloadModel();
            }, plugin);

            // settings
            settings.on("read", function(e) {
                settings.setDefaults("user/runconfig", [
                    ["saveallbeforerun", true],
                    ["debug", true],
                    ["showruncfglist", false]
                ]);

                if (!settings.getBool("project/run/configs/@inited")) {
                    settings.setJson("project/run/configs", defaultConfigs);
                    settings.set("project/run/configs/@inited", "true");
                }

                var json = settings.getJson("project/run/configs") || {};
                for (var name in json) {
                    if (json[name]["default"]) {
                        defConfig = name;
                        break;
                    }
                }
                transformButton();

                var state = settings.get("state/run/process");
                if (state) {
                    run.on("create", function wait(e) {
                        if (e.process.name == state) {
                            process = e.process;

                            decorateProcess();
                            transformButton("stop");

                            run.off("create", wait);
                        }
                    });
                }
            }, plugin);

            settings.on("project/run/configs", function() {
                reloadModel();
            }, plugin);

            tabs.on("focus", function(e) {
                if (process && process.running)
                    return;

                transformButton();
            }, plugin);

            tabs.on("tabDestroy", function(e) {
                if (e.last && !defConfig && !tabs.focussedTab) {
                    btnRun.disable();
                    btnRun.setAttribute("tooltip", "");
                }
            }, plugin);

            var activateOutput = function(plugin) {
                plugin.getTabs().forEach(function(tab) {
                    if (tab.editorType != "output") return;
                    if (tab.document.getSession()) return;

                    var state = tab.document.getState();
                    if ((state.output.running || false).debug) {
                        // Get editor and create it if it's not in the current pane
                        tab.pane.createEditor(tab.editorType, function(err, editor) {
                            editor.loadDocument(tab.document);
                        });
                    }
                });
            };
            tabs.once("ready", activateOutput.bind(this, tabs));
            c9console.once("ready", activateOutput.bind(this, c9console));

            ace.getElement("menu", function(menu) {
                menus.addItemToMenu(menu, new ui.item({
                    caption: "Run This File",
                    command: "run",
                }), 800, plugin);
                menus.addItemToMenu(menu, new ui.divider(), 900, plugin);
            });
        }

        var drawn = false;
        function draw() {
            if (drawn) return;
            drawn = true;

            // Menus
            btnRun = ui.insertByIndex(layout.findParent(plugin),
              new ui.button({
                id: "btnRun",
                skin: "c9-toolbarbutton-glossy",
                command: "run",
                caption: "Run",
                disabled: true,
                class: "runbtn stopped",
                icon: true,
            }), 100, plugin);

            btnRun.on("contextmenu", function(e) {
                mnuRunCfg.display(e.x, e.y);
                return false;
            });

            emit("draw");
        }

        /***** Helper Methods *****/

        function removeConfig(name) {
            var cfgs = settings.getJson("project/run/configs");
            if (!cfgs) return;

            delete cfgs[name];
            settings.setJson("project/run/configs", cfgs);
        }

        function reloadModel() {
            if (!model) return;

            var cfgs = settings.getJson("project/run/configs") || {};
            var nodes = Object.keys(cfgs).map(function(name) {
                return cfgs[name];
            }).sort();

            model.setRoot({ children: nodes });

            defConfig = null;
            for (var name in cfgs) {
                if (cfgs[name]["default"]) {
                    defConfig = name;
                    break;
                }
            }
            transformButton();
        }

        /***** Methods *****/

        function getRunner(path) {
            var ext = path && fs.getExtension(path);
            for (var name in run.runners) {
                if (run.runners[name].selector == "source." + ext)
                    return run.runners[name];
            }
            return false;
        }

        function runNow(runner, path, isEscapedPath, callback) {
            if (!path && !defConfig) {
                path = findTabToRun() || "";
                // if (!path) return;
            }

            if (settings.getBool("user/runconfig/@saveallbeforerun"))
                save.saveAll({ skipNewFiles: true }, start);
            else
                start();

            function start() {
                if (process && process.running)
                    stop(done);
                else
                    done();
            }

            function done() {
                if (!runner)
                    runner = "auto";

                var config;
                if (defConfig && !path) {
                    var configs = settings.getJson("project/run/configs") || {};
                    config = configs[defConfig];
                }
                else {
                    config = {
                        runner: runner.caption || runner,
                        command: isEscapedPath ? path : util.escapeShell(path)
                    };
                }
                var id;
                if (defConfig && config.name == defConfig) {
                    id = "output-default";
                    if (config.name) {
                        id += config.name.replace(/[^\w]/g, function(i) {
                            return "-" + i.charCodeAt(0).toString(36);
                        });
                    }
                }
                
                commands.exec("showoutput", null, {
                    runner: runner,
                    run: true,
                    config: config,
                    id: id,
                    callback: function(proc, tab) {
                        if (defConfig) {
                            process = proc;
                            decorateProcess();
                            transformButton("stop");

                            settings.set("state/run/process", process.name);

                        }

                        callback && callback(proc, tab);
                    }
                });
            }

            lastRun = [runner, path];
        }

        function decorateProcess() {
            process.on("away", function() {
                btnRun.disable();
            }, plugin);
            process.on("back", function() {
                btnRun.enable();
            }, plugin);
            process.on("stopping", function() {
                btnRun.disable();
            }, plugin);
            process.on("stopped", function() {
                btnRun.enable();

                var path = transformButton();
                if (path || lastRun || defConfig)
                    btnRun.enable();
                else
                    btnRun.disable();

                settings.set("state/run/process", "");
            }, plugin);
        }

        function findTabToRun() {
            var path = tabs.focussedTab && tabs.focussedTab.path;
            if (path) return path.replace(/^\//, "");

            var foundActive;
            if (tabs.getPanes().every(function(pane) {
                var tab = pane.activeTab;
                if (tab && tab.path) {
                    if (foundActive) return false;
                    foundActive = tab;
                }
                return true;
            }) && foundActive) {
                return foundActive.path.replace(/^\//, "");
            }

            return false;
        }

        function transformButton(to) {
            if (to == "stop") {
                btnRun.setAttribute("command", "stop");
                btnRun.setAttribute("caption", "Stop");
                btnRun.setAttribute("tooltip", "");
                btnRun.setAttribute("class", "runbtn running");
                btnRun.enable();

                return btnRun;
            }
            else {
                btnRun.setAttribute("class", "runbtn stopped");

                var path = findTabToRun();
                if (path && emit("updateRunButton", { 
                    path: /[~\/]/.test(path.charAt(0)) ? path : "/" + path, 
                    button: btnRun 
                }) === false) {
                    return;
                }
                else if (defConfig) {
                    btnRun.setAttribute("caption", "Run Project");
                    btnRun.setAttribute("tooltip", "");
                    btnRun.setAttribute("command", "run");
                    btnRun.setAttribute("disabled", "false");
                }
                else if (path) {
                    btnRun.enable();
                    btnRun.setAttribute("command", "run");
                    btnRun.setAttribute("caption", "Run");
                    btnRun.setAttribute("tooltip", "Run "
                        + basename(path));
                }
                else if (lastRun) {
                    var runner = lastRun[0] == "auto"
                        ? getRunner(lastRun[1])
                        : lastRun[0];

                    btnRun.enable();
                    btnRun.setAttribute("command", "runlast");
                    btnRun.setAttribute("caption", "Run Last");
                    btnRun.setAttribute("tooltip", "Run Last ("
                        + basename(lastRun[1]) + ", "
                        + (runner && runner.caption || "auto") + ")");
                }
                else {
                    btnRun.disable();
                    btnRun.setAttribute("caption", "Run");
                    btnRun.setAttribute("tooltip", "");
                }
            }
        }

        function stop(callback) {
            if (process)
                process.stop(function(err) {
                    if (err) {
                        showError(err.message || err);
                        transformButton();
                    }

                    debug.stop();

                    callback(err);
                });
        }

        function runLastFile() {
            if (lastRun)
                runNow(lastRun[0], lastRun[1], true);
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
            drawn = false;
        });

        /***** Register and define API *****/

        /**
         * UI for the {@link run} plugin. This plugin is responsible for the Run
         * menu in the main menu bar, as well as the settings and the
         * preferences UI for the run plugin.
         * @singleton
         */
        /**
         * @command run Runs the currently focussed tab.
         */
        /**
         * @command stop Stops the running process.
         */
        /**
         * @command runlast Stops the last run file
         */
        plugin.freezePublicAPI({
            get lastRun() { return lastRun; },
            set lastRun(lr) { lastRun = lr; },

            /**
             *
             */
            transformButton: transformButton
        });

        register(null, {
            "run.gui": plugin
        });
    }
});
