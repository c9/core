define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "ui", "fs.cache", "tree", "settings", "util", "commands",
        "navigate", "find", "preferences", "c9", "watcher"
    ];
    main.provides = ["tree.favorites"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var ui = imports.ui;
        var c9 = imports.c9;
        var tree = imports.tree;
        var util = imports.util;
        var find = imports.find;
        var settings = imports.settings;
        var commands = imports.commands;
        var navigate = imports.navigate;
        var watcher = imports.watcher;
        var prefs = imports.preferences;
        var fsCache = imports["fs.cache"];
        
        var basename = require("path").basename;
        var dirname = require("path").dirname;
        var escapeHTML = require("ace/lib/lang").escapeHTML;

        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var lut = {};
        var model = fsCache.model;
        var enabled = false;
        var startEmpty = options.startEmpty;
        var realRoot = options.realRoot;
        var alwaysScope = options.alwaysScope;
        var home = options.home;
        var reFavs = "";
        var changed, altRoot, favRoot, stored, hasScoping;
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            commands.addCommand({
                name: "addfavorite",
                exec: function() {
                    tree.selectedNodes.forEach(function(node) {
                        addFavorite(node.path);
                    });
                }
            }, plugin);
            commands.addCommand({
                name: "removefavorite",
                isAvailable: function() {
                    return tree && tree.selectedNode 
                        && isFavoritePath(tree.selectedNode.path);
                },
                exec: function() {
                    tree.selectedNodes.forEach(function(node) {
                        removeFavorite(node.path);
                    });
                }
            }, plugin);
            
            // Set real root
            model.realRoot = model.root;
            
            // Set empty message
            if (startEmpty) {
                model.emptyMessage = "Drag one or more folders here to populate"
                    + " this panel with files. Use the settings button in the"
                    + " top right to enable browsing the root file system.";
            } else if (realRoot) {
                model.emptyMessage = "There are no favorites defined. Please"
                    + " add some favorites to the tree using the settings"
                    + " button in the top right.";
            } else {
                model.emptyMessage = "There are no favorites defined. Use"
                    + " the settings button in the top right to add your"
                    + " workspace directory.";
            }
            
            altRoot = {
                children: [favRoot = {
                    label: "favorites",
                    path: "!favorites",
                    isOpen: true,
                    className: "heading",
                    isRoot: true,
                    isFolder: true,
                    status: "loaded",
                    map: {},
                    children: [],
                    noSelect: true,
                    $sorted: true
                }]
            };
            
            if (startEmpty)
                toggleRootFS(false);
            
            tree.once("draw", function() {
                tree.tree.on("dblclick", function(e) {
                    var selected = e.getNode();
                    var favNode = selected && isFavoritePath(selected.path);
                    if (favNode && favNode != selected) {
                        tree.select(favNode);
                        tree.scrollToSelection();
                        e.preventDefault();
                    }
                }, plugin);
                
                tree.tree.keyBinding.addKeyboardHandler(function(data, hashId, keyString, keyCode, e) {
                    if (hashId !== 0)
                        return;
                    var nodes = tree.selectedNodes;
                    if (nodes.length != 1)
                        return;
                    var node = nodes[0];
                    var favNode = isFavoritePath(node.path);
                    if (!favNode) {
                        if (keyString == "left" && !node.isOpen) {
                            node = node.parent;
                            favNode = node && isFavoritePath(node.path);
                            if (favNode) {
                                tree.select(favNode);
                                tree.scrollToSelection();
                                return { command: "null" };
                            }
                        }
                    } else {
                        if (keyString == "left") {
                            if (favNode == node) {
                                if (node.isOpen)
                                    tree.collapse(node);
                                else
                                    tree.expandAndSelect(node.path);
                            } else
                                tree.expandAndSelect(node.parent);
                            return { command: "null" };
                        } else if (keyString == "right" || keyString == "return") {
                            if (favNode != node) {
                                tree.select(favNode);
                                tree.scrollToSelection();
                                return { command: "null" };
                            }
                        }
                    }
                });
                
                tree.tree.on("folderDragEnter", function(dragInfo) {
                    if (dragInfo.$allowSortMode) {
                        if (dragInfo.hoverNode == favRoot) {
                            dragInfo.mode = "sort";
                            dragInfo.hoverNode = favRoot.children[0];
                            dragInfo.insertPos = -1;
                        }
                        else if (isFavoriteNode(dragInfo.hoverNode)) {
                            dragInfo.mode = "sort";
                            dragInfo.insertPos = 1;
                        } else {
                            var fsRoot = fsCache.model.realRoot;
                            var node = dragInfo.hoverNode;
                            do {
                                if (node == fsRoot) {
                                    dragInfo.hoverNode = fsRoot;
                                    dragInfo.insertPos = 1;
                                    break;
                                } else if (isFavoritePath(node.path)) {
                                    dragInfo.hoverNode = isFavoritePath(node.path);
                                    dragInfo.insertPos = 1;
                                    break;
                                }
                            } while (node = node.parent);
                        }
                    } else if (dragInfo.hoverNode == favRoot) {
                        dragInfo.mode = "sort";
                        dragInfo.insertPos = 1;
                    } else if (dragInfo.mode == "sort") {
                        dragInfo.mode = "move";
                        dragInfo.insertPos = 0;
                    }
                });
                
                tree.tree.on("dragStarted", function(e) {
                    var dragInfo = e.dragInfo;
                    var favs = dragInfo.selectedNodes.filter(function(node) {
                        return isFavoriteNode(node);
                    });
                    if (favs.length) {
                        if (favs.length < dragInfo.selectedNodes.length) {
                            dragInfo.selectedNodes = dragInfo.selectedNodes.filter(function(node) {
                                return isFavoriteNode(node);
                            });
                        } else {
                            dragInfo.$allowSortMode = true;
                            dragInfo.selectedNodes = [];
                            dragInfo.mode = "sort";
                        }
                    }
                });
                
                tree.tree.on("drop", function(dragInfo) {
                    var target = dragInfo.hoverNode;
                    if (target == favRoot) {
                        dragInfo.mode = "sort";
                        target = favRoot.children[0];
                    }
                    
                    if (dragInfo.mode == "sort") {
                        dragInfo.selectedNodes = null;
                        if (!dragInfo.node || !target)
                            return;
                        
                        if (dragInfo.hoverNode == fsCache.model.realRoot)
                            return removeFavorite(dragInfo.node.path);
                        
                        var favNode = addFavorite(dragInfo.node.path);
                        var index = favRoot.children.indexOf(target);
                        if (index == -1)
                            return;
                        if (dragInfo.insertPos == 1)
                            index++;
                        var oldIndex = favRoot.children.indexOf(favNode);
                        if (oldIndex != -1)
                            favRoot.children.splice(oldIndex, 1);
                        if (oldIndex < index)
                            index--;
                        favRoot.children.splice(index, 0, favNode);
                        fsCache.refresh(favRoot);
                        emit("favoriteReorder");
                        update(favNode);
                    }
                }, true);
                
                tree.on("isRootContext", function(node) {
                    return isFavoritePath(node.path) || node.path.charAt(0) == "~" 
                        && isFavoritePath(node.path.replace(/^~/, c9.home));
                });
            });
            
            tree.on("menuUpdate", function(e) {
                if (e.node && isFavoriteNode(e.node)) {
                    e.menu.childNodes.some(function(item) {
                        if (item.caption == "Delete") {
                            item.setAttribute("disabled", true);
                            return true;
                        }
                    });
                }
            });
            
            tree.on("beforeRename", function(e) {
                return !e.node.isFavorite;
            }, plugin);
            
            tree.on("delete", function(e) {
                var ok = [];
                e.selection.forEach(function(node) {
                    if (node.isFavorite)
                        removeFavorite(node.path);
                    else
                        ok.push(node);
                });
                if (ok.length == e.selection.length)
                    return;
                if (ok.length)
                    tree.remove(ok);
                return false;
            }, plugin);
            
            fsCache.on("findNode", function(e) {
                var path = e.path;
                if (path == "~") {
                    return lut["~"];
                }
                else if (path.charAt(0) == "~") {
                    var findNode = function(parts, node) {
                        var iter = 0;
                        var newp = parts[iter];
                        while (iter < parts.length) {
                            if (node) {
                                node = node.map[parts[++iter]];
                                if (!node) break;
                            }
                            else {
                                node = lut[newp];
                                newp += "/" + parts[++iter];
                            }
                        }
                        
                        return node;
                    };
                    
                    var parts = path.split("/");
                    var node = findNode(parts);
                    
                    return node;
                }
                else if (path.charAt(0) == "!") {
                    // if (e.path == "!favorite") return favRoot;
                    // if (e.path == "!fsroot") return model.realRoot;
                    return false;
                }
                else if (enabled && lut[path]) {
                    //e.type == "expand" || e.type == "collapse" || e.type == "refresh"
                    if (e.type)
                        return lut[path];
                }
                else if (path == "/" && e.type == "expand") {
                    toggleRootFS(true);
                }
            }, plugin);
            
            fsCache.on("readdir", function(e) {
                var node = isFavoritePath(e.parent.path);
                if (node)
                    model.setAttribute(node, "status", "loaded");
            });
            
            function keepSane(path) {
                var len = path.length + 1;
                for (var favPath in lut) {
                    if (favPath == path || favPath.substr(0, len) == path + "/")
                        removeFavorite(favPath);
                }
            }
            
            fsCache.on("remove", function(e) {
                // Lets ignore hidden files. It's most likely still there and
                // the user just switching hidden files off in the file tree
                // Possible solution is to do the filtering of hidden paths
                // only in the renderer of the tree
                if (!fsCache.showHidden && e.path.indexOf("/.") > -1)
                    return;
                    
                keepSane(e.path);
            });
            
            tree.on("rename", function(e) {
                keepSane(e.oldpath);
            });
            
            model.on("startUpdate", function(node) {
                var favNode = isFavoritePath(node.path);
                if (favNode) {
                    favNode.wasOpen = favNode.isOpen;
                    model.close(favNode, null, true);
                }
            });
            
            model.on("endUpdate", function(node, wasOpen) {
                var favNode = isFavoritePath(node.path);
                if (favNode && favNode.wasOpen) {
                    model.open(favNode, null, true);
                    favNode.wasOpen = false;
                }
            });
            
            model.on("expand", function(node) {
                var favNode = isFavoritePath(node.path);
                if (favNode) {
                    if (isFavoriteNode(node)) {
                        node = fsCache.findNode(node.path);
                        model.open(node);
                    }
                }
            });
            
            model.on("collapse", function(node) {
                var favNode = isFavoritePath(node.path);
                if (favNode) {
                    if (isFavoriteNode(node)) {
                        node = fsCache.findNode(node.path);
                        model.close(node);
                    }
                }
            });
            
            // Navigate
            
            // limit filelist to favorites  
            find.on("fileList", function(options) {
                if (!hasScoping) return;
                
                if (options.path == "/" && !options.startPaths) {
                    var paths = Object.keys(lut);
                    if (!paths.length)
                        return false;
                    
                    options.startPaths = paths.filter(function(p) {
                        return !lut[p].excludeFilelist && !paths.some(function(n) {
                            return p != n && p.substr(0, n.length) == n;
                        });
                    });
                }
            }, plugin);
            
            // Make sure the file list is updated when a favorite is added
            var updateNavigate = function(e) {
                if (!hasScoping) return;
                navigate.markDirty(null, e.init ? -100 : 0, true);
            };
            plugin.on("favoriteRemove", updateNavigate);
            plugin.on("favoriteAdd", updateNavigate);
            
            // Scope the paths in navigate
            navigate.on("draw", function() {
                var replaceStrong = navigate.tree.provider.replaceStrong;
                navigate.tree.provider.replaceStrong = function(path) {
                    if (hasScoping && reFavs && path.charAt(0) == "/")
                        path = path.replace(reFavs, function(m, n) {
                            return "(" + n.split("/").pop() + ")/"; 
                        });
                    return replaceStrong.call(navigate.tree.provider, path);
                };
            }, plugin);
            
            // Context Menu
            tree.getElement("mnuCtxTree", function(mnuCtxTree) {
                var remove, add;
                
                ui.insertByIndex(mnuCtxTree, add = new ui.item({
                    match: "folder|file",
                    command: "addfavorite",
                    caption: "Add to Favorites",
                }), 1000, plugin);
                ui.insertByIndex(mnuCtxTree, remove = new ui.item({
                    command: "removefavorite",
                    caption: "Remove from Favorites",
                }), 1001, plugin);
                ui.insertByIndex(mnuCtxTree, new ui.divider(), 1100, plugin);
                
                mnuCtxTree.on("prop.visible", function(e) {
                    if (e.value) {
                        var node = tree.selectedNode;
                        if (node && isFavoritePath(node.path)) {
                            add.hide();
                            remove.show();
                        }
                        else {
                            add.show();
                            remove.hide();
                        }
                    }
                });
                
                var mnuSettings = tree.getElement("mnuFilesSettings");
                ui.insertByIndex(mnuSettings, new ui.item({
                    type: "check",
                    caption: "Show Workspace Root",
                    checked: "state/projecttree/@showfs",
                    onclick: function(e) {
                        toggleRootFS();
                    }
                }), 250, plugin);
                var cbHome = new ui.item({
                    type: "check",
                    caption: "Show Home in Favorites",
                    write: true,
                    onclick: function(e) {
                        if (this.checked)
                            addFavorite(c9.toInternalPath(home));
                        else
                            removeFavorite(c9.toInternalPath(home));
                    }
                });
                ui.insertByIndex(mnuSettings, cbHome, 260, plugin);
                
                mnuSettings.on("prop.visible", function(e) {
                    if (e.value)
                        cbHome.setAttribute("checked", lut["~"] ? true : false);
                });
            });
            
            // Settings
            var init = false;
            settings.on("read", function() {
                settings.setDefaults("state/projecttree", [
                    ["showfs", startEmpty ? false : true]
                ]);
                settings.setDefaults("user/projecttree", [
                    ["scope", false]
                ]);
                
                if (settings.getBool("state/projecttree/@showfs"))
                    toggleRootFS(true);
                else
                    toggleRootFS(false);
                
                hasScoping = alwaysScope 
                    || settings.getBool("user/projecttree/@scope");
                
                if (!init) {
                    (settings.getJson("state/projecttree/favorites") || []).forEach(function(n) {
                        addFavorite(n, null, true);
                    });
                    
                    // Load file list
                    navigate.markDirty(null, 0);
                    
                    // @todo instead remove all favorites and set them again
                    init = true;
                }
            }, plugin);
            
            settings.on("user/projecttree", function() {
                var wasScoping = hasScoping;
                
                hasScoping = alwaysScope 
                    || settings.getBool("user/projecttree/@scope");
                
                if (wasScoping != hasScoping)
                    navigate.markDirty(null, 0, true);
            });
            
            settings.on("write", function() {
                if (!changed) return;
                
                var saved = favRoot.children.map(function(n) {
                    var node = util.extend({}, n);
                    delete node.isSelected;
                    delete node.children;
                    delete node.map;
                    delete node.parent;
                    delete node.$depth;
                    return node;
                });
                settings.setJson("state/projecttree/favorites", saved);
                
                changed = false;
            });
            
            // Prefs
            if (!alwaysScope) {
                prefs.add({
                    "General": {
                        "Tree & Navigate": {
                            "Scope Navigate To Favorites": {
                                type: "checkbox",
                                position: 1000,
                                path: "user/projecttree/@scope"
                            }
                        }
                    }
                }, plugin);
            }
            
            function update(e) {
                if (e && isFavoriteNode(e)) {
                    changed = true;
                    settings.save();
                }
            }
            model.on("expand", update);
            model.on("collapse", update);
        }
        
        /***** Methods *****/
        
        function wrap() {
            enabled = true;
            
            var getClassName = model.getClassName;
            model.getClassName = function(node) {
                var favNode = isFavoritePath(node.path);
                if (favNode && favNode != node)
                    return "favorite";
                else return getClassName.call(model, node);
            };
            
            var getChildren = model.getChildren;
            model.getChildren = function(node) {
                if (isFavoriteNode(node)) {
                    var realNode = fsCache.findNode(node.path);
                    var nodes = realNode && getChildren.call(model, realNode) || [];
                    nodes.forEach(function(child) {
                        child.$depth = node.$depth + 1;
                    });
                    return nodes;
                }
                else if (isFavoritePath(node.path))
                    return [];
                else
                    return getChildren.call(model, node);
            };
            
            var hasChildren = model.hasChildren;
            model.hasChildren = function(node) {
                if (isFavoriteNode(node)) {
                    var realNode = fsCache.findNode(node.path);
                    return realNode ? hasChildren.call(model, realNode) : true;
                }
                else if (isFavoritePath(node.path))
                    return false;
                else
                    return hasChildren.call(model, node);
            };
            
            var setRoot = model.setRoot;
            model.setRoot = function(node) {
                if (node != altRoot) {
                    if (!node.empty) {
                        altRoot.children.push(node);
                        node.isRoot = true;
                        node.isFSRoot = true;
                        node.label = "file system";
                        node.isFolder = true;
                        node.path = "!fsroot";
                        node.status = "loaded";
                        node.className = "heading";
                        node.noSelect = true;
                        
                        altRoot.map = node.map;
                    }
                    else {
                        if (!altRoot.map)
                            altRoot.map = { "": model.realRoot };
                        if (favRoot.children.length == 2)
                            favRoot.children.splice(1, 1);
                    }
                }
                
                // model.realRoot = node;
                setRoot.call(model, altRoot);
            };
            
            var getRowIndent = model.getRowIndent;
            model.getRowIndent = function(node) {
                return node.$depth ? node.$depth - 1 : 0;
            };
            
            var getIconHTML = model.getIconHTML;
            model.getIconHTML = function(node) {
                if (node.isFavorite) {
                    var realNode = fsCache.findNode(node.path);
                    node = { 
                        label: node.path, 
                        status: realNode ? realNode.status : node.status,
                        isFolder: node.isFolder 
                    };
                }
                
                return getIconHTML.call(model, node);
            };
            
            var getCaptionHTML = model.getCaptionHTML;
            model.getCaptionHTML = function(node) {
                if (node.isFavorite) {
                    var path = node.labelPath || node.path;
                    return escapeHTML(basename(path)) 
                        + "<span class='extrainfo'> - " 
                        + escapeHTML(dirname(path)) + "</span>";
                }
                else
                    return getCaptionHTML.call(model, node);
            };
            
            if (model.root)
                model.setRoot(model.root);
            
            toggleRootFS();
            
            stored = {
                setRoot: setRoot,
                getRowIndent: getRowIndent,
                getChildren: getChildren,
                hasChildren: hasChildren,
                getCaptionHTML: getCaptionHTML,
                getClassName: getClassName
            };
        }
        
        function unwrap() {
            enabled = false;
            
            for (var prop in stored) {
                model[prop] = stored[prop];
            }
            stored = null;
            lut = {};
            
            altRoot.children.splice(1, 1);
            
            var node = model.realRoot;
            delete node.isRoot;
            delete node.isFSRoot;
            delete node.label;
            delete node.isFolder;
            delete node.path;
            delete node.className;
            delete node.$depth;

            model.setRoot(node);
            
            toggleRootFS();
        }
        
        function isFavoritePath(path) {
            return lut[path];
        }
        
        function isFavoriteNode(node) {
            return lut[node.path] == node;
        }
        
        function getFavoritePaths() {
            return favRoot && favRoot.children.map(function(n) { 
                return n.path; 
            }) || [];
        }
        
        function addFavorite(path, name, init) {
            var node, favNode;
            
            if (lut[path.path || path]) 
                return lut[path.path || path];
            
            if (typeof path == "string") {
                node = fsCache.findNode(path);
                favNode = {
                    path: path,
                    labelPath: name,
                    isFavorite: true,
                    isRootContext: true,
                    isFolder: node ? node.isFolder : true,
                    offset: node ? node.$depth : path.split("/").length - 1
                };
                if (favNode.isFolder) {
                    favNode.status = "pending";
                    favNode.map = node ? node.map : {};
                    favNode.isOpen = node && node.isOpen;
                }
            }
            else {
                favNode = path;
                path = favNode.path;
                favNode.status = "pending";
                favNode.map = {};
                
                path = favNode.path;
            }
            
            lut[path] = favNode;
            favRoot.children.push(favNode);
            updateRegExp();
            
            if (path == "~") {
                favRoot.map["~"] = favNode;
            }
            
            changed = true;
            settings.save();
            
            if (!enabled) wrap();
            
            fsCache.refresh(node);
            fsCache.refresh(favRoot);
            
            // tree.expand(favNode);
            watcher.watch(path == "~" ? path : dirname(path));
            
            emit("favoriteAdd", { path: path, init: init });
            
            return favNode;
        }
        
        function removeFavorite(path) {
            var node = lut[path];
            if (!node) return;
            
            favRoot.children.splice(favRoot.children.indexOf(node), 1);
            delete lut[path];
            updateRegExp();
            
            changed = true;
            settings.save();
            
            if (path == "~") {
                delete favRoot.map["~"];
                delete model.root.map["~"];
            }
            
            if (!favRoot.children.length)
                unwrap();
            
            var realNode = fsCache.findNode(path);
            realNode && fsCache.refresh(realNode);
            fsCache.refresh(favRoot);
            
            emit("favoriteRemove", { path: path, node: node });
        }
        
        function updateRegExp() {
            var paths = Object.keys(lut).map(function(p) {
                return util.escapeRegExp(p.replace(/^~/, c9.home));
            });
            
            reFavs = paths.length ? new RegExp("^(" + paths.join("|") + ")\/") : "";
        }
        
        function toggleRootFS(force) {
            var showFS = typeof force == "boolean"
                ? force 
                : settings.getBool("state/projecttree/@showfs");
            
            if (!showFS && !enabled)
                model.hideAllNodes();
            else if (!showFS && enabled) {
                altRoot.children.splice(1, 1);
                model.showAllNodes();
            }
            else if (showFS && !enabled) {
                model.showAllNodes();
                // @todo setRoot ??
            }
            else if (showFS && enabled) {
                if (altRoot.children.length == 1)
                    altRoot.children.push(model.realRoot);
                model.showAllNodes();
            }
            
            if (force)
                settings.set("state/projecttree/@showfs", force);
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
            unwrap();
            loaded = false;
        });
        
        /***** Register and define API *****/
        
        /**
         * 
         **/
        plugin.freezePublicAPI({
            get favorites() { return getFavoritePaths(); },
            
            _events: [
                /**
                 * @event favoriteAdd
                 */
                "favoriteAdd",
                /**
                 * @event favoriteRemove
                 */
                "favoriteRemove"
            ],
            
            /**
             * 
             */
            isFavoritePath: isFavoritePath,
            
            /**
             * 
             */
            isFavoriteNode: isFavoriteNode,
            
            /**
             * 
             */
            addFavorite: addFavorite,
            
            /**
             * 
             */
            removeFavorite: removeFavorite,
            
            /**
             * 
             */
            getFavoritePaths: getFavoritePaths,
        });
        
        register(null, {
            "tree.favorites": plugin
        });
    }
});
