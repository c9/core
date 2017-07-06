define(function(require, exports, module) {
    main.consumes = [
        "Editor", "editors", "ui", "save", "test.coverage", "Datagrid",
        "layout", "settings", "tabManager", "commands", "Divider", "MenuItem",
        "console"
    ];
    main.provides = ["test.coverageview"];
    return main;

    function main(options, imports, register) {
        var ui = imports.ui;
        var save = imports.save;
        var Editor = imports.Editor;
        var Datagrid = imports.Datagrid;
        var editors = imports.editors;
        var layout = imports.layout;
        var Divider = imports.Divider;
        var MenuItem = imports.MenuItem;
        var tabManager = imports.tabManager;
        var settings = imports.settings;
        var console = imports.console;
        var commands = imports.commands;
        var coverage = imports["test.coverage"];
        
        var basename = require("path").basename;
        var dirname = require("path").dirname;
        
        /***** Initialization *****/
        
        var extensions = [];
        
        var handle = editors.register("coverageview", "Coverage View", CoverageView, extensions);
        
        handle.on("load", function() {
            commands.addCommand({
                name: "opencoverageview",
                // hint: "runs the selected test(s) in the test panel",
                // bindKey: { mac: "F6", win: "F6" },
                group: "Test",
                exec: function(editor, args) {
                    var tab;
                    if (tabManager.getTabs().some(function(t) {
                        if (t.editorType == "coverageview") {
                            tab = t;
                            return true;
                        }
                    })) {
                        tabManager.focusTab(tab);
                    }
                    else {
                        console.show();
                        tabManager.open({
                            editorType: "coverageview", 
                            focus: true, 
                            pane: console.getPanes()[0]
                        }, function() {});
                    }
                }
            }, handle);
            
            coverage.on("draw", function() {
                coverage.buttonMenu.append(new Divider());
                coverage.buttonMenu.append(new MenuItem({ 
                    caption: "Open Code Coverage View", 
                    command: "opencoverageview"
                }));
            }, handle);
        });
                          
        function CoverageView() {
            var plugin = new Editor("Ajax.org", main.consumes, extensions);
            var datagrid, dropdown;
            
            var BGCOLOR = { 
                "flat-light": "#f7f7f7", 
                "flat-dark": "#3D3D3D",
                "light": "#D3D3D3", 
                "light-gray": "#D3D3D3",
                "dark": "#3D3D3D",
                "dark-gray": "#3D3D3D" 
            };
            
            plugin.on("draw", function(e) {
                var vbox = e.tab.appendChild(new ui.vsplitbox({
                    childNodes: [
                        new ui.hbox({
                            height: 32,
                            edge: "1 1 1 1",
                            class: "coverage-toolbar",
                            childNodes: [
                                new ui.label({ caption: "Filter:" }),
                                dropdown = new ui.dropdown({ 
                                    skin: "black_dropdown",
                                    value: "all",
                                    minwidth: 150,
                                    "maxitems": 15,
                                    childNodes: [
                                        new ui.item({ caption: "All Tests", value: "all", selected: true })
                                    ]
                                })
                            ]
                        })
                    ]
                }));
                
                dropdown.on("afterchange", function() {
                    update();
                });
                
                var container = vbox.appendChild(new ui.bar());
                datagrid = new Datagrid({
                    container: container.$int,
                
                    columns: [
                        {
                            caption: "Hierarchy",
                            value: "label",
                            width: "60%",
                            type: "tree"
                        }, 
                        {
                            caption: "Covered (%)",
                            width: "20%",
                            getText: function(node) {
                                return node.covered + "%";
                            }
                        }, 
                        {
                            caption: "Not Covered",
                            value: "uncovered",
                            width: "20%"
                        }
                    ]
                }, plugin);
                
                datagrid.on("afterChoose", function() {
                    tabManager.openFile("/" + datagrid.selectedNode.label, 
                        true, function() {});
                });
                
                coverage.on("update", function() {
                    update();
                }, plugin);
                
                e.htmlNode.style.padding = 0;
                
                update();
            });
            
            /***** Method *****/
            
            function update() {
                var nodes = [];
                var lookup = nodes.lookup || (nodes.lookup = {});
                var filter = dropdown.value;
                
                var files;
                if (filter == "all") {
                    files = coverage.files;
                }
                else {
                    files = {};
                    coverage.tests[filter].paths.forEach(function(path) {
                        var cvg = coverage.files[path];
                        if (!cvg) return;
                        
                        files[path] = {
                            coveredLines: cvg.lines.covered.length,
                            totalLines: cvg.lines.covered.length + cvg.lines.uncovered.length,
                            lines: coverage.files[path].lines
                        };
                    });
                }
                
                for (var path in files) {
                    var file = files[path];
                    if (!file.lines)
                        continue;
                    
                    var node = lookup[path];
                    if (!node) 
                        nodes.push(node = lookup[path] = { label: path.substr(1) });
                        
                    node.covered = Math.round(file.coveredLines / file.totalLines * 100);
                    node.uncovered = file.totalLines - file.coveredLines;
                }
                
                var items = dropdown.childNodes;
                for (var i = items.length - 1; i >= 0; i--) {
                    if (items[i].value == "all") continue;
                    dropdown.removeChild(items[i]);
                }
                
                var tests = coverage.tests;
                for (var path in tests) {
                    var name = basename(dirname(path)) + "/" + basename(path);
                    dropdown.appendChild(new ui.item({ 
                        caption: name, 
                        value: path 
                    }));
                }
                
                // TODO set value again
                
                datagrid.setRoot(nodes);
            }
            
            /***** Lifecycle *****/
            
            plugin.on("documentLoad", function(e) {
                var doc = e.doc;
                
                function setTheme(e) {
                    var tab = doc.tab;
                    var isDark = e.theme == "dark";
                    
                    tab.backgroundColor = BGCOLOR[e.theme];
                    
                    if (isDark) tab.classList.add("dark");
                    else tab.classList.remove("dark");
                }
                
                layout.on("themeChange", setTheme, doc);
                setTheme({ theme: settings.get("user/general/@skin") });
                
                doc.title = "Code Coverage";
            });
            
            plugin.on("documentActivate", function(e) {
                
            });
            
            plugin.on("resize", function(e) {
                datagrid && datagrid.resize();
            });
            
            /***** Register and define API *****/
            
            plugin.freezePublicAPI({});
            
            plugin.load(null, "coverageview");
            
            return plugin;
        }
        
        register(null, {
            "test.coverageview": handle
        });
    }
});
