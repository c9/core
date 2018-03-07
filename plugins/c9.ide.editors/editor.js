define(function(require, module, exports) {
    main.consumes = ["Plugin", "ui", "clipboard"];
    main.provides = ["Editor"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var clipboard = imports.clipboard;
        var ui = imports.ui;
        
        function Editor(developer, deps, extensions) {
            // Editor extends ext.Plugin
            var plugin = new Plugin(developer, deps);
            var emit = plugin.getEmitter();
            emit.setMaxListeners(1000);
            
            var amlTab, type, pane, activeDocument, focussed;
            var meta = {};
            
            /***** Methods *****/
            
            function unloadDocument(doc, options) {
                if (!options) options = {};
                options.doc = doc;
                emit("documentUnload", options);
                doc.getSession().unload();
            }
            
            function loadDocument(doc) {
                // Old Editor
                var lastEditor = doc.editor;
                if (lastEditor && lastEditor != plugin) {
                    doc.getState();
                    lastEditor.unloadDocument(doc, { 
                        toEditor: plugin, 
                        fromEditor: lastEditor 
                    });
                }
                
                activeDocument = doc;
                
                // Initialize the Document in the Editor
                // When the Document unloads the editor should clear all it's state
                // When the Editor unloads it should clear all it's state
                if (lastEditor != plugin) {
                    var editor = plugin;
                    doc.editor = plugin;
                    
                    var session = doc.getSession();
                    var state = (doc.lastState || false)[editor.type]; // Retrieve last state
                    bufferEvent.call(plugin, "documentLoad", { 
                        doc: doc, 
                        state: state || {}
                    });
                    
                    // Check if session was unloaded from the previous editor
                    if (!session.loaded)
                        session.load(); 
                    
                    if (!doc.meta.$unloadEditor) {
                        doc.meta.$unloadEditor = true;
                        doc.on("unload", function() {
                            doc.editor.unloadDocument(doc);
                        });
                    }
                    
                    // editor.on("unload", function(){
                    //     editor.unloadDocument(doc);
                    // }, session);
                    
                    if (state)
                        plugin.setState(doc, state);
                }
                
                // Set Document Active in the Editor
                bufferEvent.call(plugin, "documentActivate", { doc: doc });
            }
            
            function bufferEvent(name, event) {
                var _self = plugin;
                
                emit(name, event);
                    
                // Add new listeners
                function listenForEvent(curName, listener) {
                    if (curName == name) 
                        listener(event);
                }
                plugin.on("newListener", listenForEvent);
                plugin.on("documentUnload", function callee(e) {
                    if (e.doc == event.doc) {
                        _self.off("newListener", listenForEvent);
                        _self.off("documentUnload", callee);
                    }
                });
            }
            
            function getState(doc, filter) {
                var state = {};
                
                emit("getState", {
                    doc: doc,
                    state: state,
                    filter: filter || false
                });
                
                return state;
            }
            
            function setState(doc, state) {
                emit("setState", {
                    doc: doc,
                    state: state || {}
                });
            }
            
            function clear() {
                emit("clear");
            }
            
            // Clipboard support
            function isClipboardAvailable(e) { 
                return true;
            }
            
            function cut(e) {
                emit("cut", e || { clipboardData: clipboard.clipboardData });
            }
            
            function copy(e) {
                emit("copy", e || { clipboardData: clipboard.clipboardData });
            }
            
            function paste(e) {
                emit("paste", e || { clipboardData: clipboard.clipboardData });
            }
            
            function focus(regain, lost) {
                if (!lost && amlTab) 
                    amlTab.focus(); //@todo this might break selenium editor
                
                emit("focus", {
                    regain: regain || false,
                    lost: lost || false
                });
                
                focussed = lost ? 0 : true;
            }
            
            function blur() {
                emit("blur");
                focussed = false;
            }
            
            function resize(e) {
                if (pane && pane.visible)
                    emit("resize", e || {});
            }
            
            function isValid(doc, info) {
                return emit("validate", { document: doc, info: info });
            }
            
            function attachTo(tb) {
                if (amlTab && !amlTab.$amlDestroyed)
                    throw new Error("Editors should only be attached once");

                //Create Tab Element
                plugin.addElement(
                    amlTab = new ui.page({
                        id: "editor::" + plugin.type,
                        mimeTypes: extensions,
                        visible: false,
                        realtime: false,
                        focussable: true,
                        $focussable: true
                    })
                );
                
                // Remember which pane we belong too
                pane = tb;
                
                // Set the reference to us on the tab element
                amlTab.editor = this;
                
                // Insert our tab into the pane element
                pane.aml.insertBefore(amlTab, pane.aml.getPage(0));
                
                // Emit draw event
                var event = { tab: amlTab, htmlNode: amlTab.$int };
                emit.sticky("draw", event);
                
                var editor = this;
                pane.on("unload", function() {
                    editor.unload();
                });
            }
            
            function drawOn(htmlNode, pg) {
                amlTab = pg;
                
                // Emit draw event
                var event = { htmlNode: htmlNode, tab: amlTab };
                emit.sticky("draw", event);
            }
            
            /***** Register and define API *****/
            
            // This is a base class
            plugin.baseclass();
            
            /**
             * Editor base class for Cloud9 Editors. Each file that is opened
             * in Cloud9 has an editor to display it's content. An editor can register 
             * itself for a set of file extensions. There are also editors that
             * don't display files but have a different purpose. For instance
             * the {@link terminal.Terminal Terminal} and 
             * {@link preferences.Preferences Preferences} panel. 
             * 
             * The editor relates to other objects as such:
             * 
             * * {@link Pane} - Represent a single pane, housing multiple tabs
             *   * {@link Tab} - A single tab (button) in a pane
             *     * **Editor - The editor responsible for displaying the file in the tab**
             *     * {@link Document} - The representation of a file in the tab
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
             *         var editor = tab.editor;
             *         editor.focus();
             *     });
             * 
             * The event flow of an editor plugin is as follows:
             * 
             * * {@link #event-documentLoad} - *A document is loaded in the editor*
             * * {@link #event-documentActivate} - *A becomes active in the editor*
             * * {@link #event-documentUnload} - *The document is unloaded in the editor*
             * 
             * This is in addition to the event flow of the {@link Plugin} base class.
             * 
             * #### User Actions:
             * 
             * * {@link #event-draw} - *The editor is drawn*
             * * {@link #event-focus} - *The editor receives focus*
             * * {@link #event-blur} - *The editor lost focus*
             * * {@link #event-clear} - *The editor's contents is cleared*
             * * {@link #event-cut} - *The editor's selection is copied and deleted*
             * * {@link #event-copy} - *The editor's selection is copied*
             * * {@link #event-paste} - *The editor's selection is deleted and new content is pasted in*
             * * {@link #event-resize} - *The editor is resized*
             * 
             * Implementing your own editor takes a new Editor() object rather
             * than a new Plugin() object. See the {@link texteditor.TextEditor TextEditor} for a
             * full implementation of an editor. Here's a short example:
             * 
             *     function TextEditor(){
             *         var plugin = new Editor("(Company) Name", main.consumes, ["txt"]);
             *         var emit = plugin.getEmitter();
             *         
             *         plugin.freezePublicAPI({
             *             example: function(){
             *      
             *             }
             *         });
             *         
             *         plugin.load(null, "texteditor");
             *         
             *         return plugin;
             *     }
             * 
             * @class Editor
             * @extends Plugin
             */
            /**
             * @constructor
             * Creates a new Editor instance.
             * @param {String}   developer   The name of the developer of the plugin
             * @param {String[]} deps        A list of dependencies for this 
             *   plugin. In most cases it's a reference to main.consumes.
             * @param {String[]} extensions  A list of file extension that this
             * editor can handle.
             */
            plugin.freezePublicAPI({
                /**
                 * @ignore
                 */
                get aml() { return amlTab; },
                
                /**
                 * The pane that this editor is a part of. Each editor is 
                 * initialized in the context of a single pane and the editor
                 * is destroyed when the pane is destroyed.
                 * @property {Pane} pane
                 * @readonly
                 */
                get pane() { return pane; },
                
                /**
                 * The document that is displayed in this editor.
                 * @property {Document} activeDocument
                 * @readonly
                 */
                get activeDocument() { return activeDocument; },
                
                /** 
                 * @property {String} type the unique identifier for this editor
                 * @readonly
                 */
                get type() { return type; },
                set type(val) {
                    if (!type)
                        type = val;
                    else
                        throw new Error("Plugin Type Exception");
                },
                
                /**
                 * @property {Object} meta
                 */
                get meta() { return meta; },
                
                /**
                 * @property {String[]} fileExtensions Array of file extensions supported by this editor
                 * @readonly
                 */
                get fileExtensions() { return extensions; },
                
                _events: [
                    /** 
                     * Fires when a document is loaded into the editor.
                     * This event is also fired when this document is attached to another
                     * instance of the same editor (in a split view situation). Often you
                     * want to keep the session information partially in tact when this
                     * happens.
                     * @event documentLoad 
                     * @param {Object}   e
                     * @param {Document} e.doc    the document that is loaded into the editor
                     * @param {Object}   e.state  state that was saved in the document
                     */
                    "documentLoad",
                    /** 
                     * Fires when a document becomes the active document of an editor
                     * This event is called every time a tab becomes the active tab of
                     * a pane. Use it to show / hide whatever is necessary.
                     * 
                     * @event documentActivate
                     * @param {Object}   e
                     * @param {Document} e.doc  the document that is activate
                     */
                    "documentActivate",
                    /** 
                     * Fires when a document is unloaded from the editor.
                     * This event is also fired when this document is attached to another
                     * instance of the same editor (in a split view situation).
                     * @event documentUnload
                     * @param {Object}   e
                     * @param {Document} e.doc  the document that was loaded into the editor
                     */
                    "documentUnload",
                    /** 
                     * Fires when the state of the editor is retrieved
                     * @event getState
                     * @param {Object}   e
                     * @param {Document} e.doc    the document for which the state is retrieved
                     * @param {Object}   e.state  the state to add values to {See Editor#getState}
                     */
                    "getState",
                    /** 
                     * Fires when the state of the editor is set
                     * @event setState
                     * @param {Object}   e
                     * @param {Document} e.doc    the document for which the state is set
                     * @param {Object}   e.state  the state that is being set
                     */
                    "setState",
                    /** 
                     * Fires when the editor is cleared
                     * @event clear
                     */
                    "clear",
                    /** 
                     * Fires when the editor gets the focus. See also 
                     * {@link tabManager#focusTab}, {@link tabManager#focussedTab}
                     * @event focus
                     * @param {Object}  e
                     * @param {Boolean} e.regain whether the focus is regained. 
                     *   This means that the editor had lost the focus 
                     *   previously (the focus event with e.lost set to true 
                     *   was called.) and now the focus has been given back to 
                     *   the tabs.
                     * @param {Boolean} e.lost   whether the focus is lost, 
                     *   while the editor remains the focussed editor. This 
                     *   happens when an element outside of the editors 
                     *   (for instance the tree or a menu) gets the focus.
                     */
                    "focus",
                    /** 
                     * Fires when the editor looses focus.
                     * @event blur
                     */
                    "blur",
                    /**
                     * Fires when the cut command is dispatched to this editor,
                     * either using a keybinding or programmatically.
                     * 
                     *    plugin.on("cut", function(e) {
                     *        var data = this.yankDataFromSomewhere();
                     *        e.clipboardData.setData("text/plain", data);
                     *    });
                     * 
                     * @event cut
                     * @param {Object}                  e
                     * @param {clipboard.ClipboardData} e.clipboardData  the api to interact with the clipboard
                     * @param {Boolean}                 e.native         whether this is a native clipboard event
                     */
                    "cut",
                    /**
                     * Fires when the copy command is dispatched to this editor,
                     * either using a keybinding or programmatically.
                     * 
                     *    plugin.on("cut", function(e) {
                     *        var data = this.getDataFromSomewhere();
                     *        e.clipboardData.setData("text/plain", data);
                     *    });
                     * 
                     * @event copy
                     * @param {Object}                  e
                     * @param {clipboard.ClipboardData} e.clipboardData  the api to interact with the clipboard
                     * @param {Boolean}                 e.native         whether this is a native clipboard event
                     */
                    "copy",
                    /**
                     * Fires when the copy command is dispatched to this editor,
                     * either using a keybinding or programmatically.
                     * 
                     *    plugin.on("paste", function(e) {
                     *        e.clipboardData.getData("text/plain", function(err, data) {
                     *            // Process the data here
                     *        });
                     *    });
                     * 
                     * @event paste
                     * @param {Object}                  e
                     * @param {clipboard.ClipboardData} e.clipboardData  the api to interact with the clipboard
                     * @param {Boolean}                 e.native         whether this is a native clipboard event
                     */
                    "paste",
                    /**
                     * Fires when the editor resizes
                     * @event resize
                     * @param {Event} e  the DOMEvent related to the resize event.
                     */
                    "resize",
                    /**
                     * Fires when the editor is requested to draw itself. Cloud9
                     * is optimized by lazy loading everyhing. This means that
                     * the editor won't be loaded until absolutely necessary.
                     * This is usually the case when the tab is active for the 
                     * first time. 
                     * @event draw
                     * @param {Object}      e
                     * @param {HTMLElement} e.htmlNode  
                     * @param {Tab}         e.tab      
                     */
                    "draw",
                    /**
                     * Fires when a new document is going to be loaded in this
                     * editor. The purpose of this event is to allow a check
                     * prior to switching from one editor to the next for the
                     * same document.
                     * @event validate
                     * @param {Object}   e
                     * @param {Document} e.document  the document that will be loaded
                     * @param {Object}   e.info      extra information about the document
                     */
                    "validate",
                ],
                
                /**
                 * Unloads the document from this editor.
                 * @private
                 */
                unloadDocument: unloadDocument,
                
                /**
                 * Loads the document in this editor to be displayed.
                 * @param {Document} doc the document to display
                 */
                loadDocument: loadDocument,

                /**
                 * Retrieves the state of a document in relation to this editor
                 * @param {Document} doc the document for which to return the state
                 * @return {Object}
                 */
                getState: getState, 
                
                /**
                 * Sets the state of this editor (related to a document)
                 * @param {Document} doc the document for which to set the state
                 * @param {Object} state the state of the document for this editor
                 */
                setState: setState,
                
                /**
                 * Clears the value of the document in the editor
                 */
                clear: clear,
                
                /**
                 * Checks if clipboard action is available
                 * @param {Object} clipboard action type
                 */
                isClipboardAvailable: isClipboardAvailable,
                
                /**
                 * Cuts the current selection from the editor into the clipboard
                 */
                cut: cut,

                /**
                 * Copies the current selection from the editor into the clipboard
                 */
                copy: copy,

                /**
                 * Pastes the current clipboard buffer into this editor
                 */
                paste: paste,

                /**
                 * Sets the focus to this editor
                 */
                focus: focus,

                /**
                 * Removes the focus from this editor
                 */
                blur: blur,

                /**
                 * Resize the editor to fit it's container
                 */
                resize: resize,

                /**
                 * Checks whether the passed document would be valid in the context
                 * of this editor.
                 * @param {Document} doc  the document to check
                 * @param {Object} info object to put values on to display in a return alert (title, head, message)
                 */
                isValid: isValid,

                /**
                 * Attaches editor to pane element. This can be done only once
                 * @param pane {AmlNode.Tab} the pane element to add this editor to
                 */
                attachTo: attachTo,
                
                /**
                 * @private
                 */
                drawOn: drawOn
            });
            
            return plugin;
        }
        
        /***** Register and define API *****/
        
        register(null, {
            Editor: Editor
        });
    }
});
