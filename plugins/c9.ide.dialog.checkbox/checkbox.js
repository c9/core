define(function(require, module, exports) {
    main.consumes = [
        "Plugin", "ui", "fs", "dialog.alert", "fs.cache", "util", "Dialog", "tree"
    ];
    main.provides = ["checkbox"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var util = imports.util;
        var ui = imports.ui;
        var fsCache = imports["fs.cache"];
        var fileTree = imports.tree;

        var Tree = require("ace_tree/tree");
        var TreeData = require("ace_tree/data_provider_mirror");
        var TreeEditor = require("ace_tree/edit");

        /***** Initialization *****/

        var plugin = new Plugin("CS50", main.consumes);
        var emit = plugin.getEmitter();

        var dialog; 
        var container; 
        var btnChoose; 
        var btnCancel;
        var tree; 
        var cbShowFiles; 
        var fileOutput;
        var globalPath = null;
        var showFiles = true;

        var loaded;
        function load() {
            if (loaded) return;
            loaded = true;
        }

        /**
         * Redefine draw function to create dialog box
         */
        var drawn = false;
        function draw(htmlNode) {
            if (drawn) return;
            drawn = true;

            // Markup
            ui.insertMarkup(null, require("text!./checkbox.xml"), plugin);

            // CSS
            ui.insertCss(require("text!./checkbox.css"), plugin);

            // Dynamic elements
            dialog = plugin.getElement("window");
            container = plugin.getElement("container");
            btnChoose = plugin.getElement("btnChoose");
            btnCancel = plugin.getElement("btnCancel");
            cbShowFiles = plugin.getElement("cbShowFiles");
            fileOutput = plugin.getElement("fileOutput");

            // Insert File Tree
            tree = new Tree(container.$int);
            tree.renderer.setScrollMargin(10, 10);
            tree.renderer.setTheme({cssClass: "filetree"});
            tree.edit = new TreeEditor(tree);

            // Rename file/directory in tree
            tree.on("beforeRename", function(e) {
                return fileTree.tree._emit("beforeRename", e);
            });
            tree.on("rename", function(e) {
                return fileTree.tree._emit("rename", e);
            });

            // Remove file/directory in tree
            tree.on("delete", function(e) {
                var selection = tree.selection.getSelectedNodes();
                fileTree.remove(selection);
            });

            // Adjust to scrolling
            tree.renderer.on("scrollbarVisibilityChanged", updateScrollBarSize);
            tree.renderer.on("resize", updateScrollBarSize);
            function updateScrollBarSize() {
                var w = tree.renderer.scrollBarV.getWidth();
                tree.renderer.scroller.style.right = Math.max(w, 10) + "px";
            }

            // On user select, get path of directory/file
            tree.on("userSelect", function(e) {
                var selected = tree.selection.getCursor();
                globalPath = selected.path;
            });

            // Handles visibility
            dialog.on("prop.visible", function(e) {
                updateTreeModel(e.value);
                if (e.value) emit("show");
                else emit("hide");
            });

            // Handles resizing of dialog box
            dialog.on("afterresize", function() {
                tree.resize();
            });

            emit.sticky("draw");
        }

        /***** Method *****/

        /**
         * Handles/Creates data in tree
         */
        function updateTreeModel(enable) {
            if (enable) {
                var model = new TreeData();

                // Details, determining root, refreshing tree
                var height = parseInt(ui.getStyleRule(".filetree .tree-row", "height"), 10);
                model.rowHeightInner = height;
                model.rowHeight = height + 1;
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
                
                // Adds in checkboxes
                model.getCheckboxHTML = 
                    function(node) {
                        return "<span class='checkbox " + (node.isChecked == -1
                            ? "half-checked " : (node.isChecked ? "checked " : ""))
                            + "'></span>";
                    };

                // Set checkbox controls to use space bar as a hotkey
                tree.commands.bindKey("Space", function(e) {
                    var nodes = tree.selection.getSelectedNodes();
                    var node = tree.selection.getCursor();
                    node.isChecked = !node.isChecked;
                    nodes.forEach(function(n){ n.isChecked = node.isChecked });
                    model._signal(node.isChecked ? "check" : "uncheck", nodes);
                    model._signal("change");
                });

                // Update filter and root
                updateFilter(model);
                tree.setDataProvider(model);
                
                // Initial expand
                model.getChildren(model.root).forEach(function(node) {
                    if (node.isRoot)
                        model.expand(node);
                });

                // Handles checkboxes on expansion
                model.on("expand", function (e) {
                    if(e.isChecked && e.isChecked != -1) {
                        e.children.forEach(function(n) {
                            n.isChecked = true;
                        });
                    }
                });

                // On check event updates parents and children
                model.on("check", function (e) {
                    updateParents(e[0], true);
                    updateChildren(e[0], true);
                });

                // On uncheck event updates parents and children
                model.on("uncheck", function (e) {
                    updateParents(e[0], false);
                    updateChildren(e[0], false);
                });
                
                // Assign clicked path, else root
                var path = globalPath == null ? "/" : globalPath;
                expandAndSelect(path, model);

                fsCache.model.on("startUpdate", tree.provider.startUpdate);
                fsCache.model.on("endUpdate", tree.provider.endUpdate);
            } else {
                fsCache.model.off("startUpdate", tree.provider.startUpdate);
                fsCache.model.off("endUpdate", tree.provider.endUpdate);
                tree.setDataProvider(null);
            }
        }

        /**
         * Updates all affected parent files' checkboxes from the checkbox events
         */
        function updateParents(node) {
            var fullCheck = true;
            var halfCheck = false;
            
            if (node.parent != null) {
                node.parent.children.forEach(function(n) {
                    halfCheck = halfCheck || n.isChecked;
                    fullCheck = (fullCheck && n.isChecked) && (n.isChecked != -1);
                });
                if (fullCheck) {
                    node.parent.isChecked = true;
                }
                else if (halfCheck) {
                    node.parent.isChecked = -1;
                }
                else {
                    node.parent.isChecked = false;
                }
                updateParents(node.parent);
            }
        }

        /**
         * Updates all affected child files' checkboxes from the checkbox events
         */
        function updateChildren(node, checkBool) {
            if (node.children != null) {
                node.children.forEach(function(n) {
                    n.isChecked = checkBool;
                    updateChildren(n, checkBool);
                });
            }
        }

        /**
         * Loads the initial path and initiates the selection process for the files
         */
        function selectFiles(path, files) {
            var limiter = true;
            fsCache.loadNodes(path, function(e) {
                if (e.node && limiter) {
                    tree.reveal(e.node);
                    limiter = false;
                    files = selectLoop(e.node, path, files);
                }
            });
            return files;
        }

        /**
         * Recursively goes through the file directory and selects all appropriate files
         */
        function selectLoop (node, path, files) {
            if ((path == "/") && node.isChecked && (node.isChecked != -1)) {
                node.children.forEach(function(n) {
                    files.push((n.path).slice(1));
                });
                return files;
            }
            else if (node.children != null) {
               node.children.forEach(function(n) {
                    if (n.isChecked && (n.isChecked != -1)) {
                        files.push((n.path).slice(1));
                    }
                    else if (n.children != null) {
                        selectLoop(n, n.path, files);
                    }
                });
                return files;
            }
        }

        /**
         * Expands tree when the directory is double clicked (or the arrow is pressed)
         */
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

        /**
         * Get icons for nodes
         */
        function getIconHTML(node) {
            var icon = node.map ? "folder" : util.getFileIcon(node.label);
            if (node.status === "loading") icon = "loading";
            return "<span class='filetree-icon " + icon + "'></span>";
        }

        /**
         * Update tree filter and root
         */
        function updateFilter(model) {
            model && model.setFilter(showFiles ? null : function(node) {
                return node.isRoot || node.isFolder;
            });
        }

        /**
         * Initializes checkbox dialog
         */
        function init(title, path, onChoose, onCancel, options) {
            var showFilesCheckbox = (options && options.showFilesCheckbox) !== false;

            plugin.title = title || "Files";

            btnChoose.setAttribute("caption", options && options.chooseCaption || "Submit");

            var choosen = false;

            // On submit, send array with all selected paths
            btnChoose.onclick = function() {
                var path = selectFiles("/", []);
                choosen = true;
                    onChoose(path || false, function() {
                        dialog.hide();
                    });
            };

            // On cancel, close
            btnCancel.onclick = function() {
                dialog.hide();
            };

            cbShowFiles.setAttribute("visible", showFilesCheckbox);
            cbShowFiles.setAttribute("checked", true);
            showFiles = true;
            cbShowFiles.on("prop.value", function() {
                showFiles = cbShowFiles.checked;
                updateFilter(tree.provider);
            });

            plugin.once("hide", function() {
                if (!choosen && onCancel)
                    onCancel();
            });
        }

        /**
         * Displays checkbox dialog
         */
        function show(title, path, onChoose, onCancel, options) {
            if (!plugin.loaded)
                return;

            draw();

            init(title, path, onChoose, onCancel, options);

            dialog.show();
        }

        /**
         * Hides checkbox dialog
         */
        function hide() {
            dialog && dialog.hide();
        }


        /***** Lifecycle *****/

        plugin.on("load", function() {
            load();
        });
        plugin.on("unload", function() {
            dialog = null,
            container = null,
            btnChoose = null,
            btnCancel = null,
            tree = null,
            cbShowFiles = null,
            showFiles = null,
            drawn = null,
            loaded = null,
            fileOutput = null;
            globalPath = null;
        });

        /***** Register and define API *****/

        plugin.freezePublicAPI({
            /**
             * The APF element that is the parent to all form elements
             */
            get aml() { 
                return dialog; 
            },
            
            /**
             * Gets the tree inside the checkbox dialog
             */
            get tree() {
                return tree; 
            },

            /**
             * Enables getting/setting the title of the checkbox dialog
             */
            get title() { 
                return plugin.title;
            },
            set title(value) {
                if (drawn)
                    dialog.setAttribute("title", value);
            },
            
            /**
             * Enables getting/setting the name of the output
             */
            get filename() { 
                return fileOutput.value; 
            },
            set filename(value) {
                if (drawn)
                    fileOutput.setAttribute("value", value);
            },
            
            _events: [
                /**
                 * Fires when the plugin is drawn
                 */
                "draw",
                
                /**
                 * Fires when the plugin is shown
                 */
                "show",
                
                /**
                 * Fires when the plugin is hidden
                 */
                "hide"
            ],

            /**
             * Show the plugin
             */
            show: show,

            /**
             * Hide the plugin
             */
            hide: hide
        });

        register("", {
            "checkbox" : plugin
        });
    }
});