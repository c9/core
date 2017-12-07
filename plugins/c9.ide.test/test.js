define(function(require, exports, module) {
    main.consumes = [
        "Panel", "ui", "settings", "panels", "menus", "commands", "Menu", 
        "MenuItem", "Divider", "tabManager", "fs", "dialog.error", "c9",
        "preferences.experimental", "save", "watcher"
    ];
    main.provides = ["test"];
    return main;

    function main(options, imports, register) {
        var Panel = imports.Panel;
        var ui = imports.ui;
        var settings = imports.settings;
        var panels = imports.panels;
        var menus = imports.menus;
        var commands = imports.commands;
        var tabManager = imports.tabManager;
        var Menu = imports.Menu;
        var MenuItem = imports.MenuItem;
        var Divider = imports.Divider;
        var fs = imports.fs;
        var c9 = imports.c9;
        var save = imports.save;
        var watcher = imports.watcher;
        var showError = imports["dialog.error"].show;
        var experimental = imports["preferences.experimental"];
        
        var Coverage = require("./data/coverage");
        var File = require("./data/file");
        var TestSet = require("./data/testset");
        var Test = require("./data/test");
        var Node = require("./data/node");
        var Data = require("./data/data");
        
        // Destructive conversion process
        Data.fromJSON = function(list) {
            return list.map(function(node) {
                if (node instanceof Data) return node;
                if (node.items) node.items = Data.fromJSON(node.items);
                
                if (node.type == "file")
                    return new File(node);
                if (node.type == "testset")
                    return new TestSet(node);
                if (node.type == "test")
                    return new Test(node);
                if (node.type == "prepare")
                    return new Node(node);
                    
                // TODO what should happen with other types
                console.error("unhandled type ", node);
            }).filter(Boolean);
        };
        
        var ENABLED = options.enabled 
            || experimental.addExperiment("test", false, "Panels/Test Panel");
        
        if (!ENABLED && !options.enabled) {
            return register(null, {
                "test": {
                    Coverage: Coverage,
                    File: File,
                    TestSet: TestSet,
                    Test: Test,
                    Node: Node,
                    
                    runners: [],
                    
                    register: function() {},
                    unregister: function() {},
                    on: function() {},
                    once: function() {},
                    inactive: true
                }
            });
        }
        
        /***** Initialization *****/
        
        var plugin = new Panel("Ajax.org", main.consumes, {
            index: options.index || 400,
            caption: "Test",
            buttonCSSClass: "test",
            minWidth: 150,
            where: options.where || "left"
        });
        var emit = plugin.getEmitter();
        
        var configPath = options.configPath || "/.c9/test.settings.yml";
        var config, ready;
        
        var runners = [];
        var toolbar, container, btnRun, focussedPanel, mnuRun, mnuSettings;
        var lastTest;
        
        function load() {
            plugin.setCommand({
                name: "showtestpanel"
                // hint: "search for a command and execute it",
                // bindKey: { mac: "Command-.", win: "Ctrl-." }
            });
            
            commands.addCommand({
                name: "runtest",
                hint: "runs the selected test(s) in the test panel",
                // bindKey: { mac: "F6", win: "Ctrl-F5" },
                group: "Test",
                exec: function(editor, args) {
                    if (settings.getBool("user/test/coverage/@alwayson"))
                        return commands.exec("runtestwithcoverage", editor, args);
                    
                    transformRunButton("stop");
                    focussedPanel.run(args.nodes || null, {
                        transformRun: args.transformRun
                    }, function(err, nodes) {
                        transformRunButton("run");
                        if (err) return console.log(err);
                        
                        if (nodes) {
                            nodes.forEach(function(node) {
                                emit(node.coverage
                                    ? "coverage"
                                    : "clearCoverage", { node: node });
                            });
                        }
                    });
                },
                isAvailable: function() {
                    return focussedPanel ? true : false;
                }
            }, plugin);

            commands.addCommand({
                name: "runfocussedtest",
                hint: "runs the focussed test or last run test",
                bindKey: { mac: "F6", win: "Ctrl-F5" },
                group: "Test",
                exec: function(editor, args) {
                    var path = tabManager.focussedTab.path;
                    var test = focussedPanel.findFileByPath(path);
                    return commands.exec("runtest", editor, { 
                        nodes: test ? [test] : lastTest,
                        transformRun: true
                    });
                },
                isAvailable: function() {
                    var path = (tabManager.focussedTab || 0).path;
                    return focussedPanel && (focussedPanel.findFileByPath(path) || lastTest)
                        ? true : false;
                }
            }, plugin);

            commands.addCommand({
                name: "runfocussedtestwithcoverage",
                hint: "runs the focussed test or last run test with code coverage",
                bindKey: { mac: "Shift-F6", win: "Ctrl-Shift-F5" },
                group: "Test",
                exec: function(editor, args) {
                    var path = tabManager.focussedTab.path;
                    var test = focussedPanel.findFileByPath(path);
                    return commands.exec("runtestwithcoverage", editor, { 
                        nodes: test ? [test] : lastTest,
                        transformRun: true
                    });
                },
                isAvailable: function() {
                    var path = (tabManager.focussedTab || 0).path;
                    return focussedPanel && (focussedPanel.findFileByPath(path) || lastTest) 
                        ? true : false;
                }
            }, plugin);

            commands.addCommand({
                name: "runtestwithcoverage",
                hint: "runs the selected test(s) in the test panel with code coverage enabled",
                // bindKey: { mac: "Shift-F6", win: "Ctrl-Shift-F5" },
                group: "Test",
                exec: function(editor, args) {
                    transformRunButton("stop");
                    focussedPanel.run(args.nodes || null, { 
                        withCodeCoverage: true 
                    }, function(err, nodes) {
                        transformRunButton("run");
                        if (err) return console.log(err);
                        
                        if (nodes) {
                            nodes.forEach(function(node) {
                                emit(node.coverage
                                    ? "coverage"
                                    : "clearCoverage", { node: node });
                            });
                        }
                    });
                },
                isAvailable: function() {
                    return focussedPanel ? true : false;
                }
            }, plugin);
            
            commands.addCommand({
                name: "stoptest",
                // hint: "runs the selected test(s) in the test panel",
                // bindKey: { mac: "Command-O", win: "Ctrl-O" },
                group: "Test",
                exec: function(editor, args) {
                    btnRun.disable();
                    focussedPanel.stop(function() {
                        btnRun.enable();
                    });
                },
                isAvailable: function() {
                    return focussedPanel ? true : false;
                }
            }, plugin);
            
            commands.addCommand({
                name: "cleartestresults",
                // hint: "runs the selected test(s) in the test panel",
                // bindKey: { mac: "Command-O", win: "Ctrl-O" },
                group: "Test",
                exec: function() {
                    emit("clear");
                }
            }, plugin);
            
            commands.addCommand({
                name: "skiptest",
                // hint: "runs the selected test(s) in the test panel",
                // bindKey: { mac: "Command-O", win: "Ctrl-O" },
                group: "Test",
                exec: function() {
                    focussedPanel.skip(function() {});
                },
                isAvailable: function() {
                    return focussedPanel && focussedPanel.tree 
                      && focussedPanel.tree.selectedNodes.some(function(n) {
                        if (n.type == "file") return true;
                    });
                }
            }, plugin);
            
            commands.addCommand({
                name: "removetest",
                // hint: "runs the selected test(s) in the test panel",
                // bindKey: { mac: "Command-O", win: "Ctrl-O" },
                group: "Test",
                exec: function() {
                    focussedPanel.remove(function() {});
                },
                isAvailable: function() {
                    return focussedPanel && focussedPanel.tree 
                      && focussedPanel.tree.selectedNodes.some(function(n) {
                        if (n.type == "file") return true;
                    });
                }
            }, plugin);
            
            commands.addCommand({
                name: "opentestoutput",
                // hint: "runs the selected test(s) in the test panel",
                // bindKey: { mac: "Command-O", win: "Ctrl-O" },
                group: "Test",
                exec: function(args) {
                    var nodes = args.nodes || focussedPanel.tree.selectedNodes;
                    nodes.forEach(function(n) {
                        var output = (n.findFileNode() || 0).fullOutput;
                        if (!output) return;
                        
                        tabManager.open({
                            editorType: "ace",
                            focus: true,
                            document: {
                                title: "Raw Test Output",
                                meta: {
                                    nofs: true,
                                    ignoreState: true
                                }
                            },
                            value: output
                        }, function() {});
                    });
                },
                isAvailable: function() {
                    return focussedPanel && focussedPanel.tree 
                      && focussedPanel.tree.selectedNodes.some(function(n) {
                        return (n.findFileNode() || 0).fullOutput || false;
                    });
                }
            }, plugin);
            
            menus.addItemByPath("Cloud9/Open Your Test Configuration", new ui.item({
                onclick: openTestConfigFile
            }), 900, plugin);
            
            function readConfig(cb) {
                fs.readFile(configPath, function(err, data) {
                    if (err && err.code != "ENOENT")
                        return showError("Could not load " + configPath 
                            + ". The test panel is disabled. Please restart " 
                            + "Cloud9 to retry.");
                    
                    parse(data || "");
                    
                    cb && cb();
                    
                    ready = true;
                    emit.sticky("ready");
                });
            }
            readConfig(function() {
                watcher.watch(configPath);
                watcher.on("change", function(e) {
                    if (e.path == configPath) {
                        readConfig(function() {
                            emit("updateConfig");
                        });
                    }
                });
            });
            
            save.on("afterSave", function(e) {
                if (e.path == configPath) {
                    parse(e.value);
                    emit("updateConfig");
                }
            }, plugin);
        }
        
        var drawnMenu = false;
        function drawMenu() {
            if (drawnMenu) return;
            drawnMenu = true;
            
            menus.addItemByPath("Run/Run Test", new ui.item({
                command: "runfocussedtest"
            }), 1250, plugin);
            menus.addItemByPath("Run/Run Test with Code Coverage", new ui.item({
                command: "runfocussedtestwithcoverage"
            }), 1260, plugin);
        }
        
        var drawn = false;
        function draw(opts) {
            if (drawn) return;
            drawn = true;
            
            // Splitbox
            var vbox = opts.aml.appendChild(new ui.vbox({ 
                anchors: "0 0 0 0" 
            }));
            
            // Toolbar
            toolbar = vbox.appendChild(new ui.hbox({
                id: "toolbar",
                class: "toolbar-top",
                align: "center",
                edge: "0 2 0 0",
                // padding: 3
                // class: "fakehbox aligncenter debugger_buttons basic",
                // style: "white-space:nowrap !important;"
                style: "border-top:0"
            }));
            plugin.addElement(toolbar);
            
            // Run Menu
            var emptyLabel = new ui.label({ caption: "No Settings " });
            mnuRun = new ui.menu({ class: "runner-config-menu" });
            mnuRun.addEventListener("prop.visible", function(e) {
                if (!e.value) return;
                
                var runners = [], found = {};
                
                for (var i = mnuRun.childNodes.length - 1; i >= 0; i--) {
                    mnuRun.removeChild(mnuRun.childNodes[i]);
                }
                
                if (focussedPanel.tree.selectedNode) {
                    focussedPanel.tree.selectedNodes.forEach(function(n) {
                        if (n.type == "all" || n.type == "root" || n.type == "runner") {
                            n.findAllNodes("runner").forEach(function(n) {
                                var runner = n.runner;
                                if (found[n.name]) return;
                                found[n.name] = true;
                                runners.push(runner);
                            });
                        }
                        else {
                            var runner = n.findRunner();
                            if (found[runner.name]) return;
                            found[runner.name] = true;
                            runners.push(runner);
                        }
                    });
                }
                
                if (emit("showRunMenu", { 
                    menu: mnuRun, 
                    runners: runners 
                }) !== false && !runners.length) {
                    mnuRun.appendChild(emptyLabel);
                    return;
                }
                
                runners.forEach(function(runner) {
                    if (runner.form) {
                        if (!runner.meta.$label) {
                            runner.meta.$label = new ui.label({
                                caption: runner.root.label.toLowerCase(),
                                class: "runner-form-header"
                            });
                        }
                        mnuRun.appendChild(runner.meta.$label);
                        runner.form.attachTo(mnuRun);
                    }
                });
            });
            
            // Buttons
            btnRun = ui.insertByIndex(toolbar, new ui.splitbutton({
                caption: "Run",
                icon: "run.png",
                skinset: "default",
                skin: "c9-menu-btn",
                class: "runtestbtn stopped",
                command: "runtest",
                submenu: mnuRun
            }), 100, plugin);
            
            ui.insertByIndex(toolbar, new ui.button({
                caption: "Clear",
                skinset: "default",
                skin: "c9-menu-btn",
                command: "cleartestresults"
            }), 100, plugin);
            
            mnuSettings = new Menu({ items: [
                new MenuItem({ caption: "Refresh", onclick: refresh }),
                new Divider()
            ]}, plugin);
            
            opts.aml.appendChild(new ui.button({
                skin: "header-btn",
                class: "panel-settings",
                style: "top:46px",
                submenu: mnuSettings.aml
            }));
            
            // Container
            container = vbox.appendChild(new ui.bar({
                style: "flex:1;display:flex;flex-direction: column;"
            }));
            
            emit.sticky("drawPanels", { html: container.$int, aml: container });
        }
        
        /***** Methods *****/
        
        function registerTestRunner(runner) {
            drawMenu();
            
            runners.push(runner);
            
            emit("register", { runner: runner });
        }
        
        function unregisterTestRunner(runner) {
            runners.splice(runners.indexOf(runner), 1);
            
            emit("unregister", { runner: runner });
        }
        
        function transformRunButton(type) {
            if (!drawn) return;
            btnRun.setAttribute("caption", type == "stop" ? "Stop" : "Run");
            btnRun.setAttribute("command", type == "stop" ? "stoptest" : "runtest");
            btnRun.setAttribute("class", "runtestbtn " + (type == "stop" ? "running" : "stopped"));
        }
        
        // TODO: https://github.com/tj/js-yaml/blob/master/lib/yaml.js
        // OR: https://github.com/jeremyfa/yaml.js/blob/develop/dist/yaml.min.js
        function convertToType(x) {
            if (x.toLowerCase() == "true") return true;
            if (x.toLowerCase() == "false") return false;
            if (typeof parseFloat(x) == "number") return parseFloat(x);
            throw new Error("Unknown Type");
        }
        function parse(data) {
            if (!config) config = {};
            
            var keepNewline, stack = [config], top = config, name, create, value;
                
            data.split("\n").forEach(function(rawLine) {
                // line = line.trim();
                var line = rawLine.split("#")[0].trimRight();
                
                if (line.match(/^\s*([\w-_ ]*):(\s?[|>]?)(.*)$/)) {
                    // stack.pop(); top = stack[stack.length - 1];
                    top = config; // Fucks use of stack, but will fix later
                    
                    name = RegExp.$1;
                    create = true;
                    keepNewline = RegExp.$2 == "|";  // Not used
                    value = RegExp.$3;
                    
                    if (value.trim()) {
                        top[name] = convertToType(value);
                    }
                }
                else if (line.match(/^\s*- (.*)$/)) {
                    if (create) {
                        stack.push(top = top[name] = {});
                        create = false;
                    }
                    
                    top[RegExp.$1] = rawLine.replace(/^\s*- /, ""); // Not according to spec, but more useful
                }
                else if (line.match(/ {2}(.*)/)) {
                    if (create) {
                        top[name] = "";
                        stack.push(-1);
                        create = false;
                    }
                    
                    top[name] += RegExp.$1 += "\n";
                }
            });
            
            if (stack.pop() == -1 && typeof top[name] === "string") 
                top[name] = top[name].substr(0, top[name].length - 1); // Remove last \n of strings
            
            return config;
        }
        
        function saveConfig(callback) {
            var contents = "";
            
            var item;
            for (var prop in config) {
                contents += prop + ":";
                
                item = config[prop];
                if (typeof item == "object") {
                    contents += "\n";
                    for (var name in item) {
                        contents += "  - " 
                          + (typeof item[name] == "string" ? item[name] : name)
                          + "\n";
                    }
                }
                else if (typeof item == "boolean") {
                    contents += " " + item.toString();
                }
                else if (typeof item == "number") {
                    contents += " " + item.toString();
                }
                else {
                    contents += " |\n";
                    contents += "  " + item.toString().split("\n").join("\n  ");
                }
                
                contents += "\n";
            }
            
            fs.writeFile(configPath, contents, callback);
            
            emit("updateConfig");
        }
        
        function resize() {
            emit("resize");
        }
        
        function refresh() {
            emit("update");
        }
        
        function setCoverage(node) {
            emit("coverage", { node: node });
        }
        
        function clearCoverage(node) {
            emit("clearCoverage", { node: node });
        }
        
        function openTestConfigFile() {
            tabManager.open({
                path: configPath,
                newOnError: true,
                value: "excluded:\n  - \n\nskipped:\n  - \n",
                focus: true
            }, function() {});
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("draw", function(e) {
            draw(e);
        });
        plugin.on("enable", function() {
            
        });
        plugin.on("disable", function() {
            
        });
        plugin.on("show", function(e) {
            
        });
        plugin.on("hide", function(e) {
            
        });
        plugin.on("unload", function() {
            drawn = false;
            drawnMenu = false;
            toolbar = null;
            lastTest = null;
            container = null;
            config = null;
            ready = null;
            runners = [];
            btnRun = null;
            focussedPanel = null;
            mnuRun = null;
            mnuSettings = null;
        });
        
        /***** Register and define API *****/
        
        /**
         * 
         */
        plugin.freezePublicAPI({
            Coverage: Coverage,
            File: File,
            TestSet: TestSet,
            Test: Test,
            Node: Node,
            
            /**
             * 
             */
            get ready() { return ready; },
            
            /**
             * 
             */
            get drawn() { return drawn; },
            
            /**
             * 
             */
            get config() { return config; },
            
            /**
             * 
             */
            get runners() { return runners; },
            
            /**
             * 
             */
            get settingsMenu() { return mnuSettings; },
            
            /**
             * 
             */
            get focussedPanel() { return focussedPanel; },
            set focussedPanel(v) { focussedPanel = v; },
            
            /**
             * 
             */
            get lastTest() { return lastTest; },
            set lastTest(v) { lastTest = v; },
            
            /**
             * 
             */
            saveConfig: saveConfig,
            
            /**
             * 
             */
            resize: resize,
            
            /**
             * 
             */
            refresh: refresh,
            
            /**
             * 
             */
            register: registerTestRunner,
            
            /**
             * 
             */
            unregister: unregisterTestRunner,
            
            /**
             * 
             */
            setCoverage: setCoverage,
            
            /**
             * 
             */
            clearCoverage: clearCoverage,
            
            /**
             * 
             */
            transformRunButton: transformRunButton
        });
        
        register(null, {
            test: plugin
        });
    }
});
