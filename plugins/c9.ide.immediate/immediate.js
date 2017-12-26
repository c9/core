define(function(require, exports, module) {
    main.consumes = [
        "editors", "ui", "settings", "tabManager", "ace", "menus", "commands",
        "console", "ace.status"
    ];
    main.provides = ["immediate"];
    return main;

    function main(options, imports, register) {
        var editors = imports.editors;
        var tabManager = imports.tabManager;
        var ui = imports.ui;
        var menus = imports.menus;
        var commands = imports.commands;
        var c9console = imports.console;
        var aceHandle = imports.ace;
        var aceStatus = imports["ace.status"];
        
        var Repl = require("plugins/c9.ide.ace.repl/repl").Repl;
        
        /***** Initialization *****/
        
        var extensions = [];
        
        var handle = editors.register("immediate", "Immediate Window", 
                                      Immediate, extensions);
        var emit = handle.getEmitter();
        
        var replTypes = {}; //Shared across Immediate windows
        var theme, defaultEvaluator;
        
        handle.on("load", function() {
            handle.addElement(
                tabManager.getElement("mnuEditors").appendChild(
                    new ui.item({
                        caption: "New Immediate Window",
                        onclick: function(e) {
                            tabManager.open({
                                active: true,
                                pane: this.parentNode.pane,
                                editorType: "immediate"
                            }, function() {});
                        }
                    })
                )
            );

            menus.addItemByPath("Window/New Immediate Window", new ui.item({
                onclick: function() {
                    tabManager.open({
                        active: true,
                        pane: this.parentNode.pane,
                        editorType: "immediate"
                    }, function() {});
                }
            }), 31, handle);
            
            commands.addCommand({
                name: "showimmediate",
                group: "Panels",
                exec: function (editor, args) {
                    // Search for the output pane
                    if (search(done)) return;
                    
                    // If not found show the console
                    c9console.show();
                    
                    // Search again
                    if (search(done)) return;
                    
                    // Else open the output panel in the console
                    tabManager.open({
                        editorType: "immediate", 
                        active: true,
                        pane: c9console.getPanes()[0],
                    }, done);
                    
                    function done(err, tab) {
                        if (args && args.evaluator)
                            tab.editor.setActiveEvaluator(args.evaluator);
                    }
                }
            }, handle);
            
            // Insert some CSS
            ui.insertCss(require("text!./style.css"), options.staticPrefix, handle);
        });

        // Search through pages
        function search(cb) {
            return !tabManager.getTabs().every(function(tab) {
                if (tab.editorType == "immediate") {
                    tabManager.focusTab(tab);
                    if (cb) cb(null, tab);
                    return false;
                }
                return true;
            });
        }
        
        function Immediate() {
            var Baseclass = editors.findEditor("ace");
            
            var plugin = new Baseclass(true, [], main.consumes);
            // var emit = plugin.getEmitter();
            
            var ddType, btnClear, ace, menu, statusbar;
            
            plugin.on("draw", function(e) {
                aceStatus.draw();
                
                // Create UI elements
                statusbar = e.tab.appendChild(new ui.bar({
                    skin: "bar-status",
                    skinset: "c9statusbar",
                    zindex: 10000,
                    height: 23,
                    style: "position:absolute;bottom:3px;right:5px;"
                }));
                
                menu = new ui.menu({
                    htmlNode: document.body,
                    render: "runtime",
                    class: "mnuSbPrefs"
                });
                plugin.addElement(menu);
                
                ddType = ui.insertByIndex(statusbar, new ui.button({
                    skin: "label",
                    style: "cursor:pointer",
                    margin: "1 7 0 0",
                    submenudir: "up",
                    submenu: menu
                }), 1000, plugin);
                
                btnClear = ui.insertByIndex(statusbar, new ui.button({
                    margin: "0 3 0 0",
                    skin: "btn_console",
                    skinset: "c9statusbar",
                    class: "clear",
                    submenudir: "up"
                }), 100000, plugin);
                
                ace = plugin.ace;
                
                ace.setOption("printMargin", false);
                ace.setOption("scrollPastEnd", 0);
                ace.setOption("showFoldWidgets", false);
                ace.setOption("highlightActiveLine", false);
                ace.setOption("highlightGutterLine", false);
                ace.renderer.setScrollMargin(0, 10);
                
                commands.addCommand({
                    bindKey: "Ctrl-C",
                    name: "abortimmediateexpression",
                    isAvailable: function() {
                        var tab = tabManager.focussedTab;
                        if (tab && tab.editorType == "immediate" && tab.editor && tab.editor.ace)
                           return tab.editor.ace.selection.isEmpty() && tab.editor.ace.isFocused();
                    },
                    exec: function() { abort(); }
                }, plugin);
                
                e.htmlNode.className += " immediate";
                
                // Allow Selection (APF)
                e.tab.textselect = true;
                
                ddType.on("afterchange", function() {
                    if (currentDocument)
                        currentDocument.getSession().changeType(ddType.selectedType);
                });
                btnClear.on("click", function() {
                    plugin.clear();
                    btnClear.blur();
                });
                
                for (var type in replTypes) {
                    var t = replTypes[type];
                    addType(t.caption, type, t.plugin);
                }
                
                handle.on("addEvaluator", function(e) {
                    addType(e.caption, e.id, e.plugin);
                });
                
                menu.on("itemclick", function(e) {
                    var value = e.relatedNode.getAttribute("value");
                    ddType.setType(value);
                });
                
                function update(e) {
                    if (e && !e.value)
                        return;
                    var items = menu.childNodes;
                    var value = ddType.selectedType || items[0].getAttribute("value");
                    var selectedItem;
                    items.forEach(function(item) {
                        var selected = item.getAttribute("value") == value ? true : false;
                        if (selected) selectedItem = item;
                        item.setAttribute("selected", selected);
                    });
                    
                    ddType.setType(value);
                }
                
                ddType.setType = function (type) {
                    if (type == ddType.selectedType)
                        return;
                    var caption = replTypes[type]
                        ? replTypes[type].caption
                        : type + " (Unknown)";
                    ddType.selectedType = type;
                    ddType.setAttribute("caption", caption);
                    ddType.dispatchEvent("afterchange");
                };
                
                function setTheme(e) {
                    theme = e.theme;
                    if (!theme) return;
                    
                    btnClear.parentNode.$ext.className = "bar-status "
                        + (theme.isDark ? "ace_dark" : "");
                }
                
                aceHandle.on("themeChange", setTheme, plugin);
                setTheme({ theme: aceHandle.theme });
                
                menu.on("prop.visible", update);
                update();
            });
            
            /***** Method *****/
            
            function addType(caption, value, plugin) {
                var item = menu.appendChild(new ui.item({
                    caption: caption,
                    value: value,
                    type: "radio"
                }));
                if (ddType.selectedType == value)
                    ddType.setAttribute("caption", caption);
                
                plugin.addOther(function() {
                    if (item.parentNode)
                        item.parentNode.removeChild(item);
                });
            }
            
            function setActiveEvaluator(value) {
                ddType.setType(value);
            }
            
            function getActiveEvaluator() {
                return ddType.selectedType;
            }
            
            function abort() {
                var session = currentDocument.getSession();
                if (session.repl.evaluator.abort)
                    session.repl.evaluator.abort();
            }
            
            // Set the tab in loading state - later this could be the output block
            // currentDocument.tab.classList.add("loading");
            // settings.save();
            
            /***** Lifecycle *****/
            
            plugin.on("load", function() {
            });
            
            var currentDocument;
            plugin.on("documentLoad", function(e) {
                var doc = e.doc;
                var session = doc.getSession();
                
                doc.undoManager.on("change", function(e) {
                    if (!doc.undoManager.isAtBookmark())
                        doc.undoManager.bookmark();
                });
                
                doc.tooltip = 
                doc.title = "Immediate";
                
                if (session.repl) return;
                
                session.changeType = function(type, noMessage) {
                    if (session.repl && session.repl.type == type)
                        return;
                    handle.findEvaluator(type, function(type, evaluator) {
                        session.type = type;
                        
                        if (!session.repl) {
                            session.repl = new Repl(session.session, {
                                mode: evaluator.mode,
                                evaluator: evaluator,
                                message: evaluator.message
                            });
                            
                            if (currentDocument
                              && currentDocument.getSession() == session)
                                session.repl.attach(ace);
                        }
                        
                        session.repl.type = type;
                        session.repl.clear();
                        
                        if (!noMessage) {
                            var cell = session.repl.insertCell(
                                { row: 0, column: 0 }, { type: "comment" }, true);
                            cell.setValue(evaluator.message + "\n");
                        }
                        
                        if (session.repl.evaluator && session.repl.evaluator != evaluator)
                            session.repl.evaluator.cleanUp("elements");
                        
                        session.repl.ensureLastInputCell();
                        session.repl.setEvaluator(evaluator);
                        session.repl.session.setMode(evaluator.mode);
                        
                        evaluator.draw(statusbar);
                        
                        doc.tooltip = 
                        doc.title = "Immediate (" + evaluator.caption + ")";
                    });
                };
                
                doc.value = "";
                
                session.changeType(session.type || defaultEvaluator || ddType.selectedType);
            });
            plugin.on("documentActivate", function(e) {
                currentDocument = e.doc;
                var session = e.doc.getSession();
                
                if (session.type) {
                    ddType.setType(session.type);
                }
                
                if (session.repl)
                    session.repl.attach(ace);
            });
            plugin.on("documentUnload", function(e) {
                var session = e.doc.getSession();
                if (session.repl)
                    session.repl.detach();
                // TODO: this breaks moving repl between splits
                // delete session.repl;
            });
            plugin.on("getState", function(e) {
                var session = e.doc.getSession();
                if (!session.repl || e.filter) return;
                
                e.state.type = session.type;
                var data = session.repl.history._data;
                var pos = session.repl.history.position;
                if (data.length > 1000)
                    data = data.slice(-500);
                e.state.history = data;
                e.state.pos = pos;
            });
            plugin.on("setState", function(e) {
                if (e.state.type) {
                    var session = e.doc.getSession();
                    session.type = e.state.type;
                    session.repl.history._data = e.state.history || [];
                    if (typeof e.state.pos === "number")
                        session.repl.history.position = e.state.pos;
                    if (e.doc == currentDocument)
                        ddType.setType(e.state.type);
                }
            });
            plugin.on("clear", function() {
                if (currentDocument) {
                    plugin.focus();
                }
            });
            plugin.on("focus", function() {
            });
            plugin.on("enable", function() {
            });
            plugin.on("disable", function() {
            });
            plugin.on("unload", function() {
            });
            
            /***** Register and define API *****/
            
            /**
             * Immediate Pane for Cloud9
             * @class immediate.Immediate
             * @extends Editor
             */
            /**
             * The type of editor. Use this to create an immediate pane using
             * {@link tabManager#openEditor} or {@link editors#createEditor}.
             * @property {"immediate"} type
             * @readonly
             */
            plugin.freezePublicAPI({
                /**
                 * 
                 */
                get statusbar() { return statusbar; },
                
                /**
                 * 
                 */
                setActiveEvaluator: setActiveEvaluator,
                
                /**
                 *
                 */
                getActiveEvaluator: getActiveEvaluator,
                
                /**
                 * @ignore This is here to overwrite default behavior
                 */
                isClipboardAvailable: function(e) { return !e.fromKeyboard; }
            });
            
            plugin.load(null, "immediate");
            
            return plugin;
        }
        
        /**
         * The immediate handle, provides an API for adding 
         * {@link Evaluator evaluators} to the immediate panes. 
         * An evaluator is a plugin that can take the expressions from the
         * multi-line REPL and return resuls. The results can be
         * rendered as HTML and are fully interactive.
         * 
         * This is the object you get when you request the immediate service 
         * in your plugin.
         * 
         * Example:
         * 
         *     define(function(require, exports, module) {
         *         main.consumes = ["immediate", "Plugin"];
         *         main.provides = ["myplugin"];
         *         return main;
         *     
         *         function main(options, imports, register) {
         *             var immediate = imports.immediate;
         *             var plugin = new imports.Plugin("Your Name", main.consumes);
         * 
         *             plugin.on("load", function(){
         *                 var evaluator = {
         *                     mode        : "ace/mode/go",
         *                     message     : "",
         *                     canEvaluate : function(str) { return str.trim() ? true : false; },
         *                     evaluate    : function(expression, cell, done) {
         *     
         *                         executeCommand(expression, function(result) {
         *                             cell.addWidget({ 
         *                                 html       : "<div class='result'>" 
         *                                     + result + "</div>",
         *                                 coverLine  : true, 
         *                                 fixedWidth : true 
         *                             });
         *                             
         *                             done();
         *                         });
         *                     
         *                     }
         *                 };
         *     
         *                 immediate.addEvaluator("Go Language", "go", evaluator, plugin);
         *             });
         *         });
         *     });
         * 
         * 
         * @class immediate
         * @extends Plugin
         * @singleton
         */
        handle.freezePublicAPI({
            get defaultEvaluator() { return defaultEvaluator; },
            set defaultEvaluator(value) { defaultEvaluator = value; },
            
            _events: [
                /**
                 * Fires when an evaluator is added.
                 * @event addEvaluator
                 * @param {Object}              e
                 * @param {String}              e.caption     The caption of the evaluator.
                 * @param {String}              e.id          The unique identifier of the evaluator.
                 * @param {Evaluator} e.evaluator   The evaluator.
                 * @param {Plugin}              e.plugin      The plugin responsible for adding the evaluator.
                 */
                "addEvaluator",
                /**
                 * Fires when an evaluator is removed.
                 * @event removeEvaluator
                 * @param {Object}              e
                 * @param {String}              e.caption     The caption of the evaluator.
                 * @param {String}              e.id          The unique identifier of the evaluator.
                 * @param {Evaluator} e.evaluator   The evaluator.
                 * @param {Plugin}              e.plugin      The plugin responsible for adding the evaluator.
                 */
                "removeEvaluator"
            ],
            
            /**
             * Adds a new evaluator to all immediate panes. The user is able
             * to choose the evaluator from a dropdown in the UI of the 
             * immediate pane.
             * @param {String}              caption     The caption in the dropdown.
             * @param {String}              id          The unique identifier of this evaluator.
             * @param {Evaluator} evaluator   The evaluator for your runtime.
             * @param {Plugin}              plugin      The plugin responsible for adding the evaluator.
             * @fires addEvaluator
             */
            addEvaluator: function(caption, id, evaluator, plugin) {
                if (replTypes[id])
                    throw new Error("An evaluator is already registered with "
                        + "the id '" + id + "'");
                    
                replTypes[id] = {
                    caption: caption, 
                    id: id, 
                    evaluator: evaluator,
                    plugin: plugin
                };
                emit("addEvaluator", replTypes[id]);
                
                plugin.addOther(function() { 
                    handle.removeEvaluator(id);
                });
            },
            
            /**
             * Retrieves an evaluator based on it's id. When the evaluator is
             * not yet registered, the callback will be returned when the 
             * evaluator is registered.
             * @param {String}              id                  The id of the evaluator to retrieve.
             * @param {Function}            callback            Called when the evaluator is available.
             * @param {Error}               callback.id         The id of the requested evaluator.
             * @param {Evaluator} callback.evaluator  The evaluator requested.
             */
            findEvaluator: function(id, callback) {
                if (!id || !replTypes[id]) {
                    handle.on("addEvaluator", function wait(e) {
                        if (!id || e.id == id)
                            callback(e.id, replTypes[e.id].evaluator);
                        
                        handle.off("addEvaluator", wait);
                    });
                }
                else {
                    callback(id, replTypes[id].evaluator);
                }
            },
            
            /**
             * Removes an evaluator from all immediate panes.
             * @param {String} id  The unique identifier of the evaluator to remove.
             */
            removeEvaluator: function(id) {
                emit("removeEvaluator", replTypes[id]);
                delete replTypes[id];
            }
        });
        
        register(null, {
            immediate: handle
        });
    }
});
