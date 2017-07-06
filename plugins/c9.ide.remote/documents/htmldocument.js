define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "remote", "watcher", "fs", "save", "dialog.error", "commands"
    ];
    main.provides = ["HTMLDocument"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var remote = imports.remote;
        var watcher = imports.watcher;
        var save = imports.save;
        var fs = imports.fs;
        var commands = imports.commands;
        var Range = require("ace/range").Range;
        
        var errorDialog = imports["dialog.error"];
        var HTMLInstrumentation 
            = require("../../c9.ide.language.html.diff/HTMLInstrumentation");
        
        function HTMLDocument(path) {
            var exists = remote.findDocument(path);
            if (exists) return exists;
            
            /***** Initialization *****/
            
            var plugin = new Plugin("Ajax.org", main.consumes);
            // var emit = plugin.getEmitter();
            
            var transports = [];
            var tab, doc, errors = {};
            
            var loaded = false;
            function load() {
                if (loaded) return false;
                loaded = true;
                
                remote.register(plugin);
            }
            
            /***** Methods *****/
            
            function addTransport(transport) {
                if (transports.indexOf(transport) == -1) {
                    transports.push(transport);
                    
                    transport.addOther(function() {
                        var idx = transports.indexOf(transport);
                        if (~idx) {
                            transports.splice(idx, 1);
                            
                            if (transports.length === 0)
                                plugin.unload();
                        }
                    });
                    
                }
                
                if (doc)
                    initDom(transport);
                
                if (tab && tab.isActive())
                    updateHighlight(true);
                
                // if (doc && doc.changed)
                //     update();
                
                return plugin;
            }
            
            function initTab(t) {
                if (!t) {
                    doc = null;
                    if (tab) {
                        fs.readFile(path, function(err, data) {
                            update(null, data);
                        });
                    }
                    tab = null;
                    return;
                }
                
                tab = t;
                doc = tab.document;
                
                // Listen for change in the document
                var c9session = doc.getSession();
                c9session.once("init", function(e) {
                    e.session.on("change", update);
                    e.session.selection.on("changeCursor", updateHighlight);
                    e.session.savedDom = null;
                    e.session.dom = null;
                    e.session.htmldocument = plugin;
                    plugin.addOther(function () {
                        e.session.off("change", update);
                        e.session.selection.off("changeCursor", updateHighlight);
                        e.session.savedDom = null;
                        e.session.dom = null;
                        e.session.htmldocument = null;
                    });
                    transports.forEach(function(transport) {
                        initDom(transport, doc);
                    });
                });
                
                tab.editor.ace.on("focus", function() { updateHighlight(true); }, plugin);
                tab.on("activate", function() { updateHighlight(); }, plugin);
                tab.on("deactivate", function() { updateHighlight(false); }, plugin);
                
                // Listen for a tab close event
                tab.on("close", function() { watcher.watch(path); });
                
                // @Ruben is there a better way to listen for save event?
                save.on("afterSave", function(e) {
                    if (e.document == doc) {
                        var session = doc.getSession().session;
                        if (session) {
                            if (!session.dom && !session.savedDom && errors.save) {
                                errors.save = false;
                                transports.forEach(function(transport) {
                                    transport.reload();
                                });
                            }
                            session.savedDom = session.dom;
                        }
                    }
                }, plugin);
            }
            
            function initDom(transport) {
                if (!doc) return;
                var session = doc.getSession().session;
                if (!session) return;
                var docState = HTMLInstrumentation.syncTagIds(session);
                if (!session.dom && docState.errors) {
                    var editList = HTMLInstrumentation.getUnappliedEditList(session);
                    if (!reportErrors(session, editList)) {
                        errors.save = true;
                        var name = doc.tab.path && doc.tab.path.match(/(^|\/)([^\/]*)$/)[2] || "the document";
                        errorDialog.show("Please save " + name + " to start a new live editing session");
                    }
                }
                if (docState.errors) {
                    session.dom = null;
                    this.errors = docState.errors;
                    console.log(this.errors);
                } else {
                    transport.initHTMLDocument(docState);
                }
            }
            
            function updateHighlight(e) {
                var query, tagId;
                
                if (tab && e !== false) {
                    var session = doc.getSession().session;
                    if (!session || !session.dom) return;
                    
                    var pos = {
                        row: session.selection.lead.row,
                        column: session.selection.lead.column
                    };
                    if (session.doc.getLine(pos.row)[pos.column] === "<")
                        pos.column++; // prefer element after cursor
                    
                    tagId = HTMLInstrumentation._getTagIDAtDocumentPos(session, pos);
                }
                
                if (tagId) {
                    query = "[data-cloud9-id='" + tagId + "']";
                } else {
                    query = false;
                }
                
                // Send the highlight command
                transports.forEach(function(transport) {
                    transport.highlightCSSQuery(query, e === true);
                });
            }
            
            function update(changes, value) {
                if (!changes) return; //@todo allow only value to be set
                
                // Calculate changes
                var session = doc.getSession().session;
                if (!session.dom) {
                    transports.forEach(function(transport) {
                        initDom(transport);
                    });
                    return;
                }
                
                var result = HTMLInstrumentation.getUnappliedEditList(session, changes);
                
                if (result.edits && result.edits.length) {
                    transports.forEach(function(transport) {
                        transport.processDOMChanges(result.edits, path);
                    });
                }
                
                reportErrors(session, result);
            }
            
            function reportErrors(session, editList) {
                if (!editList.edits && editList.errors && editList.errors.length) {
                    scheduleDisplayError("Unable to update preview: unmatched tags detected");
                } else {
                    scheduleDisplayError(false);
                }
        
                errors.unmatchedTags = editList.errors;
                
                if (session.domErrorMarker) {
                    session.removeMarker(session.domErrorMarker);
                    session.domErrorMarker = null;
                }
                if (errors.unmatchedTags && errors.unmatchedTags.length) {
                    var error = errors.unmatchedTags[0];
                    var range = Range.fromPoints(error.startPos, error.endPos);
                    if (range.isEmpty()) {
                        range.start.column--;
                        range.end.column++;
                    }
                    session.domErrorMarker = session.addMarker(range, "language_highlight_error", "text");
                }
                return editList.errors && editList.errors.length;
            }
            
            function scheduleDisplayError(msg) {
                clearTimeout(errors.timer);
                if (!msg && !errors.msg) return;
                errors.timer = setTimeout(function() {
                    errors.msg = msg;
                    errorDialog.show(msg, 2000);
                }, 800);
            }
            
            function scrollIntoView() {
                updateHighlight();
                transports.forEach(function(transport) {
                    transport.reveal();
                });
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
             **/
            plugin.freezePublicAPI({
                /**
                 * 
                 */
                get path() { return path; },
                
                /**
                 * 
                 */
                get tab() { return tab; },
                
                /**
                 * 
                 */
                set tab(tab) { initTab(tab); },
                
                _events: [
                    /**
                     * @event draw
                     */
                    "draw"
                ],
                
                /**
                 * 
                 */
                addTransport: addTransport,
                
                /**
                 * 
                 */
                update: update,
                
                /**
                 * 
                 */
                scrollIntoView: scrollIntoView
            });
            
            plugin.load(null, "htmldocument");
            
            return plugin;
        }
        
        register(null, {
            HTMLDocument: HTMLDocument
        });
    }
});