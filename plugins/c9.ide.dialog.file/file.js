define(function(require, module, exports) {
    main.consumes = [
        "Plugin", "ui", "fs", "dialog.alert", "fs.cache", "util", "Dialog", "tree"
    ];
    main.provides = ["dialog.file"];
    return main;
    
    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var Dialog = imports.Dialog;
        var util = imports.util;
        var ui = imports.ui;
        var fs = imports.fs;
        var fsCache = imports["fs.cache"];
        var alert = imports["dialog.alert"].show;
        var fileTree = imports.tree;
        
        var Tree = require("ace_tree/tree");
        var TreeData = require("ace_tree/data_provider_mirror");
        var TreeEditor = require("ace_tree/edit");
        
        var join = require("path").join;
        var basename = require("path").basename;
        var dirname = require("path").dirname;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var dialog, container, btnChoose, btnCancel, btnCreateFolder;
        var tree, cbShowFiles, txtFilename, txtDirectory, boxFilename;
        var showFiles = true;
        var hideFileInput = true;
        
        var loaded;
        function load() {
            if (loaded) return;
            loaded = true;
        }
    
        var drawn = false;
        function draw(htmlNode) {
            if (drawn) return;
            drawn = true;
            
            // Markup
            ui.insertMarkup(null, require("text!./file.xml"), plugin);
            
            // CSS
            ui.insertCss(require("text!./file.css"), plugin);
            
            dialog = plugin.getElement("window");
            container = plugin.getElement("container");
            btnChoose = plugin.getElement("btnChoose");
            btnCancel = plugin.getElement("btnCancel");
            btnCreateFolder = plugin.getElement("btnCreateFolder");
            cbShowFiles = plugin.getElement("cbShowFiles");
            txtFilename = plugin.getElement("txtFilename");
            txtDirectory = plugin.getElement("txtDirectory");
            boxFilename = plugin.getElement("boxFilename");
            
            btnCreateFolder.on("click", function() {
                fileTree.createFolder(null, null, function(err, newpath) {
                    expandAndSelect(newpath);
                }, tree);
            });
            
            txtFilename.on("keyup", function(e) {
                if (e.keyCode == 13) {
                    btnChoose.dispatchEvent("click");
                }
            });
            
            txtDirectory.on("keyup", function(e) {
                if (e.keyCode == 13) {
                    expandAndSelect(txtDirectory.value);
                }
            });
            
            // Insert File Tree
            // @todo abstract this from the file tree plugin
            tree = new Tree(container.$int);
            tree.renderer.setScrollMargin(10, 10);
            tree.renderer.setTheme({ cssClass: "filetree" });
            tree.edit = new TreeEditor(tree);
            
            // Rename
            tree.on("beforeRename", function(e) {
                return fileTree.tree._emit("beforeRename", e);
            });
            tree.on("rename", function(e) {
                return fileTree.tree._emit("rename", e);
            });
            
            // Remove
            tree.on("delete", function(e) {
                var selection = tree.selection.getSelectedNodes();
                fileTree.remove(selection);
            });
            
            tree.renderer.on("scrollbarVisibilityChanged", updateScrollBarSize);
            tree.renderer.on("resize", updateScrollBarSize);
            function updateScrollBarSize() {
                var w = tree.renderer.scrollBarV.getWidth();
                tree.renderer.scroller.style.right = Math.max(w, 10) + "px";
            }
             
            tree.on("userSelect", function(e) {
                var selected = tree.selection.getCursor();
                if (selected) {
                    plugin.directory = selected.isFolder
                        ? selected.path : dirname(selected.path);
                    if (!selected.isFolder)
                        plugin.filename = basename(selected.path);
                }
            });
            
            tree.on("afterChoose", function(e) {
                
            });
            
            dialog.on("prop.visible", function(e) {
                updateTreeModel(e.value);
                if (e.value) emit("show");
                else emit("hide");
            });
            
            dialog.on("afterresize", function() {
                tree.resize();
            });
            
            emit.sticky("draw");
        }
        
        /***** Method *****/
        
        function updateTreeModel(enable) {
            if (enable) {
                var model = new TreeData();
                
                var height = parseInt(ui.getStyleRule(".filetree .tree-row", "height"), 10);
                model.rowHeightInner = height;
                model.rowHeight = height;
                model.indent = 12;
                model.getIconHTML = getIconHTML;
                
                model.setRoot(fsCache.model.root);
                model.source = fsCache.model;
                Object.getOwnPropertyNames(model.source).forEach(function(n) {
                    if (typeof model.source[n] == "function")
                        model[n] = model.source[n];
                });
                model.startUpdate = function() {};
                model.endUpdate = function(node) {
                    if (model.isOpen(node)) {
                        model.close(node);
                        model.open(node);
                    }
                };
                updateFilter(model);
                tree.setDataProvider(model);
                model.getChildren(model.root).forEach(function(node) {
                    if (node.isRoot)
                        model.expand(node);
                });
                
                var path = plugin.directory + (showFiles && !hideFileInput
                    ? "/" + plugin.filename
                    : "");
                expandAndSelect(path, model);
                
                
                fsCache.model.on("startUpdate", tree.provider.startUpdate);
                fsCache.model.on("endUpdate", tree.provider.endUpdate);
            } else {
                fsCache.model.off("startUpdate", tree.provider.startUpdate);
                fsCache.model.off("endUpdate", tree.provider.endUpdate);
                tree.setDataProvider(null);
            }
        }
        function expandAndSelect(path, model) {
            fsCache.loadNodes(path, function(e) {
                if (model && tree.provider != model)
                    return;
                if (e.node) {
                    tree.reveal(e.node);
                    if (e.node.isFolder)
                        tree.provider.expand(e.node);
                }
                if (e.complete) {
                    setTimeout(function() {
                        tree.renderer.scrollCaretIntoView(null, 0.5);
                    }, 200);
                }
            });
        }
        function getIconHTML(node) {                
            var icon = node.map ? "folder" : util.getFileIcon(node.label);
            if (node.status === "loading") icon = "loading";
            return "<span class='filetree-icon " + icon + "'></span>";
        }
        
        function updateFilter(model) {
            model && model.setFilter(showFiles ? null : function(node) {
                return node.isRoot || node.isFolder;
            });
        }

        function init(title, path, onChoose, onCancel, options) {
            var createFolderButton = (options && options.createFolderButton) !== false;
            var showFilesCheckbox = (options && options.showFilesCheckbox) !== false;
            var hideFileInput = options && options.hideFileInput;

            plugin.title = title || "Save As";
            plugin.filename = path ? basename(path) : "";
            plugin.directory = path ? (hideFileInput ? path : dirname(path)) : "/";
            btnChoose.setAttribute("caption", options && options.chooseCaption || "Save");

            var choosen = false;

            btnChoose.onclick = function() {
                var path = join(plugin.directory, hideFileInput ? "" : plugin.filename);

                if (!path)
                    return alert("Invalid Path", "Invalid Path",
                        "Please choose a correct path and filename");

                fs.exists(path, function(exists, stat) {
                    var isDirectory = stat && (
                        /(directory|folder)$/.test(stat.mime) || stat.link && /(directory|folder)$/.test(stat.linkStat.mime));
                    if (isDirectory && !hideFileInput) {
                        // @todo
                        // var node = fsCache.findNode(path);
                        // trSaveAs.select(node);
                        // if (trSaveAs.selected == node) {
                        //     txtSaveAs.setValue("");
                        //     expand(node);
                        // }
                        return;
                    }

                    choosen = true;
                    onChoose(path, stat || false, function() {
                        dialog.hide();
                    });
                });
            };

            btnCancel.onclick = function() {
                dialog.hide();
            };

            btnCreateFolder.setAttribute("visible", createFolderButton);
            cbShowFiles.setAttribute("visible", showFilesCheckbox);
            boxFilename.setAttribute("visible", !hideFileInput);


            cbShowFiles.setAttribute("checked", true);
            showFiles = true;
            cbShowFiles.on("prop.value", function() {
                showFiles = cbShowFiles.checked;
                updateFilter(tree.provider);
            });
            // @todo options.hideTree
            // @todo options.showFiles
            // @todo options.showHiddenFiles

            plugin.once("hide", function() {
                if (!choosen && onCancel)
                    onCancel();
            });
        }

        function show(title, path, onChoose, onCancel, options) {
            if (!plugin.loaded)
                return;

            draw();

            init(title, path, onChoose, onCancel, options);

            dialog.show();
        }

        function hide() {
            dialog && dialog.hide();
        }
        
        /***** Register and define API *****/
        
        /**
         * 
         */
        plugin.freezePublicAPI({
            /**
             * The APF element that is the parent to all form elements.
             * @property {AMLElement} aml
             * @private
             * @readonly
             */
            get aml() { return dialog; },
            
            /**
             * 
             */
            get tree() { return tree; },
            
            /**
             * 
             */
            get title() { },
            set title(value) {
                if (drawn)
                    dialog.setAttribute("title", value);
            },
            /**
             * 
             */
            get filename() { return txtFilename.value; },
            set filename(value) {
                if (drawn)
                    txtFilename.setAttribute("value", value);
            },
            /**
             * 
             */
            get directory() { return txtDirectory.value; },
            set directory(value) {
                if (drawn)
                    txtDirectory.setAttribute("value", value);
            },
            
            _events: [
                /**
                 * Fires when the form is drawn.
                 * @event draw
                 */
                "draw",
                /**
                 * Fires when the form becomes visible. This happens when
                 * it's attached to an HTML element using the {@link #attachTo}
                 * method, or by calling the {@link #method-show} method.
                 * @event show
                 */
                "show",
                /**
                 * Fires when the form becomes hidden. This happens when
                 * it's detached from an HTML element using the {@link #detach}
                 * method, or by calling the {@link #method-hide} method.
                 * @event hide
                 */
                "hide"
            ],

            /**
             * Show the form. This requires the form to be 
             * {@link #attachTo attached} to an HTML element.
             * @fires show
             */
            show: show,

            /**
             * Hide the form.
             * @fires hide
             */
            hide: hide
        });
        
        register("", {
            "dialog.file": plugin
        });
    }
});