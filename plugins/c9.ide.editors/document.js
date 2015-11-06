define(function(require, module, exports) {
    main.consumes = ["Plugin", "UndoManager", "util", "error_handler"];
    main.provides = ["Document"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var util = imports.util;
        var UndoManager = imports.UndoManager;
        var reportError = imports.error_handler.reportError;
        
        function Document(options) {
            var plugin = new Plugin("Ajax.org", main.consumes);
            var undoManager;
            var emit = plugin.getEmitter();
            
            if (options && options.undoManager instanceof Plugin) {
                undoManager = options.undoManager;
                delete options.undoManager;
            }
            else
                undoManager = new UndoManager();
            
            var sessions = {};
            var value = options && options.value || "";
            var changed = false;
            var meta = {};
            var hasValue = options && (typeof options.value === "string");
            
            var tab, lastState, title, tooltip, editor, recentValue, ready;
            
            plugin.on("newListener", function(type, listener) {
                if (type == "state.set" && lastState) {
                    listener({
                        doc: plugin, 
                        state: lastState
                    });
                }
            });
            
            // Listen to changes and detect when the value of the editor
            // is different from what is on disk
            function initUndo(){
                undoManager.on("change", function(e) {
                    var c = !undoManager.isAtBookmark();
                    if (changed !== c) {
                        changed = c;
                        emit("changed", { changed: c });
                    }
                });
            }
            initUndo();
            
            /***** Methods *****/
            
            function setBookmarkedValue(value, cleansed) {
                if (plugin.value == value) {
                    recentValue = value;
                    undoManager.bookmark();
                    return;
                }
                var state = getState();
                
                // Record value (which should add an undo stack item)
                plugin.value = value;
                
                // Bookmark the undo manager
                undoManager.bookmark();
                
                // Update state
                delete state.changed;
                delete state.value;
                delete state.meta;
                state.undoManager = undoManager.getState();
                
                if (cleansed && editor && state[editor.type])
                    state[editor.type].cleansed = true;
                
                // Set new state (preserving original state)
                if (emit("mergeState") !== false)
                    setState(state);
            }
            
            function getState(filter) {
                // Editor is not inited yet, so we keep the state set until 
                // editor is loaded
                var state = !editor && lastState
                    ? state = util.extend({}, lastState)
                    : {};
                
                state.changed = changed;
                state.meta = {};
                state.filter = filter || false;
                
                for (var prop in meta) {
                    if (prop.charAt(0) != "$")
                        state.meta[prop] = meta[prop];
                }
                
                if (title)
                    state.title = title;
                if (tooltip)
                    state.tooltip = tooltip;
                
                if (!filter) {
                    state.value = plugin.value;
                    state.undoManager = undoManager.getState();
                }
                else {
                    delete state.value;
                    delete state.undoManager;
                }
                
                if (editor)
                    state[editor.type] = editor.getState(plugin, filter);
                
                var event = { doc: plugin, state: state };
                emit("getState", event);
                
                lastState = event.state;
                
                return event.state;
            }
            
            function setState(state) {
                if (state.meta) {
                    for (var prop in meta) {
                        if (prop.charAt(0) == "$")
                            state.meta[prop] = meta[prop];
                    }
                    meta = state.meta;
                }
                if (state.title)   plugin.title = state.title;
                if (state.tooltip) plugin.tooltip = state.tooltip;
                
                if (typeof state.value == "string")   
                    plugin.value = state.value;
                
                if (state.undoManager && !(state.undoManager instanceof Plugin))
                    undoManager.setState(state.undoManager);
                
                if (state.changed && state.changed !== changed) {
                    changed = state.changed;
                    emit("changed", { changed: changed });
                }
                    
                if (editor && state[editor.type])
                    editor.setState(plugin, state[editor.type]);
                
                var event = { doc: plugin, state: state };
                emit("setState", event);
                
                lastState = event.state;
            }
            
            function getSession(type) {
                var ed = editor || tab && tab.editor;
                if (ed && !type) type = ed.type;
                if (!type) return;
                
                if (sessions[type])
                    return sessions[type];
                
                var session = sessions[type] = new Plugin();
                session.load(null, "session");
                return session;
            }
            
            function progress(options) {
                emit("progress", options);
            }
            
            function clone() {
                var state = this.getState();
                state.undoManager = undoManager;
                var newdoc = new Document(state);
                emit("clone", { doc: newdoc });
                newdoc.meta.cloned = true;
                return newdoc;
            }
            
            function canUnload() {
                return emit("canUnload");
            }
            
            /***** Lifecycle *****/
            
            plugin.on("unload", function(){
                changed = false;
                
                // Unload the undo manager
                undoManager.unload();
                
                // Unload the sessions
                for (var type in sessions)
                    sessions[type].unload();
            });
            
            /**
             * Session Class for Cloud9 Editors. Each document that is loaded into an
             * editor has one session object per editor. A session object is retrieved by
             * calling {@link Document#getSession} and is specifically tied to an editor
             * type. The session is used to store state and functions on by the editor.
             * 
             * The session relates to other objects as such:
             * 
             * * {@link Pane} - Represent a single pane, housing multiple tabs
             *   * {@link Tab} - A single tab (button) in a pane
             *     * {@link Editor} - The editor responsible for displaying the file in the tab
             *     * {@link Document} - The representation of a file in the tab
             *       * **Session - The session information of the editor**
             *       * {@link UndoManager} - The object that manages the undo stack for this document
             * 
             * Panes can live in certain areas of Cloud9. By default these areas are:
             * 
             * * {@link panes}      - The main area where editor panes are displayed
             * * {@link console}    - The console in the bottom of the screen
             * 
             * Tabs are managed by the {@link tabManager}. The default way to
             * open a new file in an editor uses the tabManager:
             * 
             *     tabManager.openFile("/file.js", true, function(err, tab) {
             *         var session = tab.document.getSession();
             *         var aceSession = session.session;
             *     });
             * 
             * Generally the state and functions stored on the session object are private
             * to the editor and do not concern other plugins. However one can imagine that
             * plugins that work on editors make use of these properties. For instance the
             * {@link ace.status.Statusbar} plugin uses the information on the state object from the
             * ace editor to display state information like the line number and language 
             * mode.
             * 
             * When a tab is moved from one pane to another, the document is unloaded from
             * one editor and then loaded into another one. It is up to the editor to 
             * decide how to handle the stored state on the session object. Often the 
             * editor will remove only some of that state and reuse other state in the 
             * new editor. For instance, the {@link ace.Ace Ace} editor stores the ace session 
             * object on the Cloud9 session object. 
             * It will only do this once and will use the same ace session object in 
             * different ace editors, throughout the lifetime of the session object.
             * 
             * This example shows how an editor could deal with a session. For more
             * information see the source code of the {@link texteditor.TextEditor TextEditor} plugin.
             * 
             *     plugin.on("documentLoad", function(e) {
             *         var doc = e.doc;
             *         var session = doc.getSession();
             *         
             *         if (!session.id) {
             *             session.id = Math.random();
             *             session.iframe = document.createElement("iframe");
             *         }
             *         
             *         // Container would be a div created in the {@link Editor#draw} event.
             *         container.appendChild(session.iframe);
             *     });
             * 
             * @class Session
             * @extends Plugin
             */
            /**
             * Document Class for Cloud9 Editors. Each file that is opened
             * in an editor has a document object that contains it's value and 
             * state. 
             * 
             * The document relates to other objects as such:
             * 
             * * {@link Pane} - Represent a single pane, housing multiple tabs
             *   * {@link Tab} - A single tab (button) in a pane
             *     * {@link Editor} - The editor responsible for displaying the file in the tab
             *     * **Document - The representation of a file in the tab**
             *       * {@link Session} - The session information of the editor
             *       * {@link UndoManager} - The object that manages the undo stack for this document
             * 
             * Panes can live in certain areas of Cloud9. By default these areas are:
             * 
             * * {@link panes}      - The main area where editor panes are displayed
             * * {@link console}    - The console in the bottom of the screen
             * 
             * Tabs are managed by the {@link tabManager}. The default way to
             * open a new file in an editor uses the tabManager:
             * 
             *     tabManager.openFile("/file.js", true, function(err, tab) {
             *         var doc = tab.document;
             *         console.log("The value is: ", doc.value);
             *     });
             * 
             * For editors that do not allow a user to edit files
             * (e.g. terminal), a document object will still be created.
             */
            plugin.freezePublicAPI({
                /**
                 * the tab this document is attached to
                 * @property {Tab} tab
                 */
                get tab(){ return tab; },
                set tab(v){ tab = v; },
                
                /**
                 * the meta information for this document. Use this object to
                 * store any additional information you'd like to store. If you
                 * are storing state information that should not be kept between
                 * reloads of the IDE, prefix the items with a "$" character.
                 * 
                 * Example:
                 * 
                 *     // This document has a black bird
                 *     var doc = tabs.focussedTab.document;
                 *     doc.meta.blackBird = true;
                 * 
                 * Example (state is not preserved):
                 * 
                 *     // This document is being processed
                 *     var doc = tabs.focussedTab.document;
                 *     doc.meta.$processing = true;
                 * 
                 * @property meta
                 */
                get meta(){ return meta; },
                
                /**
                 * The last state that was set into the document.
                 * @property lastState
                 * @private
                 */
                get lastState(){ return lastState; },
                
                /**
                 * the editor this document is attached to
                 * @property {Editor} editor
                 */
                get editor(){ return editor; },
                set editor(v) { 
                    editor = v;
                    emit("setEditor", { editor: v });
                },
                /**
                 * Whether the document is fully loaded
                 * @property {Boolean} ready
                 */
                get ready(){ return ready; },
                set ready(v) {
                    // try to find out why is this called twice
                    var e =  new Error("Setting ready on ready document");
                    if (ready)
                        reportError(e, {ready: ready});
                    ready = e.stack || true;
                    emit.sticky("ready", { doc: plugin });
                },
                /**
                 * The tooltip displayed when hovering over the tab button
                 * @property {String} tooltip
                 */
                get tooltip(){ return tooltip; },
                set tooltip(v) { 
                    tooltip = v; 
                    emit("setTooltip", { tooltip: v });
                },
                /**
                 * The title of the document (displayed as caption of the tab button)
                 * @property {String} title
                 */
                get title(){ return title; },
                set title(v) { 
                    title = v; 
                    emit("setTitle", { title: v });
                },
                /**
                 * Sets or retrieves the serialized value of this document.
                 * Setting this property will not change the undo stack. Set
                 * this property only to initialize the document or to reset
                 * the value of this document. Requesting the value of this
                 * document will cause it to serialize it's full state.
                 * @property {String} value
                 */
                get value(){
                    var calculated = emit("getValue", { value: recentValue || value });
                    if (typeof calculated != "string")
                        calculated = value;
                    
                    if (undoManager.isAtBookmark())
                        recentValue = calculated;
                        
                    return calculated;
                },
                set value(v) { 
                    value = recentValue = v;
                    emit("setValue", { value: v });
                    hasValue = true;
                },
                /**
                 * The last serialized value that was either set or retrieved.
                 * The `recentValue` is only updated during a get when the 
                 * document is saved (undoManager.isAtBookmark() == true).
                 * @property {String} recentValue
                 * @readonly
                 */
                get recentValue(){ return recentValue; },
                /**
                 * Specifies whether the document on this tab is changed
                 * @property {Boolean} changed
                 */
                get changed(){ return changed; },
                /**
                 * The object managing all the changes to the document
                 * @property {UndoManager} undoManager
                 */
                get undoManager(){ return undoManager; },
                set undoManager(newUndo){ 
                    undoManager.unload();
                    undoManager = newUndo; 
                    initUndo();
                },
                
                _events: [
                    /**
                     * Fires when the state is retrieved
                     * @event getState
                     * @param {Object}   e
                     * @param {Document} e.doc    the document for which the state is retrieved
                     * @param {Object}   e.state  the state object to extend with information
                     */
                    "getState",
                    /**
                     * Fires when the state is set
                     * @event setState
                     * @param {Object}   e
                     * @param {Document} e.doc    the document for which the state is set
                     * @param {Object}   e.state  the state object
                     */
                    "setState",
                    /**
                     * Fires when the value of this document is retrieved.
                     * When implementing an editor, use this event to return
                     * the current value of this document in the event handler.
                     * 
                     * Example:
                     * 
                     *     doc.on("getValue", function(e) { 
                     *         return "The current value of this editor"
                     *     }, doc.getSession());
                     * 
                     * @event getValue
                     * @param {Object} e
                     * @param {String} e.value  the last cached value
                     */
                    "getValue",
                    /**
                     * Fires when the value of this document is set
                     * When implementing an editor, use this event to set
                     * the new value of this document in the event handler.
                     * 
                     * Example:
                     * 
                     *     doc.on("setValue", function(e) { 
                     *         myDiv.innerHTML = e.value
                     *     }, doc.getSession());
                     * 
                     * @event setValue
                     * @param {Object} e
                     * @param {String} e.value  the value that is being set
                     */
                    "setValue",
                    /**
                     * @ignore
                     */
                    "mergeState",
                    /**
                     * Fires when the title of this document is set
                     * @event setTitle
                     * @param {Object} e
                     * @param {String} e.value  the title that is being set
                     */
                    "setTitle",
                    /**
                     * Fires when the tooltip of this document is set
                     * @event setTooltip
                     * @param {Object} e
                     * @param {String} e.value  the tooltip that is being set
                     */
                    "setTooltip",
                    /**
                     * Fires when the editor of this document is set
                     * @event setEditor
                     * @param {Object} e
                     * @param {String} e.value  the editor that is being set
                     */
                    "setEditor",
                    /**
                     * Fires when the change state of the document has changed
                     * @event changed
                     * @param {Object} e
                     * @param {String} e.changed  whether the value is changed
                     */
                    "changed",
                    /**
                     * Fires when there is progress information related to this
                     * file. This can be either downloading or uploading.
                     * @event progress
                     * @param {Object}  e
                     * @param {Number}  e.loaded    the number of bytes that have been downloaded/uploaded.
                     * @param {Number}  e.total     the total number of bytes for this file.
                     * @param {Boolean} e.complete  whether the download has completed.
                     * @param {Boolean} e.upload    whether this is an upload (instead of a download).
                     **/
                    "progress",
                    /**
                     * Fires when this document is cloned
                     * @event cone
                     * @param {Object}   e
                     * @param {Document} e.doc    the cloned document
                     **/
                    "clone",
                    /**
                     * @event canUnload
                     */
                    "canUnload"
                ],
                
                /**
                 * Retrieves the session object where editors can store state
                 */
                getSession: getSession,
                
                /**
                 * Sets the value of the document and bookmarks it in the 
                 * undoManager. This method also preserves the complete state
                 * of the editor while transitioning to the new value.
                 * @param {String} value  The new value of the document
                 */
                setBookmarkedValue: setBookmarkedValue,
                
                /**
                 * Retrieves the state of the document. The state object will
                 * have a section for each editor that it is loaded in. These
                 * sections have the name of the editor. For instance if the
                 * editor is ace, the returned object will look something like
                 * this:
                 * 
                 *     {
                 *         ace : {
                 *             scrollTop : 100,
                 *             ...
                 *         }
                 *     }
                 * 
                 * @return {Object}
                 * @return {Boolean} return.changed      Specifying whether the document state has been saved.
                 * @return {Object}  return.meta         Any metadata set on this document (except items starting with a "$").
                 * @return {String}  return.title        The title displayed in the tab, displaying this document.
                 * @return {String}  return.tooltip      The tooltip displayed in the tab, displaying this document
                 * @return {String}  return.value        The value of the document.
                 * @return {Object}  return.undoManager  The result of {@link UndoManager#getState}.
                 */
                getState: getState,
                
                /**
                 * Sets the state of the document
                 * @param {Object}  state              the state of the document. This can also include sections for editors. See {@link Document#method-getState}.
                 * @param {Boolean} state.changed      Specifying whether the document state has been saved.
                 * @param {Object}  state.meta         Any metadata set on this document (except items starting with a "$").
                 * @param {String}  state.title        The title displayed in the tab, displaying this document.
                 * @param {String}  state.tooltip      The tooltip displayed in the tab, displaying this document
                 * @param {String}  state.value        The value of the document.
                 * @param {Object}  state.undoManager  The result of {@link UndoManager#getState}.
                 */
                setState: setState,
                
                /**
                 * Set the progress indicator for this document
                 * @param {Object}  options 
                 * @param {Number}  options.loaded    the number of bytes that have been downloaded/uploaded.
                 * @param {Number}  options.total     the total number of bytes for this file.
                 * @param {Boolean} options.complete  whether the download has completed.
                 * @param {Boolean} options.upload    whether this is an upload (instead of a download).
                 */
                progress: progress,
                
                /**
                 * Clones this document
                 */
                clone: clone,
                
                /**
                 * Whether this document is ready to be unloaded
                 */
                canUnload: canUnload,
                
                /**
                 * Returns whether the document has it's value set.
                 * @return {Boolean} 
                 */
                hasValue: function() { return !!hasValue; },
            });
            
            if (options)
                setState(options);
            
            plugin.load(null, "document");
            
            return plugin;
        }
        
        /***** Register and define API *****/
        
        register(null, {
            Document: Document
        });
    }
});
