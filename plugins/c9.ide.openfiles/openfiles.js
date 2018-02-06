define(function(require, exports, module) {
    "use strict";
    
    main.consumes = [
        "Plugin", "tabManager", "menus", "commands", "settings",
        "tree", "save", "ui", "c9", "panels", "layout"
    ];
    main.provides = ["openfiles"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var tabs = imports.tabManager;
        var menus = imports.menus;
        var commands = imports.commands;
        var settings = imports.settings;
        var panels = imports.panels;
        var layout = imports.layout;
        var tree = imports.tree;
        var save = imports.save;
        var ui = imports.ui;

        var Tree = require("ace_tree/tree");
        var TreeData = require("./openfilesdp");
        var basename = require("path").basename;

        /***** Initialization *****/

        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();

        // tree maximum height
        var showOpenFiles = false;
        var defaultShow = options.defaultShow;
        var dragged = false;

        // UI Elements
        var ofDataProvider, ofTree, treeParent, winFileTree;
        var ctxItem, preventUpdate, mnuFilesSettings;

        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;

            // Hook events to get the focussed tab
            tabs.on("focusSync", delayedUpdate);
            // tabs.on("tabDestroy", delayedUpdate);
            tabs.on("tabAfterClose", update);
            tabs.on("tabReparent", delayedUpdate);
            tabs.on("tabOrder", delayedUpdate);

            save.on("tabSavingState", refresh);

            commands.addCommand({
                name: "toggleOpenfiles",
                exec: function(editor, args) {
                    toggleOpenfiles(args && args.forceOpen);
                }
            }, plugin);

            menus.addItemByPath("View/Open Files", new ui.item({
                type: "check",
                checked: "user/openfiles/@show"
                // command : "toggleOpenfiles"
            }), 210, plugin);
            
            tree.getElement("mnuFilesSettings", function(mnuFilesSettings) {
                ui.insertByIndex(mnuFilesSettings, new ui.item({
                    caption: "Show Open Files",
                    type: "check",
                    checked: "user/openfiles/@show",
                }), 190, plugin);
                ui.insertByIndex(mnuFilesSettings, 
                    new ui.divider(), 185, plugin);
            });

            settings.on("read", function(e) {
                // Defaults
                settings.setDefaults("user/openfiles", [
                    ["show", defaultShow],
                    ["hidetree", "false"]
                ]);
                showOpenFiles = settings.getBool("user/openfiles/@show");
                updateVisibility(showOpenFiles);
            }, plugin);
            
            settings.on("user/openfiles/@show", function(value) {
                showOpenFiles = value;
                updateVisibility(showOpenFiles);
            });
            
            panels.on("showPanelTree", function() { update(); });
        }

        var drawn = false;
        function draw() {
            if (drawn) return;
            drawn = true;

            // ace_tree customization '.openfiles'
            ui.insertCss(require("text!./openfiles.css"), null, plugin);

            tree.getElement("winOpenfiles", function(winOpenfiles) {
                treeParent = winOpenfiles;
                
                tree.getElement("winFileTree", function(winFileTreeL) {
                    winFileTree = winFileTreeL;
                });
                
                var div = document.createElement("div");
                treeParent.$int.appendChild(div);

                // Create the Ace Tree
                ofTree = new Tree(div);
                ofDataProvider = new TreeData();
                // ofTree.renderer.setScrollMargin(0, 10);
                ofTree.renderer.setTheme({ cssClass: "filetree" });
                // Assign the dataprovider
                ofTree.setDataProvider(ofDataProvider);
                
                layout.on("eachTheme", function(e) {
                    var height = parseInt(ui.getStyleRule(".openfiles .ace_tree .tree-row", "height"), 10);
                    ofDataProvider.rowHeightInner = height;
                    ofDataProvider.rowHeight = height;
                    
                    if (e.changed) (tree).resize(true);
                });

                ofTree.on("userSelect", function() {
                    setTimeout(onSelect, 40);
                });

                // make sure scrollbar on windows is in the padding area
                ofTree.renderer.on("scrollbarVisibilityChanged", updateScrollBarSize);
                ofTree.renderer.on("resize", updateScrollBarSize);
                function updateScrollBarSize() {
                    var w = ofTree.renderer.scrollBarV.getWidth();
                    ofTree.renderer.scroller.style.right = Math.max(w, 10) + "px";
                }

                // APF + DOM HACK: close tab with confirmation
                ofTree.on("mousedown", function(e) {
                    var domTarget = e.domEvent.target;
                    var pos = e.getDocumentPosition();
                    var node = ofDataProvider.findItemAtOffset(pos.y);
                    
                    if (node.children && !~domTarget.className.indexOf("toggler")) {
                        e.preventDefault();
                        return;
                    }
                    
                    if (! (node && node.path && domTarget && ~domTarget.className.indexOf("close")))
                        return;
                    
                    var amlTab = node.tab.aml;
                    amlTab.parentNode.remove(amlTab, {});
                });

                ofTree.focus = function() {};
                
                ofTree.renderer.on("autoresize", function() {
                    updateHeight();
                });
                
                ofTree.setOption("maxLines", 100);
                ofTree.renderer.getMaxHeight = function () {
                    return Math.floor(treeParent.parentNode.$int.offsetHeight * 0.5 - 23);
                };
                
                mnuFilesSettings = tree.getElement("mnuFilesSettings");
                ctxItem = ui.insertByIndex(mnuFilesSettings, new ui.item({
                    caption: "Hide Workspace Files",
                    type: "check",
                    visible: treeParent.visible,
                    checked: "state/openfiles/@hidetree",
                    onclick: function(e) {
                        hideTree(this.checked);
                    }
                }), 195, plugin);

                if (showOpenFiles) {
                    tabs.once("ready", function() { show(); });
                    
                    if (settings.getBool("state/openfiles/@hidetree"))
                        hideTree(true);
                }
                else
                    hideOpenFiles();

                emit("draw");
            });
        }

        /***** Methods *****/
        
        function hideTree(state) {
            settings.set("state/openfiles/@hidetree", state);
            
            if (treeParent) {
                if (state)
                    ui.setStyleClass(treeParent.parentNode.$int, "hidetree");
                else
                    ui.setStyleClass(treeParent.parentNode.$int, "", ["hidetree"]);
            }
            
            if (mnuFilesSettings) {
                mnuFilesSettings.childNodes.forEach(function(node) {
                    if (node.$position >= 200) {
                        node.setAttribute("visible", !state);
                    }
                });
            }
            
            if (ofTree) {
                ofTree.resize();
                tree.resize();
            }
        }
        
        var updateTimer;
        function delayedUpdate() {
            if (updateTimer)
                return;
            updateTimer = setTimeout(function() {
                updateTimer = null;
                update();
            }, 10);
        }

        function update() {
            if (!showOpenFiles)
                return;
                
            if (!panels.isActive("tree")) 
                return;

            draw();

            if (!ofTree)
                return;

            preventUpdate = true;

            var activePanes = tabs.getPanes(tabs.container);
            var focussedTab = tabs.focussedTab;
            // focussedTab can be the terminal or output views
            if (focussedTab && activePanes.indexOf(focussedTab.pane) === -1 
              && activePanes.length)
                focussedTab = activePanes[0].getTab();

            // unhook document change update listeners
            tabs.getTabs().forEach(function (tab) {
                tab.document && tab.document.off("changed", refresh);
            });

            var selected;
            var root = { groups: []};
            var actualRoot = {
                children: [
                    {
                        name: "open files",
                        path: "!openfiles",
                        isOpen: true,
                        className: "heading",
                        isRoot: true,
                        isFolder: true,
                        status: "loaded",
                        map: {},
                        children: root.groups,
                        noSelect: true
                    }
                ]
            };
        
            var oldRoot = ofDataProvider && ofDataProvider.root;
            var existing = oldRoot && oldRoot.groups || {};
            root.children = activePanes.map(function(pane, i) {
                var group = existing[i] || { isOpen: true, className: "group" };
                if (group.isOpen == "forced")
                    group.isOpen = false;
                root.groups[i] = group;
                group.children = null;
                // name: pane.name (tab0 ...)
                group.children = pane.getTabs()
                    .filter(function(tab) { 
                        return tab.path && tab.loaded && !tab.meta.$closing;
                    })
                    .map(function(tab) {
                        var node = {
                            name: basename(tab.path),
                            path: tab.path,
                            tab: tab
                        };
                        if (tab == focussedTab) {
                            selected = node;
                            group.isOpen = "forced";
                        }
                         
                        tab.document.on("changed", refresh);
                        return node;
                    });
                return group;
            }).filter(function(pane) {
                return pane.children.length;
            }).map(function (node, i) {
                node.name = "GROUP " + (i + 1);
                return node;
            });

            // Hide the openfiles
            if (!root.children.length) {
                preventUpdate = false;
                return hideOpenFiles();
            }

            ui.setStyleClass(treeParent.parentNode.$int, "hasopenfiles");

            treeParent.show();

            if (root.children.length === 1)
                actualRoot.children[0].children = root.children[0].children;

            ofDataProvider.setRoot(actualRoot);
            ofDataProvider.selection.selectNode(selected);
            
            updateHeight();
        }
        
        function updateHeight(selected) {
            preventUpdate = true;
            
            var maxHeight = treeParent.parentNode.$int.offsetHeight * 0.5;
            var treeHeight = ofTree.renderer.desiredHeight + 23;

            treeParent.$int.style.height = dragged
                ? Math.min(treeParent.getHeight(), treeHeight) + "px"
                : Math.min(treeHeight, maxHeight) + "px";

            // ofTree.resize(true);
            tree.resize();
            
            if (!selected)
                selected = ofTree.selectedNode;
            
            ofTree.renderer.scrollCaretIntoView(selected, 0.5);
            
            preventUpdate = false;
        }

        function refresh() {
            if (!showOpenFiles || !ofDataProvider)
                return;
            ofDataProvider._signal("change");
        }

        function onSelect() {
            var node = ofTree.selection.getCursor();
            if (node && tabs.focussedTab && tabs.focussedTab.path != node.path)
                tabs.focusTab(node.path);
        }

        function hideOpenFiles() {
            var htmlNode = treeParent && treeParent.parentNode.$int;
            htmlNode && ui.setStyleClass(htmlNode, "", ["hasopenfiles"]);
            treeParent && treeParent.hide();
            tree.resize();
        }

        function toggleOpenfiles(forceOpen) {
            showOpenFiles = forceOpen == null ? !showOpenFiles : forceOpen;
            settings.set("user/openfiles/@show", showOpenFiles);
            updateVisibility(showOpenFiles);
        }

        function updateVisibility(show) {
            if (show) {
                draw();
                update();
                ctxItem && ctxItem.show();
                
                if (settings.getBool("state/openfiles/@hidetree"))
                    hideTree(true);
                
                if (!panels.isActive("tree")) {
                    panels.once("showPanelTree", function() {
                        ofTree.resize(true);
                        tree.resize(true);
                    });
                    
                    panels.activate("tree");
                }
            }
            else {
                hideOpenFiles();
                ctxItem && ctxItem.hide();
                
                if (treeParent)
                    hideTree(false);
            }
            
            emit("visible", { value: show });
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

        function show() {
            updateVisibility(true);
        }

        function hide() {
            updateVisibility(false);
        }

        /***** Register and define API *****/
        
        /**
         * Displays the open files above the tree.
         * 
         * @singleton
         */
        plugin.freezePublicAPI({
            /**
             * Show the openfiles panel
             */
            show: show,

            /**
             * Hide the openfiles panel
             */
            hide: hide,

            /**
             * Trigger a complete update of the openfiles view, only when the 
             * openfiles panel is visible.
             */
            update: update,

            /**
             * Rerender the viewed part of the tree without having to recreate 
             * the tree data.
             * Example usage: when the saving state or document content changed
             * Only applies when openfiles is visible
             */
            refresh: refresh,
            
            /**
             * 
             */
            showTree: hideTree.bind(null, false),
            
            /**
             * 
             */
            hideTree: hideTree.bind(null, true)
        });

        register(null, {
            openfiles: plugin
        });
    }
});
