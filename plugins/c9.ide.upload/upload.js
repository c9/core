define(function(require, exports, module) {
    "use strict";
    
    main.consumes = [
        "Plugin", "util", "ui", "layout", "menus", "fs", "tree", "fs.cache", 
        "upload.manager", "apf", "dialog.fileoverwrite", "dialog.alert", 
        "tabManager"
    ];
    main.provides = ["upload"];
    return main;
    
    function main(options, imports, register) {
        var util = imports.util;
        var Plugin = imports.Plugin;
        var ui = imports.ui;
        var menus = imports.menus;
        var fsCache = imports["fs.cache"];
        var tree = imports.tree;
        var uploadManager = imports["upload.manager"];
        var question = imports["dialog.fileoverwrite"].show;
        var alert = imports["dialog.alert"].show;
        var apf = imports.apf;
        var tabManager = imports.tabManager;
        
        var path = require("path");
        var css = require("text!./upload.css");
        
        var winUploadFilesMarkup = require("text!./markup/win_upload_files.xml");
        
        /***** Initialization *****/
        
        var MAX_OPEN_COUNT = options.maxOpenCount || 10;
        var MAX_FILE_COUNT = options.maxFileCount || 100000;
        var MAX_UPLOAD_SIZE = options.maxUploadSize || Infinity;

        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var winUploadFiles;
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            // Menus
            menus.addItemByPath("File/~", new ui.divider(), 1200, plugin);
            menus.addItemByPath("File/Upload Local Files...", new ui.item({
                onclick: showUploadWindow
            }), 1300, plugin);

            uploadManager.on("addJob", onAddUploadJob);
        }
        
        /***** Methods *****/
        
        function onAddUploadJob(e) {
            var job = e.job;
            var dir = path.dirname(job.fullPath);
            
            var cleanup = function() {};
            function onExpand(e) {
                // console.log("expand", e.path, dir);
                if (e.path == dir) {
                    cleanup();
                    updateNode(fsCache.findNode(dir));
                    // console.log("match!!");
                }
            }
            
            function updateNode(parent) {
                var node = fsCache.findNode(job.fullPath);
                if (!node) {
                    node = fsCache.createNode(job.fullPath, {
                        mime: job.file.type,
                        size: job.file.size || 0
                    });
                }
                node.status = "predicted";
                
                // console.log("new node", node);
            }
            
            job.on("changeState", function(state) {
                switch (state.state) {
                    case "uploading":
                        // add to tree
                        fsCache.on("readdir", onExpand);
                        cleanup = function() {
                            fsCache.off("readdir", onExpand);
                        };
                        
                        var parent = fsCache.findNode(dir);
                        if (parent) {
                            updateNode(parent);
                        }
                        
                        // console.log("up", job)
                        break;
                        
                    case "done":
                        // remove uploading state
                        var node = fsCache.findNode(job.fullPath);
                        if (node)
                            node.status = "loaded";
                        
                        cleanup();
                        // console.log("done", job)
                        break;
                        
                    case "error":
                        // remove node from tree
                        var node = fsCache.findNode(job.fullPath);
                        if (node)
                            fsCache.removeNode(node);
                            
                        cleanup();
                        break;
                }
            });
        }
        
        function uploadFromInput(inputEl) {
            uploadManager.batchFromInput(inputEl, function(err, batch) {
                if (err) return onUploadError(err);
                uploadBatch(batch);
            });
        }
        
        function getEntries(e) {
            // items is undefined on firefox 30
            if (!e.dataTransfer.items)
                return [];
            
            var first = e.dataTransfer.items[0];
            var getAsEntry = first.getAsEntry || first.webkitGetAsEntry;
                
            return [].map.call(e.dataTransfer.items, function(item) {
                return getAsEntry.call(item);
            });
        }
        
        function uploadFromDrop(dropEvent, targetPath, type) {
            if (emit("upload.drop", { 
                files: dropEvent.dataTransfer.files,
                entries: getEntries(dropEvent), 
                path: targetPath,
                type: type
            }) === false)
                return;
                
            uploadManager.batchFromDrop(dropEvent, function(err, batch, skipped) {
                if (err) return onUploadError(err);
                if (skipped && Object.keys(skipped).length) {
                    alert(
                        "File upload",
                        "Not all files can be uploaded:",
                        Object.keys(skipped).map(util.escapeXml).join("</br>")
                    );
                }
                
                uploadBatch(batch, targetPath.path || targetPath);
            });
        }
        
        function onUploadError(err) {
            // TODO
            console.error(err);
        }
        
        function uploadBatch(batch, targetPath) {
            // 1. has directories
            if (batch.hasDirectories()) {
                alert(
                    "Folder Upload",
                    "Folder uploads are currently only supported by Google Chrome.",
                    "If you want to upload folders you need to run a current version of Google Chrome."
                );
                return;
            }

            // 2. filter DS_Store
            batch.ignoreFiles({
                ".DS_Store": 1,
                "Thumbs.db": 1
            });
            
            var sizes = batch.getSizes();
            
            // 3. check file count
            if (sizes.count > MAX_FILE_COUNT) {
                alert(
                    "Too many files",
                    "File uploads are limited to " + MAX_FILE_COUNT + " files per upload.",
                    "Please upload files in smaller batches"
                );
                return;
            }
            
            // 4. check total size quota
            if (sizes.sum > MAX_UPLOAD_SIZE) {
                alert(
                    "Maximum upload-size exceeded",
                    "File uploads are limited to " + Math.floor(MAX_UPLOAD_SIZE / 1000 / 1000) + "MB in total.",
                    ""
                );
                return;
            }

            // 6. start upload if still files in batch
            if (!batch.files.length)
                return;

            
            var targetFolder;
            if (targetPath && typeof targetPath === "object") {
                if (!window.FileReader)
                    return alert(
                        "Unable to open files",
                        "Drop files on the tree to upload",
                        ""
                    );
                if (batch.files.length > MAX_OPEN_COUNT)
                    return alert(
                        "Maximum open count exceeded (" + batch.files.length + ")",
                        "Drop files on the tree to upload",
                        ""
                    );
                    
                var hasImage = false;
                batch.files.forEach(function(file, i) {
                    if (/image/i.test(file.type))
                        return hasImage = true;
                    var reader = new FileReader();
                    reader.onload = function() {
                        tabManager.open({
                            path: "/" + file.name, 
                            value: reader.result, 
                            document: { meta: { newfile: true }},
                            active: i === 0,
                            pane: targetPath
                        }, function(err, tab) {});
                    };
                    reader.readAsText(file);
                });
                
                if (hasImage)
                    alert(
                        "Can't open an image",
                        "Drop files on the tree to upload",
                        ""
                    );
                    
                return;
            }
            else if (targetPath) {
                targetFolder = fsCache.findNode(targetPath);
            }
            else {
                targetFolder = getTargetFolder();
                targetPath = targetFolder.path;
            }
            
            tree.expand(targetFolder, function() {
                uploadManager.upload(targetPath, batch, fileExistsDialog, function(err) {
                    // TODO handle error
                });
            });

            var initialSelection = JSON.stringify(tree.selection);
            uploadManager.on("batchDone", function onBatchDone(e) {
                var b = e.batch;
                if (b != batch) return;
                
                uploadManager.off("batchDone", onBatchDone);
                if (initialSelection == JSON.stringify(tree.selection)) {
                    tree.selectList(batch.getRoots().map(function(p) { return path.join(targetPath, p); }));
                }
            });
        }
        
        function showUploadWindow() {
            
            function handleFileSelect(e) {
                uploadFromInput(e.target);
                e.target.value = "";
            }
            
            if (!winUploadFiles) {
                ui.insertCss(css, null, plugin);
                ui.insertMarkup(null, winUploadFilesMarkup, plugin);
                
                winUploadFiles = plugin.getElement("winUploadFiles");

                winUploadFiles.on("show", function(e) {
                    onShow();
                });
                winUploadFiles.on("close", function(e) {
                    onClose();
                });
                winUploadFiles.selectNodes(".//a:button").pop().on("click", function() {
                    winUploadFiles.hide();
                });
                
                var fileUploadSelect = plugin.getElement("fileUploadSelect");
                var folderUploadSelect = plugin.getElement("folderUploadSelect");
                var hboxUploadNoFolders = plugin.getElement("hboxUploadNoFolders");
                var hboxUploadWithFolders = plugin.getElement("hboxUploadWithFolders");
                
                var filebrowser = fileUploadSelect.$ext;
                filebrowser.addEventListener("change", handleFileSelect, false);
    
                // enable folder upload
                if (uploadManager.SUPPORT_FOLDER_UPLOAD) {
                    hboxUploadNoFolders.hide();
                    hboxUploadWithFolders.show();
    
                    apf.setStyleClass(filebrowser, "uploadWithFolders");
    
                    var folderbrowser = folderUploadSelect.$ext;
                    folderbrowser.style.display = "block";
                    folderbrowser.addEventListener("change", handleFileSelect, false);
                }
                emit("drawUploadWindow", plugin.getElement("uploadDropArea"));
            }
            
            winUploadFiles.show();
        }
        
        function hideUploadWindow() {
            winUploadFiles && winUploadFiles.hide();
        }
    
        function fileExistsDialog(batch, path, root, callback) {
            question(
                "File already exists",
                "File already exists",
                '"' + root + '" already exists, do you want to replace it? '
                    + "Replacing it will overwrite its current contents.",
                function(all) { // Overwrite
                    callback("replace", all);
                },
                function(all) { // Skip
                    if (all) callback("stop", true);
                    else callback("no-replace", false);
                },
                { all: batch.files.length > 1 }
            );
        }
    
        function onShow () {
            if (!(window.File && window.FileReader && window.FileList && window.Blob)) {
                alert("The File APIs are not fully supported in this browser.");
                return hideUploadWindow();
            }
    
            updateTargetFolder();
            tree.on("select", updateTargetFolder);
        }
    
        function onClose () {
            tree.off("select", updateTargetFolder);
        }
    
        function getTargetFolder() {
            return tree.getSelectedFolder();
        }
        
        function updateTargetFolder() {
            plugin.getElement("uplTargetFolder").$ext.textContent 
                = getTargetFolder().path;
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
        });
        
        /***** Register and define API *****/
        
        /**
         * Implements the file upload UI for Cloud9
         * @singleton
         **/
        plugin.freezePublicAPI({
            /**
             * Display the file upload window
             */
            showUploadWindow: showUploadWindow,
            
            /**
             * Display the file exists dialog.
             * Only used for unit testing
             * @ignore
             */
            fileExistsDialog: fileExistsDialog,
            
            /**
             * Upload files from a native drag and drop operation
             * 
             * @param {DragEvent} dropEvent native DOM drop event
             * @param {String} targetPath path where to upload the files
             */
            uploadFromDrop: uploadFromDrop,
            
            /**
             * Upload files from an file upload input element
             * 
             * @param {HTMLInputElement} inputElement the upload input DOM 
             *   element
             */
            uploadFromInput: uploadFromInput,
            
            /**
             * 
             */
            getTargetFolder: getTargetFolder
        });
        
        register(null, {
            upload: plugin
        });
    }
});