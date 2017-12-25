define(function(require, exports, module) {
    main.consumes = [
        "TestPanel", "ui", "Tree", "settings", "panels", "commands", "test",
        "Menu", "MenuItem", "Divider", "tabManager", "save", "preferences", "fs",
        "run.gui", "layout", "c9", "Form"
    ];
    main.provides = ["test.all"];
    return main;

    function main(options, imports, register) {
        var TestPanel = imports.TestPanel;
        var settings = imports.settings;
        var panels = imports.panels;
        var ui = imports.ui;
        var Tree = imports.Tree;
        var test = imports.test;
        var commands = imports.commands;
        var fs = imports.fs;
        var c9 = imports.c9;
        var Form = imports.Form;
        var Menu = imports.Menu;
        var MenuItem = imports.MenuItem;
        var Divider = imports.Divider;
        var tabManager = imports.tabManager;
        var save = imports.save;
        var layout = imports.layout;
        var prefs = imports.preferences;
        var runGui = imports["run.gui"];
        
        var Node = test.Node;
        
        var async = require("async");
        var basename = require("path").basename;
        var dirname = require("path").dirname;
        var escapeHTML = require("ace/lib/lang").escapeHTML;
        
        var LineWidgets = require("ace/line_widgets").LineWidgets;
        var dom = require("ace/lib/dom");
        // var Range = require("../range").Range;
        
        /***** Initialization *****/

        var plugin = new TestPanel("Ajax.org", main.consumes, {
            caption: "All Tests",
            index: 200,
            // showTitle: true,
            style: "flex:1;"
        });
        var emit = plugin.getEmitter();
        
        var tree, stopping, menuContext, running, boxFilter, menuInlineContext;
        
        var wsNode = new Node({
            label: "workspace",
            isOpen: true,
            className: "heading",
            status: "loaded",
            noSelect: true,
            $sorted: true,
        });
        var rmtNode = new Node({
            label: "remote",
            isOpen: true,
            className: "heading",
            status: "loaded",
            noSelect: true,
            $sorted: true
        });
        var rootNode = new Node({
            label: "root",
            tree: tree,
            items: [wsNode]
        });
        
        function load() {
            if (test.inactive)
                return;
            
            panels.on("afterAnimate", function() {
                if (panels.isActive("test"))
                    tree && tree.resize();
            }, plugin);
            
            test.on("ready", function() {
                if (!test.config.excluded)
                    test.config.excluded = {};
                if (!test.config.skipped)
                    test.config.skipped = {};
            }, plugin);
            
            test.on("updateConfig", function() {
                async.each(test.runners, function(runner, cb) {
                    runner.update(cb);
                }, function() {
                    refresh();
                });
            }, plugin);
            
            settings.on("read", function() {
                settings.setDefaults("user/test", [
                    ["inlineresults", true],
                    ["runonsave", true]
                ]);
            }, plugin);
            
            prefs.add({
                "Test": {
                    position: 2000,
                    "Test Runner": {
                        position: 100,
                        "Run Tests On Save": {
                            type: "checkbox",
                            position: 50,
                            setting: "user/test/@runonsave"
                        },
                        "Show Inline Test Results": {
                            type: "checkbox",
                            position: 100,
                            setting: "user/test/@inlineresults"
                        },
                        "Exclude These Files": {
                           name: "txtTestExclude",
                           type: "textarea-row",
                           fixedFont: true,
                           width: 600,
                           height: 200,
                           rowheight: 250,
                           position: 1000
                       },
                    }
                }
            }, plugin);
            
            plugin.getElement("txtTestExclude", function(txtTestExclude) {
                var ta = txtTestExclude.lastChild;
                
                ta.on("blur", function(e) {
                    test.config.excluded = {};
                    ta.value.split("\n").forEach(function(rawLine) {
                        var path = rawLine.split("#")[0].trim();
                        test.config.excluded[path] = rawLine;
                    });
                    test.saveConfig(function() {
                        // Trigger a refetch for all runners
                        test.refresh();
                    });
                });
                
                var update = function() {
                    var str = [];
                    for (var path in test.config.excluded) {
                        str.push(test.config.excluded[path]);
                    }
                    ta.setValue(str.join("\n"));
                };
                
                test.on("ready", update, plugin);
                test.on("updateConfig", update, plugin);
            }, plugin);

            // Save hooks
            save.on("afterSave", function(e) {
                var runner = isTest(e.path, e.value);
                if (!runner) return;

                // Notify runners of change event and refresh tree 
                var runonsave = settings.getBool("user/test/@runonsave");
                runner.fileChange({
                    path: e.path,
                    value: e.value, 
                    runonsave: runonsave,
                    run: function(fileNode) {
                        // Re-run test on save
                        if (runonsave) {
                            var cmd = fileNode.coverage 
                                ? "runtestwithcoverage" 
                                : "runtest";
                            
                            fileNode.fixParents();
                            commands.exec(cmd, null, { nodes: [fileNode]});
                        }
                    },
                    refresh: function() {
                        tree && tree.refresh();
                    }
                });
            }, plugin);

            // Run Button Hook
            runGui.on("updateRunButton", function(e) {
                if (!isTest(e.path)) return;

                var btnRun = e.button;
                btnRun.enable();
                btnRun.setAttribute("command", "runfocussedtest");
                btnRun.setAttribute("caption", "Run Test");
                btnRun.setAttribute("tooltip", "Run Test" + basename(e.path));

                return false;
            }, plugin);
            
            // Initiate test runners
            test.on("register", function(e) { init(e.runner); }, plugin);
            test.on("unregister", function(e) { deinit(e.runner); }, plugin);
            
            test.on("update", function() {
                test.runners.forEach(function(runner) {
                    updateStatus(runner.root, "loading");
                    runner.update();
                });
            }, plugin);
            
            test.on("resize", function() {
                tree && tree.resize();
            }, plugin);
            
            // This is global to protect from error states
            plugin.on("stop", function() {
                progress.stop = [];
                running = false;
                runGui.transformButton();
            });
            
            var label, form;
            test.on("showRunMenu", function(e) {
                if (!label) {
                    label = new ui.label({
                        caption: "general",
                        class: "runner-form-header"
                    });
                    
                    var runner = e.runners[0] || 0;
                    
                    form = new Form({ 
                        colwidth: 180,
                        rowheight: 45,
                        style: "width:320px",
                        form: [
                            {
                                title: "Parallel Test Execution",
                                type: "checked-spinner",
                                name: "parallel",
                                min: 1,
                                max: 999,
                                defaultCheckboxValue: test.config.parallel !== undefined
                                    ? test.config.parallel
                                    : (runner.defaultParallel || false),
                                defaultValue: test.config.parallelConcurrency !== undefined
                                    ? test.config.parallelConcurrency
                                    : (runner.defaultParallelConcurrency || 6),
                                onchange: function(e) {
                                    test.config[e.type == "checkbox" 
                                        ? "parallel"
                                        : "parallelConcurrency"] = e.value;
                                    test.saveConfig(function() {});
                                }
                            }
                        ]
                    }, plugin);
                }
                e.menu.appendChild(label);
                form.attachTo(e.menu);
                
                return false;
            });
            
            // Initialize All Runners
            test.runners.forEach(init);
            
            // Set the all panel as the focussed panel
            test.focussedPanel = plugin;
        }
        
        var drawn = false;
        function draw(opts) {
            if (drawn) return;
            drawn = true;
            
            // Insert CSS
            ui.insertCss(require("text!./style.css"), null, plugin);
            
            // Tree
            tree = new Tree({
                container: opts.html,
                scrollMargin: [10, 10],
                theme: "filetree",
                emptyMessage: "No tests found",
            
                getCaptionHTML: function(node) {
                   if (node.type == "file") {
                        var path = dirname(node.label);
                        if (path == ".") return escapeHTML(node.label);
                        return escapeHTML(basename(path) + "/" + basename(node.label)) 
                            + "<span class='extrainfo'> - " + escapeHTML(dirname(path)) + "</span>";
                   }
                   else if (node.type == "testset") {
                       return escapeHTML(node.label); // "<span style='opacity:0.5;'>" + escapeHTML(node.label) + "</span>";
                   }
                   else if (node.kind == "it") {
                       return "it " + escapeHTML(node.label);
                   }
                   else if (node.type == "runner") {
                       return escapeHTML(node.label) + " (" 
                          + (!node.items.length && node.status == "loading" 
                            ? "loading" 
                            : node.items.length) 
                          + ")";
                   }
                   
                   return escapeHTML(node.label);
                },
            
                getIconHTML: function(node) {
                    var icon = "default";
                    
                    if (node.status === "loading") icon = "loading";
                    else if (node.status === "running") icon = "test-in-progress";
                    else if (node.passed === 1) icon = "test-passed";
                    else if (node.passed === 0) icon = "test-failed";
                    else if (node.passed === 2) icon = "test-error";
                    else if (node.passed === 3) icon = "test-terminated";
                    else if (node.skip) icon = "test-ignored";
                    else if (node.type == "testset") icon = "test-set";
                    else if (node.type == "file") icon = "test-file";
                    else if (node.type == "runner") icon = "test-file";
                    else if (node.type == "prepare") icon = "test-prepare";
                    else if (node.type == "test") icon = "test-notran";
                    
                    return "<span class='ace_tree-icon filetree-icon " + icon + "'></span>";
                },
                
                getClassName: function(node) {
                    return (node.className || "") 
                        + (node.status == "loading" ? " loading" : "")
                        + (node.status == "running" ? " loading" : ""); // TODO different running icon
                },
                
                getRowIndent: function(node) {
                    return node.$depth ? node.$depth - 1 : 0;
                },
                
                hasChildren: function(node) {
                    return node.status === "pending"
                        || node.items && node.items.length;
                },
                
                loadChildren: function(node, callback) {
                    populate(node, callback);
                },
                
                sort: function(children) {
                    if (!children.length || children[0].type != "file")
                        return;
                    
                    var compare = tree.model.alphanumCompare;
                    return children.sort(function(a, b) {
                        // TODO index sorting
                        // if (aIsSpecial && bIsSpecial) return a.index - b.index; 
                
                        return compare(a.path + "", b.path + "");
                    });
                }
            }, plugin);
            
            // TODO generalize this
            tree.renderer.scrollBarV.$minWidth = 10;
            
            tree.container.style.position = "absolute";
            tree.container.style.left = "0";
            tree.container.style.top = "0";
            tree.container.style.right = "0";
            tree.container.style.bottom = "0";
            tree.container.style.height = "";
            
            tree.setRoot(rootNode);
            
            tree.commands.bindKey("Space", function(e) {
                openTestFile();
            });
            
            tree.commands.bindKey("Enter", function(e) {
                commands.exec("runtest");
            });
            
            tree.commands.bindKey("Shift-Enter", function(e) {
                commands.exec("runtestwithcoverage");
            });
            
            tree.on("focus", function() {
                test.focussedPanel = plugin;
            });
            
            tree.on("select", function() {
                openTestFile([tree.selectedNode], true);
            });
            
            tree.on("afterChoose", function() {
                commands.exec("runtest");
            });
            
            layout.on("eachTheme", function(e) {
                var height = parseInt(ui.getStyleRule(".filetree .tree-row", "height"), 10) || 22;
                tree.rowHeightInner = height;
                tree.rowHeight = height;
                
                if (e.changed && tree) tree.resize(true);
            });
            
            // Hook clear
            test.on("clear", function() {
                clear();
            }, plugin);
            
            // Hook opening of known files
            tabManager.on("open", function(e) {
                var node, tab = e.tab;
                if (rootNode.findAllNodes("file").some(function(n) {
                    node = n;
                    return n.path == tab.path;
                })) {
                    decorate(node, tab);
                }
            }, plugin);

            // Filter
            var toolbar = test.getElement("toolbar");
            ui.insertByIndex(toolbar, new ui.filler(), 900, plugin);
            boxFilter = ui.insertByIndex(toolbar, new apf.codebox({
                "initial-message": "Filter Tests",
                "clearbutton": true,
                "focusselect": true,
                "singleline": true,
                "width": 100,
                "style": "flex:10; max-width:150px"
                // "style": "float:right;margin:1px 2px"
            }), 1000, plugin);
            boxFilter.ace.on("input", function() {
                 tree.filterKeyword = boxFilter.ace.getValue();
            });
            
            // Menu
            menuContext = new Menu({ items: [
                new MenuItem({ position: 100, command: "runtest", caption: "Run", class: "strong", hotkey: "Enter" }),
                new MenuItem({ position: 200, command: "runtestwithcoverage", caption: "Run with Code Coverage", hotkey: "Shift-Enter" }),
                new Divider({ position: 300 }),
                new MenuItem({ position: 400, caption: "Open Test File", onclick: openTestFile, hotkey: "Space" }),
                new MenuItem({ position: 500, caption: "Open Raw Test Output", command: "opentestoutput" }),
                new Divider({ position: 600 }),
                new MenuItem({ position: 700, caption: "Skip", command: "skiptest" }),
                new MenuItem({ position: 800, caption: "Remove", command: "removetest" })
            ]}, plugin);
            opts.aml.setAttribute("contextmenu", menuContext.aml);
            
            menuInlineContext = new Menu({ items: [
                new MenuItem({ 
                    caption: "Show Inline Test Results", 
                    checked: "user/test/@inlineresults",
                    type: "check",
                    position: 100
                }),
                new Divider(),
                new MenuItem({ 
                    caption: "Open Raw Test Output", 
                    onclick: function() {
                        var path = tabManager.focussedTab.path;
                        var test = findTest(path);
                        if (test)
                            commands.exec("opentestoutput", null, { nodes: [test]});
                    },
                    position: 300
                }),
                new MenuItem({ 
                    caption: "Clear Test Results In This File", 
                    onclick: function() {
                        var editor = tabManager.focussedTab.editor;
                        if (editor.ace)
                            clearDecoration(editor.ace.session);
                    },
                    position: 400
                }),
            ]}, plugin);
            
            settings.on("read", function() {
                test.settingsMenu.append(new MenuItem({ 
                    caption: "Show Inline Test Results", 
                    checked: "user/test/@inlineresults",
                    type: "check",
                    position: 100
                }));
            }, plugin);
            
            settings.on("user/test/@inlineresults", function(value) {
                rootNode.findAllNodes("file").forEach(function(fileNode) {
                    if (fileNode.passed === undefined) return;
                    var tab = tabManager.findTab(fileNode.path);
                    if (tab) decorate(fileNode, tab);
                });
            }, plugin);
            
            tree.resize();
        }
        
        /***** Helper Methods *****/
        
        function populate(node, callback, force) {
            var runner = node.findRunner() || findFileByPath(node.path).findRunner();
            
            updateStatus(node, "loading");
            
            runner.populate(node, function(err) {
                if (err) return callback(err); // TODO
                
                updateStatus(node, "loaded");
                node.fixParents();
                
                if (node.skip) {
                    node.findAllNodes("test").forEach(function(n) {
                        n.skip = true;
                    });
                }
                
                callback();
            });
        }
        
        function filter(path) {
            return test.config ? test.config.excluded[path] : false;
        }
        
        function init(runner) {
            if (!test.ready) return test.on("ready", init.bind(this, runner));
            if (!test.drawn) return test.once("draw", init.bind(this, runner), runner);
            
            var parent = runner.remote ? rmtNode : wsNode;
            runner.root.parent = parent;
            parent.items.push(runner.root);
            
            if (wsNode.items.length == 1 && (!tree || !tree.selectedNode))
                plugin.once("draw", function() { tree.select(runner.root); });
            
            updateStatus(runner.root, "loading");
            
            var first = true;
            runner.init(filter, function(err) {
                if (err) return console.error(err); // TODO
                
                runner.root.isOpen = true;
                updateStatus(runner.root, "loaded");
                
                runner.root.findAllNodes("file").forEach(function(node) {
                    // Mark skipped tests
                    if (test.config.skipped[node.path]) {
                        node.skip = true;
                        node.findAllNodes("test").forEach(function(n) {
                            n.skip = true;
                        });
                    }
                    
                    // Call Results
                    if (first) {
                        if (typeof node.passed == "number")
                            emit("result", { node: node });
                        
                        if (node.coverage)
                            test.setCoverage(node);
                    }
                });
                
                runner.root.fixParents();
                
                if (first) {
                    // Init any tab that is already opened
                    tabManager.getTabs().forEach(function(tab) {
                        if (tab.path && isTest(tab.path, tab.document.value)) {
                            decorate(findFileByPath(tab.path), tab);
                        }
                    });
                }
                
                first = false;
            });
        }
        
        function deinit(runner) {
            if (runner.root.parent) {
                var items = runner.root.parent.items;
                items.splice(items.indexOf(runner.root), 1);
            }
            
            tree.refresh();
        }

        function findFileByPath(path) {
            var found = false;
            rootNode.findAllNodes("file").some(function(n) {
                if (n.path == path) {
                    found = n;
                    return true;
                }
            });
            return found;
        }
        
        var knownTests = {};
        function isTest(path, value) {
            if (filter(path)) return false;
            if (knownTests[path]) return knownTests[path];
            
            if (!value)
                value = tabManager.findTab(path).document.value;
            
            test.runners.some(function(runner) {
                if (runner.isTest(path, value)) {
                    knownTests[path] = runner;
                    return true;
                }
                return false;
            });
            
            return knownTests[path] || false;
        }
        
        // TODO export to ace editor and add loading detection
        function scrollToDefinition(ace, line, lineEnd) {
            var lineHeight = ace.renderer.$cursorLayer.config.lineHeight;
            var lineVisibleStart = ace.renderer.scrollTop / lineHeight;
            var linesVisible = ace.renderer.$size.height / lineHeight;
            lineEnd = Math.min(lineEnd, line + linesVisible);
            if (lineVisibleStart <= line && lineEnd <= lineVisibleStart + linesVisible)
                return;

            var SAFETY = 1.5;
            ace.scrollToLine(Math.round((line + lineEnd) / 2 - SAFETY), true);
        }
        
        function openTestFile(nodes, onlyWhenOpen) {
            (nodes || test.focussedPanel.tree.selectedNodes).forEach(function(n) {
                var tab;
                
                if (n.passed === 0) {
                    var found; 
                    n.findAllNodes("test").some(function(n) { 
                        found = n;
                        return n.passed === 0; 
                    });
                    n = found;
                }
                
                if (n.type == "file" && (!n.ownPassed || !n.output)) {
                    if (onlyWhenOpen) {
                        tab = tabManager.findTab(n.path);
                        if (!tab || !tab.isActive())
                            return;
                    }
                    
                    tabManager.openFile(n.path, true, function() {});
                }
                else if (n.type == "file" || n.pos) {
                    var fileNode = n.findFileNode();
                    if (onlyWhenOpen) {
                        tab = tabManager.findTab(fileNode.path);
                        if (!tab || !tab.isActive())
                            return;
                    }
                    
                    tabManager.open({
                        path: fileNode.path,
                        active: true
                    }, function(err, tab) {
                        if (err) return console.error(err);
                        
                        scrollTab(tab, n);
                    });
                }
            });
        }
        
        function scrollTab(tab, n) {
            var pos = n.selpos || n.pos;
            var select = n.selpos ? {
                row: n.selpos.el,
                column: n.selpos.ec
            } : undefined;
            
            var ace = tab.editor.ace;
            var scroll = function() {
                ace.selection.clearSelection();
                
                var sl = n.pos ? n.pos.sl : 0;
                var el = n.pos ? n.pos.el : 0;
                
                var a = n.annotations;
                if (a && a.length) {
                    scrollToDefinition(ace, a[0].line, a[0].line);
                    ace.moveCursorTo(a[0].line - 1, a[0].column - 1);
                }
                else {
                    scrollToDefinition(ace, sl, el);
                    ace.moveCursorTo(pos ? pos.sl : 0, pos ? pos.sc : 0);
                    
                    if (select)
                        ace.getSession().getSelection()
                            .selectToPosition({ row: pos.el, column: pos.ec });
                }
            };
            
            if (!ace.session.doc.$lines.length)
                ace.once("changeSession", scroll);
            else if (!ace.renderer.$cursorLayer.config)
                ace.once("afterRender", scroll);
            else
                scroll();
        }
        
        /***** Methods *****/
        
        function run(nodes, options, callback) {
            if (running) return stop(run.bind(this, nodes, options, callback));
            
            running = true;

            if (typeof nodes == "string") {
                nodes = [findFileByPath(nodes)];
                if (!nodes[0]) return callback(new Error("File not found"));
            }
            
            if (nodes && !Array.isArray(nodes))
                callback = options, options = nodes, nodes = null;
            
            if (typeof options == "function")
                callback = options, options = null;
            
            if (!nodes) {
                nodes = tree.selectedNodes;
                if (!nodes) return callback(new Error("Nothing to do"));
            }
            
            var withCodeCoverage = options && options.withCodeCoverage;
            var transformRun = options && options.transformRun;
            
            if (transformRun) {
                var button = runGui.transformButton("stop");
                button.setAttribute("command", "stoptest");
            }
            
            var list = [], found = {};
            nodes.forEach(function(n) {
                if (n.type == "prepare")
                    n = n.findFileNode(); // Weak solution. It should be able to run part of a test set without knowing tests
                    
                if (n.type == "all" || n.type == "root" || n.type == "runner")
                    n.findAllNodes("file").forEach(function(n) {
                        if (n.skip) return;
                        list.push(n); 
                        found[n.path] = true;
                    });
                else if (withCodeCoverage) {
                    var fileNode = n.findFileNode();
                    if (!found[fileNode.path])
                        list.push(fileNode);
                }
                else
                    list.push(n);
            });
            
            var firstRunner = list[0].findRunner();
            var parallel = (!options || options.parallel === undefined
                ? test.config.parallel || firstRunner.defaultParallel
                : options.parallel) || false;
            var parallelConcurrency = (!options || options.parallelConcurrency === undefined
                ? test.config.parallelConcurrency || firstRunner.defaultParallelConcurrency
                : options.parallelConcurrency) || 6;
            
            options.parallel = parallel;
            options.parallelConcurrency = parallelConcurrency;
            
            test.lastTest = nodes;
            
            var worker = function(node, callback) {
                if (stopping) return callback(new Error("Terminated"));
                
                if (node.status == "pending") { // TODO do this lazily
                    return populate(node, function(err) {
                        if (err) return callback(err);
                        _run(node, options, callback);
                    });
                }
                
                _run(node, options, callback);
            };
            var complete = function(err) {
                emit("stop", { nodes: list });
                callback(err, list);
            };
            
            if (parallel) {
                var queue = async.queue(worker, parallelConcurrency);
                queue.drain = complete;
                list.forEach(function(item) {
                    queue.push(item, function() {});
                });
            }
            else {
                async.eachSeries(list, worker, complete);
            }
        }
        
        var progress = {
            log: function(node, chunk) {
                node.fullOutput += chunk;
                emit("log", chunk);
            },
            start: function(node) {
                updateStatus(node, "running");
            },
            end: function(node) {
                updateStatus(node, "loaded");
            },
            stop: []
        };
        
        function findTest(path) {
            return (function recur(items) {
                for (var j, i = 0; i < items.length; i++) {
                    j = items[i];
                    if (j.type == "file") {
                        if (j.path == path) return j;
                    }
                    else if (j.items) return recur(j.items);
                }
            })(rootNode.items);
        }
        
        function _run(node, options, callback) {
            if (tree && tree.filterKeyword) {
                if (node.type == "file")
                    node = findFileByPath(node.path);
                else {
                    node.parent.findAllNodes(node.type).some(function(n) {
                        if (n.label == node.label) {
                            node = n;
                            return true;
                        }
                    });
                }
            }
            
            var runner = node.findRunner();
            var fileNode = node.findFileNode();
            
            if (!runner) 
                runner = findFileByPath(fileNode.path).findRunner();
            
            if (runner.form)
                options = runner.form.toJson(null, options || {});
            
            fileNode.fullOutput = ""; // Reset output
            updateStatus(node, "running");
            
            // Clear previous run information
            clear([node], true);
            // emit("clearResult", { node: node });
            
            var stop = runner.run(node, progress, options, function(err) {
                updateStatus(node, "loaded");
                
                var tab = tabManager.findTab(fileNode.path);
                if (tab) decorate(fileNode, tab);
                
                delete progress.stop[stopId];
                
                callback(err, node);
                
                // Write To Cache
                writeToCache(runner, fileNode.path, fileNode.serialize());
                
                emit("result", { node: node });
            });
            var stopId = progress.stop.push(stop) - 1;
        }
        
        function clearCache(runner, callback) {
            fs.rmdir("~/.c9/cache/" + runner.name, { recursive: true }, function() {
                callback && callback.apply(this, arguments);
            });
        }
        
        function writeToCache(runner, path, cache, callback) {
            fs.writeFile("~/.c9/cache/" + runner.name 
              + "/" + path.replace(/\//g, "\\"), cache, function(err) {
                callback && callback(err);
            });
        }
        
        function refreshTree(node) {
            while (node && !node.tree) node = node.parent;
            var T = node && node.tree || tree;
            if (T) T.refresh();
        }
        
        function updateStatus(node, s) {
            // TODO make this more efficient by trusting the child nodes
            if (node.type == "file" || node.type == "testset") {
                var tests = node.findAllNodes("test|prepare");
                var st, p = [];
                tests.forEach(function(test) {
                    if (st === undefined && test.status != "loaded")
                        st = test.status;
                    if (!p[test.passed]) p[test.passed] = 0;
                    p[test.passed]++;
                });
                
                node.passed = p[3] ? 3 : (p[2] ? 2 : p[0] ? 0 : (p[1] ? 1 : undefined));
                node.status = st || "loaded";
            }
            else if (node.type == "root") {
                refreshTree(node);
                return;
            }
            else {
                node.status = s;
            }
            
            if (node.parent) updateStatus(node.parent, s);
            else refreshTree(node);
        }
        
        function stop(callback) {
            if (!running) return callback(new Error("Not Running"));
            
            var timer;
            stopping = Date.now();
            plugin.once("stop", function(e) {
                clearTimeout(timer);
                
                (function _(items, first) {
                    items.forEach(function(node) { 
                        if (node.items)
                            _(node.items);
                        else if (typeof node.passed != "number")
                            node.passed = 3;
                        
                        // This caused unrun tests to no longer have an arrow
                        // if (first) updateStatus(node, "loaded");
                    });
                })(e.nodes, true);
                
                stopping = false;
                callback();
            });
            
            progress.stop.forEach(function(stop) {
                if (stop) stop();
            });
            
            timer = setTimeout(function() {
                emit("stop", { nodes: []});
                test.transformRunButton("run");
            }, 5000);
        }
        
        function clear(nodes, onlyNodes) {
            if (!nodes) 
                nodes = rootNode.items;
            
            nodes.forEach(function(n) {
                n.passed = undefined;
                n.ownPassed = null;
                n.output = "";
                if (n.status == "running")
                    n.status = "loaded";
                n.annotations = [];
                if (n.items) clear(n.items, true);
            });
            
            if (onlyNodes) return;
            
            if (tree.filterKeyword)
                tree.filterKeyword = tree.filterKeyword;
            else tree.refresh();
            
            test.runners.forEach(function(runner) {
                clearCache(runner);
            });
            
            clearAllDecorations();
        }
        
        function skip(nodes, callback) {
            if (typeof nodes == "function")
                callback = nodes, nodes = null;
            
            if (!nodes) nodes = tree.selectedNodes;
            
            var map = {};
            nodes.forEach(function(fileNode) {
                if (fileNode.type != "file") return;
                
                if (!map[fileNode.path]) {
                    fileNode.skip = !fileNode.skip;
                    
                    if (fileNode.skip)
                        test.config.skipped[fileNode.path] = true;
                    else
                        delete test.config.skipped[fileNode.path];
                        
                    fileNode.findAllNodes("test").forEach(function(n) {
                        n.skip = fileNode.skip;
                    });
                    
                    map[fileNode.path] = true;
                }
            });
            
            test.saveConfig(function(err) {
                tree.refresh();
                callback(err);
            });
        }
        
        function remove(nodes, callback) {
            if (typeof nodes == "function")
                callback = nodes, nodes = null;
            
            if (!nodes) nodes = tree.selectedNodes;
            
            nodes.forEach(function(fileNode) {
                if (fileNode.type != "file") return;
                
                if (!test.config.excluded[fileNode.path]) {
                    fileNode.parent.children.remove(fileNode);
                    fileNode.parent.items.remove(fileNode);
                    test.config.excluded[fileNode.path] = true;
                }
            });
            
            test.saveConfig(function(err) {
                tree.refresh();
                callback(err);
            });
        }
        
        // TODO: Think about moving this to a separate plugin
        function decorate(fileNode, tab) {
            var editor = tab.editor.ace;
            var session = (tab.document.getSession() || 0).session;

            if (!session || !tab.isActive()) {
                tab.once("activate", function() {
                    setTimeout(function() { decorate(fileNode, tab); });
                });
                return;
            }
            if (!session.$testMarkers) {
                session.$testMarkers = {};
                session.on("changeEditor", function(e) {
                    if (e.oldEditor) {
                        // TODO cleanup
                    }
                    if (e.editor) {
                        decorateEditor(e.editor); 
                    }
                });
                session.on("change", function(delta) {
                    var inlineWidgets = session.lineAnnotations;
                    var decorations = session.$decorations;
                    if (!inlineWidgets) return;
                    
                    var startRow = delta.start.row;
                    var len = delta.end.row - startRow;
            
                    if (len === 0) {
                        if (inlineWidgets[startRow])
                            inlineWidgets[startRow] = undefined;
                    } else if (delta.action == 'remove') {
                        inlineWidgets.splice(startRow + 1, len);
                        decorations.splice(startRow + 1, len);
                    } else {
                        var args = new Array(len);
                        args.unshift(startRow, 0);
                        inlineWidgets.splice.apply(inlineWidgets, args);
                        decorations.splice.apply(decorations, args);
                    }
                });
            }
            
            if (!session.widgetManager) {
                session.widgetManager = new LineWidgets(session);
                session.widgetManager.attach(editor);
            }
            
            clearDecoration(session);
            
            var showInline = settings.getBool("user/test/@inlineresults");
            
            var nodes = fileNode.findAllNodes("test|prepare");
            if (fileNode.ownPassed) nodes.push(fileNode);
            nodes.forEach(function(node) {
                if (!node.parent) fileNode.fixParents();
                
                if (node.passed !== undefined && (node.type == "test" || node.output)) {
                    var pos = node.pos ? node.pos.sl : 0;
                    session.addGutterDecoration(pos, "test-" + node.passed);
                    (session.$markers || (session.$markers = []))
                        .push([pos, "test-" + node.passed]);
                }
                if (showInline) {
                    if (node.annotations)
                        createStackWidget(editor, session, node);
                    if (node.output && node.output.trim())
                        createOutputWidget(editor, session, node);
                }
            });
        }
        
        function createOutputWidget(editor, session, node) {
            // editor.session.unfold(pos.row);
            // editor.selection.moveToPosition(pos);
            
            var w = {
                row: node.pos ? node.pos.el : 0, 
                fullWidth: true,
                // coverGutter: true,
                el: dom.createElement("div")
            };
            var extraClass = node.passed == 2 
                ? "ace_error" 
                : (node.passed == 1 ? "ace_ok" : "ace_warning");
            var el = w.el.appendChild(dom.createElement("div"));
            var arrow = w.el.appendChild(dom.createElement("div"));
            arrow.className = "error_widget_arrow " + extraClass;
            
            var pos = node.pos 
                ? { row: node.pos.el, column: node.pos.ec }
                : { row: 0, column: 0 };
            var left = editor.renderer.$cursorLayer.getPixelPosition(pos).left;
            arrow.style.left = left /*+ editor.renderer.gutterWidth*/ - 5 + "px";
            
            var runner = node.findRunner();
            if (!runner)
                runner = findFileByPath(node.findFileNode().path);
            
            w.el.className = "error_widget_wrapper";
            el.style.whiteSpace = "pre";
            el.className = "error_widget " + extraClass;
            el.innerHTML = runner
                ? runner.parseLinks(escapeHTML(node.output))
                : escapeHTML(node.output);
            
            var closeBtn = document.createElement("span");
            closeBtn.textContent = "\xd7";
            closeBtn.className = "widget-close-button";
            w.el.appendChild(closeBtn);
            closeBtn.onclick = function() { w.destroy(); };
            closeBtn.onmousedown = function(e) { e.preventDefault(); };
            
            w.el.addEventListener("click", function(e) {
                if (e.target && e.target.className == "link") {
                    var link = e.target.getAttribute("link");
                    var parts = link.split(":");
                    fs.exists(parts[0], function(exists) {
                        if (!exists) {
                            commands.exec("navigate", null, { 
                                keyword: link[0] == "/" ? link.substr(1) : link 
                            });
                            return;
                        }
                        
                        var path = parts[0].indexOf(c9.workspaceDir) === 0
                            ? parts[0].replace(c9.workspaceDir, "")
                            : parts[0];
                        
                        tabManager.open({
                            path: path,
                            focus: true,
                            document: {
                                ace: {
                                    jump: {
                                        row: Number(parts[1]),
                                        column: Number(parts[1])
                                    }
                                }
                            }
                        });
                    });
                }
            }, false);
            w.el.addEventListener("contextmenu", function(e) {
                if (e.which == 2 || e.which == 3) {
                    menuInlineContext.show(e.x + 1, e.y + 1);
                    e.stopPropagation();
                    e.preventDefault();
                    return false;
                }
            }, false);
            
            el.appendChild(dom.createElement("div"));
            
            w.destroy = function() {
                session.widgetManager.removeLineWidget(w);
                w.destroyed = true;
            };
            
            session.widgetManager.addLineWidget(w);
            session.$lineWidgets.push(w);
            
            // w.el.onmousedown = editor.focus.bind(editor);
            return w;
        }
        
        function decorateEditor(editor) {
            if (editor.decorated)
                return;
            editor.renderer.on("afterRender", updateLines);
            var onMouseDown = function(e) {
                var widget = e.target;
                if (widget.classList.contains("widget")) {
                    
                    if (widget.annotation && widget.classList.contains("more")) {
                        if (widget.output && !widget.output.destroyed) {
                            widget.output.destroy();
                            widget.output = null;
                        } 
                        else {
                            var a = widget.annotation;
                            widget.output = createOutputWidget(editor, a.session, {
                                pos: { el: a.row, ec: a.column },
                                passed: 0,
                                output: a.more,
                                findRunner: a.node.findRunner.bind(a.node)
                            });
                        }
                    }
                    e.stopPropagation();
                }
            };
            editor.decorated = true;
            editor.container.addEventListener("mousedown", onMouseDown, true);
        }
        
        function createStackWidget(editor, session, node) {
            decorateEditor(editor);
            var m, d;
            node.annotations.forEach(function(item) {
                m = item.message.trim();
                if (m.length <= 50) d = m;
                else {
                    if (m.match(/[\n\r]/) > -1)
                        d = m.split("\n")[0].substr(0, 45) + " ...";
                    else
                        d = m.substr(0, 20) + " ... " + m.substr(-25);
                }
                
                var pos = item.line - 1;
                session.addGutterDecoration(pos, "test-0");
                (session.$markers || (session.$markers = []))
                    .push([pos, "test-0"]);
                
                session.lineAnnotations[pos] = { 
                    display: d,
                    row: item.line - 1,
                    column: item.column,
                    more: m.length > 50 ? m : null,
                    session: session,
                    node: node
                };
            });
        }
        
        function updateLines(e, renderer) {
            var textLayer = renderer.$textLayer;
            var config = textLayer.config;
            var session = textLayer.session;
            
            if (!session.lineAnnotations) return;
            
            var first = config.firstRow;
            var last = config.lastRow;
            
            var lineElements = textLayer.element.childNodes;
            var lineElementsIdx = 0;
            
            var row = first;
            var foldLine = session.getNextFoldLine(row);
            var foldStart = foldLine ? foldLine.start.row : Infinity;
            
            var useGroups = textLayer.$useLineGroups();
            
            while (true) {
                if (row > foldStart) {
                    row = foldLine.end.row + 1;
                    foldLine = textLayer.session.getNextFoldLine(row, foldLine);
                    foldStart = foldLine ? foldLine.start.row : Infinity;
                }
                if (row > last)
                    break;
                
                var lineElement = lineElements[lineElementsIdx++];
                if (lineElement && session.lineAnnotations[row]) {
                    if (useGroups) lineElement = lineElement.lastChild;
                    var widget, a = session.lineAnnotations[row];
                    if (!a.element) {
                        widget = document.createElement("span");
                        widget.textContent = a.display;
                        widget.className = "widget stack-message" + (a.more ? " more" : "");
                        widget.annotation = a;
                        session.lineAnnotations[row].element = widget;
                    }
                    else widget = a.element;
                    
                    lineElement.appendChild(widget);
                }
                row++;
            }
        }
        
        function clearAllDecorations() {
            tabManager.getTabs().forEach(function(tab) {
                if (tab.editorType != "ace") return;
                var session = (tab.document.getSession() || 0).session;
                if (session) clearDecoration(session);
            });
        }
        
        function clearDecoration(session) {
            if (session.$markers) {
                session.$decorations.forEach(function(m, i) {
                    if (m)
                        session.$decorations[i] = m.replace(/ test-[01234]/g, "");
                });
            }
            if (session.lineAnnotations) {
                session.lineAnnotations.forEach(function(item) {
                    if (item && item.element && item.element.parentNode)
                        item.element.remove();
                });
            }
            if (session.$lineWidgets) {
                session.$lineWidgets.forEach(function(widget) {
                    session.widgetManager.removeLineWidget(widget);
                });
            }
            session.$markers = [];
            session.lineAnnotations = [];
            session.$lineWidgets = [];
        }
        
        function refresh() {
            tree && tree.refresh();
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("draw", function(e) {
            draw(e);
        });
        plugin.on("show", function(e) {
            // txtFilter.focus();
            // txtFilter.select();
        });
        plugin.on("hide", function(e) {
            // Cancel Preview
            // tabs.preview({ cancel: true });
        });
        plugin.on("unload", function() {
            drawn = false;
            tree = null;
            stopping = null;
            menuContext = null;
            running = null;
            boxFilter = null;
            menuInlineContext = null;
        });
        
        /***** Register and define API *****/
        
        /**
         * @class Template
         * @extends Plugin
         * @singleton
         */
        plugin.freezePublicAPI({
            /**
             * @property {Object}  The tree implementation
             * @private
             */
            get tree() { return tree; },
            
            /**
             * 
             */
            get contextMenu() { return menuContext; },
            
            /**
             * 
             */
            get root() { return rootNode; },
            
            /**
             * 
             */
            refresh: refresh,
            
            /**
             * 
             */
            run: run,
            
            /**
             * 
             */
            stop: stop,
            
            /**
             * 
             */
            skip: skip,
            
            /**
             * 
             */
            remove: remove,
            
            /**
             *
             */
            openTestFile: openTestFile,
            
            /**
             * 
             */
            findTest: findTest,
            
            /**
             * 
             */
            findFileByPath: findFileByPath,
            
            /**
             * 
             */
            writeToCache: writeToCache,
            
            /**
             * 
             */
            clearCache: clearCache
        });
        
        register(null, {
            "test.all": plugin
        });
    }
});