define(function(require, exports, module) {
    main.consumes = [
        "SCMPanel", "preferences", "settings", "panels", "Tree", "scm", "Menu", 
        "MenuItem", "tabManager", "c9", "util", "tabbehavior", "ui", "layout",
        "scm.log"
    ];
    main.provides = ["scm.detail"];
    return main;

    function main(options, imports, register) {
        var SCMPanel = imports.SCMPanel;
        var prefs = imports.preferences;
        var settings = imports.settings;
        var tabManager = imports.tabManager;
        var panels = imports.panels;
        var Tree = imports.Tree;
        var scm = imports.scm;
        var c9 = imports.c9;
        var layout = imports.layout;
        var ui = imports.ui;
        var Menu = imports.Menu;
        var MenuItem = imports.MenuItem;
        var tabbehavior = imports.tabbehavior;
        var util = imports.util;
        var scmlog = imports["scm.log"];
        
        // var async = require("async");
        var basename = require("path").basename;
        var dirname = require("path").dirname;
        var escapeHTML = require("ace/lib/lang").escapeHTML;

        /***** Initialization *****/

        var plugin = new SCMPanel("Ajax.org", main.consumes, {
            caption: "Test Results",
            index: 100,
            height: 250,
            splitter: true
        });
        // var emit = plugin.getEmitter();
        
        var workspaceDir = c9.workspaceDir;

        var tree, menuContext, label;
        var arrayCache = [];
        
        function load() {
            if (!scm.on) return;
        
            scm.on("workspaceDir", function(options) {
                workspaceDir = options.workspaceDir || c9.workspaceDir;
            }, plugin);
            
            panels.on("afterAnimate", function() {
                if (panels.isActive("changes"))
                    tree && tree.resize();
            });
            
            // settings.on("read", function(){
            //     settings.setDefaults("user/test", [["collapsegroups", false]]);
            // }, plugin);
            
            // prefs.add({
            //     "Test" : {
            //         position: 1000,
            //         "Test Runner" : {
            //             position: 100,
            //             "Collapse Passed and Skipped Groups" : {
            //                 type: "checkbox",
            //                 position: 200,
            //                 setting: "user/test/@collapsegroups"
            //             }
            //         }
            //     }
            // }, plugin);
        }
        
        var drawn = false;
        function draw(opts) {
            if (drawn) return;
            drawn = true;
            
            opts.html.innerHTML = "<div class='detail-label'></div><div class='detail-tree'></div>";
            opts.html.className = "detail-root top-test-panel";
            label = opts.html.firstChild;
            label.host = { textselect: true };
            
            tree = new Tree({
                container: opts.html.lastChild,
                scrollMargin: [10, 0],
                theme: "filetree",
                enableDragdrop: true,
            
                getIconHTML: function(node) {
                    var icon = node.isFolder ? "folder" : "status-icon-" + node.type;
                    if (node.parent == conflicts)
                        icon = "status-icon-conflict";
                    if (node.status === "loading") icon = "loading";
                    if (tree.model.twoWay && !node.isFolder)
                        icon += " clickable";
                    return "<span class='status-icon " + icon + "'>"
                        + (node.type || "") + "</span>";
                },
                
                getCaptionHTML: function(node) {
                    if (node.path) {
                        var path = node.labelPath || node.path;
                        return basename(path) 
                            + "<span class='extrainfo'> - " 
                            + dirname(path) + "</span>";
                    }
                    return escapeHTML(node.label || node.name);
                },
                
                getRowIndent: function(node) {
                    return 0; //node.$depth ? node.$depth - 2 : 0;
                },
                
                isLoading: function() {},
    
                getEmptyMessage: function() {
                    if (!this.keyword)
                        return this.isLoading()
                            ? "Loading file list. One moment please..."
                            : "No files found.";
                    else
                        return "No files found that match '" + this.keyword + "'";
                }
            }, plugin);
            
            tree.container.style.position = "absolute";
            tree.container.style.left = "0";
            tree.container.style.top = "0";
            tree.container.style.right = "0";
            tree.container.style.bottom = "0";
            tree.container.style.height = "";
            tree.renderer.scrollBarV.$minWidth = 10;
            
            tree.commands.bindKey("Space", function(e) {
                if (tabManager.previewTab)
                    tabManager.preview({ cancel: true });
                else
                    openSelection({ preview: true });
            });
            
            tree.commands.bindKey("Enter", function(e) {
                openSelection();
            });
            
            tree.commands.bindKey("Shift-Enter", function(e) {
                openSelectedFiles();
            });
            
            layout.on("eachTheme", function(e) {
                var height = parseInt(ui.getStyleRule(".filetree .tree-row", "height"), 10) || 22;
                tree.rowHeightInner = height;
                tree.rowHeight = height + 1;
                if (e.changed)
                    tree.resize();
            }, plugin);
            
            tree.on("afterChoose", function(e) {
                openSelection();
            });
            
            tree.on("userSelect", function(e) {
                if (tabManager.previewTab)
                    openSelection({ preview: true });
            });
            
            tree.on("drop", function(e) {
                if (e.target && e.selectedNodes) {
                    var nodes = e.selectedNodes;
                    if (e.target == staged) {
                        scm.addFileToStaging(nodes);
                    } else if (e.target == changed) {
                        scm.unstage(nodes);
                    }
                }   
            });
            
            tree.on("click", function(e) {
                if (e.domEvent.target.classList.contains("status-icon")) {
                    var node = e.getNode();
                    if (node.parent == staged) {
                        scm.unstage(node);
                    } else if (node.parent == changed || node.parent == ignored) {
                        scm.addFileToStaging(node);
                    } else if (node.parent == conflicts) {
                        scm.addFileToStaging(node);
                    }
                }
            });
            
            tree.setRoot(arrayCache);
            
            // tree.on("focus", function(){
            //     test.focussedPanel = plugin;
            // });
            
            // settings.on("read", function(){
            //     test.settingsMenu.append(new MenuItem({ 
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
            //         tree.refresh();
            //     }
            // }, plugin);
            
            scm.on("reload", function(options) {
                reload(options || { hash: 0, force: true }, function(e, status) {
                    
                });
            }, plugin);
            
            scm.on("resize", function() {
                tree && tree.resize();
            });
            
            scmlog.on("select", function(options) {
                if (options) reload(options, function() {});
            }, plugin);
            
            // Context Menu
            menuContext = new Menu({ items: [
                new MenuItem({ match: "file", class: "strong", caption: "Open Diff", onclick: openSelection }, plugin),
                new MenuItem({ match: "file", caption: "Open", onclick: openSelectedFiles }, plugin),
                new MenuItem({ match: "file", caption: "Reveal in File Tree", onclick: reveal }, plugin),
            ]});
            opts.aml.setAttribute("contextmenu", menuContext.aml);
            
            reload({ hash: 0, force: true }, function() {});
        }
        
        /***** Methods *****/
        
        var changed = {
            label: "modified files",
            className: "heading",
            items: [],
            isOpen: true,
            isFolder: true,
            noSelect: true,
            $sorted: true
        };
        var staged = {
            label: "files staged for commit",
            className: "heading",
            items: [],
            isOpen: true,
            isFolder: true,
            noSelect: true,
            $sorted: true
        };
        var ignored = {
            label: "ignored files",
            className: "heading",
            items: [],
            isOpen: false,
            isFolder: true,
            map: {},
            noSelect: true,
            $sorted: true
        };
        var untracked = {
            label: "untracked files",
            className: "heading",
            items: [],
            isOpen: false,
            isFolder: true,
            map: {},
            noSelect: true,
            $sorted: true
        };
        var conflicts = {
            label: "conflicts",
            className: "heading",
            items: [],
            isOpen: true,
            isFolder: true,
            noSelect: true,
            $sorted: true
        };
        function reload(options, cb) {
            if (!options) options = { hash: 0 };
            if (!tree.meta.options) tree.meta.options = {};
            if (!options.force)
            if (tree.meta.options.hash == options.hash && tree.meta.options.base == options.base)
                return;
            
            scm.getStatus(options, function(e, status) {
                var root = [];
                var i, name, x;
                var twoWay = options.twoWay;
                
                status = (status || "").split("\x00");
                console.log(status);
                if (twoWay) {
                    status.shift();
                    changed.items = changed.children = [];
                    staged.items = staged.children = [];
                    ignored.items = ignored.children = [];
                    conflicts.items = conflicts.children = [];
                    untracked.items = untracked.children = [];
                    root = {
                        items: [changed, staged, untracked],
                        $sorted: true,
                        isFolder: true
                    };
                    for (i = 0; i < status.length; i++) {
                        x = status[i];
                        name = x.substr(twoWay ? 3 : 2);
                        if (!name) continue;
                        
                        if (x[0] == "U" || x[1] == "U") {
                            conflicts.items.push({
                                label: name,
                                path: name,
                                type: x[0] + x[1]
                            });
                            continue;
                        }
                        if (x[0] == "R") {
                            i++;
                            staged.items.push({
                                label: name,
                                path: name,
                                originalPath: status[i],
                                type: x[0]
                            });
                        }
                        else if (x[0] != " " && x[0] != "?") {
                            staged.items.push({
                                label: name,
                                path: name,
                                type: x[0]
                            });
                        }
                        if (x[1] == "?") {
                            untracked.items.push({
                                label: name,
                                path: name,
                                type: x[1],
                                isFolder: name.slice(-1) == "/"
                            });
                        }
                        if (x[1] == "!") {
                            ignored.items.push({
                                label: name,
                                path: name,
                                type: x[1],
                                isFolder: name.slice(-1) == "/"
                            });
                        }
                        else if (x[1] != " ") {
                            changed.items.push({
                                label: name,
                                path: name,
                                type: x[1]
                            });
                        }
                    }
                    if (ignored.items.length)
                        root.items.push(ignored);
                    if (conflicts.items.length)
                        root.items.unshift(conflicts);
                    label.style.display = "none";
                } else {
                    for (i = 0; i < status.length; i += 2) {
                        x = status[i];
                        name = status[i + 1];
                        if (!name) continue;
                        
                        if (x[0] == "R") {
                            i++;
                            root.push({
                                label: status[i + 1] + "(from " + name + ")",
                                path: name,
                                originalPath: status[i + 1],
                                type: x[0]
                            });
                        } else {
                            root.push({
                                label: name,
                                path: name,
                                type: x[0]
                            });
                        }
                    }
                    
                    if (options.commit) {
                        label.innerHTML = "<span class='hash'>" + escapeHTML(options.hash) + "</span> "
                            + "<span>" + escapeHTML(options.commit.authorname) + "</span>"
                            + "<div>" + escapeHTML(options.commit.label) + "</div>";
                    } else {
                        label.innerHTML = "<span class='hash'>" + escapeHTML(options.hash) + "</span>"
                            + " ... "
                            + "<span class='hash'>" + escapeHTML(options.base) + "</span> ";
                    }
                    label.style.display = "block";
                }
                tree.setRoot(root);
                tree.meta.options = options;
                tree.model.twoWay = twoWay;
            });
        }
        
        function reveal() {
            var node = tree.selection.getCursor();
            var path = node.path;
            if (path) {
                if (path[0] != "/") path = "/" + path;
                path = workspaceDir + path;
                path = util.normalizePath(path);
                tabbehavior.revealtab({ path: path });
            }
        }
        
        function openSelection(opts) {
            if (!c9.has(c9.STORAGE))
                return;
            
            var node = tree.selectedNode;
            if (!node || node.isFolder)
                return;
            
            if (node.parent == conflicts)
                return openConflictView(node);
            
            var options = tree.meta.options;
            var oldPath = node.path;
            var newPath = node.originalPath || node.path;
            
            var hash = options.hash
                ? options.hash + ":"
                : (node.parent == staged ? "STAGED:" : "MODIFIED:");
            
            var base = options.base
                ? options.base + ":"
                : (node.parent == staged ? "HEAD:" : "PREVIOUS:");
            
            var diffview = {
                oldPath: base + oldPath,
                newPath: hash + newPath
            };
            
            var tab = findOpenDiffview(diffview);
            if (tab && !(opts && opts.preview)) {
                if (tab.document.meta.preview)
                    tabManager.preview({ cancel: true, keep: true });
                else {
                    opts && opts.preview
                        ? tabManager.activateTab(tab)
                        : tabManager.focusTab(tab);
                }
                return;
            }
            
            tabManager[opts && opts.preview ? "preview" : "open"]({
                editorType: "diffview",
                focus: true,
                document: {
                    diffview: diffview
                }
            }, function() {});
        }
        
        function findOpenDiffview(options) {
            var pages = tabManager.getTabs();
            for (var i = 0, tab = pages[i]; tab; tab = pages[i++]) {
                if (tab.editorType == "diffview") {
                    var session = tab.document.getSession();
                    if (session && session.oldPath == options.oldPath 
                      && session.newPath == options.newPath)
                        return tab;
                }
            }
        }
        
        function openConflictView(node) {
            var addConflictMarker = require("../diff/conflictmarker");
            var path = workspaceDir + "/" + node.path;
            tabManager.open({ path: path, focus: true }, function(e, tab) {
                addConflictMarker(tab.editor.ace);
            });
        }
        
        function openSelectedFiles(opts) {
            if (!c9.has(c9.STORAGE))
                return;
            
            var focus = opts && opts.focusNewTab || true;
            var sel = tree.selection.getSelectedNodes();
            var main = tree.selection.getCursor();
            
            sel.forEach(function(node) {
                if (!node || node.isFolder)
                    return;
    
                var pane = tabManager.focussedTab && tabManager.focussedTab.pane;
                if (tabManager.getPanes(tabManager.container).indexOf(pane) == -1)
                    pane = null;
    
                tabManager.open({
                    path: workspaceDir + "/" + node.path,
                    pane: pane,
                    noanim: sel.length > 1,
                    active: node === main,
                    focus: node === main && focus
                }, function() {});
            });
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
        });
        
        /***** Register and define API *****/
        
        /**
         * This is an example of an implementation of a plugin. Check out [the source](source/template.html)
         * for more information.
         * 
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
            get changed() { return changed; },
            /**
             * 
             */
            get ignored() { return ignored; },
            /**
             * 
             */
            get staged() { return staged; }
        });
        
        register(null, {
            "scm.detail": plugin
        });
    }
});