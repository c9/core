define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "ui", "debugger", "immediate.debugnode", "language", 
        "tabManager", "callstack", "ace"
    ];
    main.provides = ["liveinspect"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var ui = imports.ui;
        var ace = imports.ace;
        var language = imports.language;
        var debug = imports.debugger;
        var tabManager = imports.tabManager;
        var callstack = imports.callstack;
        var evaluator = imports["immediate.debugnode"];
        
        // postfix plugin because debugger is restricted keyword
        var Range = require("ace/range").Range;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var activeTimeout = null;
        var windowHtml = null;
        var currentExpression = null;
        var currentTab = null;
        var marker = null;
        var evalCounter = 0;
        
        var SHOW_TIMEOUT = 350;
        
        var isContextMenuVisible = false;
        var dbg, worker, theme;
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            // Set and clear the dbg variable
            debug.on("attach", function(e) {
                dbg = e.implementation;
            });
            debug.on("detach", function(e) {
                dbg = null;
            });
            debug.on("stateChange", function(e) {
                plugin[e.action]();
            });
            
            // Hook into the language worker
            language.once("initWorker", function(e) {
                worker = e.worker;
                
                // listen to the worker's response
                worker.on("inspect", function(event) {
                    if (!event || !event.data) {
                        return hide();
                    }
    
                    // create an expression that the debugger understands
                    if (event.data.value) {
                        liveWatch(event.data);
                    }
                });
            }, plugin);
    
            // bind mouse events to all open editors
            ace.on("create", function(e) {
                var editor = e.editor;
                var ace = editor.ace;

                ace.on("mousemove", function(e) {
                    onEditorMouseMove(e, editor.pane);
                });
                ace.on("mousedown", onEditorClick);
                ace.on("changeSelection", onEditorClick);
                ace.on("mousewheel", onEditorClick);
            }, plugin);
            
            ace.on("themeChange", function(e) {
                theme = e.theme;
                if (!theme || !drawn) return;
                
                windowHtml.className = "liveinspect immediate "
                    + (theme.isDark ? "dark" : "");
                windowHtml.firstChild.className = (theme.isDark ? "ace_dark" : "");
            }, plugin);
        }
        
        var drawn = false;
        function draw() {
            if (drawn) return;
            drawn = true;
            
            // Create UI elements
            windowHtml = document.body.appendChild(document.createElement("div"));
            
            // get respective HTML elements
            windowHtml.style.position = "absolute";
            windowHtml.className = "liveinspect immediate "
                + (!theme || theme.isDark ? "dark" : "");
            windowHtml.innerHTML = "<div class='" 
                + (!theme || theme.isDark ? "ace_dark" : "") 
                + "'></div>";
            
            ace.getElement("menu", function(menu) {
                menu.on("prop.visible", function(e) {
                    isContextMenuVisible = e.value;
                });
            });
            
            // when hovering over the inspector window we should ignore all further listeners
            windowHtml.addEventListener("mousemove", function() {
                if (activeTimeout) {
                    clearTimeout(activeTimeout);
                    activeTimeout = null;
                }
            });
    
            // we should track mouse movement over the whole window
            apf.addListener(document, "mousemove", onDocumentMouseMove);
        
            emit("draw");
        }
        
        /***** Methods *****/
        
        /**
         * Determine whether the current file is the current frame where the
         * debugger is in.
         */
        function isCurrentFrame(pane) {
            var frame = callstack.activeFrame;
            var tab = frame && (tab = tabManager.findTab(frame.path)) 
                && pane.activeTab == tab;
            if (!tab)
                return false;
    
            // @todo check if we are still in the current function
            // var line = frame.getAttribute("line");
            // var column = frame.getAttribute("column");
    
            return true;
        }
    
        /**
         * onMouseMove handler that is being used to show / hide the inline quick watch
         */
        function onEditorMouseMove (ev, pane) {
            if (activeTimeout) {
                clearTimeout(activeTimeout);
                activeTimeout = null;
            }
    
            if (!dbg || dbg.state != 'stopped' || isContextMenuVisible)
                return;
                
            activeTimeout = setTimeout(function () {
                activeTimeout = null;
                
                if (!isCurrentFrame(pane))
                    return hide();

                var pos = ev.getDocumentPosition();
                var line = ev.editor.session.getLine(pos.row);
                if (pos.column == line.length || pos.column < line.search(/\S/))
                    return hide();
                    
                if (!ev.editor.selection.isEmpty()) {
                    var range = ev.editor.getSelectionRange();
                    var selectionVisible = range.end.row > ev.editor.getFirstVisibleRow()
                        && range.start.row < ev.editor.getLastVisibleRow();
                    if (!selectionVisible)
                        return hide();
                }

                worker.emit("inspect", { data: { row: pos.row, column: pos.column }});

                // hide it, and set left / top so it gets positioned right when showing again
                if (!marker || !marker.range.contains(pos.row, pos.column))
                    hide();
                
                draw();
            }, SHOW_TIMEOUT);
        }
    
        /**
         * onDocumentMove handler to clear the timeout
         */
        function onDocumentMouseMove (ev) {
            if (!activeTimeout || !currentTab)
                return;
    
            // see whether we hover over the editor or the quickwatch window
            var mouseMoveAllowed = false;
    
            var eles = [ currentTab.editor.ace.renderer.scroller, windowHtml ];
            // only the visible ones
            eles.filter(function (ele) { return ele.offsetWidth || ele.offsetHeight; })
                .forEach(function (ele) {
                    // then detect real position
                    var pos = ele.getBoundingClientRect();
                    var left = pos.left;
                    var top = pos.top;
    
                    // x boundaries
                    if (ev.pageX >= left && ev.pageX <= (left + ele.offsetWidth)) {
                        // y boundaries
                        if (ev.pageY >= top && ev.pageY <= (top + ele.offsetHeight)) {
                            // we are in the editor, so return; this will be handled
                            mouseMoveAllowed = true;
                        }
                    }
                });
    
            if (mouseMoveAllowed) return;
    
            clearTimeout(activeTimeout);
            activeTimeout = windowHtml.style.display == "block" 
                ? setTimeout(hide, 400) : null;
        }
    
        /**
         * When clicking in the editor window, hide live inspect
         */
        function onEditorClick() {
            hide();
        }
    
        /**
         * Execute live watching
         */
        function liveWatch(data) {
            if (!dbg) return;
            
            var expr = data.value;
            // already visible, and same expression?
            if (windowHtml && windowHtml.style.display == "block" 
              && expr === currentExpression)
                return;

            // if there is any modal window open, then don't show
            var windows = getNumericProperties(document.querySelectorAll(".winadv") || {})
                .filter(function (w) {
                    return w.style.display !== "none" && w.style.visibility !== "hidden";
                });
                
            if (windows.length)
                return;
            
            // Filter functions, literals
            if (data.value.match(/^function(?: |\()|^[\d\.\-\^]+$|^\".*\"$|^\[.*\]$|^\{.*\}$|^\/.*\/$/))
                return;
            
            // if context menu open, then also disable
            // if (mnuCtxEditor && mnuCtxEditor.visible) {
            //     return;
            // }
            
            // show spinner while evaluating
            windowHtml.firstChild.innerHTML = '<div class="session_btn running" style="margin:0">'
                + '<strong style="left:18px"></strong></div>';
            done();
            
            if (!marker)
                return;
            
            dbg.on("break", updateOnBreak, plugin);
            
            marker.data = data;
            
            var evalId = ++evalCounter;
    
            // evaluate the expression in the debugger, and receive model as callback
            evaluator.evaluate(expr, {
                addWidget: function(state) {
                    windowHtml.firstChild.innerHTML = "";
                    windowHtml.firstChild.appendChild(state.el);
                },
                session: { repl: { onWidgetChanged: function() {
                    
                } }},
                setError: function(err) {
                    windowHtml.firstChild.innerHTML = '<span class="error"><span>';
                    windowHtml.querySelector(".error").textContent =
                        err && err.message || "error";
                },
                setWaiting: function(show) {
                    if (!show)
                        done();
                }
            }, function() {
                if (marker && evalId === evalCounter)
                    done();
            });
            
            function done() {
                // store it
                currentExpression = expr;
    
                var tab = tabManager.findTab(data.path);
                if (!tab || !tab.isActive()) 
                    return hide();
                
                currentTab = tab;
                    
                addMarker(data);
                
                var pos = data.pos;
                var ace = tab.document.editor.ace;
                var coords = ace.renderer.textToScreenCoordinates(pos.sl, pos.sc);
                
                windowHtml.style.maxWidth = Math.min(800, window.innerWidth 
                    - coords.pageX - 30) + "px";
                windowHtml.style.maxHeight = Math.min(250, window.innerHeight 
                    - coords.pageY - ace.renderer.lineHeight - 10) + "px";
                windowHtml.style.left = coords.pageX + "px";
                windowHtml.style.top = (coords.pageY + ace.renderer.lineHeight) + "px";
    
                // show window
                windowHtml.style.display = "block";
            }
        }
    
        function hide() {
            if (windowHtml)
                windowHtml.style.display = "none";
            
            if (marker) {
                marker.session.removeMarker(marker.id);
                marker = null;
            }
            
            if (activeTimeout)
                activeTimeout = clearTimeout(activeTimeout);
            
            if (dbg)
                dbg.off("break", updateOnBreak);
        }
    
        function addMarker(data) {
            if (marker)
                marker.session.removeMarker(marker.id);
    
            var tab = tabManager.findTab(data.path);
            var doc = tab && tab.document;
            if (!doc)
                return;
            
            var pos = data.pos;
            var session = doc.getSession().session;
            
            if (pos.el != pos.sl && data.value.indexOf("\n") == -1) {
                pos.el = pos.sl;
                pos.ec = session.getLine(pos.sl).length;
            }
            
            var range = new Range(pos.sl, pos.sc, pos.el, pos.ec);
            marker = {
                id: session.addMarker(range, "ace_bracket ace_highlight", "text", true),
                session: session,
                range: range,
                data: data
            };
        }
    
        function getNumericProperties(obj) {
            return Object.keys(obj)
                .filter(function (k) { return !isNaN(k); })
                .map(function (k) { return obj[k]; });
        }
        
        function updateOnBreak() {
            currentExpression = null;
            if (marker && dbg) {
                dbg.off("break", updateOnBreak);
                if (marker.data)
                    liveWatch(marker.data);
            }
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("enable", function() {
            
        });
        plugin.on("disable", function() {
            hide();
        });
        plugin.on("unload", function() {
            loaded = false;
            drawn = false;
        });
        
        /***** Register and define API *****/
        
        /**
         * 
         **/
        plugin.freezePublicAPI({
        });
        
        register(null, {
            liveinspect: plugin
        });
    }
});