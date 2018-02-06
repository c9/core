define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "util", "ui", "layout", "tree", "upload.manager", "anims"
    ];
    main.provides = ["upload.progress"];
    return main;
    
    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var ui = imports.ui;
        var layout = imports.layout;
        var tree = imports.tree;
        var anims = imports.anims;
        var uploadManager = imports["upload.manager"];
        
        var css = require("text!./upload_progress.css");
        var TreeData = require("ace_tree/data_provider");
        var Tree = require("ace_tree/tree");
        var escapeHTML = require("ace/lib/lang").escapeHTML;
        
        var boxUploadActivityMarkup = require("text!./markup/box_upload_activity.xml");
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var list, boxUploadActivity, mdlUploadActivity;
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
        
            uploadManager.on("addJob", onAddUploadJob);
            uploadManager.on("removeJob", onRemoveUploadJob);
        }
        
        var drawn = false;
        function draw() {
            if (drawn) return;
            drawn = true;
            
            // load CSS
            ui.insertCss(css, null, plugin);
            
            // Import Skin
            ui.insertSkin({
                name: "uploadfiles",
                data: require("text!./markup/skin.xml"),
            }, plugin);
            
            // Create UI elements
            ui.insertMarkup(layout.findParent(plugin), boxUploadActivityMarkup, plugin);
        
            boxUploadActivity = plugin.getElement("boxUploadActivity");
        
            tree.getElement("container", function(treeContainer) {
                var p = treeContainer.parentNode;
                var box = new ui.vsplitbox({
                    id: "vboxTreeContainer",
                    style: "position:relative;flex:1",
                    splitter: false
                });
                p.insertBefore(box, treeContainer);
                box.appendChild(treeContainer);
                box.appendChild(boxUploadActivity);
            });
            
            list = plugin.getElement("lstUploadActivity");

            tree = new Tree(list.$ext);
            mdlUploadActivity = new TreeData();
            tree.setDataProvider(mdlUploadActivity);
            tree.renderer.setScrollMargin(10, 10);
            tree.renderer.setTheme({ cssClass: "list-uploadactivity" });
            mdlUploadActivity.rowHeight = 21;
            mdlUploadActivity.rowHeightInner = 20;
            mdlUploadActivity.getContentHTML = function(node) {
                return "<span class='uploadactivity-caption'>"
                    + escapeHTML(node.label)
                    + "</span>"
                    + "<span class='uploadactivity-progress'>"
                    + (node.progress == undefined ? "&nbsp;" : escapeHTML(node.progress + "%")) + "</span>"
                    + "<span class='uploadactivity-delete'>&nbsp;</span>";
            };
            mdlUploadActivity.updateProgress = function(node, val) {
                node.progress = val;
                this._signal("changeClass");
            };
            mdlUploadActivity.redrawNode = function(el, node) {
                if (node.progress && el.children[2]) 
                    el.children[2].textContent = node.progress + "%";
            };
            
            tree.on("delete", function(node) {
                var job = uploadManager.jobById(node.job_id);
                if (job)
                    job.cancel();
                return false;
            });
            
            tree.on("click", function(ev) {
                if (ev.domEvent.target.className == 'uploadactivity-delete') {
                    tree._signal("delete", ev.getNode());
                }
            });
            
            plugin.getElement("btnCancelUploads").on("click", function(e) {
                cancelAll();
            });
            
            plugin.getElement("btnToggleUploadQueue").addEventListener("click", function(e) {
                var checked = !this.value;
                
                if (checked) {
                    hidePanel(boxUploadActivity);
                } else {
                    showPanel(boxUploadActivity);
                }
            });

            showPanel(boxUploadActivity);
            emit("draw");
        }
        
        /***** Methods *****/
        
        var panelVisible = false;
        
        function hidePanel(list) {
            if (!panelVisible) return;
            panelVisible = false;
            anims.animateSplitBoxNode(list, {
                height: "22px",
                duration: 0.2,
                timingFunction: "ease-in-out",
            }, function() {
                tree && tree.resize();
            }); 
        }
        
        function removePanel(panel) {
            if (!panelVisible) return;
            panelVisible = false;
            if (!panel.$amlDestroyed) {
                anims.animateSplitBoxNode(panel, {
                    height: "0px",
                    duration: 0.2,
                    timingFunction: "ease-in-out"
                });
            }
        }
        
        function showPanel(panel) {
            if (panelVisible) return;
            
            panelVisible = true;
            panel.show();
            panel.$ext.style.height = "22px";
            anims.animateSplitBoxNode(panel, {
                height: "175px",
                duration: 0.2,
                timingFunction: "ease-in-out"
            }, function() {
                tree && tree.resize();
            });
        }
        
        function onAddUploadJob(e) {
            var job = e.job;
            show();
            
            var node = { label: job.file.name, job_id: job.id };
            job.node = node;
            mdlUploadActivity.visibleItems.push(node);
            mdlUploadActivity._signal("change");
            job.on("progress", updateProgress);
            updateUploadCount();
        }
        
        function updateProgress(e) {
            if (e.job.node) {
                mdlUploadActivity.updateProgress(e.job.node, Math.round(e.progress * 100));
            }
        }
        
        function onRemoveUploadJob(e) {
            var job = e.job;
            // RLD: I removed this because it makes little sense to me to force
            // the box to show when an item is removed.
            // show();
            
            var i = mdlUploadActivity.visibleItems.indexOf(job.node);
            if (i != -1)
                mdlUploadActivity.visibleItems.splice(i, 1);
            mdlUploadActivity._signal("change");
            updateUploadCount();
            
            if (uploadManager.jobs.length === 0) {
                setTimeout(function() {
                    removePanel(boxUploadActivity);
                }, 1000);
            }
        }
        
        var updateUploadCountSyncTimer;
        function updateUploadCountSync() {
            updateUploadCountSyncTimer = null;
            var count = uploadManager.jobs.length;
            boxUploadActivity.setAttribute("caption", "Upload Activity" + (count ? "(" + count + ")" : ""));
        }
        
        function updateUploadCount() {
            if (!updateUploadCountSyncTimer)
                updateUploadCountSyncTimer = setTimeout(updateUploadCountSync, 100);
        }
        
        function cancelAll() {
            uploadManager.jobs.forEach(function(job) {
                job.cancel(); 
            });
        }
        
        function show() {
            draw();
            list.show();
            showPanel(boxUploadActivity);
        }
        
        function hide() {
            hidePanel(boxUploadActivity);
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
            drawn = false;
        });
        
        /***** Register and define API *****/
        
        /**
         * Displays the upload progress in a panel below the tree.
         * @singleton
         */
        plugin.freezePublicAPI({
            /**
             * Show the upload progress panel
             */
            show: show,
            
            /**
             * Hide the upload progress panel
             */
            hide: hide,
            
            /**
             * Cancel all running jobs
             */
            cancelAll: cancelAll
        });
        
        register(null, {
            "upload.progress": plugin
        });
    }
});