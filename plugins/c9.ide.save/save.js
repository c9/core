define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "c9", "fs", "layout", "commands", "menus", "settings", "ui", 
        "tabManager", "dialog.question", "dialog.file", 
        "dialog.fileoverwrite", "dialog.error", "error_handler", "vfs.log"
    ];
    main.provides = ["save"];
    return main;

    function main(options, imports, register) {
        var c9 = imports.c9;
        var Plugin = imports.Plugin;
        var settings = imports.settings;
        var ui = imports.ui;
        var commands = imports.commands;
        var menus = imports.menus;
        var fs = imports.fs;
        var layout = imports.layout;
        var tabManager = imports.tabManager;
        var question = imports["dialog.question"].show;
        var showSaveAs = imports["dialog.file"].show;
        var showError = imports["dialog.error"].show;
        var logger = imports["vfs.log"];
        
        var dirname = require("path").dirname;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var btnSave, saveStatus;
        
        var SAVING = 0;
        var SAVED = 1;
        var OFFLINE = 2;
        
        var YESTOALL = -2;
        var NOTOALL = -1;
        var YES = 2;
        var NO = 1;
        var CANCEL = 0;
        var CAPTION_SAVED = "All changes saved";
        
        var DELAY_ALREADY_SAVING = 120 * 1000;
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            function available(editor) {
                return !!editor && (c9.status & c9.STORAGE)
                    && (!tabManager.focussedTab
                    || typeof tabManager.focussedTab.path == "string");
            }
            
            commands.addCommand({
                name: "save",
                hint: "save the currently active file to disk",
                bindKey: { mac: "Command-S", win: "Ctrl-S" },
                isAvailable: available,
                exec: function () {
                    save(null, null, function() {});
                }
            }, plugin);
    
            commands.addCommand({
                name: "saveas",
                hint: "save the file to disk with a different filename",
                bindKey: { mac: "Command-Shift-S", win: "Ctrl-Shift-S" },
                isAvailable: available,
                exec: function () {
                    saveAs(null, function() {});
                }
            }, plugin);
    
            commands.addCommand({
                name: "saveall",
                hint: "save all unsaved files",
                isAvailable: available,
                exec: function () {
                    saveAll(function() {});
                }
            }, plugin);
    
            commands.addCommand({
                name: "reverttosaved",
                hint: "downgrade the currently active file to the last saved version",
                bindKey: { mac: "Ctrl-Shift-Q", win: "Ctrl-Shift-Q" },
                isAvailable: available,
                exec: function () {
                    revertToSaved(null, function() {});
                }
            }, plugin);
    
            commands.addCommand({
                name: "reverttosavedall",
                hint: "downgrade the all open tabs to the last saved version",
                bindKey: { mac: "Option-Shift-Q", win: "Alt-Shift-Q" },
                exec: function () {
                    revertToSavedAll();
                }
            }, plugin);
    
            tabManager.on("tabBeforeClose", function(e) {
                var tab = e.tab;
                var undoManager = tab.document.undoManager;
                
                // Won't save documents that don't support paths
                // Use path = "" to trigger Save As Dialog
                if (typeof tab.path !== "string") 
                    return; 
                
                // There's nothing to save
                if (undoManager.isAtBookmark())
                    return;
                
                // Still no changes
                if (!tab.document.changed)
                    return;
                    
                // Don't check cloned tabs
                if (tab.document.meta.cloned)
                    return;
                
                // Already checked, now just closing - volatile attribute
                if (tab.document.meta.$ignoreSave)
                    return;

                // Custom tab no-prompt-saving - persistent attribute
                if (tab.document.meta.ignoreSave)
                    return;

                // Won't save new file that is empty
                if (tab.document.meta.newfile && !tab.document.value)
                    return;
                
                // For autosave and other plugins
                if (emit("beforeWarn", { tab: tab }) === false)
                    return;
                
                // If currently saving, lets see if that succeeds
                if (tab.document.meta.$saveBuffer) {
                    plugin.on("afterSave", function monitor(e) {
                        if (e.document == tab.document) {
                            if (tab.loaded)
                                tab.close();
                            plugin.off("afterSave", monitor);
                        }
                    });
                    return false;
                }

                // Activate tab to be warned for
                tabManager.activateTab(tab);
                
                function close(err) {
                    if (!err || err.code != "EUSERCANCEL") {
                        // Close file without a check
                        tab.document.meta.$ignoreSave = true;
                        tab.close();
                        
                        // Remove the flag for the case that the doc is restored
                        delete tab.document.meta.$ignoreSave;
                    }
                    
                    emit("dialogClose", { tab: tab });
                }
                
                question(
                    "Would you like to save this file?",
                    "Save " + ui.escapeXML(tab.path) + "?",
                    "This file has unsaved changes. Your changes will be lost "
                        + "if you don't save them.",
                    function(all, tab) { // Yes
                        save(tab, { silentsave: true }, close);
                    },
                    function(all, cancel, tab) { // No
                        if (cancel) {
                            emit("dialogCancel", { tab: tab });
                        }
                        else {
                            close();
                        }
                    },
                    { cancel: true, metadata: tab, yes: "Save", no: "Don't save" }
                );

                return false;
            }, plugin);
            
            saveStatus = document.getElementById("saveStatus");
    
            var toolbar = layout.findParent({ name: "save" });
            btnSave = ui.insertByIndex(toolbar, new ui.button({
                id: "btnSave",
                "class": "btnSave",
                caption: "Save",
                tooltip: "Save",
                disabled: "true",
                visible: false,
                skin: "c9-toolbarbutton-glossy",
                command: "save"
            }), 1000, plugin);
    
            menus.addItemByPath("File/~", new ui.divider(), 600, plugin);
    
            menus.addItemByPath("File/Save", new ui.item({
                command: "save"
            }), 700, plugin);

            menus.addItemByPath("File/Save As...", new ui.item({
                command: "saveas"
            }), 800, plugin);

            menus.addItemByPath("File/Save All", new ui.item({
                command: "saveall"
            }), 900, plugin);
            
            menus.addItemByPath("File/Revert to Saved", new ui.item({
                command: "reverttosaved"
            }), 1000, plugin);
            menus.addItemByPath("File/Revert All to Saved", new ui.item({
                command: "reverttosavedall"
            }), 1100, plugin);
            
            tabManager.on("focus", function(e) {
                btnSave.setAttribute("disabled", !available(true));
            });
            tabManager.on("tabDestroy", function(e) {
                if (e.last)
                    btnSave.setAttribute("disabled", true);
            });
            
            c9.on("stateChange", function(e) {
                if (e.state & c9.STORAGE) 
                    plugin.enable();
                else 
                    plugin.disable();
            });
        }
        
        /***** Methods *****/
        
        function revertToSaved(tab, callback) {
            tabManager.reload(tab, callback);
        }
        
        function revertToSavedAll() {
            tabManager.getTabs().forEach(function(tab) {
                if (tab.path)
                    tabManager.reload(tab, function() {});
            });
        }
    
        function saveAll(options, callback) {
            if (!callback) {
                callback = options;
                options = {};
            }
            var count = 0;
            
            tabManager.getTabs().forEach(function (tab) {
                if (typeof tab.path != "string")
                    return;
                
                if (tab.document.undoManager.isAtBookmark() 
                  || tab.document.meta.newfile && (tab.path.charAt(0).match(/[^\/~]/) || options.skipNewFiles)
                  || tab.document.meta.preview || tab.document.meta.ignoreSave)
                    return;
                    
                count++;
                save(tab, null, function(err) {
                    if (--count === 0 || err) {
                        callback(err);
                        count = 0;
                    }
                });
            });
            
            if (!count) callback();
        }
    
        function saveAllInteractive(tabs, callback) {
            var state = NO;
            var counter = tabs.length;
            
            tabs = tabs.filter(function(tab) {
                return !tab.document.undoManager.isAtBookmark();
            });
            
            ui.asyncForEach(tabs, function(tab, next) {
                counter--;
                
                // Yes to all saves all files
                if (state == YESTOALL) {
                    save(tab, null, function() {});
                    return next();
                }
                if (state === NOTOALL) {
                    tab.document.meta.ignoreSave = true;
                    return next();
                }
                
                // Activate tab
                tabManager.activateTab(tab);
                
                question(
                    "Would you like to save this file?",
                    "Save " + ui.escapeXML(tab.path) + "?",
                    "This file has unsaved changes. Your changes will be lost "
                        + "if you don't save them.",
                    function(all, tab) { // Yes
                        state = all ? YESTOALL : YES;
                        save(tab, null, function() {});
                        next();
                    },
                    function(all, cancel, tab) { // No
                        if (cancel)
                            return callback(state);

                        state = all ? NOTOALL : NO;
                        tab.document.meta.ignoreSave = true;
                        next();
                    },
                    { all: counter >= 1, cancel: true, metadata: tab, yes: "Save", no: "Don't save", yestoall: "Save all", notoall: "Save none" }
                );
            },
            function() {
                callback(state);
            });
        }
    
        function ideIsOfflineMessage() {
            showError("Failed to save file. Please check your connection. "
                + "When your connection has been restored you can try to save the file again.");
        }
        
        // `silentsave` indicates whether the saving of the file is forced by the user or not.
        // callback is optional and is not called if saving is canceled
        function save(tab, options, callback) {
            if (!tab && !(tab = tabManager.focussedTab)) {
                return;
            }
    
            // Optional callback, against code, but allowing for now
            if (!options)
                options = {};
    
            var doc = tab.document;
            var path = options.path || tab.path;
            
            // If document is unloaded return
            if (!doc.loaded) {
                return;
            }
            
            var value = options.value || doc.value;
            if ((!value || !value.length) && !doc.ready) {
                console.log("[save] Document has zero length and is not ready, aborting save.");
                return;
            }
    
            var doSave = emit("beforeSave", {
                path: path,
                document: doc,
                tab: tab,
                value: value,
                options: options
            });
            if (doSave === false) {
                // Saving may be disabled when e.g. viewing history
                console.log("[save] Saving not allowed by beforeSave event.");
                return;
            }
            if (!doSave) {
                // No custom saver; use default save function
                // (note that Collab intercepts beforeWriteFile)
                doSave = fs.writeFile;
            }
    
            if (tab.classList.contains("conflict")) {
                console.log("[save] Tab is in conflict mode which needs to be resolved, aborting save.");
                return;
            }
            
            // Use the save as flow for files that don't have a path yet
            if (!options.path && (doc.meta.newfile || !tab.path)) {
                saveAs(tab, callback);
                return;
            }
    
            // IF we're offline show a message notifying the user
            if (!c9.has(c9.STORAGE)) {
                return ideIsOfflineMessage();
            }
    
            // Check if we're already saving!
            if (!options.force) {
                if (doc.meta.$saveBuffer) {
                    if (Date.now() - doc.meta.$saveBuffer[3] > DELAY_ALREADY_SAVING) {
                        doc.meta.$saveBuffer = true;
                    }
                    else {
                        console.log("[save] Save cancelled, already saving");
                        doc.meta.$saveBuffer = [tab, options, callback, 
                            doc.meta.$saveBuffer[3] || Date.now()];
                        return;
                    }
                }
                doc.meta.$saveBuffer = true;
            }
            
            setSavingState(tab, "saving", null, options.noUi);
    
            var bookmark = doc.undoManager.position;
            var loadStartT = Date.now();
            
            function fnProgress(loaded, total, complete) {
                doc.progress({ 
                    loaded: loaded, 
                    total: total, 
                    upload: true, 
                    complete: complete,
                    dt: Date.now() - loadStartT
                });
                if (!complete)
                    doc.meta.$saving = Date.now();
            }
            fnProgress(0, 1, 0);
        
            logger.log("User saving " + path);
            doSave(path, value, function(err) {
                if (err) {
                    if (!options.silentsave) {
                        showError("Failed to save document. "
                            + "Please see if your internet connection is available and try again. "
                            + err.message
                        );
                    }
                    setSavingState(tab, "offline");
                    logger.log("Failed to save " + path);
                }
                else {
                    delete doc.meta.newfile;
                    doc.meta.timestamp = Date.now() - settings.timeOffset;
                    doc.undoManager.bookmark(bookmark);
                    
                    if (options.path)
                        tab.path = options.path;
                    
                    setSavingState(tab, "saved", options.timeout, options.noUi);
                    settings.save();
                    logger.log("Successfully saved " + path);
                }
                
                emit("afterSave", { 
                    path: path,
                    value: value,
                    document: doc,
                    tab: tab,
                    err: err, 
                    options: options,
                });
                
                callback && callback(err);
                checkBuffer(doc);
            }, fnProgress);
    
            return false;
        }
        
        // TODO remove saveBuffer once there is a way to cancel fs.writeFile
        function checkBuffer(doc) {
            if (doc.meta.$saveBuffer) {
                var next = doc.meta.$saveBuffer;
                delete doc.meta.$saveBuffer;
                
                // isAtBookmark checks if anything has changed since the last save. If nothing has changed we don't need to save again. 
                if (next !== true && !doc.undoManager.isAtBookmark()) {
                    (next[1] || (next[1] = {})).force = true;
                    save.apply(window, next);
                }
            }
        }
    
        function saveAs(tab, callback) {
            if (!tab && !(tab = tabManager.focussedTab))
                return;
    
            if (typeof tab.path != "string")
                return;
    
            function onCancel() {
                var err = new Error("User Cancelled Save");
                err.code = "EUSERCANCEL";
                err.tab = tab;
                callback(err);
            }
    
            showSaveAs("Save As", tab.path, 
                function(path, exists, done) {
                    var oldPath = tab.path;
                    
                    function doSave() {
                        done();
                        save(tab, { path: path }, function() {
                            callback.apply(this, arguments);
                            
                            emit("saveAs", { 
                                oldPath: oldPath, 
                                path: path, 
                                document: tab.document
                            });
                        });
                    }
                    
                    if (path == oldPath || !exists)
                        return doSave();

                    question(
                        "Save As",
                        "",
                        "A file with the same name already exists in '"
                        + dirname(path) + "'.\n Do you want to overwrite it?",
                        doSave,
                        function() {
                            done();
                            onCancel();
                        },
                        { queue: false });
                }, 
                onCancel);
        }
        
        function getSavingState(tab) {
            return tab.classList.names.filter(function(c) {
                return ["saving", "saved", "changed", "offline", "error"].indexOf(c) > -1;
            })[0] || "saved";
        }
        
        var stateTimer = null, pageTimers = {};
        function setSavingState(tab, state, timeout, silent) {
            tab.classList.remove("saving", "saved", "error");
            
            var doc = tab.document;
            clearTimeout(doc.meta.$saveTimer);
            if (state == "saving")
                doc.meta.$saving = Date.now();
            else
                delete doc.meta.$saving;
            
            if (!silent)
                updateSavingUi(tab, state, timeout);
            emit("tabSavingState", { tab: tab });
        }
        
        function updateSavingUi(tab, state, timeout) {
            clearTimeout(stateTimer);
            clearTimeout(pageTimers[tab.name]);
            var doc = tab.document;
            if (state == "saving") {
                btnSave.show();
        
                ui.setStyleClass(btnSave.$ext, "saving", ["saved", "error"]);
                ui.setStyleClass(saveStatus, "saving", ["saved", "error"]);
                saveStatus.style.display = "block";
                btnSave.currentState = SAVING;
                btnSave.setCaption("Saving...");
                tab.classList.add("saving");
                
                // Error if file isn't saved after 40 seconds and no progress
                // event happened
                (function testSaveTimeout() {
                    doc.meta.$saveTimer = setTimeout(function() {
                        if (!doc.meta.$saving) return;
                        
                        // If we haven't seen any activity in the last 40secs
                        // lets call for a timeout
                        if (Date.now() - doc.meta.$saving > 40000) {
                            setSavingState(tab, "offline");
                            checkBuffer(tab.document);
                        }
                        // Else wait another 30 secs
                        else
                            testSaveTimeout();
                    }, 30000);
                })();
            }
            else if (state == "saved") {
                btnSave.show();
        
                // Remove possible error state on a succesful save
                delete tab.document.meta.error;
        
                ui.setStyleClass(btnSave.$ext, "saved", ["saving", "error"]);
                ui.setStyleClass(saveStatus, "saved", ["saving", "error"]);
                saveStatus.style.display = "block";
                btnSave.currentState = SAVED;
                btnSave.setCaption(CAPTION_SAVED);
                tab.classList.add("saved");
        
                stateTimer = setTimeout(function() {
                    if (btnSave.currentState === SAVED && btnSave.caption === CAPTION_SAVED)
                        btnSave.hide();
                }, 4000);
                
                pageTimers[tab.name] = setTimeout(function() {
                    if (btnSave.currentState === SAVED) {
                        saveStatus.style.display = "none";
                        tab.classList.remove("saved");
                    }
                    emit("tabSavingState", { tab: tab });
                }, timeout || 500);
            }
            else if (state == "offline") {
                btnSave.show();
        
                // don't blink!
                ui.setStyleClass(btnSave.$ext, "saved");
                ui.setStyleClass(btnSave.$ext, "error", ["saving"]);
                ui.setStyleClass(saveStatus, "error", ["saving"]);
                saveStatus.style.display = "block";
        
                btnSave.currentState = OFFLINE;
                btnSave.setCaption("Not saved");
                tab.classList.add("error");
            }
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("enable", function() {
            btnSave && btnSave.enable();
        });
        plugin.on("disable", function() {
            btnSave && btnSave.disable();
            
            tabManager.getTabs().forEach(function(tab) {
                if (tab.document.meta.$saveBuffer) {
                    // Set tab in error state
                    setSavingState(tab, "offline");
                    
                    // Call callback
                    var item = tab.document.meta.$saveBuffer;
                    if (item[2])
                        item[2](new Error("Disabled Save Plugin"));
                    
                    delete tab.document.meta.$saveBuffer;
                }
            });
        });
        plugin.on("unload", function() {
            loaded = false;
        });
        
        /***** Register and define API *****/
        
        /**
         * Saving of files to disk. This plugin provides a simple way to save
         * files to the workspace. It also provides a save as dialog as well as
         * menu items, commands and a button in the toolbar.
         * @singleton
         **/
        /**
         * @command save
         */
        /**
         * @command saveas
         */
        /**
         * @command saveall
         */
        /**
         * @command reverttosaved
         */
        plugin.freezePublicAPI({
            /**
             * @property {-2} YESTOALL  The state when the user clicked the "Yes To All" button.
             */
            YESTOALL: YESTOALL,
            /**
             * @property {-1} NOTOALL  The state when the user clicked the "No To All" button.
             */
            NOTOALL: NOTOALL,
            /**
             * @property {2} YES  The state when the user clicked the "Yes" button.
             */
            YES: YES,
            /**
             * @property {1} NO  The state when the user clicked the "No" button.
             */
            NO: NO,
            /**
             * @property {0} CANCEL  The state when the user clicked the "Cancel" button.
             */
            CANCEL: CANCEL,
            /**
             * 
             */
            get CAPTION_SAVED() { return CAPTION_SAVED; },
            set CAPTION_SAVED(value) { CAPTION_SAVED = value; },
            
            _events: [
                /**
                 * Fires before the file is being saved
                 * @event beforeSave
                 * @param {Object}   e
                 * @param {String}   e.path      The path of the file to be saved.
                 * @param {Document} e.document  The document object that contains the file contents.
                 * @param {String}   e.value     The value of the document that is to be saved.
                 * @param {Object}   e.options   The options passed to the {@link #save} method.
                 * @cancellable
                 */
                "beforeSave",
                /**
                 * Fires after a file is saved or had an error
                 * @event afterSave 
                 * @param {Object}   e
                 * @param {String}   e.path      The path of the file to be saved.
                 * @param {Error}    e.err       An error object if an error occured during saving.
                 * @param {Document} e.document  The document object that contains the file contents.
                 * @param {Object}   e.options   The options passed to the {@link #save} method.
                 */
                "afterSave",
                /**
                 * Fires after a file is saved at a new path
                 * @event saveAs 
                 * @param {Object}   e
                 * @param {String}   e.path      The path of the file to be saved.
                 * @param {String}   e.oldPath   The path of the file before it was saved.
                 * @param {Document} e.document  The document object that contains the file contents.
                 */
                "saveAs",
                /**
                 * Fires before the save warning is shown. The save 
                 * warning occurs when the document of a tab is in the changed 
                 * state and the tab is being closed. You can test for the 
                 * changed state using `tab.document.changed`.
                 * 
                 * @event beforeWarn
                 * @param {Object} e
                 * @param {Tab}    e.tab
                 * @cancellable
                 */
                "beforeWarn",
                /**
                 * Fires when the save confirmation dialog (when closing an 
                 * unsaved tab) is closed and not cancelled.
                 * @event dialogClose
                 * @param {Object} e
                 * @param {Tab}    e.tab
                 */
                "dialogClose",
                /**
                 * Fires when the save confirmation dialog (when closing an 
                 * unsaved tab) is closed by clicking the cancel or X button.
                 * @event dialogCancel
                 * @param {Object} e
                 * @param {Tab}    e.tab
                 */
                "dialogCancel",
                /**
                 * Fires when the save as dialog is drawn.
                 * @event drawSaveas
                 */
                "drawSaveas",
                /**
                 * Fires when the save state of a tab changes.
                 * @event tabSavingState
                 * @param {Object} e
                 * @param {Tab}    e.tab
                 */
                "tabSavingState"
            ],
            
            /**
             * Saves the contents of a tab to disk using `fs.writeFile`
             * @param {Tab}      tab                   The tab to save
             * @param {Object}   options
             * @param {String}   [options.path]        The new path of the file (otherwise tab.path is used)
             * @param {Boolean}  [options.force]       Species whether to save no matter what conditions
             * @param {Boolean}  [options.silentsave]  Species whether to show an error message in the UI when a save fails
             * @param {Number}   [options.timeout]     the time any success state is shown in the UI
             * @param {Function} callback              Called after the file is saved or had an error
             * @param {Error}    callback.err          The error object, if an error occured during saving.
             * @fires beforeSave
             * @fires afterSave
             */
            save: save,
            
            /**
             * Saves a file and allows the user to choose the path
             * @param {Tab}      tab           The tab to save
             * @param {Function} callback      Called after the file is saved or had an error
             * @param {Error}    callback.err  The error object, if an error occured during saving.
             */
            saveAs: saveAs,
            
            /**
             * Reverts the value of a tab / document back to the value that is on disk
             * @param {Tab} tab the tab to save
             */
            revertToSaved: revertToSaved,
            
            /**
             * Saves all changed pages
             * @param {Function} callback      called after the files are saved or had an error
             * @param {Error}    callback.err  The error object, if an error occured during saving.
             */
            saveAll: saveAll,
            
            /**
             * Saves a set of pages by asking the user for confirmation
             * @param {Tab[]}    tabs             The tabs to save
             * @param {Function} callback         Called each time the user 
             *   clicks a button in the confirm dialog. 
             * @param {Error}    callback.err     The error object, if an error occured during saving.
             * @param {Number}   callback.result  Specifies which button the 
             *   user has clicked. This corresponds to one of the following
             *   constants:
             * 
             * <table>
             * <tr><td>Constant</td><td>                              Description</td></tr>
             * <tr><td>{@link save#YESTOALL save.YESTOALL}</td><td>   The user saved all remaining tabs.</td></tr>
             * <tr><td>{@link save#NOTOALL save.NOTOALL}</td><td>     The user saved none of the remaining tabs.</td></tr>
             * <tr><td>{@link save#YES save.YES}</td><td>             The user saved the last tab in the list.</td></tr>
             * <tr><td>{@link save#NO save.NO}</td><td>               The user did not save the last tab in the list.</td></tr>
             * <tr><td>{@link save#CANCEL save.CANCEL}</td><td>       The user cancelled the saving of the tabs.</td></tr>
             * </table>
             */
            saveAllInteractive: saveAllInteractive,
            
            /**
             * Sets the saving state of a tab
             * @param {Tab}    tab    The tab to set the state of.
             * @param {String} state  The saving state. This argument has four
             * possible values: "saving", "saved", "changed", "offline"
             */
            setSavingState: setSavingState,
            
            /**
             * Gets the saving state of a tab
             * @param {Tab}    tab     The tab to set the state of.
             * @return {String} state  The saving state. This argument has four
             * possible values: "saving", "saved", "changed", "offline"
             */
            getSavingState: getSavingState,
            
            /**
             * Hide the global saving caption UI.
             */
            hideCaption: function() {
                btnSave.hide();
            },
            
            /**
             * Get the value of the global saving caption UI.
             * @return {String} the current caption or undefined if no caption
             * or when showing "All changes saved".
             */
            getCaption: function() {
                if (btnSave.caption == CAPTION_SAVED)
                    return; // irrelevant; this will automatically disappear
                return btnSave.visible && btnSave.caption;
            },
            
            /**
             * Set the value of the global saving caption UI.
             * 
             * @param {String} value
             */
            setCaption: function(value) {
                ui.setStyleClass(btnSave.$ext, "saving", ["saved", "error"]);
                btnSave.show();
                btnSave.setCaption(value);
            }
        });
        
        register(null, {
            save: plugin
        });
    }
});