define(function(require, exports, module) {
    main.consumes = [
        "Editor", "editors", "commands", "menus", "layout", "util",
        "settings", "ui", "proc", "c9", "preferences", "tabManager",
        "dialog.error", "dialog.question", "dialog.alert", "installer"
    ];
    main.provides = ["terminal"];
    return main;

    function main(options, imports, register) {
        var c9 = imports.c9;
        var Editor = imports.Editor;
        var editors = imports.editors;
        var layout = imports.layout;
        var proc = imports.proc;
        var util = imports.util;
        var ui = imports.ui;
        var commands = imports.commands;
        var prefs = imports.preferences;
        var menus = imports.menus;
        var tabs = imports.tabManager;
        var settings = imports.settings;
        var installer = imports.installer;
        var question = imports["dialog.question"];
        var showError = imports["dialog.error"].show;
        var hideError = imports["dialog.error"].hide;
        var alert = imports["dialog.alert"];

        // Disabled: bad performance, openshift specific, possibly unreliable
        // var Monitor = require("./monitor.js");
        var markup = require("text!./terminal.xml");
        var markupMenu = require("text!./menu.xml");
        var Aceterm = require("./aceterm/aceterm");
        var libterm = require("./aceterm/libterm");
        
        // Needed to clear ace
        var EditSession = require("ace/edit_session").EditSession;
        var dummySession = new EditSession("");
        
        var extensions = [];
        
        // Set up the generic handle
        var handle = editors.register("terminal", "Terminal", 
                                       Terminal, extensions);
        var handleEmit = handle.getEmitter();
        handleEmit.setMaxListeners(1000);

        var TMUX = options.tmux || "~/.c9/bin/tmux";
        var VFSROOT = options.root || "~";
        var TMPDIR = options.tmpdir;
        
        var tmuxConnection = require("./tmux_connection")(c9, proc, 
            options.installPath, options.shell);
        var mnuTerminal;
        var lastEditor;
        var lastTerminal;
        var shownDotsHelp;
        var installPrompted;
        
        var defaults = {
            "flat-light" : ["#eaf0f7", "#000000", "#bed1e3", false], 
            "flat-dark"  : ["#153649", "#FFFFFF", "#515D77", true],
            "light" : ["rgb(248, 248, 231)", "#000000", "rgb(137, 193, 253)", false], 
            "light-gray" : ["rgb(248, 248, 231)", "#000000", "rgb(137, 193, 253)", false], 
            "dark"  : ["#153649", "#FFFFFF", "#515D77", true],
            "dark-gray"  : ["#153649", "#FFFFFF", "#515D77", true]
        };

        var themeName;
        if (options.defaults) {
            for (themeName in options.defaults) {
                defaults[themeName] = options.defaults[themeName];
            }
        }
                
        // Import the CSS
        ui.insertCss(require("text!./style.css"), options.staticPrefix, handle);
        
        handle.on("load", function(){
            commands.addCommand({
                name: "openterminal",
                group: "Terminal",
                hint: "Opens a new terminal window",
                msg: "opening terminal.",
                bindKey: { mac: "Option-T", win: "Alt-T" },
                exec: function (editor) {
                    var pane = tabs.focussedTab && tabs.focussedTab.pane;
                    if (tabs.getTabs(tabs.container).length === 0)
                        pane = null;
                    
                    tabs.open({
                        editorType: "terminal", 
                        focus: true,
                        pane: pane
                    }, function(){});
                }
            }, handle);
            
            commands.addCommand({
                name: "switchterminal",
                group: "Terminal",
                hint: "Switch between Editor and Terminal",
                msg: "switching.",
                bindKey: { mac: "Option-S", win: "Alt-S" },
                isAvailable: function() {
                    return tabs.focussedTab;
                },
                exec: function (editor) {
                    if (!tabs.focussedTab)
                        return;
                    if (tabs.focussedTab.editorType !== "terminal")
                        lastTerminal && tabs.focusTab(lastTerminal);
                    else
                        lastEditor && tabs.focusTab(lastEditor);
                }
            }, handle);
            
            commands.addCommand({
                name: "clearterm",
                group: "Terminal",
                hint: "Clears the terminal buffer",
                isAvailable: function(editor) {
                    return editor && editor.type == "terminal";
                },
                exec: function (editor) {
                    tabs.focussedTab.editor.clear();
                }
            }, handle);
            
            var meta = '\x1b';
            [
                ["close_term_pane", "x", "x"],
                ["split_term_pane", '"', '"'],
                ["layout_term_hor_even", "Meta-1", meta + "1"],
                ["layout_term_ver_even", "Meta-2", meta + "2"],
                ["layout_term_hor_main", "Meta-3", meta + "3"],
                ["layout_term_ver_main", "Meta-4", meta + "4"],
                ["move_term_paneup", "Up", '\x1b[A'],
                ["move_term_panedown", "Down", '\x1b[B'],
                ["move_term_paneright", "Right", '\x1b[C'],
                ["move_term_paneleft", "Left", '\x1b[D'],
                ["term_help", "?", '?'],
                ["term_restart", "", ":kill-server\r"],
                ["term_detach", "", ":detach -a\r"],
                ["toggle_term_status", "", ":set-option status on\r"]
            ].forEach(function(iter) {
                commands.addCommand({
                    name: iter[0],
                    group: "Terminal",
                    bindKey: {
                        mac: "", //Ctrl-B " + iter[1].replace(/Meta/, "Command"), 
                        win: "" //Ctrl-B " + iter[1]
                    },
                    isAvailable: function(editor, e) {
                        var type = editor && editor.type;
                        return (type == "terminal" || type == "output") && e.source == "click";
                    },
                    exec: function (editor) {
                        if (iter[0] == "toggle_term_status") {
                            var session = editor.activeDocument.getSession();
                            session.status = !(session.status || 0);
                            editor.write(String.fromCharCode(2) 
                                + iter[2].replace(/on\r/, 
                                    session.status ? "on\r" : "off\r"));
                        }
                        else {
                            editor.write(String.fromCharCode(2) + iter[2]);
                        }
                    }
                }, handle);
            });
            
            var menu = tabs.getElement("mnuEditors");
            var ctxItem = menus.addItemToMenu(menu, 
                new ui.item({
                    caption: "New Terminal",
                    hotkey: "{commands.commandManager.openterminal}",
                    onclick: function(e) {
                        tabs.open({
                            active: true,
                            pane: this.parentNode.pane,
                            editorType: "terminal"
                        }, function(){});
                    }
                }), 200, handle);

            menus.addItemByPath("Window/New Terminal", new ui.item({
                command: "openterminal"
            }), 30, handle);

            menus.addItemByPath("Window/Navigation/~", new ui.divider(), 1500, handle);
            menus.addItemByPath("Window/Navigation/Switch Between Editor and Terminal", new ui.item({
                command: "switchterminal"
            }), 1550, handle);
            
            function setSettings(){
                libterm.cursorBlink = settings.getBool("user/terminal/@blinking");
                libterm.scrollback = 
                    settings.getNumber("user/terminal/@scrollback") || 1000;
                
                var cname = ".c9terminal .c9terminalcontainer .terminal";
                var sname = ".c9terminal .c9terminalcontainer";
                var fsize = settings.getNumber("user/terminal/@fontsize");
                var fstyle = settings.getBool("user/terminal/@antialiasedfonts");
                var fcolor = settings.get("user/terminal/@foregroundColor");
                var bcolor = settings.get("user/terminal/@backgroundColor");
                var scolor = settings.get("user/terminal/@selectionColor");
                [
                    [cname, "fontFamily", settings.get("user/terminal/@fontfamily")
                        || "Ubuntu Mono, Menlo, Consolas, monospace"],
                    [cname, "fontSize", fsize ? fsize + "px" : "10px"],
                    [cname, "WebkitFontSmoothing", fstyle ? "antialiased" : "auto"],
                    [cname, "MozOSXFontSmoothing", fstyle ? "grayscale" : "auto"],
                    [cname, "color", fcolor || "rgb(255,255,255)"],
                    [sname, "backgroundColor", bcolor || "rgb(25, 34, 39)"],
                    [cname + " .ace_selection", "backgroundColor", scolor || "rgb(81, 93, 119)"]
                ].forEach(function(i) {
                    ui.setStyleRule(i[0], i[1], i[2]);
                });
                
                // Small hack until we have terminal themes
                var colors;
                if (bcolor == "#eaf0f7") {
                    colors = [
                      // dark:
                      '#eaf0f7', // background wrong link
                      '#cc0000',
                      '#4e9a06',
                      '#c4a000',
                      '#3465a4',
                      '#75507b',
                      '#06989a',
                      '#d3d7cf',
                      // bright:
                      '#555753', // grey
                      '#ef2929', // red
                      '#579818', // green
                      '#C3A613', // yellow
                      '#5183B8', // blue
                      '#ad7fa8', // purple
                      '#20C7C7', // mint
                      '#BBBBBB' // light grey
                    ];
                }
                
                libterm.setColors(fcolor, bcolor, colors);
                
                handleEmit("settingsUpdate");
            }
            
            // Terminal
            
            settings.on("read", function(e) {
                var skin = settings.get("user/general/@skin");
                var colors = defaults[skin] || defaults["dark"];
                
                settings.setDefaults("user/terminal", [
                    ["backgroundColor", colors[0]],
                    ["foregroundColor", colors[1]],
                    ["selectionColor", colors[2]],
                    ["antialiasedfonts", colors[3]],
                    ["fontfamily", "Ubuntu Mono, Menlo, Consolas, monospace"], // Monaco, 
                    ["fontsize", "12"],
                    ["blinking", "false"],
                    ["scrollback", 1000]
                ]);
                
                setSettings();
            }, handle);

            settings.on("user/terminal", setSettings);
            
            layout.on("themeChange", function(e) {
                setSettings();
                
                var skin = e.oldTheme;
                if (!(settings.get("user/terminal/@backgroundColor") == defaults[skin][0] &&
                  settings.get("user/terminal/@foregroundColor") == defaults[skin][1] &&
                  settings.get("user/terminal/@selectionColor") == defaults[skin][2] &&
                  settings.get("user/terminal/@antialiasedfonts") == defaults[skin][3]))
                    return false;
            });
            
            layout.on("themeDefaults", function(e) {
                var skin = e.theme;
                settings.set("user/terminal/@backgroundColor", defaults[skin][0]);
                settings.set("user/terminal/@foregroundColor", defaults[skin][1]);
                settings.set("user/terminal/@selectionColor", defaults[skin][2]);
                settings.set("user/terminal/@antialiasedfonts", defaults[skin][3]);
            }, handle);
    
            // Settings UI
            
            prefs.add({
                "Editors" : {
                    "Terminal" : {
                        position: 100,
                        "Text Color" : {
                           type: "colorbox",
                           path: "user/terminal/@foregroundColor",
                           position: 10100
                        },
                        "Background Color" : {
                           type: "colorbox",
                           path: "user/terminal/@backgroundColor",
                           position: 10200
                        },
                        "Selection Color" : {
                           type: "colorbox",
                           path: "user/terminal/@selectionColor",
                           position: 10250
                        },
                        "Font Family" : {
                           type: "textbox",
                           path: "user/terminal/@fontfamily",
                           position: 10300
                        },
                        "Font Size" : {
                           type: "spinner",
                           path: "user/terminal/@fontsize",
                           min: "1",
                           max: "72",
                           position: 11000
                        },
                        "Antialiased Fonts" : {
                           type: "checkbox",
                           path: "user/terminal/@antialiasedfonts",
                           position: 12000
                        },
                        "Blinking Cursor" : {
                           type: "checkbox",
                           path: "user/terminal/@blinking",
                           position: 12000
                        },
                        "Scrollback" : {
                           type: "spinner",
                           path: "user/terminal/@scrollback",
                           min: "1",
                           max: "100000",
                           position: 13000
                        }
                    }
                }
            }, handle);
            
            // Offline
            c9.on("stateChange", function(e) {
                // Online
                if (e.state & c9.NETWORK) {
                    ctxItem && ctxItem.enable();
                    ui.setStyleRule(".terminal .ace_content", "opacity", "");
                }
                // Offline
                else {
                    ctxItem && ctxItem.disable();
                    ui.setStyleRule(".terminal .ace_content", "opacity", "0.5");
                }
            });
        });
        handle.on("unload", function(){
            mnuTerminal = null;
            lastEditor = null;
            lastTerminal = null;
            shownDotsHelp = null;
            installPrompted = null;
        });
        
        handle.draw = function(){
            ui.insertMarkup(null, markupMenu, handle);
            mnuTerminal = handle.getElement("mnuTerminal");
            
            if (c9.platform == "win32") {
                var nodes = mnuTerminal.childNodes;
                while (nodes[6]) {
                    mnuTerminal.removeChild(nodes[6]);
                }
            }
            
            handle.draw = function(){};
        };
        
        handle.Terminal = Terminal;
        handle.VFSROOT = VFSROOT;
        
        var counter = 0;
        
        /***** Initialization *****/
        
        function Terminal(isOutputTerminal) {
            var plugin = new Editor("Ajax.org", main.consumes, extensions);
            var emit = plugin.getEmitter();
            
            var container, barTerminal, currentSession, currentDocument, aceterm;
            
            plugin.on("draw", function(e) {
                // Create UI elements
                ui.insertMarkup(e.tab, markup, plugin);
                barTerminal = plugin.getElement("barTerminal");
                
                // Draw menu
                handle.draw();
                
                // Set context menu
                barTerminal.setAttribute("contextmenu", mnuTerminal);
                
                // Fetch Reference to the HTML Element
                container = barTerminal.firstChild.$ext;
                
                // todo do we need barTerminal or e.htmlNode
                aceterm = Aceterm.createEditor(null, "ace/theme/idle_fingers");
                aceterm.container.style.position = "absolute";
                aceterm.container.style.left = "0px";
                aceterm.container.style.right = "0px";
                aceterm.container.style.top = "0px";
                aceterm.container.style.bottom = "0px";
                // e.htmlNode
                container.appendChild(aceterm.container);
                
                aceterm.on("focus", function() {
                    barTerminal.setAttribute("class", "c9terminal c9terminalFocus");
                });
                aceterm.on("blur", function() {
                    barTerminal.setAttribute("class", "c9terminal");
                });
                
                handle.on("settingsUpdate", function(){
                    aceterm.renderer.updateFull();
                }, plugin);
                
                var cm = commands;
                // TODO find better way for terminal and ace commands to coexist
                aceterm.commands.addCommands(cm.getExceptionList());
                cm.on("update", function() {
                    aceterm.commands.addCommands(cm.getExceptionList());
                }, plugin);
                
                aceterm.commands.exec = function(command) {
                    return cm.exec(command);
                };
                
                plugin.on("unload", function(){
                    aceterm.destroy();
                    container.innerHTML = "";
                    
                    aceterm = null;
                    container = null;
                });
                
                aceterm.on("focus", function(){
                    if (currentSession && !currentSession.connected && currentSession.reconnect)
                        currentSession.reconnect();
                });
                
                handleEmit.sticky("create", { editor: plugin }, plugin);
            });
            
            /***** Methods *****/
            
            function write(data) {
                if (currentSession) {
                    if (currentSession.connected)
                        currentSession.pty.write(data);
                    else {
                        var session = currentSession;
                        plugin.on("connect", function wait(e) {
                            if (e.tab == session.tab) {
                                currentSession.pty.write(data);
                                plugin.off("connect", wait);
                            }
                        });
                    }
                }
            }
            
            function focus(){
                if (aceterm)
                    aceterm.focus();
            }
            
            function blur(){
                // var cursor = barTerminal.$ext.querySelector(".terminal .reverse-video");
                // if (cursor && settings.getBool("user/terminal/blinking"))
                //     cursor.parentNode.removeChild(cursor);
                barTerminal.setAttribute("class", "c9terminal");
                if (aceterm)
                    aceterm.blur();
            }
            
            var afterAnim;
            function resize(e) {
                var renderer = aceterm && aceterm.renderer;
                if (!renderer || !currentDocument) return;
                
                if (e.type == "anim") {
                    var htmlNode = aceterm.container;
                    if (!htmlNode)
                        return;
                    
                    if (e.vertical) {
                        var size = e.current === 0
                          ? Math.abs(e.delta) - 5
                            - currentDocument.tab.pane.aml.$buttons.offsetHeight
                          : htmlNode.offsetHeight + e.delta;
                        
                        renderer.onResize(false, null, null, size);
                    }
                    else {
                        renderer.onResize(false, null, 
                            htmlNode.offsetWidth + e.delta);
                    }
                    afterAnim = true;
                }
                else if (e.type == "afteranim" && afterAnim) {
                    afterAnim = false;
                } else {
                    afterAnim = false;
                    renderer.$updateSizeAsync();
                }
            }
            
            function updateCover(aceSession, add) {
                if (aceSession.updatingStatus) return;
                if (!add) {
                    if (!aceSession.term.tmuxDotCover) return;
                    var x = aceSession.term.tmuxDotCover.width;
                    var y = aceSession.term.tmuxDotCover.height;
                    if (isEmpty(aceSession.term, x, y)) return;
                }
                
                
                aceSession.updatingStatus = true;
                aceSession.c9session.getStatus({clients:true}, function(e, s) {
                    aceSession.updatingStatus = false;
                    if (e) return console.warn(e);
                    
                    var term = aceSession.term;
                    add = term.rows > s.height || term.cols > s.width;
                    setCover(aceSession, add);
                    
                    if (aceSession.term.tmuxDotCover) {
                        aceSession.term.tmuxDotCover.width = s.width;
                        aceSession.term.tmuxDotCover.height = s.height;
                        aceSession._signal("changeFrontMarker");
                    }
                });
            }
            
            function showTmuxDotsHelp(e) {
                if (settings.getBool("user/terminal/@collab") || shownDotsHelp)
                    return;
                
                var aceSession = e && e.editor && e.editor.session.term;
                if (aceSession && !aceSession.tmuxDotCover)
                    return;
                
                shownDotsHelp = true;
                    
                alert.show("Collaborative Terminal",
                  "Your Terminal is in Collaborative mode",
                  "When you Share your workspace with others, they can use your "
                    + "Terminal as well.\n\n"
                    + "Some side-effects are that the terminal view will only be as "
                    + "large as the smallest view of all collaborators. The rest "
                    + "of the space is unavailable. Also, you can’t scroll back "
                    + "the history. \n\n"
                    + "(note that this can also happen when the workspace is open "
                    + "in another window; to resolve this, right click on the "
                    + "terminal and choose ‘detach other clients’)",
                  function(){ // Hide
                      settings.set("user/terminal/@collab", alert.dontShow);
                  }, {
                      showDontShow: true
                  });
            }
            
            function isEmpty(term, x, y) {
                if (x >= term.cols || y >= term.rows) return false;
                var lines = term.lines;
                for (var i = term.ybase; i < lines.length; i++) {
                    if (!lines[i]) continue;
                    for (var j = term.ybase; j < lines.length; j++) {
                        if (lines[i][j] && lines[i][j][1])
                            return false;
                    }
                }
                return true;
            }
            
            function setCover(aceSession, add) {
                if (Boolean(aceSession.term.tmuxDotCover) === Boolean(add))
                    return;
                
                aceSession.setScrollTop(Number.MAX_VALUE);
                if (aceSession.term.tmuxDotCover) {
                    aceSession.removeMarker(aceSession.term.tmuxDotCover.id);
                    aceSession.term.tmuxDotCover = null;
                    return;
                }
                
                var marker = {};
                marker.update = function(html, markerLayer, session, config) {
                    if (!this.width || !this.height || !session.term) return;
                    var rows = session.term.rows;
                    var cols = session.term.cols;
                    var coverHeight = config.lineHeight * (rows - this.height);
                    
                    var screenBottom = config.height - coverHeight + config.offset + 2;
                    var screenRight = (cols - this.width) * config.characterWidth;
                    
                    html.push("<div style='height:", coverHeight, "px;", "left:0; right: ", screenRight, "px; top:",  screenBottom, "px;' ", 
                            "class='c9terminalcontainer cover bottom'></div>",
                        "<div style='width:", screenRight, "px; height: ", screenBottom, "px; top:0; right:0;' ",
                            "class='c9terminalcontainer cover right'></div>",
                        "<div style='width:", screenRight, "px; bottom:0; top:", screenBottom, "px; right:0;' ",
                            "class='c9terminalcontainer cover'></div>"
                    );
                };
                aceSession.addDynamicMarker(marker, true);
                aceSession.term.tmuxDotCover = marker;
                if (aceSession.ace)
                    aceSession.ace.on("click", showTmuxDotsHelp);
            }
            function isTmuxBorderChar(x){ return !x || x[1] && "\xb7\u2500\u2502\u2518".indexOf(x[1]) != -1 }
            function clearTmuxBorders(terminal) {
                var trimmed = false;
                var lines = terminal.lines;
                for (var i = Math.max(0, terminal.ybase - 4); i < lines.length; i++) {
                    var line = terminal.lines[i];
                    if (line) {
                        var col = Math.min(line.length, terminal.cols) - 1;
                        while (col >= 0 && isTmuxBorderChar(line[col])) {
                            if (line[col]) line[col][1] = '';
                            col--;
                            trimmed = true;
                        }
                    }
                }
                updateCover(terminal.aceSession, trimmed);
            }
            function loadHistory(session) {
                if (session.terminal.tmuxDotCover)
                    return;
                    
                session.getOutputHistory({}, function(e, data) {
                    if (!e && data) {
                        session.terminal.setOutputHistory(data, true);
                        session.getStatus({clients: true}, function(e, status) {
                            if (e) return;
                            if (status.clients && status.clients.length > 0) {
                                var terminal = session.terminal;
                                var rows = terminal.rows;
                                var cols = terminal.cols;
                                session.terminal.resize(status.width, status.height);
                                updateCover(session.terminal.aceSession);
                                
                                terminal.cols = cols;
                                while (terminal.rows < rows) {
                                    terminal.lines.push(terminal.blankLine());
                                    terminal.rows++;
                                }
                                terminal.rows = rows;
                            }
                        });
                    }
                });
            }
            
            function createTerminal(session, state) {
                var queue = "";
                var warned = false;
                var timer = null;
                var initialConnect = true;

                function send(data) {
                    if (!(c9.status & c9.NETWORK))
                        return warnConnection();
                    
                    emit("input", { data: data, session: session });
                    queue += data;
                    
                    if (!timer) {
                        timer = setTimeout(function() {
                            timer = null;
                            if (!session.connected)
                                return initialConnect || warnConnection();
                            // Send data to stdin of tmux process
                            session.pty.write(queue);
                            queue = "";
                        }, 1);
                    }
                }
                
                function warnConnection() {
                    if (warned)
                        return;
                    warned = true;
                    var error = showError("Terminal was disconnected. Trying to reconnect");
                    if (!session.connecting && session.reconnect)
                        session.reconnect();
                    session.once("connected", function() {
                        hideError(error);
                        warned = false;
                    });
                }
                
                // Create the terminal renderer and monitor
                var terminal = new Aceterm(0, 0, send);
                
                session.terminal = terminal;
                session.monitor = terminal.monitor;
                session.aceSession = terminal.aceSession;
                session.aceSession.c9session = session;
            
                session.send = send;
            
                // Add method to write to terminal
                session.write = function(data) {
                    var handled = emit("beforeWrite", { data: data, session: session });
                    if (!handled)
                        session.terminal.write(data);
                    emit("afterWrite", { data: data, session: session });
                };
                
                // Create a container and initialize the terminal in it.
                session.attach();
                
                // Update the terminal title
                terminal.on("title", function(title) {
                    emit("title", { title: title });
                    if (!session.output) {
                        session.doc.title = 
                        session.doc.tooltip = title.replace(/^.+?:\d+:/, "");
                    }
                });
                session.aceSession.resize = session.resize.bind(session);
                
                // delay a little until we have correct size
                aceterm.renderer.once("afterRender", function start(){
                    if (session.resize() === false)
                        return aceterm.renderer.once("afterRender", start);
                    // Lets get our TMUX process
                    tmuxConnection.init(session, function(err, session) {
                        if (err)
                            emit("connectError", { error: err });
                        else {
                            emit("connect", { 
                                id: session.id, 
                                tab: session.tab 
                            });
                            loadHistory(session);
                            initialConnect = false;
                            if (queue) {
                                session.pty.write(queue);
                                queue = "";
                            }
                        }
                    });
                });
                
                // hack to deal with dotted borders drawn by tmux
                terminal.on("afterWrite", function() {
                    clearTmuxBorders(terminal);
                });
                
                session.getEmitter().sticky("terminalReady", session);
            }
            
            /***** Lifecycle *****/
            
            plugin.on("documentLoad", function(e) {
                var doc = e.doc;
                var session = doc.getSession();
                
                session.__defineGetter__("tab", function(){ return doc.tab });
                session.__defineGetter__("doc", function(){ return doc });
                session.__defineGetter__("defaultEditor", function(){ 
                    return settings.getBool("user/terminal/@defaultEnvEditor");
                });
                
                session.attach = function(){
                    if (session.aceSession && aceterm) {
                        aceterm.setSession(session.aceSession);
                        aceterm.container.style.display = "block";
                    }
                    else
                        aceterm.container.style.display = "none";
                };
                
                session.detach = function(){
                    // if (session.aceSession)
                    //     aceterm.setSession(session.aceSession);
                };
                
                session.kill = function(){
                    tmuxConnection.kill(this);
                };
                
                session.warn = function(err){
                    if (err.code == "EINSTALL" && !installPrompted) {
                        installPrompted = true;
                        question.show("Wrong version of dependencies installed",
                            err.message,
                            "Cloud9 detected you have unsupported version of a dependency "
                              + "installed. Would you like to open the installer "
                              + "to update to the latest version?",
                            function(){ // Yes
                                installer.reinstall("Cloud9 IDE");
                            },
                            function(){ // No
                                // Do nothing
                            },
                            {
                                yes: "Update",
                                no: "Not now",
                            });
                    }
                }
                
                session.setState = function(state) {
                    if (!plugin.loaded)
                        return;
                    
                    if (session == currentSession) {
                        var el = container.querySelector(".ace_content");
                        el.style.opacity = state == "connected" ? "" : "0.5";
                    }
                    
                    if (state == "connecting") {
                        session.tab.classList.add("connecting");
                    }
                    else if (state == "error" || state == "killed") {
                        doc.tab.classList.add("error");
                    }
                    else {
                        doc.tab.classList.remove("error");
                        session.tab.classList.remove("connecting");
                    }
                };
                
                var sizeChanged = null;
                var waitForServer = null;
                session.setSize = function(size) {
                    if (size) {
                        clearTimeout(waitForServer);
                        waitForServer = null;
                        var term = this.terminal;
                        term.setSize(size.cols, size.rows);
                        term.$resizeMessageT = Date.now();
                        
                        term.$resizeDelay = (term.$resizeMessageT - term.$resizeMessageSentT) || 0;
                        
                        if (sizeChanged) {
                            sizeChanged = false;
                            this.updatePtySize();
                        }
                    }
                };
                
                session.updatePtySize = function() {
                    // todo check tab.visible
                    if (this.pty && this.cols > 1 && this.rows > 1 && !waitForServer) {
                        this.terminal.$resizeMessageSentT = Date.now();
                        this.pty.resize(this.cols, this.rows);
                        clearTimeout(waitForServer);
                        waitForServer = setTimeout(function() {
                            waitForServer = null;
                        }, 1000);
                    } else
                        sizeChanged = true;
                };
                
                session.resize = function(force) {
                    if (!this.aceSession) return;
                    
                    var terminal = this.terminal;
                    var ace = this.aceSession.ace;

                    if (!terminal || !ace) return;
                    
                    var size = ace.renderer.$size;
                    var config = ace.renderer.layerConfig;
                    
                    var h = size.scrollerHeight;
                    var w = size.scrollerWidth - 2 * config.padding;
                    
                    if (!h || config.lineHeight <= 1)
                        return false;

                    // top 1px is for cursor outline
                    var rows = Math.floor((h - 1) / config.lineHeight);
                    if (rows <= 2 && !ace.renderer.scrollBarV.isVisible)
                        w -= ace.renderer.scrollBarV.width;
                    var cols = Math.floor(w / config.characterWidth);
                    
                    if (!cols || !rows)
                        return;

                    // Don't do anything if the size remains the same
                    if (!force && cols == terminal.cols && rows == terminal.rows)
                        return;
                        
                    // do not resize terminal to very small heights during initialization
                    rows = Math.max(rows, 2);
                    cols = Math.max(cols, 2);
                        
                    if (cols > 1000 || rows > 1000) {
                        console.error("invalid terminal size");
                        return;
                    }
                        
                    terminal.resize(cols, rows);

                    session.cols = cols;
                    session.rows = rows;
                    
                    this.updatePtySize();
                };
                
                function setTabColor(){
                    var bg = settings.get("user/terminal/@backgroundColor");
                    var shade = util.shadeColor(bg, 0.75);
                    var skinName = settings.get("user/general/@skin");
                    var isLight = ~skinName.indexOf("flat") || shade.isLight;
                    doc.tab.backgroundColor = isLight ? bg : shade.color;
                    
                    if (isLight) {
                        if (~skinName.indexOf("flat") && !shade.isLight) {
                            doc.tab.classList.add("dark");
                            container.className = "c9terminalcontainer flat-dark";
                        }
                        else {
                            doc.tab.classList.remove("dark");
                            container.className = "c9terminalcontainer";
                        }
                    }
                    else {
                        doc.tab.classList.add("dark");
                        container.className = "c9terminalcontainer dark";
                    }
                }
                if (!isOutputTerminal)
                    setTabColor();
                
                // Prevent existing session from being reset
                if (session.terminal) {
                    if (session.connecting)
                        session.tab.classList.add("connecting");
                    
                    return;
                }
                
                // Set id of previous session if applicable
                session.id = e.state && e.state.id || session.id
                    || isOutputTerminal && "output";
                session.root = VFSROOT;
                session.cwd = e.state.cwd || handleEmit("setTerminalCwd") || "";
                session.output = isOutputTerminal;

                // When document gets unloaded everything should be cleaned up
                doc.on("unload", function(){
                    // Stop the shell process at the remote machine
                    if (!options.testing)
                        session.kill();
                    
                    // Destroy the terminal
                    if (session.terminal)
                        session.terminal.destroy();
                }, doc);
                
                doc.on("setTitle", function(e) {
                    if (session.mnuItem)
                        session.mnuItem.setAttribute("caption", e.title);
                }, doc);
                
                if (isOutputTerminal) {
                    session.connect = function(){
                        session.connect = function(){};
                        
                        // Connect to a new or attach to an existing tmux session
                        createTerminal(session, e.state);
                        
                        // Resize
                        session.resize();
                    };
                    
                    return;
                }
                
                var tab = doc.tab;
                tab.on("beforeClose", function(){
                    if (!settings.getBool("user/terminal/noclosequestion") 
                      && !tab.meta.$ignore && !options.testing) {
                        question.show("Close Terminal?",
                            "Are you sure you want to close this terminal?",
                            "Closing this terminal will stop any processes that it hosts.",
                            function(){ // Yes
                                tab.meta.$ignore = true;
                                tab.close();
                                
                                if (question.dontAsk)
                                    settings.set("user/terminal/noclosequestion", "true");
                            }, 
                            function(){ // No
                                // do nothing; allow user to continue
                                
                                if (question.dontAsk)
                                    settings.set("user/terminal/noclosequestion", "true");
                            },
                            { showDontAsk: true, yes: "Close", no: "Cancel" });
                        return false;
                    }
                }, session);
                
                handle.on("settingsUpdate", setTabColor, doc);
                
                // Some terminals won't set the title, lets set a default
                if (!doc.title)
                    doc.title = "Terminal";
                
                // Connect to a new or attach to an existing tmux session
                createTerminal(session, e.state);
            });
            
            plugin.on("documentActivate", function(e) {
                // Remove the previously visible terminal
                if (currentSession)
                    currentSession.detach();
                
                // Set the current terminal as visible terminal
                currentDocument = e.doc;
                currentSession = e.doc.getSession();
                currentSession.attach();
                currentSession.resize();
                
                var el = container.querySelector(".ace_content");
                el.style.transition = "opacity 150ms";
                el.style.transitionDelay = "50ms";
                el.style.opacity = currentSession.connected ? "" : "0.5";
                
                // Focus
                // plugin.focus();
            });
            
            plugin.on("documentUnload", function(e) {
                var session = e.doc.getSession();

                // Remove the element from the container
                session.detach();
                
                // Clear current session
                if (currentSession == session) {
                    currentSession = null;
                    currentDocument = null;
                    aceterm && aceterm.setSession(dummySession);
                }
            });
            
            plugin.on("getState", function(e) {
                var session = e.doc.getSession();
                if (!session.id)
                    return;
        
                e.state.id = session.id;
                e.state.cwd = session.cwd;
                e.state.width = barTerminal.lastWidth || barTerminal.getWidth();
                e.state.height = barTerminal.lastHeight || barTerminal.getHeight();
                
                // @todo scrollback log
                if (!e.filter && session.aceSession) {
                    var aceSession = session.aceSession;
                    
                    e.state.scrollTop = aceSession.getScrollTop();
                    if (!aceSession.selection.isEmpty() || aceSession.selection.rangeCount > 1)
                        e.state.selection = aceSession.selection.toJSON();
                }
            });
            
            plugin.on("setState", function(e) {
                var session = e.doc.getSession();
                session.id = e.state.id; 
                session.cwd = e.state.cwd; 
                
                // @todo scrollback log
                var aceSession = session.aceSession;
                if (aceSession) {
                    if (e.state.scrollTop)
                        aceSession.setScrollTop(e.state.scrollTop);
                    if (e.state.selection)
                        aceSession.selection.fromJSON(e.state.selection);
                }
            });
            
            plugin.on("clear", function(){
                if (currentSession) {
                    var t = currentSession.terminal;
                    if (!t) return;
                    t.ybase = 0;
                    t.lines = t.lines.slice(-(t.ybase + t.rows));
                }
            });
            
            plugin.on("copy", function(e) {
                if (e.native) return; // Ace handles this herself
                
                var data = aceterm.getCopyText();
                e.clipboardData.setData("text/plain", data);
            });
            plugin.on("paste", function(e) {
                if (e.native) return; // Ace handles this herself
                
                var data = e.clipboardData.getData("text/plain");
                if (data !== false)
                    aceterm.onPaste(data);
            });
            
            plugin.on("focus", function(e) {
                if (e.lost) blur();
                else focus();
            });
            tabs.on("focus", function(e) {
                if (e.tab.editorType === "terminal")
                    lastTerminal = e.tab;
                if (e.tab.editorType === "ace")
                    lastEditor = e.tab;
            });
            tabs.on("tabAfterClose", function(e) {
                if (e.tab === lastTerminal)
                    lastTerminal = null;
                if (e.tab === lastEditor)
                    lastEditor = null;
            });
            
            plugin.on("blur", function(){
                blur();
            });
            
            plugin.on("resize", function(e) {
                resize(e);
            });
            
            plugin.on("enable", function(){
                
            });
            
            plugin.on("disable", function(){
                
            });
            
            plugin.on("unload", function(){
                
            });
            
            /***** Register and define API *****/
            
            if (isOutputTerminal)
                plugin.freezePublicAPI.baseclass();
            
            /**
             * The output handle, responsible for events that involve all 
             * output instances. This is the object you get when you request 
             * the output service in your plugin.
             * 
             * Example:
             * 
             *     define(function(require, exports, module) {
             *         main.consumes = ["output"];
             *         main.provides = ["myplugin"];
             *         return main;
             *     
             *         function main(options, imports, register) {
             *             var outputHandle = imports.output;
             *         });
             *     });
             * 
             * 
             * @class output
             * @extends Plugin
             * @singleton
             */
            /**
             * The terminal handle, responsible for events that involve all 
             * terminal instances. This is the object you get when you request 
             * the terminal service in your plugin.
             * 
             * Example:
             * 
             *     define(function(require, exports, module) {
             *         main.consumes = ["terminal"];
             *         main.provides = ["myplugin"];
             *         return main;
             *     
             *         function main(options, imports, register) {
             *             var terminalHandle = imports.terminal;
             *         });
             *     });
             * 
             * 
             * @class terminal
             * @extends Plugin
             * @singleton
             */
            /**
             * Output Editor for Cloud9. This editor does not allow 
             * editing content. Instead it displays the output of a PTY in the
             * workspace. This editor is similar to terminal, except that it
             * doesn't start the default, instead it connects to an existing
             * TMUX session in which a process can be started using the 
             * {@link run#run run} plugin.
             * 
             * Example of instantiating a new output pane:
             * 
             *     tabManager.open({
             *         editorType : "output", 
             *         active     : true,
             *         document   : {
             *             title  : "My Process Name",
             *             output : {
             *                 id : "name_of_process"
             *             }
             *         }
             *     }, function(){});
             * 
             * @class output.Output
             * @extends Terminal
             */
            /**
             * The type of editor. Use this to create the output using
             * {@link tabManager#openEditor} or {@link editors#createEditor}.
             * @property {"output"} type
             * @readonly
             */
            /**
             * Terminal Editor for Cloud9. This editor does not allow 
             * editing content. Instead it displays the output of a PTY in the
             * workspace.
             * 
             * Example of instantiating a new terminal:
             * 
             *     tabManager.openEditor("terminal", true, function(err, tab) {
             *         if (err) throw err;
             * 
             *         var terminal = tab.editor;
             *         terminal.write("ls\n");
             *     });
             * 
             * @class terminal.Terminal
             * @extends Editor
             */
            /**
             * The type of editor. Use this to create the terminal using
             * {@link tabManager#openEditor} or {@link editors#createEditor}.
             * @property {"terminal"} type
             * @readonly
             */
            /**
             * Retrieves the state of a document in relation to this editor
             * @param {Document} doc the document for which to return the state
             * @method getState
             * @return {Object}
             * @return {String} return.id         The unique id of the terminal session.
             * @return {Number} return.width      The width of the terminal in pixels.
             * @return {Number} return.height     The height of the terminal in pixels.
             * @return {Number} return.scrollTop  The amount of pixels scrolled.
             * @return {Object} return.selection  Describing the current state 
             *   of the selection. This can become a complex object when 
             *   there are multiple selections.
             */
            plugin.freezePublicAPI({
                /**
                 * Reference to the ace instance used by this terminal for 
                 * rendering the output of the terminal.
                 * @property {Ace.Editor} ace
                 * @readonly
                 */
                get ace(){ return aceterm; },
                
                /**
                 * The HTMLElement containing the termainl.
                 * @property {HTMLElement} container
                 * @readonly
                 */
                get container(){ return container; },
                
                _events: [
                    /**
                     * Fires when a connection attempt has failed
                     * @event connectError
                     * @param {Object} e
                     * @param {Error}  e.error describes the error that has occured.
                     */
                    "connectError",
                    /**
                     * Fires when a connection with the PTY on the server is
                     * established. From this moment on data can be received
                     * by the terminal and data can be written to the terminal.
                     * @event connect
                     * @param {Object} e
                     * @param {Tab}   e.tab  the tab of the terminal that got connected
                     * @param {String} e.id    the session id of the terminal
                     */
                    "connect"
                ],
                
                /**
                 * @ignore This is here to overwrite default behavior
                 */
                isClipboardAvailable: function(e) { return !e.fromKeyboard },
                
                /**
                 * Writes a string to the terminal. The message is send to the 
                 * server and interpreted as if it was typed by the user. You 
                 * can send modifier keys by using their hex representation.
                 * @param {String} message the message to write to the terminal.
                 */
                write: write,

                // toggleMouse : toggleMouse,
                // toggleStatus : toggleStatus,
                // closeActivePane : closeActivePane,
                // splitPaneH : splitPaneH,
                // splitPaneV : splitPaneV,
                // moveUp : moveUp,
                // moveDown : moveDown,
                // moveLeft : moveLeft,
                // moveRight : moveRight,
                
                /**
                 * @internal
                 * @ignore
                 */
                Aceterm: Aceterm
            });
            
            plugin.load((isOutputTerminal ? "output" : "terminal") + counter++);
            
            return plugin;
        }
        
        register(null, {
            terminal: handle
        });
    }
});
