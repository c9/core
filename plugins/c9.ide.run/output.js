define(function(require, exports, module) {
    main.consumes = [
        "Editor", "editors", "util", "commands", "terminal",
        "settings", "ui", "proc", "tabManager", "run", "console", "run.gui",
        "layout", "debugger", "settings", "dialog.question", "c9", "preferences",
        "dialog.error", "dialog.file", "dialog.alert"
    ];
    main.provides = ["output"];
    return main;

    // On line 894 trigger connect to output or connect after process is started
    // add special case in terminal.js to not auto connect when isOutput

    function main(options, imports, register) {
        var editors = imports.editors;
        var ui = imports.ui;
        var c9 = imports.c9;
        var commands = imports.commands;
        var console = imports.console;
        var layout = imports.layout;
        var tabs = imports.tabManager;
        var util = imports.util;
        var run = imports.run;
        var prefs = imports.preferences;
        var runGui = imports["run.gui"];
        var question = imports["dialog.question"];
        var showError = imports["dialog.error"].show;
        var showAlert = imports["dialog.alert"].show;
        var showSave = imports["dialog.file"].show;
        var Terminal = imports.terminal.Terminal;
        var debug = imports.debugger;
        var settings = imports.settings;
        
        var join = require("path").join;
        var markup = require("text!./output.xml");

        var keys = require("ace/lib/keys");
        var Tree = require("ace_tree/tree");
        var TreeData = require("ace_tree/data_provider");
        var TreeEditor = require("ace_tree/edit");
        
        var basePath = options.basePath;
        
        // Set up the generic handle
        var handle = editors.register("output", "Output", Output, []);
        var handleEmit = handle.getEmitter();

        var defaults = {
            "flat-light": ["#e0e5e7", "#333333", "#aebabf"],
            "flat-dark": ["#003a58", "#FFFFFF", "#225477"],
            "light": ["#eef7ff", "#333333", "#89c1ff"],
            "light-gray": ["#eef7ff", "#333333", "#89c1ff"],
            "dark": ["#003a58", "#FFFFFF", "#225477"],
            "dark-gray": ["#003a58", "#FFFFFF", "#225477"]
        };

        handle.on("load", function() {
            // Import CSS
            ui.insertCss(require("text!./style.css"), null, handle);

            commands.addCommand({
                name: "showoutput",
                group: "Panels",
                exec: function (editor, argv) {
                    if (!argv) argv = false;
                    var id = argv.id;
                    var cmd = argv.config && argv.config.command;

                    if (id === undefined)
                        id = getOutputId();

                    // Search for the output pane
                    if (search(id, cmd, argv)) return;

                    // If not found show the console
                    console.show();

                    // Search again
                    if (search(id, cmd, argv)) return;
                    
                    var config = argv.config || {};
                    if (config.debug === undefined && debug.state != "disconnected")
                        config.debug = false;

                    if (config.toolbar === undefined)
                        config.toolbar = true;

                    // Else open the output panel in the console
                    tabs.open({
                        editorType: "output",
                        active: true,
                        pane: argv.pane || console.getPanes()[0],
                        document: {
                            title: "Output",
                            output: {
                                id: id || "output",
                                config: config,
                                runner: argv.runner || config.runner,
                                run: argv.run,
                                callback: argv.callback
                            }
                        }
                    }, function() {});
                }
            }, handle);

            function setSettings() {
                var cname = ".output .c9terminal .c9terminalcontainer .terminal";
                var sname = ".output .c9terminal .c9terminalcontainer";
                var fcolor = settings.get("user/output/@foregroundColor");
                var bcolor = settings.get("user/output/@backgroundColor");
                var scolor = settings.get("user/output/@selectionColor");
                [
                    [cname, "color", fcolor || "rgb(255,255,255)"],
                    [sname, "backgroundColor", bcolor || "rgb(25, 34, 39)"],
                    [cname + " .ace_selection", "backgroundColor", scolor || "rgb(81, 93, 119)"]
                ].forEach(function(i) {
                    ui.setStyleRule(i[0], i[1], i[2]);
                });

                handleEmit("settingsUpdate");
            }

            settings.on("read", function(e) {
                var skin = settings.get("user/general/@skin");
                var colors = defaults[skin] || defaults["dark"];

                settings.setDefaults("user/output", [
                    ["backgroundColor", colors[0]],
                    ["foregroundColor", colors[1]],
                    ["selectionColor", colors[2]],
                    ["nosavequestion", false],
                    ["keepOutput", false]
                ]);

                setSettings();
            }, handle);

            settings.on("user/output", setSettings);

            layout.on("validateThemeChange", function(e) {
                var oldColors = defaults[e.oldTheme];
                var newColors = defaults[e.theme];
                var colors = [
                    settings.get("user/output/@backgroundColor"),
                    settings.get("user/output/@foregroundColor"),
                    settings.get("user/output/@selectionColor"),
                ];
                var matchesOldTheme = oldColors && oldColors.toString() == colors.toString();
                var matchesNewTheme = newColors && newColors.toString() == colors.toString();
                if (!matchesOldTheme && !matchesNewTheme)
                    return false;
            });

            layout.on("themeDefaults", function(e) {
                var colors = defaults[e.theme];
                if (!colors) return;
                settings.set("user/output/@backgroundColor", colors[0]);
                settings.set("user/output/@foregroundColor", colors[1]);
                settings.set("user/output/@selectionColor", colors[2]);
            }, handle);

            // Settings UI

            prefs.add({
                "Editors": {
                    "Output": {
                        position: 130,
                        "Text Color": {
                           type: "colorbox",
                           path: "user/output/@foregroundColor",
                           position: 10100
                        },
                        "Background Color": {
                           type: "colorbox",
                           path: "user/output/@backgroundColor",
                           position: 10200
                        },
                        "Selection Color": {
                           type: "colorbox",
                           path: "user/output/@selectionColor",
                           position: 10250
                        },
                        "Warn Before Closing Unnamed Configuration": {
                           type: "checkbox",
                           path: "user/output/@nosavequestion",
                           position: 10300
                        },
                        "Preserve log between runs": {
                           type: "checkbox",
                           path: "user/output/@keepOutput",
                           position: 10300
                        }
                    }
                }
            }, handle);
        });

        // Search through pages
        function search(id, cmd, argv) {
            if (!id) id = "output";
            var tablist = tabs.getTabs();
            for (var i = 0; i < tablist.length; i++) {
                if (tablist[i].editorType != "output")
                    continue;
                var state = tablist[i].document.getState();
                var session = tablist[i].document.getSession();
                if (!session)
                    continue;
                var config = state.output && state.output.config || session.config;
                var command = config.command || "";
                var isSameCommand = command == cmd || command.startsWith(cmd) && /\s/.test(command[cmd.length]);
                if (session.id == id || cmd && isSameCommand) {
                    tabs.activateTab(tablist[i]);
                    
                    if (argv && argv.run)
                        tablist[i].editor.run(session, argv.callback);
                    return true;
                }
            }
        }

        function getOutputId() {
            return "output" + Math.round(Math.random() * 100000) + counter++;
        }

        handle.search = search;

        /***** Initialization *****/

        var counter = 0;

        function Output() {
            var plugin = new Terminal(true);

            var htmlNode;
            var btnRun, currentSession, btnRunner, btnDebug, btnRestart;
            var tbName, tbCommand, btnEnv, btnCwd;

            /***** Methods *****/

            function runNow(session, callback) {
                if (!session)
                    session = currentSession;

                var runner = session.runner;
                if (!runner) {
                    session.runOnRunner = { callback: callback };
                    return;
                }

                if (session.terminal) {
                    var term = session.terminal.aceSession.term;
                    term.$resetScreenOnStateChange = false;

                    if (settings.getBool("user/output/@keepOutput"))
                        term.clearScreen(2);
                    else
                        term.reset();
                }

                // ignore if tmux tries to redraw old screen
                var filter = session.filter;
                session.filter = function() { return ""; };

                var path = session.config.command;
                var cfg = session.config;
                var args = splitPathArgs(path);

                path = args.shift();

                if (session.process && session.process.running)
                    stop(done);
                else
                    done();

                function done() {
                    var refresh = tabs.getTabs().some(function(tab) {
                        return tab.path && /\.run$/.test(tab.path);
                    });
                    run.getRunner(runner.caption, refresh, function(err, result) {
                        // Make sure we have the latest runner if possible, or ignore err
                        if (!err)
                            runner = session.runner = result;
                        if (!runner.debugger) {
                            cfg.debug = undefined;
                        } else if (cfg.debug == null) {
                            cfg.debug = runner.$debugDefaultState != false;
                        }
                        
                        if (cfg.debug)
                            debug.checkAttached(start);
                        else
                            start();
                    });
                }

                function start() {
                    if (!runner)
                        runner = "auto";
                    
                    var cwd = session.config.cwd || "";
                    if (cwd.charAt(0) == "/")
                        cwd = join(basePath, cwd);
                    
                    session.process = debug.run(runner, {
                        path: path,
                        cwd: cwd,
                        env: session.config.env || {},
                        args: args,
                        debug: cfg.debug
                    }, session.id, function(err, pid) {
                        session.connect();

                        if (filter)
                            session.filter = filter;

                        if (err) {
                            transformButton(session);
                            session.process = null;
                            return showError(err);
                        }

                        session.updateTitle();

                        if (!session.process || session.process.running < session.process.STARTING)
                            return;

                        session.process.meta.debug = cfg.debug;
                    });

                    decorateProcess(session);
                    updateToolbar(session);

                    callback && callback(session.process, session.tab);
                }

                runGui.lastRun = [runner, path];
            }

            function splitPathArgs(pathArgs) {
                if (!pathArgs) return [];
                
                var results = [];
                var lastStart = 0;
                for (var i = 0; i < pathArgs.length; i++) {
                    var c = pathArgs[i];
                    if (c === "\\") {
                        pathArgs = pathArgs.substr(0, i) + pathArgs.substr(i + 1);
                        continue;
                    }
                    if (c === " ") {
                        if (!results.raw)
                            results.raw = pathArgs.substr(i);
                        if (lastStart < i)
                            results.push(pathArgs.substring(lastStart, i));
                        lastStart = i + 1;
                    }
                }
                var lastPart = pathArgs.substring(lastStart, i);
                if (lastPart.length)
                    results.push(lastPart);
                return results;
            }

            function decorateProcess(session) {
                session.process.on("away", function() {
                    if (session == currentSession) {
                        btnRun.disable();
                        btnRestart.disable();
                    }
                });
                session.process.on("back", function() {
                    if (session == currentSession) {
                        btnRun.enable();

                        if (!session.process || session.process.running != session.process.STOPPED)
                            btnRestart.enable();
                    }
                });
                session.process.on("started", function() {
                    if (session == currentSession) {
                        btnRun.enable();
                        btnRestart.enable();
                        transformButton(session);
                    }
                    session.updateTitle();
                }, plugin);
                session.process.on("stopping", function() {
                    if (session == currentSession) {
                        btnRun.disable();
                        btnRestart.disable();
                    }
                    session.updateTitle();
                }, plugin);
                session.process.on("stopped", function() {
                    if (session == currentSession) {
                        btnRun.enable();
                        btnRestart.enable();
                        transformButton(session);
                    }
                    session.updateTitle();
                }, plugin);
            }

            function transformButton(session) {
                if (session != currentSession)
                    return;
                
                btnRun.setAttribute("disabled", !c9.has(c9.NETWORK));

                if (session && session.process && session.process.running) {
                    btnRun.setAttribute("caption", "Stop");
                    btnRun.setAttribute("tooltip", "");
                    btnRun.setAttribute("class", "runbtn running");
                    btnRun.enable();

                    btnRestart.show();
                    btnRestart.enable();
                }
                else {
                    var path = (tbCommand.value || "").split(" ", 1)[0];

                    btnRun.setAttribute("caption", "Run");
                    btnRun.setAttribute("class", "runbtn stopped");

                    btnRestart.disable();

                    return path;
                }
            }

            function stop(callback) {
                var session = currentSession;
                if (!session) return;

                var process = session.process;
                if (process)
                    process.stop(function(err) {
                        if (err) {
                            showError(err.message || err);
                        }
                        else {
                            debug.stop();
                        }

                        if (session == currentSession)
                            transformButton(session);

                        callback(err);
                    });
            }

            function detectRunner(session) {
                var path = session.path;
                if (!path) return;

                run.detectRunner({ path: path }, function(err, runner) {
                    session.setRunner(err ? null : runner);
                });
            }

            function saveConfig() {
                if (!currentSession || !currentSession.config.name)
                    return;

                var json = settings.getJson("project/run/configs") || {};
                json[currentSession.config.name] = currentSession.config;
                settings.setJson("project/run/configs", json);

                currentSession.updateTitle();
                handleEmit("runConfigSaved", currentSession.config);
            }

            function removeConfig() {
                if (!currentSession || !currentSession.config.name)
                    return;

                var json = settings.getJson("project/run/configs") || {};
                delete json[currentSession.config.name];
                settings.setJson("project/run/configs", json);

                currentSession.updateTitle();
            }

            var model, datagrid, mnuEnv;
            function drawEnv() {
                if (model) return;

                model = new TreeData();
                model.emptyMessage = "Type a new environment variable here...";
                
                layout.on("eachTheme", function(e) {
                    var height = parseInt(ui.getStyleRule(".blackdg .row", "height"), 10) || 24;
                    model.rowHeight = height;
                    
                    if (e.changed) datagrid.resize(true);
                });

                model.$sorted = false;
                model.columns = [{
                    caption: "Name",
                    value: "name",
                    width: "40%",
                    editor: "textbox"
                }, {
                    caption: "Value",
                    value: "value",
                    width: "60%",
                    editor: "textbox"
                }];
                model.updateNodeAfterChange = function(node) {
                    return findNode(node.name);
                };

                mnuEnv.$setStyleClass(mnuEnv.$ext, "envcontainer");
                var div = mnuEnv.$ext.appendChild(document.createElement("div"));

                datagrid = new Tree(div);
                datagrid.renderer.setTheme({ cssClass: "blackdg" });
                datagrid.setDataProvider(model);
                datagrid.edit = new TreeEditor(datagrid);

                var justEdited = false;

                datagrid.textInput.getElement().addEventListener("keydown", function(e) {
                    var cursor = datagrid.selection.getCursor();
                    var key = keys[e.keyCode] || "";
                    if (key.length == 1 || key.substr(0, 3) == "num" && cursor && !justEdited)
                        datagrid.edit.startRename(cursor, 0);
                }, true);

                datagrid.textInput.getElement().addEventListener("keyup", function(e) {
                    var cursor = datagrid.selection.getCursor();
                    if (e.keyCode == 13 && cursor && !justEdited)
                        datagrid.edit.startRename(cursor, 0);
                }, true);

                datagrid.on("delete", function(e) {
                    datagrid.selection.getSelectedNodes().forEach(function(n) {
                        delete model.session.config.env[n.name];
                        model._signal("remove", n);
                    });

                    reloadModel();
                    saveConfig();

                    mnuEnv.resize();
                });

                datagrid.on("createEditor", function(e) {
                    e.ace.commands.bindKeys({
                        "Up": function(ace) { ace.treeEditor.editNext(-1, true); },
                        "Down": function(ace) { ace.treeEditor.editNext(1, true); }
                    });
                });

                datagrid.on("rename", function(e) {
                    if (!e.column) return;

                    var node = e.node;
                    var config = model.session.config;
                    var name, value;

                    if (e.column.value == "name" || node.isNew) {
                        name = e.value;
                        value = node.value || "";
                    }
                    else {
                        name = node.name;
                        value = e.value;
                    }

                    if (name === node.name && value === node.value)
                        return;

                    if (!node.isNew || !name)
                        delete config.env[node.name];

                    if (name) {
                        config.env[name] = value;
                        var envVariable = {};
                        envVariable[name] = value;
                        handleEmit("envSet", name, config.env);
                    }

                    reloadModel();
                    saveConfig();

                    if (node.isNew && findNode(name))
                        datagrid.edit.startRename(findNode(name), 1);
                    else
                        model.selection.setSelection(findNode(name));

                    mnuEnv.resize();
                });

                datagrid.on("rename", function(e) {
                    justEdited = true;
                    setTimeout(function() { justEdited = false; }, 500);
                });

                mnuEnv.resize = function() {
                    if (!mnuEnv.visible) return;

                    setTimeout(function() {
                        if (mnuEnv.opener) {
                            mnuEnv.reopen = true;
                            mnuEnv.display(null, null, true, mnuEnv.opener);
                            mnuEnv.reopen = false;
                        }
                    }, 10);
                };
            }

            function findNode(name) {
                var f;
                model.root.children.some(function(n) {
                    return n.name == name && (f = n);
                });
                return f;
            }

            function reloadModel() {
                var env = [];
                var cfg = model.session.config;
                var sel = model.selection.getCursor();

                for (var name in cfg.env) {
                    env.push({
                        name: name,
                        value: cfg.env[name]
                    });
                }
                env.sort(function(a, b) {
                    return TreeData.alphanumCompare(a.name, b.name);
                });
                model.newEnvNode = model.newEnvNode || {
                    name: model.emptyMessage,
                    className: "newenv",
                    fullWidth: true,
                    isNew: true,
                };
                model.setRoot({
                    items: [].concat(env, model.newEnvNode),
                    $sorted: true
                });

                // restore selection
                if (sel && sel.name)
                    model.selection.setSelection(findNode(sel.name));
            }

            function updateConfig(session) {
                var configs = settings.getJson("project/run/configs");
                var cfg = configs[session.config.name] || session.config;

                session.config = cfg;
                updateRunner(session);

                updateToolbar(session);
            }

            function updateRunner(session) {
                session.runner = null;

                var runner = session.config.runner;
                if (runner && runner != "auto") {
                    run.getRunner(session.config.runner, function(err, result) {
                        session.setRunner(err ? null : result);
                    });
                }
                else {
                    var path = /([^\\ ]|\\.)*/.exec(session.config.command || "")[0];
                    if (!path) return;

                    run.detectRunner({ path: path }, function(err, runner) {
                        session.setRunner(err ? null : runner);
                    });
                }
            }

            function updateToolbar(session) {
                if (session != currentSession)
                    return;
                
                transformButton(session);

                var cfg = session.config;
                btnDebug.setAttribute("visible",
                    !session.runner || session.runner.debugger ? true : false);
                if (cfg.debug != null)
                    btnDebug.setAttribute("value", cfg.debug);
                btnRunner.setAttribute("caption", "Runner: "
                    + (cfg.runner || "Auto"));
                tbCommand.setAttribute("value", cfg.command);
                tbName.setAttribute("value", cfg.name);
                // btnEnv.setAttribute("value", );
                btnCwd.$ext.title = cfg.cwd || "Current working directory (unset)";

                btnRun.setAttribute("disabled", !c9.has(c9.NETWORK));

                if (session.config.toolbar === false) {
                    htmlNode.classList.add("hidetoolbar");
                } else {
                    htmlNode.classList.remove("hidetoolbar");
                }
            }

            /***** Lifecycle *****/

            plugin.on("draw", function(e) {
                // Create UI elements
                ui.insertMarkup(e.tab, markup, plugin);

                htmlNode = e.htmlNode;

                // Set output class name
                e.htmlNode.className += " output";

                // Decorate UI
                btnRun = plugin.getElement("btnRun");
                btnRestart = plugin.getElement("btnRestart");
                btnDebug = plugin.getElement("btnDebug");
                btnRunner = plugin.getElement("btnRunner");
                tbCommand = plugin.getElement("tbCommand");
                tbName = plugin.getElement("tbName");
                btnEnv = plugin.getElement("btnEnv");
                btnCwd = plugin.getElement("btnCwd");

                btnRun.on("click", function() {
                    var session = currentSession;
                    if (!session) return;

                    if (session.process && session.process.running) {
                        stop(function() {});
                    }
                    else {
                        runNow(session);
                    }
                });

                btnRestart.on("click", function() {
                    var session = currentSession;
                    if (!session) return;

                    if (session.process && session.process.running > 0)
                        stop(function() { runNow(session); });
                });

                btnDebug.on("prop.value", function(e) {
                    if (currentSession) {
                        currentSession.config.debug = e.value;
                        saveConfig();
                    }
                });
                tbCommand.on("afterchange", function(e) {
                    if (currentSession)
                        currentSession.changeCommand(e.value);
                });
                tbCommand.$ext.addEventListener("keydown", function(e) {
                    if (e.keyCode === 13)
                        currentSession && runNow(currentSession);
                });
                tbName.on("afterchange", function(e) {
                    if (!currentSession) return;

                    currentSession.changeName(e.value);
                });

                btnRunner.setAttribute("submenu", runGui.getElement("mnuRunAs"));
                btnRunner.onitemclick = function(value) {
                    // Stop the current process
                    // @todo

                    // Start this run config with the new runner
                    run.getRunner(value, function(err, result) {
                        if (err)
                            return showError("Cannot use " + value + ": " + err);

                        currentSession.setRunner(result);
                    });
                    btnRunner.setAttribute("caption", "Runner: " + value);

                    // Set Button Caption
                };

                btnCwd.on("click", function selectCwd(e, cwd) {
                    cwd = cwd || currentSession.config && currentSession.config.cwd 
                        || currentSession.runner && currentSession.runner.working_dir 
                        || "/";
                        
                    showSave("Select current working directory", cwd,
                        function(directory, stat, hide) {
                            if (!stat) {
                                hide();
                                return showAlert(
                                    "Select current working directory",
                                    "Directory does not exist",
                                    directory,
                                    selectCwd.bind(null, e, directory)
                                );
                            }
                            currentSession.config.cwd = directory;
                            updateToolbar(currentSession);
                            handleEmit("cwdSet", directory);
                            hide();
                        },
                        function() {},
                        {
                            chooseCaption: "Select",
                            hideFileInput: true
                        }
                    );
                });

                mnuEnv = new ui.menu({
                    htmlNode: document.body,
                    width: 250
                });
                btnEnv.setAttribute("submenu", mnuEnv);

                mnuEnv.on("prop.visible", function(e) {
                    if (!e.value || mnuEnv.reopen)
                        return;

                    drawEnv();
                    model.session = currentSession;
                    if (!model.session.config.env)
                        model.session.config.env = {};
                    reloadModel();
                    
                    var rect = mnuEnv.opener.$ext.getBoundingClientRect();
                    var top = rect.top;
                    var bottom = window.innerHeight - rect.bottom;
                    
                    var maxRows = Math.floor(Math.max(top, bottom) / datagrid.model.rowHeight) - 2;
                    datagrid.setOption("maxLines", maxRows);
                    datagrid.resize();
                    mnuEnv.resize();

                    var node = datagrid.getFirstNode();
                    var isNew = node.className == "newenv";
                    if (isNew) datagrid.select(node);

                    if (isNew) {
                        setTimeout(function() {
                            datagrid.edit.startRename(node);
                        }, 30);
                    }
                });

                c9.on("stateChange", function() {
                    updateToolbar(currentSession);
                }, plugin);
            });

            plugin.on("documentLoad", function(e) {
                var doc = e.doc;
                var tab = e.doc.tab;
                var session = doc.getSession();

                if (!session.config)
                    session.config = { env: {}};

                session.tab = tab;

                session.run = function() {
                    runNow(session);
                };

                session.setRunner = function(runner) {
                    if (!runner) {
                        run.getRunner("Shell command", function(err, runner) {
                            if (!err) session.setRunner(runner);
                        });
                        return;
                    }

                    session.runner = runner;
                    session.config.runner = runner.caption;

                    if (session.runOnRunner) {
                        runNow(session, session.runOnRunner.callback);
                        delete session.runOnRunner;
                    }

                    saveConfig();

                    if (session == currentSession) {
                        btnRunner.setAttribute("caption", "Runner: "
                            + (runner ? runner.caption : "Auto"));
                        updateToolbar(session);
                    }
                };

                session.filter = function(data, recur) {
                    // Ignore clear screen when detaching
                    if (/output:0:.*\[dead\] - /.test(data))
                        return;

                    if (
                        /\[exited\]\r/.test(data) ||
                        /Set option: remain-on-exit \-\> on/.test(data)
                    ) {
                        session.stopped = false;
                        session.terminal.showCursor();
                        if (!session.process) {
                            plugin.setState(session.doc, {
                                running: {
                                    runner: session.runner,
                                    debug: session.config.debug,
                                    name: session.id,
                                    pid: -1,
                                },
                                cwd: session.cwd,
                                id: session.id,
                            });
                        }
                        // tab.classList.add(session.process
                        //     && session.process.running > 0 ? "running" : "loading");
                        return session.process && session.process.checkState();
                    }

                    // Change the last lines of TMUX saying the pane is dead
                    if (data.indexOf("Pane is dead") > -1) {
                        if (data.lastIndexOf("\x1b[1mPane is dead\x1b[H") === 0) {
                            data = "";
                        } else if (data === "\r\x1b[1mPane is dead\x1b[m\x1b[K") {
                            data = "";
                        } else {
                            data = data
                              .replace(/\s*Pane is dead([\s\S]*)13H/g, "") // "$117H")
                              .replace(/\s*Pane is dead/g, "");
                        }
                        data = data.replace(/\s+$/, "");

                        session.terminal.hideCursor();

                        tab.classList.remove(session.process
                            && session.process.running > 0 ? "running" : "loading");

                        if (session.process && session.process.running > 1)
                            session.process.checkState();

                        // sometimes if process finishes quickly and with little output
                        // tmux won't show most of it so we have to reload
                        if (!recur && session.terminal.lines.length < 2 * session.terminal.rows)
                            setTimeout(session.$reloadHistory);
                    }

                    return data;
                };

                session.$reloadHistory = function() {
                    if (session.getOutputHistory) {
                        session.getOutputHistory({
                            id: session.id,
                            start: -1000,
                            end: 1000
                        }, function(e, output) {
                            if (e || !output) return;
                            if (session.filter)
                                output = session.filter(output, true);
                            session.terminal.reset();
                            var convertEol = session.terminal.convertEol;
                            session.terminal.convertEol = true;
                            session.terminal.write(output);
                            session.terminal.convertEol = convertEol;
                        });
                    }
                };

                session.updateTitle = function() {
                    var process = session.process;

                    doc.tooltip =
                    doc.title = (session.config.name || session.config.command || "[New]")
                      + " - " + (!process
                        ? "Idle"
                        : (process.running
                            ? "Running"
                            : "Stopped"));

                    if (process && process.running)
                        tab.classList.add("running");
                    else
                        tab.classList.remove("running");
                    tab.classList.remove("loading");
                };

                session.changeCommand = function(value) {
                    currentSession.config.command = value;
                    saveConfig();

                    if (!currentSession.runner)
                        updateRunner(currentSession);
                };

                session.changeName = function(value) {
                    if (!value && session.config.name) {
                        question.show("Remove this configuration?",
                            "You have cleared the name of this configuration.",
                            "Would you like to remove this configuration from your project settings?",
                            function() { // Yes
                                removeConfig();
                                session.config.name = "";
                                session.updateTitle();
                                handleEmit("runnerNameChanged", "");
                            },
                            function() { // No
                                // Revert change
                                tbName.setAttribute("value", session.config.name);
                            });
                    }
                    else {
                        removeConfig();
                        session.config.name = value;
                        saveConfig();
                        handleEmit("runnerNameChanged", value);
                    }
                };

                session.show = function(v) {
                    // plugin.ace.container.style.visibility = "visible";
                };

                session.hide = function(v) {
                    // plugin.ace.container.style.visibility = "hidden";
                };

                tab.on("beforeClose", function() {
                    if (!settings.getBool("user/output/nosavequestion")
                      && (!session.config.name && session.config.command
                      && !tab.meta.$ignore)) {
                        question.show("Unsaved changes",
                            "Are you sure you want to close this run configuration without saving it?",
                            "You can keep these settings in a run configuration "
                            + "for easy access later. If you would like to do "
                            + "this, choose No and fill in the name of the "
                            + "run configuration prior to closing this tab.",
                            function() { // Yes
                                tab.meta.$ignore = true;
                                tab.close();

                                if (question.dontAsk)
                                    settings.set("user/output/nosavequestion", true);
                            },
                            function() { // No
                                // do nothing; allow user to set a name

                                if (question.dontAsk)
                                    settings.set("user/output/nosavequestion", true);
                            },
                            { showDontAsk: true, yes: "Close", no: "Cancel" });
                        return false;
                    }
                }, session);

                // Preferred before to be before the state is serialized
                tab.on("beforeUnload", function() {
                    if (session.process && session.process.running) {
                        session.process.stop(function() {});
                        tab.classList.remove("running");
                    }
                });

                if (e.state.hidden || e.state.run)
                    session.hide();

                function setTabColor() {
                    var bg = settings.get("user/output/@backgroundColor");
                    var shade = util.shadeColor(bg, 0.75);
                    var skinName = settings.get("user/general/@skin");
                    var isLight = ~skinName.indexOf("flat") || shade.isLight;
                    doc.tab.backgroundColor = isLight ? bg : shade.color;
                    
                    if (isLight) {
                        if (~skinName.indexOf("flat") && !shade.isLight) {
                            doc.tab.classList.add("dark");
                            plugin.container.className = "c9terminalcontainer flat-dark";
                        }
                        else {
                            doc.tab.classList.remove("dark");
                            plugin.container.className = "c9terminalcontainer";
                        }
                    }
                    else {
                        doc.tab.classList.add("dark");
                        plugin.container.className = "c9terminalcontainer dark";
                    }
                }
                setTabColor();

                handle.on("settingsUpdate", setTabColor, doc);
            });

            plugin.on("documentActivate", function(e) {
                if (currentSession && currentSession.loaded) {
                    // needed because tab change fires before blur event
                    if (tbCommand.getValue() != currentSession.config.command)
                        currentSession.changeCommand(tbCommand.getValue());
                    if (tbName.getValue() != currentSession.config.name)
                        currentSession.changeName(tbName.getValue());
                }

                currentSession = e.doc.getSession();
                updateToolbar(currentSession);
            });

            plugin.on("documentUnload", function(e) {

            });

            plugin.on("getState", function(e) {
                var session = e.doc.getSession();
                if (!session.id)
                    return;

                var state = e.state;
                state.config = session.config;

                if (session.process && session.process.running) {
                    state.running = session.process.getState();
                    state.running.debug = session.process.meta.debug;
                }
            });

            plugin.on("setState", function(e) {
                var session = e.doc.getSession();
                var state = e.state;

                if (state.config) {
                    session.config = state.config;
                    updateConfig(session);
                }

                if (state.running && !session.process) {
                    session.process = run.restoreProcess(state.running);
                    decorateProcess(session);
                    transformButton(session);

                    if (state.running.debug && session.process.running > 0) {
                        session.process.meta.debug = true;
                        session.process.once("back", function() {
                            debug.debug(session.process, true, function(err) {
                                if (err)
                                    return; // Either the debugger is not found or paused
                            });
                        });
                    }
                }

                if (state.run)
                    runNow(session, state.callback);
                else
                    session.connect();

                session.updateTitle();
            });

            plugin.on("unload", function() {
                currentSession = null;
            });

            plugin.freezePublicAPI({
                /**
                 * @param {Session} session
                 */
                run: runNow,
                
                /**
                 * @ignore This is here to overwrite default behavior
                 */
                isClipboardAvailable: function(e) { return !e.fromKeyboard; },
                
                get relatedPath() {
                    if (!currentSession) return;
                    var path = currentSession && currentSession.config.command;
                    if (path && path[0] != "~" && path[0] != "/")
                        path = "/" + path;
                    return path && splitPathArgs(path)[0];
                }
            });

            return plugin;
        }

        register(null, {
            output: handle
        });
    }
});
