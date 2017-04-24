define(function(require, exports, module) {
    "use strict";
    
    main.consumes = [
        "Plugin", "c9", "ui", "menus", "tree", "info", "vfs", "preferences", "settings", "util"
    ];
    main.provides = ["download"];
    return main;
    
    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var ui = imports.ui;
        var c9 = imports.c9;
        var util = imports.util;
        var menus = imports.menus;
        var tree = imports.tree;
        var vfs = imports.vfs;
        var info = imports.info;
        var prefs = imports.preferences;
        var settings = imports.settings;

        var SETTING_NAME = "downloadFilesAs";
        var SETTING_PATH = "user/general/@" + SETTING_NAME;

        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);

        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            menus.addItemByPath("File/Download Project", new ui.item({
                onclick: downloadProject
            }), 1300, plugin);
            
            // Context Menu
            tree.getElement("mnuCtxTree", function(mnuCtxTree) {
                menus.addItemToMenu(mnuCtxTree, new ui.item({
                    match: "folder|project",
                    isAvailable: function() {
                        return tree.selectedNode;
                    },
                    caption: "Download",
                    onclick: download
                }), 140, plugin);
            });

            // Preferences
            prefs.add({
                "General": {
                    "Tree & Navigate": {
                        "Download Files As": {
                            type: "dropdown",
                            path: SETTING_PATH,
                            items: [
                                { caption: "auto", value: "auto" },
                                { caption: "tar.gz", value: "tar.gz" },
                                { caption: "zip", value: "zip" }
                            ],
                            position: 5000
                        }
                    }
                }
            }, plugin);

            settings.on("read", function() {
                settings.setDefaults("user/general", [[SETTING_NAME, "auto"]]);
            }, plugin);
        }
        
        function download() {
            if (!c9.has(c9.STORAGE))
                return;
                
            var node = tree.selectedNode;
            if (!node) return;
            
            var paths = tree.selectedNodes.map(function(node) {
                return util.normalizePath(node.path);
            });
            if (node.isFolder && node.path == "/")
                downloadProject();
            else if (paths.length > 1)
                downloadPaths(paths);
            else if (node.isFolder)
                downloadFolder(paths[0]);
            else
                downloadFile(paths[0]);
        }

        function downloadProject() {
            vfs.download("/", makeArchiveFilename(info.getWorkspace().name));
        }

        function downloadPaths(paths) {
            var lastPart = paths[0].match(/([^\/]*)\/?$/)[1];
            var filename = lastPart ? (lastPart + "[+" + (paths.length - 1) + "]") : info.getWorkspace().name;
            vfs.download(paths, makeArchiveFilename(filename));
        }

        function downloadFolder(path) {
            var withTrailingSlash = path.replace(/\/*$/, "/");
            var parts = withTrailingSlash.split("/");
            var folderName = parts[parts.length - 2];
            vfs.download(withTrailingSlash, makeArchiveFilename(folderName));
        }

        function downloadFile(path) {
            vfs.download(path.replace(/\/*$/, ""), null, true);
        }

        function makeArchiveFilename(filename) {
            return filename + getArchiveFileExtension();
        }

        function getArchiveFileExtension() {
            var downloadFilesAs = settings.get(SETTING_PATH);
            if (downloadFilesAs === 'auto' || !downloadFilesAs) {
                downloadFilesAs = /Win/.test(navigator.platform) ? 'zip' : 'tar.gz';
            }
            return '.' + downloadFilesAs;
        }
                
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
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