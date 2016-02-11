define(function(require, exports, module) {
    main.consumes = [
        "c9", "Plugin", "fs", "settings", "tabManager", "dialog.error", 
        "dialog.question", "preferences", "save"
    ];
    main.provides = ["metadata"];
    return main;

    function main(options, imports, register) {
        var c9 = imports.c9;
        var Plugin = imports.Plugin;
        var fs = imports.fs;
        var settings = imports.settings;
        var save = imports.save;
        var tabs = imports.tabManager;
        var confirm = imports["dialog.question"].show;
        var showError = imports["dialog.error"].show;
        var prefs = imports.preferences;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();

        var PATH = options.path || "/.c9/metadata";
        var WORKSPACE = "/workspace";
        
        var jobs = {};
        var changed = {};
        var cached = {};
        var worker, timer;
        
        var CHANGE_CHECK_INTERVAL = options.changeCheckInterval || 30000;
        
        var loaded = false;
        function load(){
            if (loaded) return false;
            loaded = true;
            
            // Schedule for inspection when tab becomes active
            tabs.on("tabAfterActivate", function(e) {
                // // If disabled don't do anything
                // if (!e.tab.loaded || !settings.getBool("user/metadata/@enabled"))
                //     return;
                
                if (e.lastTab)
                    changed[e.lastTab.name] = e.lastTab;
                    
                changed[e.tab.name] = e.tab;
            }, plugin);
            
            // Closing a tab
            tabs.on("tabAfterClose", function (e) {
                // // If disabled don't do anything
                // if (!settings.getBool("user/metadata/@enabled"))
                //     return;
                
                var doc = e.tab.document;
                if (!e.tab.path) {
                    fs.unlink(PATH + "/" + e.tab.name, function(){ return false });
                }
                else if (doc.meta.newfile || doc.meta.$ignoreSave) {
                    fs.unlink(PATH + WORKSPACE + e.tab.path, function(){ return false });
                }
                else if (check(e.tab) !== false) {
                    delete changed[e.tab.name];
                    delete cached[e.tab.name];
                }
            }, plugin);
            
            // Opening a file
            tabs.on("beforeOpen", function(e) {
                // // If disabled don't do anything
                // if (!settings.getBool("user/metadata/@enabled"))
                //     return;
                
                // Don't load metadata if document state is defined or value is set
                if (e.tab.path && e.options.document.filter === false
                  || !e.tab.path && !e.options.document.filter
                  || e.options.value)
                    return;
                
                // todo should tabmanager check this?
                e.options.loadFromDisk = e.loadFromDisk 
                    && !e.tab.document.meta.newfile
                    && !e.tab.document.meta.nofs;
                
                // Fetch the metadata and real data
                var callback = function(err) {
                    if (e.loadFromDisk)
                        e.callback(err);
                };
                loadMetadata(e.tab, e.options, callback, e.options.init);
                
                return e.loadFromDisk ? false : true;
            }, plugin);
            
            // Check every half a minute for changed tabs
            timer = setInterval(function(){
                checkChangedTabs();
            }, CHANGE_CHECK_INTERVAL);
            
            // Delete metadata when file is renamed
            save.on("saveAs", function(e){
                if (e.path != e.oldPath)
                    fs.unlink(PATH + WORKSPACE + e.oldPath, function(){ return false });
            });
            
            // Settings
            
            settings.on("read", function(e) {
                settings.setDefaults("user/metadata", [
                    // ["enabled", "true"],
                    ["undolimit", "100"],
                ]);
            }, plugin);
            
            settings.on("write", function(e) {
                if (e.unload) return;
                
                checkChangedTabs();
            }, plugin);
            
            
            function checkChangedTabs(unload) {
                // // If disabled don't do anything
                // if (!settings.getBool("user/metadata/@enabled"))
                //     return;
                
                tabs.getPanes().forEach(function(pane) {
                    var tab = pane.getTab();
                    if (tab) {
                        changed[tab.name] = tab;
                    }
                });
                
                for (var name in changed) {
                    if (check(changed[name], unload) === false)
                        return;
                }
                
                changed = {};
            }
            
            // Preferences
            
            prefs.add({
                "File" : {
                    position: 150,
                    "Meta Data" : {
                        position: 200,
                        "Maximum of Undo Stack Items in Meta Data" : {
                            type: "spinner",
                            path: "user/metadata/@undolimit",
                            position: 200,
                            min: 10,
                            max: 10000
                        }
                    }
                }
            }, plugin);
            
            // Exiting Cloud9
            c9.on("beforequit", function(){
                checkChangedTabs(true);
            }, plugin);
            
            // Initial Load
            tabs.getTabs().forEach(function(tab) {
                var options = tab.getState();
                options.loadFromDisk = tab.path 
                  && !tab.document.meta.newfile
                  && !tab.document.meta.nofs
                  // autoload to false prevents loading data, used by image editor
                  && (!tab.editor || tab.editor.autoload !== false);
                
                loadMetadata(tab, options, function(err) {
                    if (err) {
                        tab.unload();
                        showError("File not found '" + tab.path + "'");
                        return;
                    }
                    tab.classList.remove("loading");
                }, true);
            });
        }
        
        /***** Methods *****/
        
        function check(tab, forceSync) {
            var docChanged = tab.document.changed || tab.document.meta.nofs;
            
            // Don't save state if we're offline
            if (!c9.has(c9.STORAGE))
                return false;
            
            if (tab.meta.$loadingMetadata)
                return;
            
            // Ignore metadata files and preview pages and debug files and 
            // tabs that are not loaded
            if (!tab.loaded 
              || tab.path && tab.path.indexOf(PATH) === 0
              || tab.document.meta.preview)
                return;
            
            var state = tab.document.getState();
            
            // Make sure timestamp is preserved
            if (state.meta)
                state.timestamp = state.meta.timestamp;
            
            // meta is recorded by the tab state
            delete state.meta;
            
            // If we discarded the file before closing, clear that data
            if (tab.document.meta.$ignoreSave) {
                delete state.value;
                delete state.changed;
                delete state.undoManager;
                docChanged = true;
            }
            
            if (docChanged || typeof state.value == "undefined" || forceSync) {
                if (forceSync && !docChanged && state.undoManager.stack.length)
                    delete state.value;
                
                write(forceSync);
            }
            else {
                hash(state.value, function(err, hash) {
                    if (err) return;
                    
                    delete state.value;
                    delete state.changed;
                    state.hash = hash;
                    write(forceSync);
                });
            }
            
            function write(forceSync) {
                if (c9.readonly) return;
                
                var limit = settings.getNumber("user/metadata/@undolimit");
                var undo = state.undoManager;
                if (undo) {
                    var start = Math.max(0, undo.position - limit);
                    undo.stack.splice(0, start);
                    undo.position -= start;
                    undo.mark     -= start;
                }
                
                try {
                    // This throws when a structure is circular
                    var sstate = JSON.stringify(state);
                } catch (e) {
                    // debugger;
                    return;
                }
                
                // Lets not save large metadata
                if (sstate.length > 1024 * 1024) {
                    sstate = "";
                    state = {};
                }
                
                if (cached[tab.name] != sstate) {
                    cached[tab.name] = sstate;
                    
                    if (tab.path) {
                        var path = (tab.path.charAt(0) == "~" ? "/" : "") + tab.path;
                        fs.metadata(path, state, forceSync, function(err) {
                            if (err)
                                return;
                        });
                    }
                    else {
                        fs.metadata("/_/_/" + tab.name, state, forceSync, function(err) {
                            if (err)
                                return;
                        });
                    }
                }
            }
            
            return true;
        }
        
        function merge(from, to) {
            for (var prop in from) {
                if (to[prop] && typeof from[prop] == "object")
                    merge(from[prop], to[prop]);
                else
                    to[prop] = from[prop];
            }
        }
        
        function loadMetadata(tab, options, callback, init) {
            // // When something goes wrong somewhere in cloud9, this can happen
            // if (tab.path && "/~".indexOf(tab.path.charAt(0)) == -1)
            //     debugger;
                
            var path = tab.path
                ? PATH + WORKSPACE + (tab.path.charAt(0) == "~" ? "/" : "") + tab.path
                : PATH + "/" + tab.name;
            
            var storedValue, storedMetadata;
            var xhr;
            
            // Prevent Saving of Metadata
            tab.meta.$loadingMetadata = true;
            
            // Progress Handling
            tab.classList.add("loading");
            
            var loadStartT = Date.now();
            
            // Handler to show loading indicator
            function progress(loaded, total, complete) {
                var data = { 
                    total: total, 
                    loaded: loaded,
                    complete: complete,
                    dt: Date.now() - loadStartT
                };
                
                tab.document.progress(data);
            }
            
            if (tab.path) {
                if (options.loadFromDisk === false) {
                    // This is for new files and other files that will store 
                    // their value in the metadata
                    receive(tab.document.value);
                    
                    // Don't load metadata of newly created newfile tabs (runtime)
                    if (!init) {
                        receive(null, -1);
                        return;
                    }
                }
                else {
                    tab.classList.add("loading");
                    // progress(0, 1, 0);
                    
                    var cb = function(err, data, metadata, res) {
                        if (err) return callback(err);
                        receive(data, metadata || -1);
                    };

                    xhr = emit("beforeReadFile", {
                        tab: tab,
                        path: tab.path,
                        callback: cb,
                        progress: progress
                    });

                    if (!xhr)
                        xhr = fs.readFileWithMetadata(tab.path, "utf8", cb, progress);
                }
            }
            
            if (!xhr) {
                xhr = fs.readFile(path, "utf8", function(err, data) {
                    receive(null, err ? -1 : data);
                }, progress);
            }
            
            // Cancel file opening when tab is closed
            var abort = function(){ xhr && xhr.abort(); };
            tab.on("close", abort);
            tabs.on("open", function wait(e) { 
                if (e.tab == tab) {
                    tab.off("close", abort); 
                    tab.off("open", wait);
                }
            }, tab);
            
            function receive(value, metadata) {
                var state;
                
                if (value !== null)
                    storedValue = value;
                if (metadata) {
                    storedMetadata = metadata;
                    if (metadata != -1) {
                        cached[tab.name] 
                            = metadata.replace(/"timestamp":\d+\,?$/, "");
                    }
                }
                
                // Final state processing and then we're done
                var compareModified = false;
                function done(state, cleansed) {
                    // Import state from options
                    var doc = options.document;
                    if (doc instanceof Plugin)
                        doc = doc.getState();
                    
                    delete doc.fullState;
                    delete doc.value;
                    delete doc.undoManager;
                    
                    if (!doc.changed)
                        delete doc.changed;
                    
                    if (cleansed) {
                        delete state.undoManager;
                        
                        if (tab.editor && state[tab.editor.type])
                            state[tab.editor.type].cleansed = true;
                    }
                     
                    // Preserve timestamp from metadata
                    if (!doc.meta) doc.meta = {};
                    doc.meta.timestamp = state.timestamp;
                    delete state.timestamp;
                    
                    // Merge the two sources
                    merge(doc, state);
                    
                    if (tab.document.hasValue())
                        delete state.value;
                    
                    // Keep original value from disk
                    state.meta.$savedValue = storedValue;
                    
                    var sameValue = state.value === storedValue;
                    if (options.loadFromDisk && (sameValue || compareModified)) {
                        fs.stat(tab.path, function(err, stat) {
                            if (err) return;
                            
                            if (compareModified) {
                                // @todo this won't work well on windows, because
                                // there is a 20s period in which the mtime is
                                // the same. The solution would be to have a 
                                // way to compare the saved document to the 
                                // loaded document that created the state
                                if (!state.meta || state.meta.timestamp < stat.mtime) {
                                    var doc = tab.document;
                                    
                                    function checkChange(){
                                        confirm("File Changed",
                                          tab.path + " has been changed on disk.",
                                          "Would you like to reload this file?",
                                          function(){ // Yes
                                              // Set new value and clear undo state
                                              doc.setBookmarkedValue(storedValue, true);
                                              doc.meta.timestamp = stat.mtime;
                                          }, 
                                          function(){ // No
                                              // Set to changed
                                              doc.undoManager.bookmark(-2);
                                              doc.meta.timestamp = stat.mtime;
                                          }, 
                                          { merge: false, all: false }
                                        );
                                    }
                                    
                                    if (state.meta.preview) {
                                        doc.editor.on("focus", function wait(e) {
                                            if (doc.editor.activeDocument == doc) {
                                                doc.editor.off("focus", wait);
                                                checkChange();
                                            }
                                        }, doc);
                                        return;
                                    }
                                    else 
                                        checkChange();
                                }
                            }
                            else {
                                tab.document.meta.timestamp = stat.mtime;
                            }
                        });
                    }
                    
                    // Set new state
                    tab.document.setState(state);
                    
                    // Declare done
                    delete tab.meta.$loadingMetadata;
                    
                    callback();
                }
                
                if ((!tab.path || storedValue !== undefined) && storedMetadata) {
                    try{ 
                        state = storedMetadata == -1 
                            ? {} : JSON.parse(storedMetadata); 
                    }
                    catch (e){ state = {} }
                    
                    // There's a hash. Lets compare it to the hash of the 
                    // current value. If they are the same we can keep the
                    // undo stack, otherwise we'll clear the undo stack
                    if (state.hash && typeof storedValue == "string") {
                        state.value = storedValue;
                        
                        hash(storedValue, function(err, hash) {
                            done(state, state.hash != hash);
                        });
                        return; // Wait until hash is retrieved
                    }
                    else if (state.value && tab.path) {
                        // If the stored value is not the same as the value
                        // on disk we need to find out which is newer
                        if (state.value != storedValue)
                            compareModified = true;
                    }
                    else {
                        state.value = storedValue;
                    }
                    
                    done(state);
                }
            }
        }
        
        hash.counter = 0;
        function hash(data, callback) {
            if (!worker) {
                worker = new Worker('/static/lib/rusha/rusha.min.js');
                worker.addEventListener("message", function(e) {
                    // @todo security?
                    
                    if (jobs[e.data.id]) {
                        jobs[e.data.id](null, e.data.hash);
                        delete jobs[e.data.id];
                    }
                });
            }
            worker.postMessage({ id: ++hash.counter, data: data });
            jobs[hash.counter] = callback;
            
            if (hash.counter === 30000)
                hash.counter = 0;
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
            clearInterval(timer);
        });
        
        /***** Register and define API *****/
        
        /**
         * Manages metadata for tabs in Cloud9. Each tab in Cloud9 has
         * additional information that needs to be stored. 
         * 
         * When you open a file in Cloud9, it generally is opened in a tab and 
         * displayed using the {@link ace.Ace Ace} editor. The ace editor maintains a
         * lot of state while displaying the file, such as the scroll position,
         * the selection, the folds, the syntax highligher, etc. The document
         * also serializes the value and the complete undo stack. Editors
         * that don't open files can still hold metadata. The {@link terminal.Terminal Terminal}
         * for instance has selection, scroll state and scroll history. All this
         * information can be saved to disk by the metadata plugin.
         * 
         * The metadata is saved in ~/.c9/metadata. The metadata plugin plugs
         * into the tabManager and takes over the loading of the file content
         * so that the loading of the content and the metadata is synchronized.
         * This plugin is also responsible for saving the metadata back to the
         * workspace.
         * 
         * @singleton
         **/
        plugin.freezePublicAPI({

        });
        
        register(null, {
            metadata: plugin
        });
    }
});
