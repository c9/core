define(function(require, exports, module) {
    "use strict";
    
    main.consumes = [
        "Plugin", "c9", "ui", "menus", "tree", "info", "vfs"
    ];
    main.provides = ["download"];
    return main;
    
    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var ui = imports.ui;
        var c9 = imports.c9;
        var menus = imports.menus;
        var tree = imports.tree;
        var vfs = imports.vfs;
        var info = imports.info;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);

        var loaded = false;
        function load(){
            if (loaded) return false;
            loaded = true;
            
            menus.addItemByPath("File/Download Project", new ui.item({
                onclick: downloadProject
            }), 1300, plugin);
            
            // Context Menu
            tree.getElement("mnuCtxTree", function(mnuCtxTree) {
                menus.addItemToMenu(mnuCtxTree, new ui.item({
                    match: "folder|project",
                    isAvailable: function(){
                        return tree.selectedNode;
                    },
                    caption: "Download",
                    onclick: download
                }), 140, plugin);
            });
        }
        
        function download() {
            if (!c9.has(c9.STORAGE))
                return;
                
            var node = tree.selectedNode;
            if (!node) return;
            
            var paths = tree.selectedNodes.map(function(node) {
                return node.path;
            });
            if (node.isFolder && node.path == "/")
                downloadProject();
            else if (paths.length > 1)
                vfs.download(paths);
            else if (node.isFolder)
                downloadFolder(node.path);
            else
                downloadFile(node.path);
            
        }
        
        function downloadProject() {
            vfs.download("/", info.getWorkspace().name + ".tar.gz");
        }

        function downloadFolder(path) {
            vfs.download(path.replace(/\/*$/, "/"));
        }
        
        function downloadFile(path) {
            vfs.download(path.replace(/\/*$/, ""), null, true);
        }
                
        /***** Lifecycle *****/
        
        plugin.on("load", function(){
            load();
        });
        
        /***** Register and define API *****/
        
        plugin.freezePublicAPI({
            
        });
        
        register(null, {
            download: plugin
        });
    }
});