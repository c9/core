define(function(require, exports, module) {
    main.consumes = [
        "Editor", "editors", "ui", "save", "scm", "Datagrid", "Tree",
        "layout", "settings", "tabManager", "commands", "Divider", "MenuItem",
        "console", "Menu", "preferences.experimental", "c9"
    ];
    main.provides = ["scm.log"];
    return main;

    function main(options, imports, register) {
        var ui = imports.ui;
        var c9 = imports.c9;
        var save = imports.save;
        var Editor = imports.Editor;
        var Tree = imports.Tree;
        var Datagrid = imports.Datagrid;
        var editors = imports.editors;
        var layout = imports.layout;
        var Menu = imports.Menu;
        var Divider = imports.Divider;
        var MenuItem = imports.MenuItem;
        var tabManager = imports.tabManager;
        var settings = imports.settings;
        var cnsl = imports.console;
        var commands = imports.commands;
        var experimental = imports["preferences.experimental"];
        var scmProvider = imports.scm;
        
        var GitGraph = require("./log/log");
        
        var basename = require("path").basename;
        var dirname = require("path").dirname;
        var escapeHTML = require("ace/lib/lang").escapeHTML;
        
        /***** Initialization *****/
        
        var ENABLED = experimental.addExperiment("git", !c9.hosted, "Panels/Source Control Management");
        if (!ENABLED)
            return register(null, { "scm.log": {}});
        
        var extensions = [];
        
        var handle = editors.register("scmlog", "SCM Log Viewer", LogView, extensions);
        
        handle.on("load", function() {
            // commands.addCommand({
            //     name: "opencoverageview",
            //     // hint: "runs the selected test(s) in the test panel",
            //     // bindKey: { mac: "F6", win: "F6" },
            //     group: "Test",
            //     exec: function(editor, args){
            //         var tab;
            //         if (tabManager.getTabs().some(function(t){
            //             if (t.editorType == "coverageview") {
            //                 tab = t;
            //                 return true;
            //             }
            //         })) {
            //             tabManager.focusTab(tab);
            //         }
            //         else {
            //             cnsl.show();
            //             tabManager.open({
            //                 editorType: "coverageview", 
            //                 focus: true, 
            //                 pane: cnsl.getPanes()[0]
            //             }, function(){});
            //         }
            //     }
            // }, handle);
        });
                          
        function LogView() {
            var plugin = new Editor("Ajax.org", main.consumes, extensions);
            var emit = plugin.getEmitter();
            
            var datagrid, dropdown, label, tree, detail, scm, ready;
            var currentDocument;
            
            var BGCOLOR = { 
                "flat-light": "#f7f7f7", 
                "flat-dark": "#3D3D3D",
                "light": "#D3D3D3", 
                "light-gray": "#D3D3D3",
                "dark": "#3D3D3D",
                "dark-gray": "#3D3D3D" 
            };
            
            plugin.on("draw", function(e) {
                e.htmlNode.style.paddingTop = 0;
                
                var container = e.tab.appendChild(new ui.bar({ anchors: "0 0 0 0" }));
                drawLog(container.$int);
                
                scmProvider.on("scm", function(implementation) {
                    scm = implementation;
                    
                    if (scm) {                    
                        scm.on("log", function(node) {
                            datagrid.model.loadData(node);
                        }, plugin);
                        
                        scm.on("log.dirty", function(node) {
                            reloadLog();
                        }, plugin);
                    }
                    
                    reloadLog();
                });
            });
                
            function drawLog(parentHtml) {
                datagrid = new Datagrid({
                    container: parentHtml,
                    scrollMargin: [0, 0],
                    theme: "blackdg versionlog",
                    
                    columns: [
                        {
                            caption: "Date",
                            width: "110",
                            getText: function(node) {
                                if (!node.$uiDate && node.date)
                                    node.$uiDate = new Date(parseInt(node.date) * 1000).toString("yyyy-MM-dd hh:mm");
                                return node.$uiDate || "";
                            }
                        }, 
                        {
                            caption: "User",
                            value: "authorname",
                            width: "100"
                        },
                        {
                            caption: "Commit Message",
                            value: "label",
                            width: "100%",
                            type: "tree"
                        }, 
                    ],
                
                    isLoading: function() {},
        
                    getEmptyMessage: function() {
                        return "Loading log...";
                    }
                }, plugin);
                
                datagrid.container.style.position = "absolute";
                datagrid.container.style.left = "0";
                datagrid.container.style.top = "0";
                datagrid.container.style.right = "0px";
                datagrid.container.style.bottom = "0";
                datagrid.container.style.height = "";
                
                // Enable Git Graph
                new GitGraph().attachToTree(datagrid.acetree);
                
                // datagrid.tooltip = new Tooltip(tree);
                // logdatagrid.tooltip = new Tooltip(logTree);
                
                layout.on("eachTheme", function(e) {
                    var height = parseInt(ui.getStyleRule(".filetree .tree-row", "height"), 10) || 20;
                    datagrid.rowHeightInner = height;
                    datagrid.rowHeight = height;
                    if (e.changed)
                        datagrid.resize();
                }, plugin);
                
                datagrid.commands.bindKey("Enter", function(e) {
                    showCompareView(datagrid.selectedNode);
                });
                
                datagrid.commands.bindKey("Space", function(e) {
                    if (tabManager.previewTab)
                        tabManager.preview({ cancel: true });
                    else
                        showCompareView(datagrid.selectedNode, true);
                });
                
                datagrid.on("afterChoose", function(e) {
                    showCompareView(datagrid.selectedNode);
                });
                
                datagrid.on("userSelect", function(e) {
                    if (tabManager.previewTab)
                        showCompareView(datagrid.selectedNode, true);
                });
                
                var switchToTree = function(e) {
                    tree.focus();
                    if (!tree.selectedNode)
                        tree.select(tree.root[0]);
                };
                datagrid.commands.bindKey("Right", switchToTree);
                datagrid.commands.bindKey("Tab", switchToTree);
                
                datagrid.on("userSelect", function(e) {
                    var options = {};
                    var nodes = datagrid.selectedNodes;
                    
                    if (!nodes[0]) 
                        return;
                        
                    options.hash = nodes[0].hash;
                    if (nodes[0].parents)
                        options.base = nodes[0].parents.match(/\S*/)[0] || "4b825dc6";
                    
                    if (nodes[1])
                        options.base = nodes[1].hash;
                    
                    if (!nodes[1] && !options.hash)
                        options.twoWay = true;
                        
                    if (!nodes[1]) {
                        options.commit = nodes[0];
                    }
                    
                    emit("select", options);
                });
                // datagrid.setRoot(rootNode = new Node({
                //     label: "root",
                //     tree: tree
                // }));
                
                // datagrid.on("focus", function(){
                //     scm.focussedPanel = plugin;
                // });
                
                // settings.on("read", function(){
                //     scm.settingsMenu.append(new MenuItem({ 
                //         caption: "Collapse Passed and Skipped Groups", 
                //         checked: "user/test/@collapsegroups",
                //         type: "check",
                //         position: 300
                //     }));
                // }, plugin);
                
                // settings.on("user/test/@collapsegroups", function(value){
                //     if (plugin.visible) {
                //         skipNode.isOpen = !value;
                //         passNode.isOpen = !value;
                //         datagrid.refresh();
                //     }
                // }, plugin);
                
                    // scm.on("resize", function(){
                    //     tree && datagrid.resize();
                    // });
                
                // new Datagrid({
                //     container: container.$int,
                
                //     columns : [
                //         {
                //             caption: "Hierarchy",
                //             value: "label",
                //             width: "60%",
                //             type: "tree"
                //         }, 
                //         {
                //             caption: "Covered (%)",
                //             width: "20%",
                //             getText: function(node){
                //                 return node.covered + "%";
                //             }
                //         }, 
                //         {
                //             caption: "Not Covered",
                //             value: "uncovered",
                //             width: "20%"
                //         }
                //     ]
                // }, plugin);
                
                // e.htmlNode.style.padding = 0;
            }
            
            /***** Method *****/
            
            function showBranch(hash) {
                var node;
                if (datagrid.model.visibleItems.some(function(b) {
                    if (b.hash == hash) {
                        node = b;
                        return true;
                    }
                })) {
                    datagrid.select(node);
                    datagrid.scrollIntoView(node, 0.5);
                }
            }
            
            function reloadLog() {
                if (!scm) {
                    tree.emptyMessage = "No repository detected";
                    tree.setRoot(null);
                    return;
                }
                
                var doc = currentDocument;
                if (doc) {
                    doc.tab.classList.add("connecting");
                    doc.tab.classList.remove("error");
                }
                
                scm.getLog({}, function(err, root) {
                    doc && doc.tab.classList.remove("connecting");
                    
                    if (err) {
                        doc && doc.tab.classList.add("error");
                        return console.error(err);
                    }
                    
                    if (!ready) {
                        ready = true;
                        emit.sticky("ready");
                    }
                });
            }
            
            function showCompareView(node, preview) {
                if (node.label == "// WIP") {
                    return scmProvider.openDiff({
                        preview: preview
                    });
                }
                
                scmProvider.openDiff({
                    hash: node.hash,
                    preview: preview
                });
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
                
                doc.title = "Version Log";
            });
            
            plugin.on("documentActivate", function(e) {
                currentDocument = e.doc;
            });
            
            plugin.on("documentUnload", function(e) {
                if (currentDocument == e.doc)
                    currentDocument = null;
            });
            
            plugin.on("resize", function(e) {
                datagrid && datagrid.resize();
            });
            
            plugin.on("focus", function(e) {
                datagrid && datagrid.focus();
            });
            
            /***** Register and define API *****/
            
            plugin.freezePublicAPI({
                /**
                 * 
                 */
                get ready() { return ready; },
                /**
                 * 
                 */
                get tree() { return tree; },
                
                /**
                 * 
                 */
                showBranch: showBranch
            });
            
            plugin.load(null, "scmlog");
            
            return plugin;
        }
        
        register(null, {
            "scm.log": handle
        });
    }
});
