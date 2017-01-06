define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "ui", "ace", "tabbehavior", "menus", "tabManager"
    ];
    main.provides = ["ace.split"];
    return main;
    
    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var ui = imports.ui;
        var ace = imports.ace;
        
        var event = require("ace/lib/event");
        var Editor = require("ace/editor").Editor;
        var Renderer = require("ace/virtual_renderer").VirtualRenderer;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var editors = [], splits = {};
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            ace.on("create", function(e) {
                if (e.editor.type != "ace")
                    return;
                
                draw();
                
                var editor = e.editor;
                var grabber;
                
                editor.once("draw", function() {
                    grabber = createGrabber(editor);
                }, plugin);
                
                editor.on("documentActivate", function(e) {
                    var doc = e.doc;
                    var session = doc.getSession();
                    var split = session.split;
                    var splitInfo = splits[doc.editor.name];
                    
                    // If we are not in split mode and the editor is not split
                    // lets do nothing.
                    if (!split && !splitInfo)
                        return;
                    
                    if (split) {
                        // Make sure we have a split inited for this editor
                        if (!splitInfo)
                            splitInfo = initSplit(editor, split.height);
                            
                        var editor2 = splitInfo.editor2;
                        
                        // Set Session
                        editor2.setSession(split.session2);
                        
                        // Set Height
                        splitInfo.topPane.setHeight(split.height);
                        
                        // Show bottom pane
                        splitInfo.topPane.show();
                        
                        // Hide Grabber
                        grabber.style.display = "none";
                    }
                    else {
                        // Hide bottom pane
                        splitInfo.topPane.hide();
                        
                        // Show Grabber
                        grabber.style.display = "block";
                    }
                });
                
                editor.on("getState", function(e) {
                    var session = e.doc.getSession();
                    var state = e.state;
                    
                    if (e.filter || !session.split) 
                        return;
                    
                    var session2 = session.split.session2;
                    
                    state.split = {
                        height: session.split.height,
                        
                        // Scroll state
                        scrolltop: session2.getScrollTop(),
                        scrollleft: session2.getScrollLeft(),
                        
                        // Selection
                        selection: session2.selection.toJSON()
                    };
                });
                
                editor.on("setState", function(e) {
                    var state = e.state.split;
                    var session = e.doc.getSession();
                    
                    if (!state)
                        return;
                    
                    var splitInfo = initSplit(editor, state.height);
                    var session2 = ace.cloneSession(session.session);
                    
                    session.split = {
                        height: state.height,
                        session2: session2
                    };
                    
                    // Set 2nd Session
                    splitInfo.editor2.setSession(session2);
                    
                    // Set selection
                    if (state.selection)
                        session2.selection.fromJSON(state.selection);
                    
                    // Set scroll state
                    if (state.scrolltop)
                        session2.setScrollTop(state.scrolltop);
                    if (state.scrollleft)
                        session2.setScrollLeft(state.scrollleft);
                    
                    if (state.options)
                        session2.setOptions(state.options);
                    
                    var grabber = editor.aml.$int.querySelector(".splitgrabber");
                    grabber.style.display = "none";
                });
                
                editor.on("resize", function(e) {
                    var splitInfo = splits[editor.name];
                    if (!splitInfo || !splitInfo.topPane.visible) return;
                    splitInfo.editor2.resize(true); // @Harutyun
                });
                
                editor.on("unload", function(e) {
                    delete splits[editor.name];
                });
            });
        }
        
        var drawn = false;
        function draw() {
            if (drawn) return;
            drawn = true;
            
            // Insert CSS
            ui.insertCss(require("text!./style.css"), plugin);
        
            emit("draw");
        }
        
        function createGrabber(editor) {
            var htmlNode = editor.ace.container.parentNode;
            var grabber = document.createElement("div");
            htmlNode.appendChild(grabber);
            grabber.className = "splitgrabber";
            grabber.innerHTML = "=";
            
            grabber.addEventListener("mousedown", function(e) {
                startSplit(e, grabber, editor);
            });
            
            plugin.addOther(function() {
                grabber.parentNode.removeChild(grabber);
            });
            
            return grabber;
        }
        
        /***** Methods *****/
        
        function startSplit(e, grabber, editor) {
            var container = grabber;
            var drag = grabber;
            
            // Set Top
            drag.style.zIndex = 1000000;
            
            var offsetY = e.clientY - (parseInt(container.style.top, 10) || 0);
            var moved = false;
            var startY = e.clientY - offsetY;
            var offset = e.offsetY;
            
            var session = editor.activeDocument.getSession();
            
            event.capture(container, function(e) {
                var y = e.clientY - offsetY;
                
                if (!moved) {
                    if (Math.abs(y - startY) > 3) {
                        moved = true;
                        var percentage = ((y - startY) / grabber.parentNode.offsetHeight) * 100;
                        session.split = {
                            height: percentage + "%",
                            session2: ace.cloneSession(session.session)
                        };
                        var splitInfo = initSplit(editor, percentage);
                        
                        // Set 2nd Session
                        splitInfo.editor2.setSession(session.split.session2);
                        
                        // Start splitter
                        splitInfo.splitbox.$handle.$ext.onmousedown({ 
                            clientY: e.clientY, 
                            offsetY: -7 + offset
                        });
                        
                        // Hide Grabber
                        grabber.style.display = "none";
                    }
                    else return;
                }
            }, function() {
                if (moved)
                    setFinalState(editor, session);
            });
            
            event.stopEvent(e);
        }
        
        function initSplit(editor, percentage) {
            if (splits[editor.name]) {
                var splitInfo = splits[editor.name];
                splitInfo.topPane.show();
                return splitInfo;
            }
            
            var container = editor.aml.$int;
            var amlNode = container.host;
            // @todo detect if this already happened
            
            var splitbox = amlNode.appendChild(new ui.vsplitbox({ 
                "class": "ace_split",
                padding: 7,
                edge: "7 0 0 0",
                splitter: true 
            }));
            
            var topPane = splitbox.appendChild(new ui.bar({ 
                height: percentage + "%" 
            }));
            var bottomPane = splitbox.appendChild(new ui.bar());
            
            // Original Editor
            bottomPane.$int.appendChild(editor.ace.container);
            editor.ace.container.style.top = "0px";
            
            // New Editor
            var editor2 = new Editor(new Renderer(topPane.$int, ace.theme));
            editors.push(editor2);
            
            splitbox.$handle.on("dragmove", function() {
                editor.resize();
                editor2.resize();
            });
            splitbox.$handle.on("dragdrop", function() {
                editor.resize();
                editor2.resize();
                
                var session = editor.activeDocument.getSession();
                setFinalState(editor, session);
            });
            ace.on("settingsUpdate", function(e) {
                editor2.setOptions(e.options);
            }, editor);
            
            function setTheme() {
                var theme = ace.theme;
                editor2.setTheme(theme.path);
                
                var node = splitbox.$ext.parentNode;
                if (theme.isDark)
                    ui.setStyleClass(node, "dark");
                else
                    ui.setStyleClass(node, "", ["dark"]);
            }
            ace.on("themeChange", setTheme, editor);
            setTheme();
            
            var lastFocused = editor2;
            editor2.on("focus", function() {
                lastFocused = editor2;
            });
            
            editor.ace.on("focus", function() {
                lastFocused = null;
            });
            
            editor.on("getAce", function() {
                if (lastFocused)
                    return editor2;
            });
            
            editor.addEditor(editor2);
            
            splits[editor.name] = {
                splitbox: splitbox,
                topPane: topPane,
                bottomPane: bottomPane,
                editor: editor,
                editor2: editor2
            };
            
            return splits[editor.name];
        }
        
        function setFinalState(editor, session) {
            var splitInfo = splits[editor.name];
            var pixelHeight = splitInfo.topPane.getHeight();
            
            var grabber = editor.aml.$int.querySelector(".splitgrabber");
            
            if (pixelHeight < 3) {
                // Remove the split
                splitInfo.topPane.hide();
                delete session.split;
                
                // Show Grabber
                grabber.style.display = "block";
            }
            else {
                // Record the height
                session.split.height = splitInfo.topPane.height;
                
                // Hide Grabber
                grabber.style.display = "none";
            }
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
            drawn = false;
        });
        
        /***** Register and define API *****/
        
        /**
         * 
         **/
        plugin.freezePublicAPI({
            _events: [
                /**
                 * @event draw
                 */
                "draw"
            ]
        });
        
        register(null, {
            "ace.split": plugin
        });
    }
});