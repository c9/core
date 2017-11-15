define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "fs", "settings", "preferences", "watcher", "tabManager", 
        "save", "dialog.question", "dialog.filechange", "threewaymerge", "collab"
    ];
    main.provides = ["watcher.gui"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var watcher = imports.watcher;
        var prefs = imports.preferences;
        var fs = imports.fs;
        var save = imports.save;
        var settings = imports.settings;
        var tabManager = imports.tabManager;
        var question = imports["dialog.question"];
        var filechange = imports["dialog.filechange"];
        var threeWayMerge = imports.threewaymerge.merge;
        var collab = imports.collab;
        
        var collabEnabled = options.collab;
        
        var comparisonType = {
            TIMESTAMP_AND_CONTENTS: "TIMESTAMP_AND_CONTENTS",
            CONTENTS: "CONTENTS",
            NONE: "NONE"
        };

        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var removedPaths, changedPaths;
        var deleteDialog, changeDialog, initialFocus;
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            removedPaths = {};
            changedPaths = {};
    
            // Settings and preferences
    
            settings.on("read", function(e) {
                settings.setDefaults("user/general", [
                    ["automerge", false],
                    ["confirmmerge", true]
                ]);
            });
            
            prefs.add({
                "File": {
                    position: 150,
                    "Watchers": {
                        position: 300,
                        "Auto-Merge Files When a Conflict Occurs": {
                            type: "checkbox",
                            path: "user/general/@automerge",
                            min: "1",
                            max: "64",
                            tooltip: "Whenever the file watcher detects a "
                                + "file change on disk, 'auto merge' will fetch "
                                + "the contents from disc and merges it with "
                                + "the version in the editor.",
                            position: 2200
                        }
                    }
                }
            }, plugin);
            
            // Watch for new documents and hook their value initialization
            
            function initializeDocument(doc) {
                if (!doc.meta.$savedValue)
                    doc.meta.$savedValue = doc.recentValue;
                doc.on("setValue", function(e) {
                    doc.meta.$savedValue = e.value;
                }, plugin);
            }
            
            function initializeTab(tab) {
                if (!tab.path) return;
                
                if (tab.document.undoManager.isAtBookmark()) {
                    initializeDocument(tab.document);
                }
                if (tab.classList.contains("conflict")) {
                    addChangedTab(tab, comparisonType.TIMESTAMP_AND_CONTENTS);
                }
            }
            
            tabManager.getTabs().forEach(initializeTab);
            tabManager.on("open", function(e) {
                initializeTab(e.tab);
            }, plugin);
            
            // Hook the save of the document value
            save.on("beforeSave", function(e) {
                e.document.meta.$savingValue = e.save;
                if (e.tab.classList.contains("conflict")) {
                    showChangeDialog(e.tab);
                }
            }, plugin);
            
            save.on("afterSave", function(e) {
                var meta = e.document.meta;
                if (!e.err) {
                    meta.$savedValue = meta.$savingValue;
                    watcher.watch(e.path);
                }
                delete meta.$savingValue;
                delete meta.$mergeRoot;
            }, plugin);
    
            // Hook watcher events
            
            // A change event sent from the watcher plugin
            watcher.on("change", function(e) {
                var tab = tabManager.findTab(e.path);
                if (tab) {
                    if (collabEnabled && tab.editorType == "ace") {
                        /* If the lastChange (added by collab) was greater than 1 second ago set up a watch 
                            To ensure that collab makes this change, if not report an error. The lastChange
                            check is to avoid a race condition if collab updates before this function runs */
                        if (!tab.meta.$lastCollabChange || tab.meta.$lastCollabChange < (Date.now() - 1000)) {
                            if (tab.meta.$collabChangeRegistered) {
                                clearTimeout(tab.meta.$collabChangeRegistered);
                            }
                        }
                        
                        return false;
                    }
                    
                    addChangedTab(tab, comparisonType.TIMESTAMP_AND_CONTENTS);
                }
            });
            
            collab.on("change", function (e) {
                var tab = tabManager.findTab(e.path);
                if (tab) {
                    addChangedTab(tab, comparisonType.NONE);
                }
            });
            
            collab.on("resolveConflict", function (e) {
                var tab = tabManager.findTab(e.path);
                if (tab) {
                    var doc = tab.document;
                    var path = tab.path;
                    resolveConflict(doc, path);
                }
            });
            
            watcher.on("delete", function(e) {
                var tab = tabManager.findTab(e.path);
                if (tab)
                    addDeletedTab(tab);
            });
        }
        
        /***** Methods *****/
        
        function resolveConflict(doc, path) {
            doc.tab.classList.remove("conflict");
            delete doc.meta.$merge;
            delete changedPaths[path];
        }
        
        function resolve(doc, path) {
            if (collabEnabled && collab.send)
                collab.send({ type: "RESOLVE_CONFLICT", data: { docId: path }});
            resolveConflict(doc, path);
        }

        
        function isTabSaving(tab) {
            return !!tab.document.meta.$saving;
        }
        
        function addChangedTab(tab, doubleCheckComparisonType) {
            // If we already have a dialog open, just update it, but mark the value dirty
            if (changedPaths[tab.path]) {
                if (changedPaths[tab.path].data)
                    changedPaths[tab.path].dirty = true;
                if (changeDialog && changeDialog.visible)
                    return;
            }
            
            // Ignore changes that come in while tab is being saved
            if (isTabSaving(tab)) return;
            
            // If the terminal is currently focussed, lets wait until 
            // another tab is focussed
            if (tabManager.focussedTab && tabManager.focussedTab.editorType == "terminal") {
                tabManager.once("focus", function() {
                    addChangedTab(tab, comparisonType.CONTENTS);
                });
                return;
            }
            
            var doc = tab.document;
            var path = tab.path;
            
            changedPaths[tab.path] = { tab: tab, resolve: resolve.bind(null, doc, path) };
            
            switch (doubleCheckComparisonType) {
                case comparisonType.TIMESTAMP_AND_CONTENTS:
                    checkByStatOrContents(tab);
                    break;
                case comparisonType.CONTENTS:
                    checkByContents(tab);
                    break;
                case comparisonType.NONE:
                    showChangeDialog(tab);
                    break;
            }
        }
            
        function createChangeDialog(tab, data) {
            var doc = tab.document;
            var path = tab.path;
            
            if (!changedPaths[path])
                return;
            changedPaths[path].data = data || changedPaths[path].data;
            
            if (tabManager.focussedTab && !changedPaths[tabManager.focussedTab.path]) {
                doc.tab.classList.add("conflict");
                // Let's try again later, maybe then one of our paths gets focus
                tabManager.once("focus", function() {
                    showChangeDialog(tab, data);
                });
                return;
            }
                
            if (!tabManager.findTab(path)) // drat! tab is gone
                return;
            
            // Show dialogs for changed tab
            showChangeDialog(tab, data);
        }
            
        function checkByStatOrContents(tab) {
            var doc = tab.document;
            var path = tab.path;
            
            fs.stat(path, function(err, stat) {
                if (!err && doc.meta.timestamp >= stat.mtime)
                    return resolve(doc, path);
                checkByContents(tab, stat);
            });
        }
        
        function checkByContents(tab, stat) {
            var doc = tab.document;
            var path = tab.path;
            
            fs.readFile(path, function(err, data) {
                if (err) {
                    console.warn("[watchers] Could not read", path, "will assume it got changed");
                    return createChangeDialog(tab);
                }

                // false alarm. File content didn't change
                if (data === doc.meta.$savedValue)
                    return resolve(doc, path);
                
                // Store base value for merges
                if (doc.meta.$mergeRoot == undefined)
                    doc.meta.$mergeRoot = doc.meta.$savedValue || doc.recentValue;
                // Update saved value
                doc.meta.$savedValue = data;
                if (stat)
                    doc.meta.timestamp = stat.mtime;
                    
                // short cut: remote value is the same as the current value
                if (data === doc.value) { // Expensive check
                    
                    // Remove the changed state from the document
                    doc.undoManager.bookmark();
                    
                    // Mark as resolved
                    resolve(doc, path);
                    
                    return;
                } else {
                    // if this is the first time change notification comes
                    // remember undomanger state for deciding to merge or not
                    if (doc.meta.$merge == undefined)
                        doc.meta.$merge = !doc.undoManager.isAtBookmark();
                    doc.undoManager.bookmark(-2);
                }
                
                if (automerge(tab, data))
                    resolve(doc, path);
                else
                    createChangeDialog(tab, data);
            });
        }
        
        function automerge(tab, data) {
            if (!settings.getBool("user/general/@automerge"))
                return false;
            return merge(tab, data);
        }
        
        function merge(tab, data) {
            if (tab.editor.type != "ace")
                return false;
            
            var doc = tab.document;
            var root = doc.meta.$mergeRoot || doc.meta.$savedValue;
            
            if (typeof root !== "string")
                return false;
            
            var aceDoc = doc.getSession().session.doc;
            var mergedValue = threeWayMerge(root, data, aceDoc);
            
            doc.meta.$mergeRoot = data;
            
            // If the value on disk is the same as in the document, set the bookmark
            if (mergedValue == data) {
                doc.undoManager.bookmark();
                save.save(tab);
            }
            
            return true;
        }
        
        function getLatestValue(path, callback) {
            if (!changedPaths[path] || changedPaths[path].dirty || !changedPaths[path].data) {
                fs.readFile(path, function(err, data) {
                    callback(err, path, data);
                });
            }
            else {
                callback(null, path, changedPaths[path].data);
            }
        }
        
        function updateChangedPath(err, path, data) {
            if (!changedPaths[path])
                return;
            var tab = changedPaths[path].tab || tabManager.findTab(path);
            if (!tab)
                return changedPaths[path].resolve();
            var doc = tab.document;
            doc.setBookmarkedValue(data, true);
            doc.meta.timestamp = Date.now() - settings.timeOffset;
            changedPaths[path].resolve();
            save.save(tab);
        }
        
        function mergeChangedPath(err, path, data) {
            merge(changedPaths[path].tab, data);
            changedPaths[path].resolve();
        }
        
        function showChangeDialog(tab, data) {
            var path, merge;
            
            if (changeDialog) {
                // The dialog is visible
                if (changeDialog.visible === 1) {
                    question.all = true;
                    return;
                }
                // The dialog still is to become visible
                else if (changeDialog.visible === undefined) {
                    changeDialog.on("show", function() {
                        question.all = true;
                    });
                    return;
                }
            }
            
            path = tab.path;
            merge = tab.document.meta.$merge 
              && typeof tab.document.meta.$savedValue === "string";
            
            function no(all) { // Local | No
                if (all) {
                    for (var id in changedPaths) {
                        changedPaths[id].tab.document.undoManager.bookmark(-2);
                        changedPaths[id].resolve();
                    }
                }
                else {
                    changedPaths[path].tab.document.undoManager.bookmark(-2);
                    changedPaths[path].resolve();
                }
                checkIfQueueIsEmpty();
            }
            
            function yes(all) { // Remote | Yes
                if (all) {
                    for (var id in changedPaths) {
                        getLatestValue(id, updateChangedPath);
                    }
                }
                else {
                    getLatestValue(path, updateChangedPath);
                }
                
                checkIfQueueIsEmpty();
            }
            
            if (merge) {
                changeDialog = filechange.show(
                    "File Changed",
                    path + " has been changed on disk.",
                    null,
                    no,
                    yes,
                    function(all) { // Merge
                        if (all) {
                            askAutoMerge();
        
                            for (var id in changedPaths) {
                                getLatestValue(id, mergeChangedPath);
                            }
                        }
                        else {
                            askAutoMerge();
                            getLatestValue(path, mergeChangedPath);
                        }
                        
                        checkIfQueueIsEmpty();
                    },
                    { 
                        merge: true,
                        all: Object.keys(changedPaths).length > 1
                    }
                );
            }
            else {
                changeDialog = question.show(
                    "File Changed",
                    path + " has been changed on disk.",
                    "Would you like to reload this file?",
                    yes, no, {
                        yes: "Reload",
                        no: "Keep current version",
                        all: Object.keys(changedPaths).length > 1
                    }
                );
            }
            
            if (!initialFocus)
                initialFocus = tabManager.focussedTab;
            
            // Focus the tab that is changed
            tabManager.focusTab(tab);
        }
        
        function addDeletedTab(tab, force) {
            if (!force && removedPaths[tab.path])
                return;
            
            // If the terminal is currently focussed, lets wait until 
            // another tab is focussed
            if (tabManager.focussedTab 
              && tabManager.focussedTab.editorType == "terminal") {
                tabManager.once("focus", function() {
                    addDeletedTab(tab, true);
                });
                return;
            }
            
            fs.stat(tab.path, function(err, data) {
                if (err && err.code === "ENOENT") {
                    removedPaths[tab.path] = { tab: tab };
    
                    if (deleteDialog) {
                        // The dialog is visible
                        if (deleteDialog.visible === 1) {
                            question.all = true;
                            return;
                        }
                        // The dialog still is to become visible
                        else if (deleteDialog.visible === undefined) {
                            deleteDialog.on("show", function() {
                                question.all = true;
                            });
                            return;
                        }
                    }
                    
                    if (!tabManager.findTab(tab.path)) // drat! tab is gone
                        return;
                    
                    // Show dialog
                    showDeleteDialog(tab);
                }
                else {
                    watcher.watch(tab.path); // Restore file watcher
                }
            });
        }
        
        function showDeleteDialog(tab) {
            var path = tab.path;

            deleteDialog = question.show(
                "File removed, keep tab open?",
                path + " has been deleted, or is no longer available.",
                "Do you wish to keep the file open in the editor?",
                function(all) { // Yes
                    var doc;
                    
                    if (all) {
                        for (var id in removedPaths) {
                            doc = removedPaths[id].tab.document;
                            doc.undoManager.bookmark(-2);
                            doc.meta.newfile = true;
                        }
                        removedPaths = {};
                    }
                    else {
                        doc = removedPaths[path].tab.document;
                        doc.undoManager.bookmark(-2);
                        doc.meta.newfile = true;
                        delete removedPaths[path];
                    }
                    
                    checkIfQueueIsEmpty();
                },
                function(all, cancel) { // No
                    if (all) {
                        for (var id in removedPaths) {
                            closeTab(removedPaths[id].tab, true);
                        }
                        removedPaths = {};
                    }
                    else {
                        closeTab(removedPaths[path].tab);
                        delete removedPaths[path];
                    }
                    
                    checkIfQueueIsEmpty();
                },
                {
                    all: Object.keys(removedPaths).length > 1,
                    yes: "Keep open",
                    yestoall: "Keep all open",
                    no: "Close tab",
                }
            );
            
            deleteDialog.on("show", function() {
                if (!tabManager.findTab(path))
                    return false;
            });
            
            if (!initialFocus)
                initialFocus = tabManager.focussedTab;
            
            // Focus the tab that is to be deleted
            tabManager.focusTab(tab);
        }
        
        function checkIfQueueIsEmpty() {
            for (var path in changedPaths) {
                return showChangeDialog(changedPaths[path].tab, changedPaths[path].data);
            } 
            for (var path in removedPaths) {
                return showDeleteDialog(removedPaths[path].tab);
            }
            
            if (initialFocus) {
                tabManager.focusTab(initialFocus);
                initialFocus = null;
            }
        }
        
        function closeTab(tab, noAnim) {
            // Close file without a check
            tab.document.meta.$ignoreSave = true;
            tab.close(noAnim);
            
            // Remove the flag for the case that the doc is restored
            delete tab.document.meta.$ignoreSave;
        }

        function askAutoMerge() {
            if (!settings.getBool("user/general/@confirmmerge"))
                return;

            question.show(
                "Always merge?",
                "Always merge on file changes?",
                "With 'auto merge' enabled, if a file changes "
                  + "on disk and you have unsaved changes in the IDE, "
                  + "it will automatically attempt to merge your changes with the new file. "
                  + "This setting can be controlled from the "
                  + "settings panel as well.",
                function() { // on yes
                    if (question.dontAsk)
                        settings.set("user/general/@confirmmerge", "false");
                    settings.set("user/general/@automerge", "true");
                },
                function() { // on no
                    if (question.dontAsk)
                        settings.set("user/general/@confirmmerge", "false");
                    settings.set("user/general/@automerge", "false");
                },
                { showDontAsk: true }
            );
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
         * 
         */
        plugin.freezePublicAPI({
            
        });
        
        register(null, {
            "watcher.gui": plugin
        });
    }
});