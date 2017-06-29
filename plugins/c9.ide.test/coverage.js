define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "test", "ui", "layout", "test.all", "c9", "util", 
        "tabManager", "commands", "settings", "Menu", "MenuItem", "Divider",
        "preferences", "save", "test.all"
    ];
    main.provides = ["test.coverage"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var test = imports.test;
        var all = imports["test.all"];
        var ui = imports.ui;
        var c9 = imports.c9;
        var util = imports.util;
        var layout = imports.layout;
        var commands = imports.commands;
        var settings = imports.settings;
        var tabManager = imports.tabManager;
        var Menu = imports.Menu;
        var MenuItem = imports.MenuItem;
        var Divider = imports.Divider;
        var save = imports.save;
        var prefs = imports.preferences;
        var testAll = imports["test.all"];
        
        var Range = require("ace/range").Range;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var files = {};
        var tests = {};
        var showCoverage = false;
        var reWs = new RegExp("^" + util.escapeRegExp(c9.workspaceDir));
        var menu, button;
        
        function load() {
            if (test.inactive)
                return;
                
            test.on("coverage", function(e) {
                addToLibrary(e.node);
                if (!showCoverage)
                    commands.exec("togglecoverage");
            }, plugin);
            test.on("clearCoverage", function(e) {
                removeFromLibrary(e.node);
            }, plugin);
            
            test.on("clear", function() {
                clear();
            }, plugin);
            
            // Hook opening of known files
            tabManager.on("open", function(e) {
                var tab = e.tab;
                if (!showCoverage) return;
                
                if (files[tab.path])
                    decorateTab(tab);
                else if (tests[tab.path])
                    decorateTab(tab, true);
            });
            
            commands.addCommand({
                name: "openrelatedtestfiles",
                // hint: "runs the selected test(s) in the test panel with code coverage enabled",
                // bindKey: { mac: "Command-O", win: "Ctrl-O" },
                group: "Test",
                exec: function(editor, args) {
                    var tree = test.focussedPanel.tree;
                    var fileNode = tree.selectedNode.findFileNode();
                    
                    if (tests[fileNode.path]) {
                        tests[fileNode.path].paths.forEach(function(path) {
                            tabManager.openFile(path, true, function() {});
                        });
                    }
                },
                isAvailable: function() {
                    var tree = test.focussedPanel.tree;
                    if (!tree || !tree.selectedNode) return false;
                    var fileNode = tree.selectedNode.findFileNode();
                    return tests[fileNode.path] ? true : false;
                }
            }, plugin);
            
            commands.addCommand({
                name: "togglecoverage",
                // hint: "runs the selected test(s) in the test panel with code coverage enabled",
                // bindKey: { mac: "Command-O", win: "Ctrl-O" },
                group: "Test",
                exec: function() {
                    showCoverage = !showCoverage;
                    settings.set("state/test/coverage/@show", showCoverage);
                    
                    if (!showCoverage)
                        clearAllDecorations();
                    else {
                        var tab;
                        for (var path in tests) {
                            tab = tabManager.findTab(path);
                            if (tab) decorateTab(tab, true);
                        }
                        for (var path in files) {
                            tab = tabManager.findTab(path);
                            if (tab) decorateTab(tab);
                        }
                    }
                },
                isAvailable: function() {
                    for (var path in tests) { 
                        if (tests[path].all) return true; 
                    }
                    return false;
                }
            }, plugin);
            
            commands.addCommand({
                name: "clearcoverage",
                // hint: "runs the selected test(s) in the test panel with code coverage enabled",
                // bindKey: { mac: "Command-O", win: "Ctrl-O" },
                group: "Test",
                exec: function() {
                    clear();
                },
                isAvailable: function() {
                    for (var path in tests) { 
                        if (tests[path].all) return true; 
                    }
                    return false;
                }
            }, plugin);
            
            settings.on("read", function() {
                settings.setDefaults("user/test/coverage", [
                    ["alwayson", false],
                    ["fullline", true],
                    ["testfiles", false],
                    ["toolbar", true]
                ]);
                
                settings.setDefaults("state/test/coverage", [
                    ["show", false]
                ]);
                
                settings.set("state/test/coverage/@show", false);
                
                var totalCoverage = settings.getNumber("state/test/coverage/@total");
                if (totalCoverage && settings.getBool("user/test/coverage/@toolbar")) {
                    draw();
                    
                    var amount = button.$ext.querySelector(".amount");
                    amount.textContent = totalCoverage + "%";
                    button.show();
                }
                
                all.once("draw", function() {
                    test.settingsMenu.append(new Divider({ position: 400 }));
                    test.settingsMenu.append(new MenuItem({ 
                        caption: "Show Coverage", 
                        type: "check",
                        checked: "state/test/coverage/@show",
                        position: 500,
                        command: "togglecoverage"
                    }));
                    test.settingsMenu.append(new MenuItem({ 
                        caption: "Always Run With Code Coverage", 
                        checked: "user/test/coverage/@alwayson",
                        type: "check",
                        position: 600
                    }));
                    test.settingsMenu.append(new MenuItem({ 
                        caption: "Mark Full Line Coverage In Editor", 
                        checked: "user/test/coverage/@fullline",
                        type: "check",
                        position: 700
                    }));
                });
            }, plugin);
            
            settings.on("user/test/coverage/@fullline", function(value) {
                if (!showCoverage) return;
                commands.exec("togglecoverage");
                commands.exec("togglecoverage");
            }, plugin);
            settings.on("user/test/coverage/@testfiles", function(value) {
                if (!showCoverage) return;
                var tab;
                if (value) {
                    for (var path in tests) {
                        tab = tabManager.findTab(path);
                        if (tab) decorateTab(tab);
                    }
                }
                else {
                    for (var path in tests) {
                        tab = tabManager.findTab(path);
                        if (tab) {
                            var session = tab.document.getSession().session;
                            if (session) clearDecoration(session);
                        }
                    }
                }
            }, plugin);
            settings.on("user/test/coverage/@toolbar", function(value) {
                value 
                    ? settings.getNumber("state/test/coverage/@total") && button.show() 
                    : button.hide();
            }, plugin);
            
            prefs.add({
                "Test": {
                    position: 1000,
                    "Code Coverage": {
                        position: 400,
                        "Always Run With Code Coverage": {
                            type: "checkbox",
                            position: 100,
                            setting: "user/test/coverage/@alwayson"
                        },
                        "Mark Full Line Coverage In Editor": {
                            type: "checkbox",
                            position: 200,
                            setting: "user/test/coverage/@fullline"
                        },
                        "Show Code Coverage In Test Files": {
                            type: "checkbox",
                            position: 300,
                            setting: "user/test/coverage/@testfiles"
                        },
                        "Show Total Code Coverage In Toolbar": {
                            type: "checkbox",
                            position: 400,
                            setting: "user/test/coverage/@toolbar"
                        },
                    }
                }
            }, plugin);
            
            // Save hooks
            // TODO figure out what changed in the file and only run applicable tests
            save.on("afterSave", function(e) {
                if (!settings.getBool("user/test/@runonsave") || !files[e.path])
                    return;
                
                var tests = Object.keys(files[e.path].coverage).map(function(path) {
                    return all.findTest(path);
                });
                
                var cmd = files[e.path].coverage ? "runtestwithcoverage" : "runtest";
                commands.exec(cmd, null, { nodes: tests });
            }, plugin);
            
            all.on("draw", function() {
                var menuRelatedFiles = new Menu({}, plugin);
                menuRelatedFiles.on("itemclick", function(e) {
                    tabManager.openFile(e.value, true);
                });
                
                menuRelatedFiles.on("show", function() {
                    var tree = test.focussedPanel.tree;
                    var fileNode = tree.selectedNode.findFileNode();
                    
                    var items = menuRelatedFiles.items;
                    for (var i = items.length - 1; i > 0; i--) {
                        menuRelatedFiles.remove(items[i]);
                    }
                    
                    if (tests[fileNode.path]) {
                        tests[fileNode.path].paths.forEach(function(path) {
                            menuRelatedFiles.append(new MenuItem({
                                caption: path,
                                value: path
                            }));
                        });
                    }
                });
            
                all.contextMenu.append(new MenuItem({ 
                    caption: "Open Related Files", 
                    position: 450,
                    submenu: menuRelatedFiles,
                    isAvailable: function() {
                        var tree = test.focussedPanel.tree;
                        if (!tree || !tree.selectedNode) return false;
                        var fileNode = tree.selectedNode.findFileNode();
                        return tests[fileNode.path] ? true : false;
                    }
                }), plugin);
            });
        }
        
        var drawn;
        function draw() {
            if (drawn) return;
            drawn = true;
            
            menu = new Menu({ items: [
                new MenuItem({ 
                    caption: "Show Coverage", 
                    checked: "state/test/coverage/@show",
                    type: "check",
                    position: 500,
                    command: "togglecoverage"
                }),
                new MenuItem({ 
                    caption: "Clear", 
                    command: "clearcoverage"
                })
            ]}, plugin);

            button = new ui.button({
                "skin": "c9-simple-btn",
                // "caption" : "Share",
                "class": "coverage-btn",
                "visible": false,
                "submenu": menu.aml
            });
            
            ui.insertByIndex(layout.findParent({
                name: "preferences"
            }), button, 865, plugin);
        
            // TODO threshold red: #AB4E4E, green: #3E713E
            button.$ext.innerHTML = '\
                <div class="title">Code coverage</div>\
                <div class="amount">~</div>';
            
            emit.sticky("draw");
        }
        
        /***** Methods *****/
        
        function addToLibrary(node) {
            var fileNode = node.findFileNode();
            var coverageFiles = node.coverage.files;
            
            if (!tests[fileNode.path] || !tests[fileNode.path].all) {
                tests[fileNode.path] = { 
                    paths: coverageFiles.map(function(coverage) {
                        return coverage.file.replace(reWs, "");
                    }),
                    node: fileNode,
                    all: coverageFiles 
                };
            }
            
            coverageFiles.forEach(function(coverage) {
                var path = coverage.file.replace(reWs, "");
                var tab;
                
                if (tests[path]) {
                    tests[path].own = coverage;
                    tab = tabManager.findTab(path);
                    if (tab) decorateTab(tab, true);
                }
                else {
                    var fInfo = files[path];
                    if (!fInfo || !fInfo.coverage) {
                        fInfo = files[path] = { 
                            coverage: {}, 
                            lines: {},
                            paths: [],
                            coveredLines: 0
                        };
                    }
                    
                    var isNew = fInfo.coverage[fileNode.path] ? false : true;
                    if (!fInfo.coverage[fileNode.path])
                        fInfo.paths.push(fileNode.path);
                    fInfo.coverage[fileNode.path] = coverage;
                    fInfo.totalLines = coverage.lines.found;
                    
                    if (isNew) {
                        fInfo.lines.covered = coverage.lines.covered;
                        fInfo.lines.uncovered = coverage.lines.uncovered;
                    }
                    else {
                        var covered = {}, uncovered = {};
                        
                        for (var path in fInfo.coverage) {
                            var cvg = fInfo.coverage[path];
                            (cvg.lines.covered || []).forEach(function(nr) {
                                covered[nr] = true;
                            });
                            (cvg.lines.uncovered || []).forEach(function(nr) {
                                uncovered[nr] = true;
                            });
                        }
                        
                        fInfo.lines = {
                            covered: Object.keys(covered),
                            uncovered: Object.keys(uncovered)
                        };
                    }
                    fInfo.coveredLines = fInfo.lines.covered.length;
                    
                    tab = tabManager.findTab(path);
                    if (tab) decorateTab(tab);
                }
            });
            
            // Store in settings
            updateGlobalCoverage();
            
            emit("update");
        }
        
        function removeFromLibrary(node) {
            var path = typeof node == "string" ? node : node.findFileNode().path;
            
            if (!tests[path]) return;
            
            var all = tests[path].all;
            var fileNode = tests[path].node;
            
            delete tests[path].own;
            delete tests[path].all;
            delete tests[path].node;
            
            if (fileNode) {
                fileNode.coverage = null;
                testAll.writeToCache(fileNode.findRunner(), path, 
                    fileNode.serialize());
            }
            
            if (!all) return; // Already cleared
            
            all.forEach(function(coverage) {
                var path = coverage.file.replace(reWs, "");
                var tab;
                
                if (files[path]) {
                    var fInfo = files[path];
                    delete fInfo.coverage; 
                    delete fInfo.lines;
                }
                
                tab = tabManager.findTab(path);
                if (tab) clearDecoration(tab);
            });
            
            // updateGlobalCoverage();
            
            emit("update");
        }
        
        function updateGlobalCoverage() {
            var totalLines = 0, coveredLines = 0;
            
            for (var path in files) {
                var file = files[path];
                
                totalLines += file.totalLines;
                coveredLines += file.coveredLines;
            }
            
            draw();
            
            var amount = button.$ext.querySelector(".amount");
            var totalCoverage = Math.round(coveredLines / totalLines * 100);
            amount.innerHTML = totalLines ? totalCoverage + "%" : "~";
            button[totalLines ? "show" : "hide"]();
            settings.set("state/test/coverage/@total", totalCoverage);
        }
        
        function addMarker(session, type, row, showMarker) {
            var marker = showMarker
                ? session.addMarker(new Range(row, 0, row, 1), "test-" + type, "fullLine")
                : null;
            session.addGutterDecoration(row, type);
            session.coverageLines.push({ marker: marker, gutter: row, type: type });
        }

        function decorateTab(tab, isTest) {
            if (isTest && !tests[tab.path]) return;
            else if (!files[tab.path]) return;
            
            if (isTest && !settings.getBool("user/test/coverage/@testfiles")) 
                return;
            
            var session = tab.document.getSession().session;
            if (!session) {
                tab.once("activate", function() { 
                    setTimeout(function() { 
                        decorateTab(tab, isTest); 
                    });
                });
                return;
            }
            
            clearDecoration(session);
            
            var coverage = isTest ? tests[tab.path].own : files[tab.path];
            var showMarker = settings.getBool("user/test/coverage/@fullline");
            if (coverage.lines.covered) {
                coverage.lines.covered.forEach(function(row) {
                    addMarker(session, "covered", row - 1, showMarker);
                });
            }
            if (coverage.lines.uncovered) {
                coverage.lines.uncovered.forEach(function(row) {
                    addMarker(session, "uncovered", row - 1, showMarker);
                });
            }
        }
        
        function clearDecoration(session) {
            if (session.document) {
                session = session.document.getSession().session;
                if (!session) return;
            }
            
            if (session.coverageLines) {
                session.coverageLines.forEach(function(i) {
                    if (i.marker) session.removeMarker(i.marker);
                    session.removeGutterDecoration(i.gutter, i.type);
                });
            }
            session.coverageLines = [];
        }
        
        function clearAllDecorations() {
            tabManager.getTabs().forEach(function(tab) {
                if (tab.editorType != "ace") return;
                var session = tab.document.getSession().session;
                if (session && session.coverageLines) clearDecoration(session);
            });
            
            showCoverage = false;
            settings.set("state/test/coverage/@show", false);
        }
        
        function clear() {
            for (var path in tests) {
                removeFromLibrary(path);
            }
            
            // settings.set("state/test/coverage/@total", "");
            // if (drawn) {
            //     button.hide();
            //     clearAllDecorations();
            // }
            
            emit("update");
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("unload", function() {
            drawn = false;
            files = null;
            tests = null;
            showCoverage = null;
            menu = null;
            button = null;
        });
        
        /***** Register and define API *****/
        
        plugin.freezePublicAPI({
            /**
             * 
             */
            get buttonMenu() { return menu; },
            
            /**
             * 
             */
            get tests() { return tests; },
            
            /**
             * 
             */
            get files() { return files; },
            
            /**
             * 
             */
            clear: clear
        });
        
        register(null, {
            "test.coverage": plugin
        });
    }
});