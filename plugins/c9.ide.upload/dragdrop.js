define(function(require, exports, module) {
    "use strict";
    main.consumes = [
        "Plugin", "upload", "tree", "ui", "layout", "c9", "tabManager"
    ];

    main.provides = ["dragdrop"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var upload = imports.upload;
        var tree = imports.tree;
        var ui = imports.ui;
        var c9 = imports.c9;
        var tabs = imports.tabManager;
        
        var css = require("text!./dragdrop.css");
        var dirname = require("path").dirname;
        
        var treeAsPane = options.treeAsPane;
        var dropbox, treeMouseHandler; 
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            ui.insertCss(css, plugin);
            
            document.addEventListener("dragenter", dragEnter, true);
            document.addEventListener("dragleave", dragLeave, true);
            document.addEventListener("dragover", dragOver, true);
            document.addEventListener("drop", dragDrop, true);
            
            tree.once("draw", function() {
                var acetree = tree.tree;
                treeMouseHandler = acetree.$mouseHandler;
                acetree.on("dragIn", updateDrag);
                acetree.on("dragMoveOutside", updateDrag);
                acetree.on("dropOutside", treeDrop, false);
                function updateDrag(ev) {
                    var selectedNodes = ev.dragInfo.selectedNodes;
                    var hasFile = selectedNodes && selectedNodes.some(function(node) {
                        return !node.isFolder;
                    });
                    var host = hasFile && findHost(ev.domEvent.target, ev);
                    updateTabDrag(!ev.dragInfo.isInTree && host);
                }
                function treeDrop(ev) {
                    var selectedNodes = ev.dragInfo.selectedNodes;
                    if (selectedNodes && dragContext.pane) {
                        selectedNodes.forEach(function(node, i) {
                            tabs.open({
                                path: node.path,
                                active: i === selectedNodes.length - 1,
                                pane: dragContext.pane
                            }, function(err, tab) {});
                        });
                    }
                    updateTabDrag();
                }
            });
        }
        
        function unload() {
            loaded = false;
            document.removeEventListener("dragenter", dragEnter, true);
            document.removeEventListener("dragleave", dragLeave, true);
            document.removeEventListener("dragover", dragOver, true);
            document.removeEventListener("drop", dragDrop, true);
        }
        
        /***** Methods *****/
        
        var dragContext = {};
        
        function dragEnter(e) {
            apf.preventDefault(e);
            if (plugin.disableDropbox || !isFile(e))
                return;
            var host = findHost(e.target, e);
            if (!dragContext.mouseListener && (!treeAsPane || e.ctrlKey))
                window.addEventListener("mousemove", clearDrag, true);
            // TODO open tree panel when hoverng over the button
            updateUploadAreaDrag(e.target.host);
            updateTreeDrag(e, host);
            updateTabDrag(host);
                
            clearTimeout(dragContext.timer);
            
            dragContext.dropEffect = "copy";
            if (treeAsPane && dragContext.pane && dragContext.pane.isTree)
                dragContext.dropEffect = "link";
            e.dataTransfer.dropEffect = dragContext.dropEffect;
        }
        
        function dragLeave(e) {
            apf.preventDefault(e);
            if (plugin.disableDropbox)
                return;
                
            clearTimeout(dragContext.timer);
            dragContext.timer = setTimeout(clearDrag, 100);
        }
        
        function dragOver(e) {
            apf.preventDefault(e);
            if (plugin.disableDropbox || !isFile(e))
                return;
            
            if (treeAsPane && e.ctrlKey != dragContext.ctrlKey) {
                var pane = dragContext.pane;
                if (pane && pane.isTree || dragContext.path) {
                    dragEnter(e);
                }
            }
            
            if (treeMouseHandler && treeMouseHandler.$onCaptureMouseMove)
                treeMouseHandler.$onCaptureMouseMove(e);
            if (dragContext.timer)
                dragContext.timer = clearTimeout(dragContext.timer);
            e.dataTransfer.dropEffect = dragContext.dropEffect;
        }
        
        function dragDrop(e) {
            apf.preventDefault(e);
            setTimeout(clearDrag);
            if (plugin.disableDropbox)
                return;

            var target = dragContext.path || dragContext.pane;
            if (target) {
                upload.uploadFromDrop(e, target, 
                    dragContext.pane && !target.isTree ? "tab" : "tree");
                apf.stopEvent(e);
            }
        }
        
        function clearDrag(e) {
            dragContext.mouseListener = null;
            window.removeEventListener("mousemove", clearDrag, true);
            updateTreeDrag(e);
            updateTabDrag();
            updateUploadAreaDrag();
        }
        
        // helper
        function findHost(el, e) {
            var ctrlKey = dragContext.ctrlKey = e.ctrlKey;
            var treeEl = tree.getElement("container");
            if (treeAsPane && !ctrlKey) {
                treeEl = treeEl.parentNode;
            }
            
            while (el) {
                var host = el.host;
                if (host && (host.cloud9pane))
                    return host;
                if (host && (host === treeEl))
                    return treeAsPane && !ctrlKey ? {
                        cloud9pane: {
                            isTree: true,
                            container: host.$ext,
                            dropboxTitle: "Drop a file or folder"
                        }
                    } : host;
                
                if (el === dropbox) {
                    if (treeAsPane && ctrlKey && dragContext.pane.isTree)
                        return treeEl;
                    return { cloud9pane: dragContext.pane };
                }
                
                el = el.parentNode;
            }
        }
        
        function isFile(e) {
            var types = e.dataTransfer.types;
            if (types && Array.prototype.indexOf.call(types, 'Files') !== -1)
                return true;
        }
        
        function getDropbox(title) {
            if (!dropbox) {
                dropbox = document.createElement("div");
                dropbox.className = "draganddrop";

                var label = document.createElement("span");
                dropbox.appendChild(label);
            }
            dropbox.firstChild.textContent = title || "Drop a file here to open";
            return dropbox;
        }
        
        function updateTabDrag(host) {
            var pane = host && (host.cloud9pane
                || host.parentNode && host.parentNode.cloud9pane);
            
            clearTimeout(dragContext.dropboxTimer);
            if (pane) {
                dragContext.path = null;
                if (dragContext.pane === pane)
                    return;
                
                var parent = pane.container;
                dropbox = getDropbox(pane.dropboxTitle);
                parent && parent.appendChild(dropbox);
                apf.setStyleClass(dropbox, "over");
                
                dragContext.pane = pane;
            } else if (dragContext.pane) {
                dragContext.pane = null;
                if (dropbox && dropbox.parentNode) {
                    dragContext.dropboxTimer = setTimeout(function() {
                        if (dropbox.parentNode)
                            dropbox.parentNode.removeChild(dropbox);
                    }, 100);
                    apf.setStyleClass(dropbox, null, ["over"]);
                }
            }
        }
        
        function updateUploadAreaDrag(host) {
            if (host && host.$ext && host.$ext.id === "uploadDropArea") {
                dragContext.uploadDropArea = host.$ext;
                dragContext.path = upload.getTargetFolder().path;
                apf.setStyleClass(dragContext.uploadDropArea, "over");
            } else if (dragContext.uploadDropArea) {
                apf.setStyleClass(dragContext.uploadDropArea, null, ["over"]);
                dragContext.uploadDropArea = null;
            }
        }

        // tree
        function updateTreeDrag(e, host) {
            var online = c9.status & c9.STORAGE;
            var isOnlineTree;
            try { 
                isOnlineTree = online && host === tree.getElement("container");
            } catch (e) {}
            
            if (isOnlineTree) {
                if (!treeMouseHandler.releaseMouse) {
                    treeMouseHandler.captureMouse(e);
                    treeMouseHandler.setState("drag");
                    treeMouseHandler.dragStart();
                    tree.tree.on("folderDragEnter", folderDragEnter);
                    tree.tree.on("folderDragLeave", folderDragLeave);
                }
            } else if (treeMouseHandler && treeMouseHandler.releaseMouse) {
                var path = dragContext.path;
                treeMouseHandler.releaseMouse(e || {});
                tree.tree.off("folderDragEnter", folderDragEnter);
                tree.tree.off("folderDragLeave", folderDragLeave);
                // do not reset path if called from mouseup
                dragContext.path = path;
            }
        }

        function folderDragLeave(e) {
            tree.tree.provider.setClass(e.hoverNode, "dragAppendUpload", false);
            dragContext.path = null;
        }
        
        function folderDragEnter(e) {
            tree.tree.provider.setClass(e.hoverNode, "dragAppendUpload", true);
            dragContext.path = e.hoverNode.path;
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
            unload();
        });
        
        /***** Register and define API *****/
        
        plugin.freezePublicAPI({});
        
        register(null, {
            dragdrop: plugin
        });
    }
});