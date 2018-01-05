define(function(require, exports, module) {
    main.consumes = [
        "DebugPanel", "util", "ui", "tabManager", "debugger", "save", "panels",
        "Menu", "MenuItem", "dialog.error", "layout", "clipboard"
    ];
    main.provides = ["callstack"];
    return main;

    function main(options, imports, register) {
        var util = imports.util;
        var DebugPanel = imports.DebugPanel;
        var ui = imports.ui;
        var save = imports.save;
        var layout = imports.layout;
        var panels = imports.panels;
        var debug = imports.debugger;
        var tabs = imports.tabManager;
        var Menu = imports.Menu;
        var MenuItem = imports.MenuItem;
        var clipboard = imports.clipboard;
        var showError = imports["dialog.error"].show;
        
        var Range = require("ace/range").Range;
        var markup = require("text!./callstack.xml");
        
        var Tree = require("ace_tree/tree");
        var TreeData = require("ace_tree/data_provider");
        var LineWidgets = require("ace/line_widgets").LineWidgets;
        
        /***** Initialization *****/
        
        var plugin = new DebugPanel("Ajax.org", main.consumes, {
            caption: "Call Stack",
            index: 200
        });
        var emit = plugin.getEmitter();
        
        var datagrid, modelSources, modelFrames; // UI Elements
        var sources = [];
        var frames = [];
        
        var activeFrame, dbg, menu, button, lastException;
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            modelSources = new TreeData();
            modelSources.$sortNodes = false;
            
            modelFrames = new TreeData();
            modelFrames.emptyMessage = "No call stack to display";
            modelFrames.$sortNodes = false;
            
            modelFrames.$sorted = false;
            modelFrames.columns = [{
                caption: "Function",
                value: "name",
                width: "60%",
                icon: true
            }, {
                caption: "File",
                getText: function(node) {
                    var path = node.path;
                    if (typeof path != "string")
                        return "";
                    
                    if (path.charAt(0) === "/")
                        path = path.substr(1);
                    return path + " :" + (node.line + 1) + ":" + (node.column + 1);
                },
                width: "40%"
            }];
            
            // Set and clear the dbg variable
            debug.on("attach", function(e) {
                dbg = e.implementation;
                
                if (button)
                    button.setAttribute("disabled", !dbg.features.scripts);
            });
            debug.on("detach", function(e) {
                dbg = null;
            });
            debug.on("stateChange", function(e) {
                if (!plugin.enabled && e.action == "enable" && activeFrame)
                    debug.activeFrame = activeFrame;
                    
                plugin[e.action]();
                
                if (e.action == "disable" && e.state != "away")
                    clearFrames();
            });
            
            debug.on("framesLoad", function(e) {
                function setFrames(frames, frame, force) {
                    // Load frames into the callstack and if the frames 
                    // are completely reloaded, set active frame
                    var top = debug.findTopFrame(frames);
                    if (loadFrames(frames, top, false, force) && (force
                      || !activeFrame || activeFrame == frame
                      || activeFrame == top)) {

                        // Set the active frame
                        activeFrame = top;
                        emit("frameActivate", { frame: activeFrame });
                        debug.activeFrame = activeFrame;
                        
                        e.frame = activeFrame;
                        emit("framesLoad", e);
                    }
                }
                
                // Load frames
                if (e.frames) 
                    return setFrames(e.frames, e.frame, true);
                
                // If we don't have the frames yet, lets fetch them
                dbg.getFrames(function(err, frames) {
                    setFrames(frames, e.frame);
                });
                
                // If we're most likely in the current frame, lets update
                // The callstack and show it in the editor
                var frame = debug.findTopFrame(frames);
                if (frame && e.frame.path == frame.path
                  && e.frame.sourceId == frame.sourceId) {
                    frame.line = e.frame.line;
                    frame.column = e.frame.column;
                    
                    setFrames(frames, frame, true);
                }
                // Otherwise set the current frame as the active one, until
                // we have fetched all the frames
                else {
                    setFrames([e.frame], e.frame, true);
                }
            });
            
            debug.on("break", function(e) {
                if (e.exception && e.frame) {
                    lastException = e;
                } else if (lastException) {
                    if (!e.frame || frameId(e.frame) != frameId(lastException.frame))
                        lastException = null;
                }
                // Show the frame in the editor
                debug.showDebugFrame(activeFrame);
            });
            
            debug.on("frameActivate", function(e) {
                // This is disabled, because frames should be kept around a bit
                // in order to update them, for a better UX experience
                //callstack.activeFrame = e.frame;
                updateMarker(e.frame, true);
            });
            
            // Loading new sources
            debug.on("sources", function(e) {
                loadSources(e.sources);
            }, plugin);
            
            // Adding single new sources when they are compiles
            debug.on("sourcesCompile", function(e) {
                addSource(e.source);
            }, plugin);
            
            // Set script source when a file is saved
            save.on("afterSave", function(e) {
                if (debug.state == "disconnected")
                    return;

                var script = findSourceByPath(e.path);
                if (!script)
                    return;
                    
                if (!dbg.features.liveUpdate || debug.disabledFeatures.liveUpdate)
                    return;
    
                var value = e.document.value, lastError;
                dbg.setScriptSource(script, value, false, function(err) {
                    if (err) {
                        if (lastError != err.message) {
                            lastError = err.message;
                            showError(err.message);
                        }
                        return;
                    }
                    
                    // @todo update the UI
                });
            }, plugin);
        }

        var drawn = false;
        function draw(options) {
            if (drawn) return;
            drawn = true;
            
            // Create UI elements
            ui.insertMarkup(options.aml, markup, plugin);
            
            var datagridEl = plugin.getElement("datagrid");
            datagrid = new Tree(datagridEl.$ext);
            datagrid.renderer.setTheme({ cssClass: "blackdg" });
            datagrid.setOption("maxLines", 200);
            
            datagrid.setDataProvider(modelFrames);
            panels.on("afterAnimate", function(e) {
                if (panels.isActive("debugger"))
                    datagrid && datagrid.resize();
            });
            
            // Update markers when a document becomes available
            tabs.on("tabAfterActivateSync", function(e) {
                updateMarker(activeFrame);
            }, plugin);
            tabs.on("open", function wait(e) {
                if (activeFrame)
                    updateMarker(activeFrame);
            }, plugin);
            
            // stack view
            datagrid.on("userSelect", function(e) {
                var frame = datagrid.selection.getCursor();
                setActiveFrame(frame, true);
            });
            
            var contextMenu = new Menu({
                items: [
                    new MenuItem({ value: "restart", caption: "Restart Frame" }),
                    new MenuItem({ value: "copy", caption: "Copy Stack Trace" }),
                ]
            }, plugin);
            contextMenu.on("itemclick", function(e) {
                if (e.value == "restart")
                    dbg.restartFrame(activeFrame, function() {});
                if (e.value == "copy") {
                    var text = frames.map(function(f) {
                        return f.name + " (" + f.path + ":" + f.line
                            + (f.column != null ? ":" + f.column : "") + ")";
                    }).join("\n");
                    clipboard.clipboardData.setData("text/plain", text);
                }
            });
            contextMenu.on("show", function(e) {
                var selected = datagrid.selection.getCursor();
                contextMenu.items[0].disabled = selected && dbg ? false : true;
            });
            
            datagridEl.setAttribute("contextmenu", contextMenu.aml);
            
            var hbox = debug.getElement("hbox");
            menu = hbox.ownerDocument.documentElement.appendChild(new ui.menu({
                style: "top: 56px;"
                    + "left: 803px;"
                    + "width: 350px;"
                    + "opacity: 1;"
                    + "border: 0px;"
                    + "padding: 0px;"
                    + "background-color: transparent;"
                    + "margin: -3px 0px 0px;"
                    + "box-shadow: none;",
                childNodes: [
                ]
            }));
            button = hbox.appendChild(new ui.button({
                id: "btnScripts",
                tooltip: "Available internal and external scripts",
                icon: true,
                right: "0",
                top: "0",
                class: "scripts",
                skin: "c9-menu-btn",
                disabled: !dbg || !dbg.features.scripts
            }));
            plugin.addElement(menu, button);
            
            menu.on("prop.visible", function(e) {
                if (!e.value || menu.reopen)
                    return;
                
                list.resize();
                menu.resize();
            });
            
            menu.resize = function() {
                if (!menu.visible) return;
                
                list.renderer.setOption("maxLines", Math.floor(window.innerHeight / 28 * 3 / 4));
                setTimeout(function() {
                    if (menu.opener) {
                        menu.reopen = true;
                        menu.$ext.style.overflowY = "";
                        menu.display(null, null, true, menu.opener);
                        menu.$ext.style.overflowY = "";
                        menu.reopen = false;
                    }
                }, 10);
            };
            
            // Load the scripts in the sources dropdown
            var list = new Tree();
            menu.$ext.appendChild(list.container);
            list.setDataProvider(modelSources);
            list.renderer.setTheme({ cssClass: "blackdg" });
            list.on("click", function(e) {
                var selected = list.selection.getCursor();
                debug.openFile({
                    scriptId: selected.id,
                    path: selected.path,
                    generated: true
                });
                menu.hide();
            }, plugin);
            list.renderer.setScrollMargin(10, 10);
            list.container.className = "ace_tree c9menu list_dark";
            list.container.style.width = "inherit";
            // Set context menu to the button
            button.setAttribute("submenu", menu);

            layout.on("eachTheme", function(e) {
                var height = parseInt(ui.getStyleRule(".blackdg .row", "height"), 10) || 24;
                // modelFrames.rowHeightInner = height - 1;
                modelFrames.rowHeight = height;
                modelSources.rowHeight = height;
                
                if (e.changed) datagrid.resize(true);
            });
            
        }
        
        function setActiveFrame(frame, fromDG) {
            activeFrame = frame;
            if (!frames.length) return;
            
            if (!fromDG && datagrid) {
                // Select the frame in the UI
                if (!frame) {
                    modelFrames.setRoot({});
                    frames = [];
                }
                else {
                    datagrid.select(frame);
                }
            }
            
            // Highlight frame in Ace and Open the file
            if (frame) {
                debug.showDebugFrame(frame, function() {
                    updateMarker(frame);
                });
            }
                
            emit("frameActivate", { frame: activeFrame });
            debug.activeFrame = activeFrame;
        }
        
        /***** Helper Functions *****/
        
        function addMarker(session, type, row) {
            var marker = session.addMarker(new Range(row, 0, row, 1), "ace_" + type, "fullLine");
            session.addGutterDecoration(row, type);
            session["$" + type + "Marker"] = { lineMarker: marker, row: row };
        }

        function removeMarker(session, type) {
            var markerName = "$" + type + "Marker";
            session.removeMarker(session[markerName].lineMarker);
            session.removeGutterDecoration(session[markerName].row, type);
            session[markerName] = null;
        }
        
        function removeMarkerFromSession(session) {
            session.$stackMarker && removeMarker(session, "stack");
            session.$stepMarker && removeMarker(session, "step");
            session.$exceptionWidget && session.$exceptionWidget.destroy();
        }
        
        function addExceptionWidget(editor, ev) {
            var session = editor.session;
            if (!session.widgetManager) {
                session.widgetManager = new LineWidgets(session);
                session.widgetManager.attach(editor);
            }
            
            var oldWidget = session.$exceptionWidget;
            if (oldWidget)
                oldWidget.destroy();
                
            var row = ev.frame.line;
            var column = ev.frame.column || 0;
            var w = {
                row: row, 
                fixedWidth: true,
                coverGutter: true,
                el: document.createElement("div"),
                type: "debuggerException"
            };
            var el = w.el.appendChild(document.createElement("div"));
            var arrow = w.el.appendChild(document.createElement("div"));
            arrow.className = "error_widget_arrow ace_error";
            
            var left = editor.renderer.$cursorLayer
                .getPixelPosition({ row: row, column: column }).left;
            arrow.style.left = left + editor.renderer.gutterWidth - 5 + "px";
            
            w.el.className = "error_widget_wrapper";
            el.className = "error_widget ace_error";
            el.textContent = ev.exception.value;
            el.appendChild(document.createElement("div"));
            
            w.destroy = function() {
                session.$exceptionWidget = null;
                session.off("change", w.destroy);
                session.widgetManager.removeLineWidget(w);
            };
            session.$exceptionWidget = w;
            session.on("change", w.destroy);
            
            editor.session.widgetManager.addLineWidget(w);
            
            w.el.onmousedown = function(e) {
                e.stopPropagation();
            };
            
            // TODO add buttons to: close, disable break on exception, not break on current line
            
            editor.renderer.scrollCursorIntoView(null, 0.5, { bottom: w.el.offsetHeight });
        }

        function updateMarker(frame, scrollToLine) {
            // Remove from all active sessions, when there is no active frame.
            if (!frame) {
                tabs.getPanes().forEach(function(pane) {
                    var tab = pane.getTab();
                    if (tab && tab.editor && tab.editor.type == "ace") {
                        var session = tab.document.getSession().session;
                        removeMarkerFromSession(session);
                    }
                });
                return;
            }
            
            // Otherwise find the active session and set the marker
            var tab = frame && tabs.findTab(frame.path);
            var editor = tab && tab.isActive() && tab.editor;
            if (!editor || editor.type != "ace")
                return;
                
            var session = tab.document.getSession().session;
            removeMarkerFromSession(session);

            if (!frame)
                return;
                
            var path = tab.path;
            var framePath = frame.path;
            var row = frame.line;
            
            if (frame.istop) {
                if (path == framePath || path == "/" + framePath) {
                    if (row >= session.getLength())
                        row = session.getLength() - 1;
                        
                    addMarker(session, "step", row);
                    
                    if (scrollToLine) {
                        var ace = tab.editor.ace;
                        var renderer = ace.renderer;
                        if (row < renderer.getFirstFullyVisibleRow() 
                          || row > renderer.getLastFullyVisibleRow()) {
                            ace.scrollToLine(row, true, true);
                        }
                    }
                }
            }
            else {
                if (path == framePath || path == "/" + framePath)
                    addMarker(session, "stack", row);

                var topFrame = debug.findTopFrame(frames);
                if (path == topFrame.path)
                    addMarker(session, "step", topFrame.line);
            }
            
            if (lastException && frameId(frame) == frameId(lastException.frame)) {
                addExceptionWidget(editor.ace, lastException);
            }
        }
        
        /***** Methods *****/
        
        function findSourceByPath(path) {
            for (var i = 0, l = sources.length, source; i < l; i++) {
                if ((source = sources[i]).path == path)
                    return source;
            }
        }
        
        function findSource(id) {
            if (typeof id == "object") {
                id = parseInt(id.getAttribute("id"), 10);
            }
            
            for (var i = 0, l = sources.length, source; i < l; i++) {
                if ((source = sources[i]).id == id)
                    return source;
            }
        }
        
        function findFrame(index) {
            if (typeof index == "object") {
                index = parseInt(index.getAttribute("index"), 10);
            }
            
            for (var i = 0, l = frames.length, frame; i < l; i++) {
                if ((frame = frames[i]).index == index)
                    return frame;
            }
        }
        
        function frameId(frame) {
            return [frame.path, frame.line, frame.column, frame.sourceId].join(":");
        }
        /**
         * Assumptions:
         *  - .index stays the same
         *  - sequence in the array stays the same
         *  - ref stays the same when stepping in the same context
         */
        
        function updateFrame(frame, noRecur) {
            modelFrames._signal("change", frame);
            if (noRecur)
                return;
        
            // Updating the scopes of a frame
            if (frame.variables) {
                emit("scopeUpdate", {
                    scope: frame,
                    variables: frame.variables
                });
            }
            else {
                dbg.getScope(activeFrame, frame, function(err, vars) {
                    if (err) return console.error(err);
                    
                    emit("scopeUpdate", {
                        scope: frame,
                        variables: vars
                    });
                });
            }
        
            // Update scopes if already loaded
            frame.scopes && frame.scopes.forEach(function(scope) {
                if (scope.variables)
                    emit("scopeUpdate", { scope: scope });
            });
        }
        
        function loadFrames(input, top, noRecur, force) {
            frames = input;
            modelFrames.setRoot(frames);
            
            if (activeFrame && frames.indexOf(activeFrame) > -1)
                setActiveFrame(activeFrame);
            else
                setActiveFrame(top);

            for (var i = 0, l = input.length; i < l; i++)
                updateFrame(input[i], noRecur);

            return true;
        }
        
        function loadSources(input) {
            sources = input;
            modelSources.setRoot(sources);
        }
        
        function clearFrames() {
            setActiveFrame(null);
        }
        
        function addSource(source) {
            sources.push(source);
            modelSources.setRoot(sources);
        }
        
        function updateAll() {
            modelFrames.setRoot(frames);
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
            plugin.once("draw", draw);
        });
        plugin.on("enable", function() {
            if (drawn) {
                menu.enable();
                button.setAttribute("disabled", dbg && !dbg.features.scripts);
                datagrid.enable();
            }
        });
        plugin.on("disable", function() {
            if (drawn) {
                menu.disable();
                button.disable();
                datagrid.disable();
            }
        });
        plugin.on("unload", function() {
            loaded = false;
            drawn = false;
        });
        
        /***** Register and define API *****/
        
        /**
         * The call stack panel for the {@link debugger Cloud9 debugger}.
         * 
         * This panel allows a user to inspect the call stack and jump to the
         * different items in the stack.
         * 
         * @singleton
         * @extends DebugPanel
         **/
        plugin.freezePublicAPI({
            /**
             * When the debugger has hit a breakpoint or an exception, it breaks
             * and shows the active frame in the callstack panel. The active
             * frame represents the scope at which the debugger is stopped.
             * @property {debugger.Frame} activeFrame
             */
            get activeFrame() { return activeFrame; },
            set activeFrame(frame) { setActiveFrame(frame); },
            /**
             * A list of sources that are available from the debugger. These
             * can be files that are loaded in the runtime as well as code that
             * is injected by a script or by the runtime itself.
             * @property {debugger.Source[]} sources
             * @readonly
             */
            get sources() { return sources; },
            /**
             * A list (or stack) of frames that make up the call stack. The
             * frames are in order and the index 0 contains the frame where
             * the debugger is breaked on.
             * @property {debugger.Frame[]} frames
             * @readonly
             */
            get frames() { return frames; },
            
            /**
             * Updates all frames in the call stack UI.
             */
            updateAll: updateAll,
            
            /**
             * Updates a specific frame in the call stack UI
             * @param {debugger.Frame} frame  The frame to update.
             */
            updateFrame: updateFrame
        });
        
        register(null, {
            callstack: plugin
        });
    }
});
