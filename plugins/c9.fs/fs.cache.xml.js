define(function(require, exports, module) {
    "use strict";
    
    main.consumes = ["fs", "Plugin", "c9", "util", "watcher", "error_handler"];
    main.provides = ["fs.cache"];
    return main;

    function main(options, imports, register) {
        var fs = imports.fs;
        var Plugin = imports.Plugin;
        var c9 = imports.c9;
        var util = imports.util;
        var watcher = imports.watcher;
        var reportError = imports.error_handler.reportError;
        var TreeData = require("ace_tree/data_provider");
        var lang = require("ace/lib/lang");
        
        // var basename = require("path").basename;
        var dirname = require("path").dirname;

        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var model = new TreeData();
        var showHidden = false;
        var hiddenFilePattern = "";
        var hiddenFileRe = /^$/;
        
        var orphans = {};
        
        model.loadChildren = function(node, cb) {
            fs.readdir(node.path, function(err, files) {
                cb && cb(err, files);
            });
        };
        model.getClassName = function(node) {
            var cl = node.className || "";
            if (node.link)
                cl += " symlink";
            if (node.isCut)
                cl += " cut";
            return cl;
        };
        
        var loaded = false;
        function load(){
            if (loaded) return false;
            loaded = true;
            
            clear();
            
            // Watch
            watcher.on("delete", function(e) {
                removeSingleNode(e);
            });
            
            watcher.on("change.all", function(e) {
                onstat({ path: e.path, result: [null, e.stat] });
            });
            
            watcher.on("directory.all", function(e) {
                // @todo make onreaddir incremental
                onreaddir({ path: e.path, result: [null, e.files] });
            });
            
            // Read
            fs.on("beforeReaddir", function (e) {
                var node = findNode(e.path);
                if (!node) 
                    return; // Parent is not visible
                
                // Indicate this directory is being read
                model.setAttribute(node, "status", "loading");
            });
            
            function onreaddir(e, orphan) {
                var node = findNode(e.path);
                if (e.error) {
                    if (node)
                        node.status = "pending";
                    return;
                }
                var parentPath = e.path;
                if (!parentPath.endsWith("/"))
                    parentPath += "/";
                // update cache
                if (!node) {
                    if (!showHidden && isFileHidden(e.path))
                        return;
                    node = createNode(e.path);
                    if (!node) return;
                    node.isFolder = true;
                    orphans[e.path] = node;
                    orphan = true;
                }
                node.$lastReadT = Date.now();

                // Indicate this directory has been fully read
                model.setAttribute(node, "status", "loaded");
                
                var ondisk = Object.create(null);
                var toRemove = [];
                var toCreate = [];
                var orphanAppand = [];
                var existing = node.map || (node.map = Object.create(null));
                e.result[1].forEach(function(stat) {
                    if (!stat.name || !showHidden && isFileHidden(stat.name))
                        return;
                    var name = stat.name;
                    var path = parentPath + name;

                    ondisk[name] = 1;
                    
                    if (orphans[path]) {
                        if (existing[name])
                            delete orphans[path];
                        orphanAppand.push(path);
                    }
                    
                    if (existing[name])
                        updateNodeStat(path, stat, existing[name]);
                    else
                        toCreate.push(stat);
                });
                
                Object.keys(existing).forEach(function(name) {
                    // onreaddir can be called before copied nodes are written to disk
                    // in this case we don't want to lose "predicted" state
                    if (existing[name] && existing[name].status === "predicted")
                        ondisk[name] = 1;
                    if (!ondisk[name])
                        toRemove.push(name);
                });
                
                if (!toCreate.length && !toRemove.length && !orphanAppand.length)
                    return;
                
                var wasOpen = startUpdate(node);
                node.children = null;
                
                // Fill Parent
                toCreate.forEach(function(stat) {
                    createNode(parentPath + stat.name, stat, null, true);
                });
                
                toRemove.forEach(function(name) {
                    var currentNode = existing[name];
                    delete existing[name];
                    emit("remove", {
                        path: parentPath + name,
                        node: currentNode,
                        parent: node
                    });
                });
                
                emit("readdir", { path : e.path, parent : node, orphan: orphan });
                
                endUpdate(node, wasOpen);
                
                orphanAppand.forEach(function(path) {
                    emit("orphan-append", {path: path});
                });
            }
            fs.on("afterReaddir", onreaddir, plugin);
            
            function onstat(e) {
                if (e.error) return;
                
                // update cache
                var stat = e.result[1];
                
                var there = true;
                var node = findNode(e.path);
                var parent = findNode(dirname(e.path));
                
                if (!showHidden && isFileHidden(e.path))
                    return;

                if (!node) { 
                    if (!parent) 
                        return;
                    there = false;
                }
                
                if (there != !!stat) {
                    if (there) {
                        if (!node.link)
                            deleteNode(node);
                    }
                    else {
                        if (typeof stat != "object")
                            stat = null;
                        createNode(e.path, stat);
                    }
                }
                else if (there) {
                    if (typeof stat != "object")
                        stat = null;
                    if (!stat && node)
                        return;
                    if (stat && node)
                        updateNodeStat(e.path, stat, node);
                    else
                        createNode(e.path, stat, node);
                }
            }
            fs.on("afterStat", onstat, plugin);
            fs.on("afterReadFile", function(e) {
                var err = e.result[0];
                return onstat({
                    path: e.path, 
                    result: [0, err && err.code == "ENOENT" 
                        ? false : true]
                });
            }, plugin);
            fs.on("afterExists", onstat, plugin);
            
            // Modify
            
            function afterHandler(e) {
                if (e.error) e.undo && e.undo();
                else e.confirm && e.confirm();
            }
            
            function addSingleNode(e, isFolder, linkInfo) {
                var node = findNode(e.path);
                if (node) return; // Node already exists
                
                if (!showHidden && isFileHidden(e.path))
                    return;
                
                var parent = findNode(dirname(e.path));
                if (parent) { // Dir is in cache
                    var stat = isFolder 
                        ? { mime : "folder" } 
                        : (linkInfo
                            ? { link: true, linkStat: { fullPath: linkInfo } }
                            : {});
                    stat.mtime = Date.now();
                    node = createNode(e.path, stat);

                    emit("add", {path : e.path, node : node});
                    
                    e.undo = function(){
                        deleteNode(node);
                        
                        emit("remove", {
                            path: e.path,
                            node: node,
                            parent: parent
                        });
                    };
                    e.confirm = function () {
                        if (node.status === "predicted")
                            node.status = "loaded";
                    };
                    node.status = "predicted";
                }
            }
            
            function removeSingleNode(e) {
                var node = findNode(e.path);
                if (!node) return; //Node doesn't exist
                
                deleteNode(node);
                emit("remove", {
                    path: node.path,
                    node: node
                });
                
                // todo
                e.undo = function(){
                    createNode(node.path, null, node);
                    emit("add", {
                        path: node.path,
                        node: node
                    });
                };
            }
            
            function recurPathUpdate(node, oldPath, newPath, isCopy) {
                if (!isCopy) model.setAttribute(node, "oldpath", oldPath);
                model.setAttribute(node, "path", newPath);
                
                if (node.children)
                    node.children = null;
                var cnode, nodes = model.getChildren(node) || [];
                for (var i = nodes.length; i--;) {
                    cnode = nodes[i];
                    if (cnode) {
                        recurPathUpdate(cnode, cnode.path,
                            newPath + "/" + cnode.label, isCopy);
                    }
                }
                
                emit(isCopy ? "add" : "update", {
                    path: oldPath,
                    newPath: newPath,
                    node: node
                });
            }
            
            fs.on("beforeWriteFile", function(e) { addSingleNode(e); }, plugin);
            fs.on("afterWriteFile", afterHandler, plugin);
            
            // Also does move
            fs.on("beforeRename", function(e) {
                var node = findNode(e.path);
                if (!node) return;
                
                var oldPath = e.path;
                var newPath = e.args[1];
                var parent = findNode(dirname(newPath));
                
                // Validation
                var toNode = findNode(newPath);
                
                if (!toNode) {
                    deleteNode(node, true);
                    createNode(newPath, null, node); // Move node
                    recurPathUpdate(node, oldPath, newPath);
                }
                
                e.undo = function(){
                    if (toNode)
                        return;
                    if (!parent) {
                        var tmpParent = node;
                        while (node.parent && tmpParent.parent.status == "pending")
                            tmpParent = tmpParent.parent;
                        if (tmpParent)
                            deleteNode(tmpParent, true);
                    }
                    deleteNode(node, true);
                    if (toNode)
                        createNode(newPath, null, toNode);
                    
                    createNode(oldPath, null, node);
                    recurPathUpdate(node, newPath, oldPath);
                };
                e.confirm = function() {
                    if (toNode) {
                        deleteNode(toNode, true);
                        createNode(newPath, null, node); // Move node
                        recurPathUpdate(node, oldPath, newPath);
                    }
                    
                    if (node.status === "predicted")
                        node.status = "loaded";
                };
                node.status = "predicted";
            }, plugin);
            fs.on("afterRename", afterHandler, plugin);
            
            fs.on("beforeMkdirP", function(e) {
                var dirsToMake = [];
                var path = e.path;
                
                while (!findNode(path)) {
                    dirsToMake.push(path);
                    path = dirname(path);
                    if (path == "~") return; // Don't create home based paths if ~ doesn't exist
                    if (path == ".") break;
                }
                
                dirsToMake.forEach(function(dir) {
                    createNode(dir, {mime: "folder"});
                });
                
                var node = dirsToMake[0] && findNode(dirsToMake[0]);
                if (!node)
                    return;
                
                e.undo = function(){
                    dirsToMake.forEach(function(dir) {
                        var node = findNode(dir);
                        if (node)
                            deleteNode(node);
                    });
                };
                e.confirm = function() {
                    if (node.status === "predicted")
                        node.status = "loaded";
                };
                node.status = "predicted";
            }, plugin);
            fs.on("afterMkdirP", afterHandler, plugin);
            
            fs.on("beforeMkdir", function(e) { addSingleNode(e, true); }, plugin);
            fs.on("afterMkdir", afterHandler, plugin);
            
            fs.on("beforeUnlink", function(e) { removeSingleNode(e); }, plugin);
            fs.on("afterUnlink", afterHandler, plugin);
            
            fs.on("beforeRmfile", function(e) { removeSingleNode(e); }, plugin);
            fs.on("afterRmfile", afterHandler, plugin);
            
            fs.on("beforeRmdir", function(e) { removeSingleNode(e); }, plugin);
            fs.on("afterRmdir", afterHandler, plugin);
            
            fs.on("beforeCopy", function(e) {
                var node = findNode(e.path);
                if (!node) return;
                
                var parent = findNode(dirname(e.args[1]));
                if (!parent) return;
                
                function setCacheCopy(to) {
                    toNode = copyNode(node);
                    createNode(to, null, toNode);
                    
                    //Validation
                    //var path = toNode.path;
                    //if (path != to) return;
                    
                    recurPathUpdate(toNode, e.path, to, true);
                    
                    e.undo = function(){
                        removeSingleNode({path: to});
                    };
                    e.confirm = function() {
                        if (toNode.status === "predicted")
                            toNode.status = e.status;
                    };
                    e._status = node.status == "predicted" ? "pending" : e.status;
                    toNode.status = "predicted";
                }
                
                var toNode = findNode(e.args[1]);
                if (toNode) {
                    if (!e.args[2] || e.args[2].overwrite !== false) { //overwrite
                        deleteNode(toNode);
                    }
                    else {
                        e.setCacheCopy = setCacheCopy;
                        return; //We'll wait to get the new name from the server
                    }
                }
                
                setCacheCopy(e.args[1]);
            }, plugin);
            fs.on("afterCopy", function(e) {
                if (!e.error && e.setCacheCopy)
                    e.setCacheCopy(e.result[1].to);
                afterHandler(e);
            }, plugin);
            
            fs.on("beforeSymlink", function(e) {
                addSingleNode(e, false, e.args[1]);
            }, plugin);
            fs.on("afterSymlink", function(e) {
                if (e.error) {
                    if (e.undo)
                        e.undo();
                }
                else {
                    var node = findNode(e.path);
                    if (!node) return;
                        
                    fs.stat(e.args[1], function(err, stat) {
                        var linkNode = findNode(e.path);
                        
                        if (err || stat.err) {
                            model.setAttribute(linkNode, "error", err.message);
                            return;
                        }
                        
                        stat.fullPath = e.args[1];
                        createNode(e.path, {
                            link: true, 
                            linkStat: stat}, linkNode);
                        
                        emit("update", {
                            path: e.path,
                            node: linkNode
                        });
                    });
                }
            }, plugin);
        }
        
        /***** Methods *****/
        
        function findNode(path, context) {
            if (typeof context == "string") { // || path && path.charAt(0) != "/"
                node = emit("findNode", { type: context, path: path });
                if (node || node === false) return node;
                context = null;
            }
            
            var parts = path.split("/");
            var node = context || model.root;
            if (!node) {
                node = orphans[parts[0]]; // model.realRoot || 
                if (node) parts.shift();
            }
            
            if (path == "/") parts.shift();
            
            var up = 0;
            for (var i = parts.length; i--;) {
                var p = parts[i];
                if (!p && i || p === ".") {
                    parts.splice(i, 1);
                }
                else if (p === "..") {
                    parts.splice(i, 1);
                    up++;
                }
                else if (up) {
                    parts.splice(i, 1);
                    up--;
                }
            }
            
            for (var i = 0; i < parts.length; i++) { 
                var p = parts[i];
                if (node)
                    node = node.map && node.map[p];
                if (!node)
                    node = orphans[parts.slice(0, i + 1).join("/")];
            }
            
            return node;
        }
        
        function findNodes(path) {
            // todo ??
        }
        
        function createNode(path, stat, updateNode, updating) {
            if (!/^[!~/]/.test(path)) {
                var e = new Error("Refusing to add a node with misformed path to fs.cache");
                return reportError(e, { path: path });
            }
            
            if (orphans[path]) {
                updateNode = orphans[path];
                delete orphans[path];
            }
            
            var parts = path.split("/");
            var node = model.root.map[parts[0] == "~" ? "~" : ""];
            if (!node) {
                node = orphans[parts[0]];
                if (node) parts.shift();
            }
            
            var parent = model.root;
            var modified = [];
            var subPath = "";
            parts.forEach(function(p, i) {
                if (!p) return;
                subPath += (p == "~" ? p : "/" + p);
                
                if (!node)
                    return node = orphans[subPath];
                
                var map = node.map;
                if (!map) {
                    map = node.map = Object.create(null);
                }
                parent = node;
                node = map[p];
                if (!node) {
                    modified.push(parent);
                    if (i !== parts.length - 1) {
                        node = {label: p, path: subPath, status: "pending", isFolder: true};
                        // TODO filter hidden files in getChildren instead.
                        if (!showHidden && isFileHidden(p)) {
                            orphans[node.path] = node;
                            return;
                        }
                    } else if (updateNode) {
                        deleteNode(updateNode, true);
                        node = updateNode;
                        if (node.label != p) {
                            if (map[node.label] == node)
                                delete map[node.label];
                            node.label = p;
                        }
                    } else {
                        node = {label: p, path: subPath};
                    }
                    node.parent = parent;
                    map[p] = node;
                }
            });
            if (!node) {
                node = {label: parts[parts.length - 1], path: path};
                orphans[path] = node;
            }
            
            updateNodeStat(path, stat, node); 
            
            node.children = null;
            
            if (!updating) {
                if (!modified.length)
                    modified.push(parent);
                var wasOpen = startUpdate(modified[0]);
                modified.forEach(function(n) {
                    if (n != model.root)
                        n.children = null;
                });
                endUpdate(modified[0], wasOpen);
            }
            model._signal("createNode", node);
            return node;
        }
        
        function updateNodeStat(path, stat, node) {
            node.path = path;
            var original_stat;
            if (stat && stat.link) {
                original_stat = stat;
                stat = stat.linkStat;
            }
            if (stat) {
                var isFolder = stat && /(directory|folder)$/.test(stat.mime);
                if (isFolder) {
                    node.status = node.status || "pending";
                } else {
                    node.status = "loaded";
                }
                if (typeof stat.mtime !== "number" && stat.mtime) {
                    // TODO fix localfs to not send date objects here
                    stat.mtime = +stat.mtime;
                }
                if (stat.size != undefined)
                    node.size = stat.size;
                if (stat.mtime != undefined)
                    node.mtime = stat.mtime;
                if (original_stat || stat.linkErr)
                    node.link = stat.fullPath || stat.linkErr;
                if (isFolder)
                    node.isFolder = isFolder;
                else
                    delete node.isFolder;
            }
            
            if (node.isFolder && !node.map) {
                node.map = Object.create(null);
                node.children = null;
            } else if (!node.isFolder && node.map) {
                delete node.map;
                node.children = null;
            }
        }
        
        function deleteNode(node, silent) {
            if (findNode(node.path) != node)
                return;
            var parent = findNode(dirname(node.path));
            if (!parent) {
                // likely a broken node
                var e = new Error("Node with misformed path in fs.cache");
                reportError(e, {
                    path: node.path,
                    hasParentProp: !!node.parent,
                    parentPath: node.parent && node.parent.path
                });
                return;
            }
            silent || model._signal("remove", node);
            var wasOpen = startUpdate(parent);
            delete parent.map[node.label];
            if (parent.children)
                node.index = parent.children.indexOf(node);
            parent.children = node.children = null;
            endUpdate(parent, wasOpen);
        }
        
        function copyNode(node, parent) {
            var copy = {};
            Object.keys(node).forEach(function(key) {
                var prop;
                if (key == "parent") {
                    prop = parent;
                } else if (key == "map") {
                    prop = {};
                    Object.keys(node.map).forEach(function(label) {
                        prop[label] = copyNode(node.map[label], node);
                    });
                } else if (key === "children" || key === "isSelected") {
                    prop = null;
                } else {
                    prop = lang.deepCopy(node[key]);
                }
                copy[key] = prop;
            });
            return copy;
        }
        
        function clear() {
            var all = model.visibleItems;
            for (var i = all.length; i--;) {
                if (model.isOpen(all[i]))
                    model.collapse(all[i]);
            }
            model.projectDir = {
                label: options.rootLabel || c9.projectName,
                isFolder: true,
                path: "/",
                status: "pending",
                className: "projectRoot",
                isEditable: false,
                map: Object.create(null)
            };
            var root = {};
            root.map = Object.create(null);
            root.map[""] = model.projectDir;
            model.setRoot(root);
            // fs.readdir("/", function(){});
        }
        
        function loadNodes(path, progress) {
            var loaded = 0, subPath = "/";
            var nodes = path.split("/"), node;
            function recur() {
                node = findNode(subPath, "expand");
                if (!node) {
                    progress({
                        nodes: nodes, node: nodes[loaded - 1], 
                        loaded: loaded, complete : true
                    });
                } else if (node.status == "loaded") {
                    if (subPath.slice(-1) !== "/")
                        subPath += "/";
                    subPath += nodes[loaded];
                    nodes[loaded++] = node;
                    progress({nodes: nodes, node: node, loaded: loaded});
                    recur();
                } else if (node.status == "loading") {
                    plugin.on("readdir", function listener(e) {
                        if (e.path == subPath) {
                            plugin.on("readdir", listener);
                            recur();
                        }
                    });
                } else if (node.status == "pending") {
                    model.loadChildren(node, recur);
                }
            }
            recur();
        }

        /***** Private *****/
        
        function updateHiddenFileRegexp(str) {
            var parts = (str || ".*").split(/,\s*/).map(function(x) {
                return x.trim().replace(/([\/'*+?|()\[\]{}.\^$])/g, function(p) {
                    if (p === "*")
                        return "[^\\/]*?";
                    else
                        return "\\" + p;
                });
            }).filter(Boolean);
            hiddenFileRe = new RegExp("(^|/)(" + parts.join("|") + ")/?$", "i");
        }
        
        function isFileHidden(name) {
            return hiddenFileRe.test(name);
        }
        
        function startUpdate(node) {
            var wasOpen = node.isOpen;
            if (wasOpen) model.close(node, undefined, true);
            model._signal("startUpdate", node);
            return wasOpen;
        }
        
        function endUpdate(node, wasOpen) {
            if (wasOpen) {
                model.open(node, undefined, true);
                model._signal("change", node);
            }
            model._signal("endUpdate", node, wasOpen);
        }
        
        function refresh(node) {
            model.close(node, undefined, true);
            model.open(node, undefined, true);
            model._signal("change", node);
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function(){
            load();
        });
        plugin.on("enable", function(){
            
        });
        plugin.on("disable", function(){
            
        });
        plugin.on("unload", function(){
            loaded = false;
            showHidden = false;
            hiddenFilePattern = "";
            hiddenFileRe = /^$/;
            orphans = {};
        });
        
        /***** Register and define API *****/
        
        /**
         * Provides a model for storage and retrieval of xml nodes that represent
         * filesystem nodes. The model will contain all nodes that have been
         * accessed via the {@link fs} plugin.
         * @singleton
         **/
        plugin.freezePublicAPI({
            /**
             * Exposes the model object that stores the XML used to store the
             * cache. This property is here for backwards compatibility only
             * and will be removed in the next version.
             * @property model
             * @deprecated
             * @private
             */
            model: model,
            
            /** 
             * Specifies whether hidden files are shown. 
             * @property {Boolean} [showHidden=false]
             */
            get showHidden(){ return showHidden; },
            set showHidden(value) { 
                showHidden = value; 
                emit("setShowHidden", { value: value });
            },
            
            /** 
             * Specifies pattern for hidden file name. 
             * @property {String}
             */
            get hiddenFilePattern(){ return hiddenFilePattern; },
            set hiddenFilePattern(value) { 
                updateHiddenFileRegexp(value);
                hiddenFilePattern = value;
            },
            
            _events: [
                /** 
                 * @event orphan-append Fires when a parent of a previously loaded dir gets loaded
                 * @param {Object} e
                 * @param {String} e.path the path of the parent that got loaded
                 */
                "orphan-append",
                /**
                 * @event readdir Fires after storing the directory contents into cache
                 * @param {Object}     e
                 * @param {String}     e.path    the path of the parent that got loaded
                 * @param {XMLElement} e.parent  the parent node that is stored in cache
                 */
                "readdir",
                /**
                 * Fires when a file system node is added to the cache.
                 * @event add
                 * @param {Object} e
                 * @param {String} e.path       The path of the file system node that is added.
                 * @param {String} [e.newPath]  The new path of the file (if the new file is created by a copy)
                 * @param {Object} e.node       Object describing the file system node.
                 */
                "add",
                /**
                 * Fires when a file system node is removed from the cache.
                 * @event remove
                 * @param {Object} e
                 * @param {String} e.path       The path of the file system node that is removed.
                 * @param {Object} e.node       Object describing the file system node.
                 * @param {Object} [e.parent]   Object describing the parent of the file system node.
                 */
                "remove",
                /**
                 * Fires when a file system node is updated in the cache.
                 * @event update
                 * @param {Object} e
                 * @param {String} e.path       The path of the file system node that is updated.
                 * @param {String} [e.newPath]  The new path of the file (if the new file is created by a copy)
                 * @param {Object} e.node       Object describing the file system node.
                 */
                "update"
            ],
            
            /**
             * Returns a new xml node representing a file, folder or symlink. Note
             * that this call will not make any changes to the actual file system.
             * It will just create a node in the cache. Generally you won't need
             * to use this method.
             * @param {String} path the path of the filesystem node
             * @param {Object} stat an object similar to that returned by the fs.stat call
             * @returns {XMLElement} the created node representing the file system node.
             */
            createNode: createNode,
            
            /**
             * @ignore
             */
            removeNode: deleteNode,
            
            /**
             * Finds an xml node based on a path
             * @param {String} path the path of the node to find
             * @returns {XMLElement} the node representing the file system node.
             */
            findNode: findNode,
            
            /**
             * Finds all xml nodes based on a path (or xpath)
             * @param {String} path the path of the node to find
             * @returns {Array} the xml nodes representing the file system nodes.
             */
            findNodes: findNodes,
            
            /**
             * Removes all the nodes from the cache
             */
            clear: clear,
            
            /**
             * Refreshes a section based on a tree node
             * @param {Object} node
             */
            refresh: refresh,
            
            /**
             * Refreshes a section based on a tree node
             * @param {String} path
             * @param {Function} progress
             * @param {Function} done
             */
            loadNodes: loadNodes,
            
            /**
             * @ignore
             */
            isFileHidden: isFileHidden
        });
        
        register(null, {
            "fs.cache": plugin
        });
    }
});
