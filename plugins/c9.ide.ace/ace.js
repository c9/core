define(function(require, exports, module) {
    "use strict";
    main.consumes = [
        "Editor", "editors", "commands", "menus", "Menu", "MenuItem", "Divider",
        "settings", "c9", "preferences", "ui", "tabManager", "layout", "util",
        "threewaymerge", "error_handler"
    ];
    main.provides = ["ace"];
    return main;

    function main(options, imports, register) {
        var Editor = imports.Editor;
        var editors = imports.editors;
        var commands = imports.commands;
        var menus = imports.menus;
        var settings = imports.settings;
        var layout = imports.layout;
        var c9 = imports.c9;
        var ui = imports.ui;
        var util = imports.util;
        var tabs = imports.tabManager;
        var prefs = imports.preferences;
        var Menu = imports.Menu;
        var MenuItem = imports.MenuItem;
        var Divider = imports.Divider;
        var merge = imports.threewaymerge;
        var errorHandler = imports.error_handler;
        
        // Markup & Modes
        var cssString = require("text!./style.less");
        var themes = JSON.parse(require("text!./themes.json"));
        var modes = require("./modes");
        
        var extensions = Object.keys(modes.extensions);
        
        // bearable scrollbars on windows
        require("./scrollbar");
        
        // Ace
        var dom = require("ace/lib/dom");
        var lang = require("ace/lib/lang");
        var Range = require("ace/range").Range;
        var config = require("ace/config");
        var Document = require("ace/document").Document;
        var AceEditor = require("ace/editor").Editor;
        var EditSession = require("ace/edit_session").EditSession;
        var UndoManager = require("ace/undomanager").UndoManager;
        var whitespaceUtil = require("ace/ext/whitespace");
        var defaultCommands = require("ace/commands/default_commands").commands;
        var VirtualRenderer = require("ace/virtual_renderer").VirtualRenderer;
        var multiSelectCommands = require("ace/multi_select").commands;
        
        // enable multiselect
        require("ace/multi_select");
        
        // and error marker
        require("ace/ext/error_marker");
        
        // preload html mode
        require("ace/mode/html");
        
        // Needed to clear ace
        var dummySession = new EditSession("");
        
        // We don't use ace workers
        config.setDefaultValue("session", "useWorker", false);
        
        // experiment
        config.setDefaultValue("editor", "fixedWidthGutter", true);
        EditSession.prototype.diffAndReplace = function(range, text) {
            var doc = this.doc;
            var start = doc.positionToIndex(range.start);
            var oldText = doc.getTextRange(range);
            merge.patchAce(oldText, text, doc, {
                offset: start,
                method: "quick"
            });
            var dl = text.replace(/\r\n|\r|\n/g, doc.getNewLineCharacter()).length;
            return doc.indexToPosition(start + dl);
        };
        
        require("ace/lib/fixoldbrowsers");
        
        /***** Global API *****/
        
        // Set up the generic handle
        var handle = editors.register("ace", "Ace", Ace, extensions);
        var handleEmit = handle.getEmitter();
        handleEmit.setMaxListeners(1000);
        
        var mnuAce, mnuGutter;
        
        var isMinimal = options.minimal;
        var themeLoaded = {};
        var themeCounter = 100;
        var lastTheme, grpSyntax, grpThemes;
        
        var theme;
        var skin = settings.get("user/general/@skin");
        var defaultThemes = {
            "light" : "ace/theme/cloud9_day",
            "light-gray" : "ace/theme/cloud9_day",
            "flat-light" : "ace/theme/cloud9_day",
            "flat-dark"  : "ace/theme/cloud9_night_low_color",
            "dark"  : "ace/theme/cloud9_night_low_color",
            "dark-gray"  : "ace/theme/cloud9_night_low_color"
        };
        
        // Fix broken settings
        if (!defaultThemes[skin]) {
            settings.set("user/general/@skin", "dark");
            skin = "dark";
        }
        
        if (isMinimal) {
            defaultThemes[skin] = "ace/theme/textmate";
        } else {
            require([defaultThemes[skin]], function(){}); // Preload Themes
        }
        handle.__defineGetter__("theme", function(){ return theme; });
        
        function addCorner(ace) {
            if (isMinimal)
                return;
            var shadow = document.createElement("div");
            shadow.className = "scroll_shadow";
            var corner = document.createElement("div");
            corner.className = "ace_corner";
            shadow.appendChild(corner);
            ace.renderer.scroller.appendChild(shadow);
        }
        
        function addCornerStyles(theme) {
            var sheet = document.getElementById(theme.cssClass).sheet;
            sheet.insertRule(
                "." + theme.cssClass + " .ace_corner" + "{"
                + "background: radial-gradient(at 5px 5px, "
                + (theme.isDark ? "rgba(0,0,0,0)" : "rgba(250,250,250,0)")
                + "5.5px," + theme.bg + "6px)"
                + "}",
                sheet.cssRules.length
            );
        }
        
        function setTheme(path, isPreview, fromServer, $err) {
            // Get Theme or wait for theme to load
            theme = fromServer;
            if (/custom_themes/.test(path)) {
                theme = themes[path];
                if (!theme) return;
                dom.importCssString(theme.cssText, theme.cssClass);
            }
            if (!theme) {
                return $err || config.loadModule(path, function(m) {
                    setTheme(path, isPreview, m, true);
                });
            }
            
            if (!isPreview) {
                if (settings.get("user/ace/@theme") != path) {
                    settings.set("user/ace/@theme", path);
                    
                    settings.set("user/ace/@customTheme", theme.customCss);
                    
                    // Emit theme change event
                    var style = (theme.isDark ? "dark" : "light");
                    if (settings.get("user/general/@skin").indexOf(style) == -1)
                        layout.proposeLayoutChange(style, false, "ace");
                }
            }
            
            if (lastTheme == theme)
                return;
            
            if (isMinimal) {
                if (!themeLoaded[path]) {
                    themeLoaded[path] = true;
                    handleEmit("themeInit", {theme: theme, path: path});
                }
                return;
            }
            else {
                if (!themeLoaded[path]) {
                    themeLoaded[path] = true;
                    
                    var cssClass = theme.cssClass;
                    
                    var div = document.createElement("div");
                    document.body.appendChild(div);
                    div.innerHTML = "<div class='ace_gutter'></div>";
                    div.className = cssClass;
                    
                    theme.bg = ui.getStyle(div.firstChild, "backgroundColor");
                    theme.fg = ui.getStyle(div.firstChild, "color");
                    theme.path = path;
                    
                    document.body.removeChild(div);
                    
                    addCornerStyles(theme);
                
                    // Init Theme Event
                    handleEmit("themeInit", {theme: theme, path: path});
                }
                
                tabs.containers.forEach(function(container) {
                    if (theme.isDark)
                        ui.setStyleClass(container, "dark");
                    else
                        ui.setStyleClass(container, "", ["dark"]);
                });
            }
            
            var lTheme = lastTheme;
            lastTheme = theme;
            
            handleEmit("themeChange", {
                lastTheme: lTheme, 
                theme: theme, 
                path: path
            });
        }
        
        // Theme passed in from the server
        if (options.theme) {
            ui.insertCss(options.theme.cssText, handle);
            define(options.theme.path, [], options.theme);
            // require([options.theme.path], function(){});
            setTheme(options.theme.path, null, options.theme);
        }
        
        /***** Default Settings *****/
        
        var BOOL = "getBool";
        var STRING = "get";
        var NUMBER = "getNumber";
        
        // Name, Default Value, Type, Old Name, Store in Project Settings
        var font = "Monaco, Menlo, Ubuntu Mono, Consolas, source-code-pro, monospace";
        var aceSettings = [
            // detected from document value
            ["newLineMode",           "unix",   STRING, "newlinemode", 1],
            // Per document
            ["tabSize",               "4",      NUMBER, "tabsize", 1],
            ["useSoftTabs",           "true",   BOOL,   "softtabs", 1],
            ["guessTabSize",          "true",   BOOL,   "guesstabsize", 1],
            ["useWrapMode",           "false",  BOOL,   "wrapmode"],
            ["wrapToView",            "true",   BOOL,   "wrapmodeViewport"],
            
            // Ace
            ["fontSize",              "12",     NUMBER, "fontsize"],
            ["fontFamily",            font,     STRING, "fontfamily"],
            ["antialiasedfonts",      "false",  BOOL],
            ["overwrite",             "false",  BOOL,   "overwrite"],
            ["selectionStyle",        "line",   STRING, "selectstyle"],
            ["cursorStyle",           "ace",    STRING, "cursorstyle"],
            ["highlightActiveLine",   "true",   BOOL,   "activeline"],
            ["highlightGutterLine",   "true",   BOOL,   "gutterline"],
            ["showInvisibles",        "false",  BOOL,   "showinvisibles"],
            ["showPrintMargin",       "true",   BOOL,   "showprintmargin"],
            ["displayIndentGuides",   "true",   BOOL,   "showindentguides"],
            ["printMarginColumn",     "80",     NUMBER, "printmargincolumn"],
            ["behavioursEnabled",     "true",   BOOL,   "behaviors"],
            ["wrapBehavioursEnabled", "false",  BOOL,   "wrapbehaviors"],
            ["scrollSpeed",           "2",      NUMBER, "scrollspeed"],
            ["showGutter",            "true",   BOOL,   "gutter"],
            ["showFoldWidgets",       "true",   BOOL,   "folding"],
            ["fadeFoldWidgets",       "true",   BOOL,   "fadefoldwidgets"],
            ["highlightSelectedWord", "true",   BOOL,   "highlightselectedword"],
            ["animatedScroll",        "true",   BOOL,   "animatedscroll"],
            ["scrollPastEnd",         "0.5",    NUMBER],
            ["mergeUndoDeltas",       "off",    STRING],
            ["theme",                 defaultThemes[skin], STRING, "theme"]
        ];
        var docSettings = aceSettings.slice(1, 6);
        var editorSettings = aceSettings.slice(6);
        var projectSettings = aceSettings.slice(0, 4);
        var userSettings = aceSettings.slice(4);
        var docLut = {}; docSettings.forEach(function(x){ docLut[x[0]] = x });
        
        /***** Undo Manager *****/
        
        function AceUndoManager(undoManager, session) {
            var state = undoManager.getState();
            this.$session = session;
            this.$undo = undoManager;
            this.$aceUndo = new UndoManager();
            this.$aceUndo.c9UndoProxy = undoManager;
            undoManager.$aceUndo = this.$aceUndo;
            undoManager.add = this.add;
            undoManager.addSelection = this.addSelection;
            undoManager.undo = this.undo;
            undoManager.redo = this.redo;
            undoManager.reset = this.reset;
            undoManager.canUndo = this.canUndo;
            undoManager.canRedo = this.canRedo;
            undoManager.getState = this.getState;
            undoManager.setState = this.setState;
            undoManager.bookmark = this.bookmarkPosition;
            undoManager.isAtBookmark = this.isAtBookmark;
            undoManager.__defineGetter__("position", this.getPosition);
            undoManager.__defineGetter__("length", this.getLength);
            undoManager._emit = this._emit = undoManager.getEmitter();
            
            this.deleyedEmit = lang.delayedCall(this._emit.bind(null, "change"))
                .schedule.bind(null, 0);
            this.setState(state, true);
        }
        function updateDeltas(deltas) {
            if (deltas[0] && deltas[0].deltas) {
                var oldDeltas = deltas.slice();
                deltas.length = 0;
                oldDeltas.forEach(function(x) {
                    deltas.push.apply(deltas, x.deltas);
                });
            }
            return deltas;
        }
        AceUndoManager.prototype = {
            add: function(delta, doc) {
                this.$aceUndo.add(delta, doc);
                this._emit("change");
            },
            addSelection: function(range, rev) {
                this.$aceUndo.addSelection(range, rev);
            },
            undo: function(dontSelect) {
                this.$aceUndo.undo(dontSelect);
                this._emit("change");
            },
            redo: function(dontSelect) {
                this.$aceUndo.redo(dontSelect);
                this._emit("change");
            },
            reset: function(){
                this.$aceUndo.reset();
                this._emit("change");
            },
            canUndo: function() {
                return this.$aceUndo.canUndo();
            },
            canRedo: function() {
                return this.$aceUndo.canRedo();
            },
            clearUndo: function() {
                this.$aceUndo.$undoStack = [];
                this._emit("change");
            },
            clearRedo: function() {
                this.$aceUndo.$redoStack = [];
                this._emit("change");
            },
            startNewGroup: function() {
                return this.$aceUndo.startNewGroup();
            },
            markIgnored: function(from, to) {
                return this.$aceUndo.markIgnored(from, to);
            },
            getState: function() {
                var aceUndo = this.$aceUndo;
                var mark = -2;
                var aceMark = aceUndo.mark;
                var stack = [];
                function transform(deltaSet) {
                    if (!deltaSet || !deltaSet.filter) {
                        errorHandler.reportError("Misformed ace delta", {
                            delta: deltaSet
                        });
                        return;
                    }
                    var newDelta = deltaSet.filter(function(d) {
                        if (d.id == aceMark) mark = stack.length;
                        return d.action == "insert" || d.action == "remove";
                    });
                    if (newDelta.length)
                        stack.push(newDelta);
                }
                aceUndo.$undoStack.forEach(transform);
                var pos = stack.length - 1;
                if (pos == -1 && aceUndo.isAtBookmark())
                    mark = pos;
                if (aceUndo.$redoStackBaseRev == aceUndo.$rev)
                    aceUndo.$redoStack.forEach(transform);
                return {
                    mark: mark,
                    position: pos,
                    stack: stack
                };
            },
            setState: function(e, silent) {
                var aceUndo = this.$aceUndo;
                var stack = e.stack || [];
                var marked = stack[e.mark] && stack[e.mark][0];
                var pos = e.position + 1;
                var undo = stack.slice(0, pos);
                var redo = stack.slice(pos);
                var maxRev = aceUndo.$maxRev;
                function check(x) {
                    if (!x.length) return false;
                    if (!x[0].id || x[0].id < maxRev) {
                        x[0].id = maxRev++;
                    } else {
                        maxRev = x[0].id;
                    }
                    return true;
                }
                aceUndo.$undoStack = undo.map(updateDeltas).filter(check);
                aceUndo.$redoStack = redo.map(updateDeltas).filter(check);
                
                var lastDeltaGroup = stack[stack.length - 1];
                var lastRev = lastDeltaGroup && lastDeltaGroup[0] && lastDeltaGroup[0].id || 0;
                aceUndo.$rev = lastRev;
                aceUndo.$redoStackBaseRev = aceUndo.$rev;
                aceUndo.$maxRev = Math.max(maxRev, lastRev);
                var markedRev = marked && marked.id;
                if (markedRev != null)
                    this.$aceUndo.bookmark(markedRev);
                else if (e.mark == e.position)
                    this.$aceUndo.bookmark();
                else
                    this.$aceUndo.bookmark(-1);
                silent || this._emit("change");
            },
            isAtBookmark: function() {
                return this.$aceUndo.isAtBookmark();
            },
            bookmark: function(rev) {
                this.$aceUndo.bookmark(rev);
                this._emit("change");
            },
            bookmarkPosition: function(index) {
                if (index > -1) {
                    var stack = this.$aceUndo.$undoStack;
                    if (index >= stack.length) {
                        index -= stack.length;
                        stack = this.$aceUndo.$redoStack;
                        index = stack.length - index;
                    }
                    var deltaSet = stack[index];
                    var rev = deltaSet && deltaSet[0] && deltaSet[0].id;
                    if (rev == null) rev = -1;
                    this.$aceUndo.bookmark(rev);
                } else if (index == -1) {
                    this.$aceUndo.bookmark(0);
                } else {
                    this.$aceUndo.bookmark(index);
                }
                this._emit("change");
            },
            addSession: function(session) {
                this.$aceUndo.addSession(session);
            },
            getPosition: function() {
                var aceUndo = this.$aceUndo;
                return aceUndo.$undoStack.length - 1;
            },
            getLength: function() {
                var aceUndo = this.$aceUndo;
                return aceUndo.$undoStack.length + aceUndo.$redoStack.length;
            }
        };
        
        /***** Generic Load *****/
        
        handle.on("load", function(){
            if (!isMinimal) {
                // Preferences
                setPreferences();
                
                // Menus
                setMenus();
                
                // State Management
                c9.on("stateChange", function(e) {
                    if (e.state & c9.NETWORK)
                        menus.enableItem("View/Themes");
                    else
                        menus.disableItem("View/Themes");
                }, handle);
            }
            
            // Commands
            setCommands();
            
            // Settings
            var lastSettings = {};
            function updateSettings(e, list, prefix) {
                var options = {};
                (list || aceSettings).forEach(function(setting) {
                    options[setting[0]] 
                        = settings[setting[2]](prefix + "/ace/@" + setting[0]);
                });
                
                // When loading from settings only set editor settings
                docSettings.forEach(function(setting) {
                    var val = options[setting[0]];
                    if (val !== undefined) {
                        setting[1] = val;
                        delete options[setting[0]];
                    }
                });
                
                handleEmit("settingsUpdate", {
                    options: options
                });
                
                if (options.theme)
                    setTheme(options.theme);

                util.extend(lastSettings, options);
            }
            
            settings.on("read", function(e) {
                settings.setDefaults("user/ace", userSettings);
                settings.setDefaults("project/ace", projectSettings);
                
                // TODO remove when there is a better way of loading custom themes
                var customTheme = settings.get("user/ace/@customTheme");
                if (customTheme)
                    addTheme(customTheme, handle);
                
                // pre load custom mime types
                loadCustomExtensions();
                
                setFontSmoothing();
                
                updateSettings(null, userSettings, "user");
                updateSettings(null, projectSettings, "project");
            }, handle);
            
            // Listen to changes in the settings
            settings.on("user/ace", function(e) {
                var fstyle = settings.getBool("user/ace/@antialiasedfonts");
                ui.setStyleRule(".ace_editor", 
                    apf.isChrome ? "WebkitFontSmoothing" : "MozOSXFontSmoothing", 
                    fstyle && (apf.isChrome ? "antialiased" : "grayscale") || "auto");
                
                updateSettings(e, userSettings, "user");
            }, handle);
            settings.on("project/ace", function(e) { 
                updateSettings(e, projectSettings, "project");
            }, handle);
            
            handle.on("newListener", function(event, listener) {
                if (event == "settingsUpdate") 
                    listener({options: lastSettings});
            });
            
            layout.on("themeChange", function(e) {
                setFontSmoothing();
                
                if (e.type !== "ace" 
                  && settings.get("user/ace/@theme") != defaultThemes[e.oldTheme])
                    return false;
            });
            
            layout.on("themeDefaults", function(e) {
                if (e.type != "ace")
                    handle.setTheme(defaultThemes[e.theme]);
            }, handle);
            
            // CSS
            ui.insertCss(cssString, options.staticPrefix, handle);
        });
        handle.on("unload", function(){
            drawn = false;
        });
        
        function setFontSmoothing(){
            var fstyle = settings.getBool("user/ace/@antialiasedfonts");
            ui.setStyleRule(".ace_editor", 
                apf.isChrome ? "WebkitFontSmoothing" : "MozOSXFontSmoothing", 
                fstyle && (apf.isChrome ? "antialiased" : "grayscale") || "auto");
        }
        
        var drawn;
        function draw(){
            if (drawn) return;
            drawn = true;
            
            mnuAce = new Menu({ 
                id: "menu",
                items: [
                    new MenuItem({ position: 10, command: "cut", caption: "Cut"}, handle),
                    new MenuItem({ position: 20, command: "copy", caption: "Copy" }, handle),
                    new MenuItem({ position: 30, command: "paste", caption: "Paste" }, handle),
                    new Divider({ position: 40 }, handle),
                    new MenuItem({ position: 50, command: "selectall", caption: "Select All" }, handle),
                    new Divider({ position: 60 }, handle)
                ]
            }, handle);
            
            mnuGutter = new Menu({ id: "menuGutter" }, handle);
            mnuGutter.on("show", function(e) {
                var ace = tabs.focussedTab.editor.ace;
                var region = ace.renderer.$gutterLayer.getRegion(e);
                var line = ace.renderer.screenToTextCoordinates(e.x, e.y).row;
                var className = ace.session.getBreakpoints()[line] || "";
            
                mnuGutter.meta.ace = ace;
                mnuGutter.meta.line = line;
                mnuGutter.meta.region = region;
                mnuGutter.meta.className = className;
            });
        
            handleEmit("draw");
        }
        
        /***** Commands *****/
        
        function setCommands() {
            function isAce(editor, allowBlured) {
                if (!editor || !editor.ace)
                    return false;
                return  allowBlured || editor.ace.isFocused();
            }
            function fnWrap(command) {
                command.group = "Code Editor";
                command.readOnly = command.readOnly || false;
                command.focusContext = true;
    
                var isAvailable = command.isAvailable;
                command.isAvailable = function(editor, args, event) {
                    // checking editor.ace instead of editor.type == "ace" to make 
                    // commands avaliable in editors inheriting from ace
                    if (event instanceof KeyboardEvent && !isAce(editor))
                        editor = apf.activeElement;
                    if (!isAce(editor, true))
                        return false;
                    if (!editor.ace.commands.byName[command.name] && !command.shared)
                        return false;
                    
                    return isAvailable ? isAvailable(editor.ace) : true;
                };
    
                command.findEditor = function(editor, e) {
                    if (e && apf.activeElement && apf.activeElement.ace && apf.activeElement.ace.isFocused())
                        return apf.activeElement.ace;
                    return editor && editor.ace || editor;
                };
                
                return command;
            }

            if (!defaultCommands.wrapped) {
                defaultCommands.push.apply(defaultCommands, whitespaceUtil.commands);
                defaultCommands.forEach(fnWrap, defaultCommands);
                Object.defineProperty(defaultCommands, "wrapped", {value: true, configurable: true});
            }
            if (!multiSelectCommands.wrapped) {
                multiSelectCommands.forEach(fnWrap, multiSelectCommands);
                Object.defineProperty(multiSelectCommands, "wrapped", {value: true, configurable: true});
            }

            commands.addCommands(defaultCommands, handle, true);
            commands.addCommands(multiSelectCommands, handle, true);
    
            // Override ACE key bindings (conflict with goto definition)
            commands.commands.togglerecording.bindKey = { 
                mac: "Command-Shift-R", 
                win: "Alt-Shift-R" 
            };
            commands.commands.replaymacro.bindKey = { 
                mac: "Command-Ctrl-R", 
                win: "Alt-R" 
            };
            
            commands.commands["findnext"].hint = 
                "search for the next occurrence of the search query your entered last";
            commands.commands["findnext"].msg = "Navigating to next match.";
            commands.commands["findprevious"].hint = 
                "search for the previous occurrence of the search query your entered last";
                
            commands.commands["findprevious"].msg = "Navigating to previous match.";
            commands.addCommand(commands.commands.togglerecording, handle);
            commands.addCommand(commands.commands.replaymacro, handle);
            
            // when event for cmd-z in textarea is not canceled 
            // chrome tries to find another textarea with pending undo and focus it
            // we do not want this to happen when ace instance is focused
            commands.addCommand(fnWrap({
                name: "cancelBrowserUndoInAce",
                bindKey: {
                    mac: "Cmd-Z|Cmd-Shift-Z|Cmd-Y",
                    win: "Ctrl-Z|Ctrl-Shift-Z|Ctrl-Y",
                    position: -10000
                },
                group: "ignore",
                exec: function(e) {},
                readOnly: true,
                shared: true
            }), handle);
            function sharedCommand(command) {
                command.isAvailable = function(editor) {
                    return editor && editor.type == "ace";
                };
                command.group = "Code Editor";
                return command;
            }
            commands.addCommand(sharedCommand({
                name: "syntax",
                exec: function(_, syntax) {
                    if (typeof syntax == "object")
                        syntax = syntax.argv && syntax.argv[1] || "";

                    syntax = modes.caption[syntax] 
                        || modes.extensions[syntax] || syntax;
                    
                    var tab = tabs.focussedTab;
                    tab && tab.editor.setOption("syntax", syntax);
                },
                commands: modes.caption
            }), handle);
            
            commands.addCommand(sharedCommand({
                name: "largerfont",
                bindKey: { mac : "Command-+|Command-=", win : "Ctrl-+|Ctrl-=" },
                exec: function(e) {
                    var currSize = settings.get("user/ace/@fontSize");
                    settings.set("user/ace/@fontSize", ++currSize > 72 ? 72 : currSize);
                }
            }), handle);
    
            commands.addCommand(sharedCommand({
                name: "smallerfont",
                bindKey: { mac : "Command--", win : "Ctrl--" },
                exec: function(e) {
                    var currSize = settings.get("user/ace/@fontSize");
                    settings.set("user/ace/@fontSize", --currSize < 1 ? 1 : currSize);
                }
            }), handle);
            
            commands.addCommand(sharedCommand({
                name: "toggleWordWrap",
                bindKey: {win: "Ctrl-Q", mac: "Ctrl-W"},
                exec: function(editor) {
                    editor.setOption("wrap",  editor.getOption("wrap") == "off");
                }
            }), handle);
        }
        
        /***** Preferences *****/
         
        function setPreferences(){
            prefs.add({
                "Project" : {
                    position: 10,
                    "Code Editor (Ace)" : {
                        position: 100,
                        "Soft Tabs" : {
                            type: "checked-spinner",
                            checkboxPath: "project/ace/@useSoftTabs",
                            path: "project/ace/@tabSize",
                            min: "1",
                            max: "64",
                            position: 100
                        },
                        "Autodetect Tab Size on Load" : {
                            type: "checkbox",
                            path: "project/ace/@guessTabSize",
                            position: 150
                        },
                        "New File Line Endings" : {
                           type: "dropdown",
                           path: "project/ace/@newLineMode",
                           width: 130,
                           items: [
                               { caption : "Windows (CRLF)", value : "windows" },
                               { caption : "Unix (LF)", value : "unix" }
                               // { caption : "Mac OS 9 (CR)", value : "macos9" }
                           ],
                           position: 200
                        }
                    }
                }
            }, handle);
            
            prefs.add({
                "Editors" : {
                    position: 400,
                    "Code Editor (Ace)" : {
                        position: 200,
                        "Auto-pair Brackets, Quotes, etc." : {
                            type: "checkbox",
                            position: 1000,
                            path: "user/ace/@behavioursEnabled"
                        },
                        "Wrap Selection with Brackets, Quotes, etc." : {
                            type: "checkbox",
                            position: 1001,
                            path: "user/ace/@wrapBehavioursEnabled"
                        },
                        "Code Folding" : {
                            type: "checkbox",
                            position: 2000,
                            path: "user/ace/@showFoldWidgets"
                        },
                        "Fade Fold Widgets" : {
                            type: "checkbox",
                            position: 2500,
                            path: "user/ace/@fadeFoldWidgets"
                        },
                        "Full Line Selection" : {
                            type: "checkbox",
                            position: 3000,
                            path: "user/ace/@selectionStyle",
                            values: "line|text"
                        },
                        "Highlight Active Line" : {
                            type: "checkbox",
                            position: 4000,
                            path: "user/ace/@highlightActiveLine"
                        },
                        "Highlight Gutter Line" : {
                            type: "checkbox",
                            position: 4000,
                            path: "user/ace/@highlightGutterLine"
                        },
                        "Show Invisible Characters" : {
                            type: "checkbox",
                            position: 5000,
                            path: "user/ace/@showInvisibles"
                        },
                        "Show Gutter" : {
                            type: "checkbox",
                            position: 6000,
                            path: "user/ace/@showGutter"
                        },
                        "Show Indent Guides" : {
                            type: "checkbox",
                            position: 6500,
                            path: "user/ace/@displayIndentGuides"
                        },
                        "Highlight Selected Word" : {
                            type: "checkbox",
                            position: 7000,
                            path: "user/ace/@highlightSelectedWord"
                        },
                        "Scroll Past the End of the Document" : {
                            type: "dropdown",
                            width: 150,
                            path: "user/ace/@scrollPastEnd",
                            items: [
                               { caption : "Off",       value : "0" },
                               { caption : "Half Editor Height", value : "0.5" },
                               { caption : "Full Editor Height", value : "1" }
                           ],
                            position: 8000
                        },
                        "Animate Scrolling" : {
                            type: "checkbox",
                            path: "user/ace/@animatedScroll",
                            position: 9000
                        },
                        
                        "Font Family" : {
                           type: "textbox",
                           path: "user/ace/@fontFamily",
                           position: 10000
                        },
                        "Font Size" : {
                            type: "spinner",
                            path: "user/ace/@fontSize",
                            min: "1",
                            max: "72",
                            position: 10500
                        },
                        "Antialiased Fonts" : {
                           type: "checkbox",
                           path: "user/ace/@antialiasedfonts",
                           position: 10600
                        },
                        "Show Print Margin" : {
                            type: "checked-spinner",
                            checkboxPath: "user/ace/@showPrintMargin",
                            path: "user/ace/@printMarginColumn",
                            min: "1",
                            max: "200",
                            position: 11000
                        },
                        "Mouse Scroll Speed" : {
                            type: "spinner",
                            path: "user/ace/@scrollSpeed",
                            min: "1",
                            max: "8",
                            position: 13000,
                        },
                        "Cursor Style" : {
                           type: "dropdown",
                           path: "user/ace/@cursorStyle",
                           items: [
                               { caption : "Ace",    value : "ace" },
                               { caption : "Slim",   value : "slim" },
                               { caption : "Smooth", value : "smooth" },
                               { caption : "Smooth And Slim", value : "smooth slim" },
                               { caption : "Wide",   value : "wide" },
                           ],
                           position: 13500
                        },
                        "Merge Undo Deltas" : {
                           type: "dropdown",
                           path: "user/ace/@mergeUndoDeltas",
                           items: [
                               { caption : "Always", value : "always" },
                               { caption : "Never",  value : "off" },
                               { caption : "Timed",  value : "true" }
                           ],
                           position: 14000
                        },
                        "Enable Wrapping For New Documents" : {
                            type: "checkbox",
                            path: "user/ace/@useWrapMode"
                        },
                    }
                }
            }, handle);
        }
        
        /***** Menus *****/
        
        function setMenus() {
            function addEditorMenu(path, commandName) {
                return menus.addItemByPath(path, new ui.item({
                    command: commandName
                }), c += 100, handle);
            }
            
            var c = 20000;

            addEditorMenu("Tools/Toggle Macro Recording", "togglerecording"); //@todo this needs some more work
            addEditorMenu("Tools/Play Macro", "replaymacro"); //@todo this needs some more work
    
            c = 600;

            menus.addItemByPath("Edit/~", new ui.divider(), c += 100, handle);
            menus.addItemByPath("Edit/Selection/", null, c += 100, handle);
            menus.addItemByPath("Edit/Line/", null, c += 100, handle);
            menus.addItemByPath("Edit/Text/", null, c += 100, handle);
            menus.addItemByPath("Edit/Comment/", null, c += 100, handle);
            menus.addItemByPath("Edit/Code Folding/", null, c += 100, handle);
    
            c = 0;

            addEditorMenu("Edit/Line/Indent", "indent"),
            addEditorMenu("Edit/Line/Outdent", "outdent"),
            addEditorMenu("Edit/Line/Move Line Up", "movelinesup"),
            addEditorMenu("Edit/Line/Move Line Down", "movelinesdown"),

            menus.addItemByPath("Edit/Line/~", new ui.divider(), c += 100, handle);
            addEditorMenu("Edit/Line/Copy Lines Up", "copylinesup"),
            addEditorMenu("Edit/Line/Copy Lines Down", "copylinesdown"),

            menus.addItemByPath("Edit/Line/~", new ui.divider(), c += 100, handle);
            addEditorMenu("Edit/Line/Remove Line", "removeline"),
            addEditorMenu("Edit/Line/Remove to Line End", "removetolineend"),
            addEditorMenu("Edit/Line/Remove to Line Start", "removetolinestart"),

            menus.addItemByPath("Edit/Line/~", new ui.divider(), c += 100, handle);
            addEditorMenu("Edit/Line/Split Line", "splitline");
    
            c = 0;

            addEditorMenu("Edit/Comment/Toggle Comment", "togglecomment");
    
            c = 0;

            addEditorMenu("Edit/Text/Remove Word Right", "removewordright"),
            addEditorMenu("Edit/Text/Remove Word Left", "removewordleft"),

            menus.addItemByPath("Edit/Text/~", new ui.divider(), c += 100, handle);
            addEditorMenu("Edit/Text/Align", "alignCursors");
            addEditorMenu("Edit/Text/Transpose Letters", "transposeletters");

            menus.addItemByPath("Edit/Text/~", new ui.divider(), c += 100, handle);
            addEditorMenu("Edit/Text/To Upper Case", "touppercase"),
            addEditorMenu("Edit/Text/To Lower Case", "tolowercase");
    
            c = 0;

            addEditorMenu("Edit/Code Folding/Toggle Fold", "toggleFoldWidget"),
            addEditorMenu("Edit/Code Folding/Unfold", "unfold"),

            menus.addItemByPath("Edit/Code Folding/~", new ui.divider(), c += 100, handle);
            addEditorMenu("Edit/Code Folding/Fold Other", "foldOther");
            addEditorMenu("Edit/Code Folding/Fold All", "foldall");
            addEditorMenu("Edit/Code Folding/Unfold All", "unfoldall");
    
            c = 0;
            
            addEditorMenu("Edit/Selection/Select All", "selectall"),
            addEditorMenu("Edit/Selection/Split Into Lines", "splitIntoLines"),
            addEditorMenu("Edit/Selection/Single Selection", "singleSelection"),
            
            menus.addItemByPath("Edit/Selection/~", new ui.divider(), c += 100, handle);
            menus.addItemByPath("Edit/Selection/Multiple Selections/", null, c += 100, handle);
            
            menus.addItemByPath("Edit/Selection/~", new ui.divider(), c += 100, handle);
            addEditorMenu("Edit/Selection/Select Word Right", "selectwordright"),
            addEditorMenu("Edit/Selection/Select Word Left", "selectwordleft"),
            
            menus.addItemByPath("Edit/Selection/~", new ui.divider(), c += 100, handle);
            addEditorMenu("Edit/Selection/Select to Line End", "selecttolineend"),
            addEditorMenu("Edit/Selection/Select to Line Start", "selecttolinestart"),
            
            menus.addItemByPath("Edit/Selection/~", new ui.divider(), c += 100, handle);
            addEditorMenu("Edit/Selection/Select to Document End", "selecttoend");
            addEditorMenu("Edit/Selection/Select to Document Start", "selecttostart");
            
            c = 0;
            
            addEditorMenu("Edit/Selection/Multiple Selections/Add Cursor Up", "addCursorAbove"),
            addEditorMenu("Edit/Selection/Multiple Selections/Add Cursor Down", "addCursorBelow"),
            addEditorMenu("Edit/Selection/Multiple Selections/Move Active Cursor Up", "addCursorAboveSkipCurrent"),
            addEditorMenu("Edit/Selection/Multiple Selections/Move Active Cursor Down", "addCursorBelowSkipCurrent"),
            
            menus.addItemByPath("Edit/Selection/Multiple Selections/~", new ui.divider(), c += 100, handle);
            addEditorMenu("Edit/Selection/Multiple Selections/Add Next Selection Match", "selectMoreAfter"),
            addEditorMenu("Edit/Selection/Multiple Selections/Add Previous Selection Match", "selectMoreBefore"),
            
            menus.addItemByPath("Edit/Selection/Multiple Selections/~", new ui.divider(), c += 100, handle);
            addEditorMenu("Edit/Selection/Multiple Selections/Merge Selection Range", "splitIntoLines");
    
            /**** View ****/
            
            menus.addItemByPath("View/~", new ui.divider(), 290000, handle);
            menus.addItemByPath("View/Font Size/", null, 290001, handle);
    
            c = 0;
    
            addEditorMenu("View/Font Size/Increase Font Size", "largerfont");
            addEditorMenu("View/Font Size/Decrease Font Size", "smallerfont");
    
            menus.addItemByPath("View/Gutter", new ui.item({
                type: "check",
                checked: "user/ace/@showGutter"
            }), 500, handle);

            var grpNewline = new ui.group();

            
            menus.addItemByPath("File/~", new ui.divider(), 1400, handle);
            menus.addItemByPath("File/Line Endings/", new ui.menu({
                "onprop.visible" : function(e) {
                    if (e.value) {
                        var tab = tabs.focussedTab;
                        var ace = tab && tab.editor && tab.editor.ace;
                        if (ace && tab.editor.type == "ace") {
                            this.enable();
                            var mode = ace.session.doc.getNewLineMode();
                            grpNewline.setValue(mode);
                        } else {
                            this.disable();
                        }
                    }
                },
                "onitemclick" : function(e) {
                    var tab = tabs.focussedTab;
                    var ace = tab && tab.editor && tab.editor.ace;
                    if (ace && tab.editor.type == "ace") {
                        ace.session.doc.setNewLineMode(e.value);
                        tab.document.undoManager.bookmark(-2);
                    }
                }
            }), 1500, handle);

            menus.addItemByPath("File/Line Endings/Windows (CRLF)", new ui.item({
                type: "radio",
                value: "windows",
                group: grpNewline
            }), 200, handle);

            menus.addItemByPath("File/Line Endings/Unix (LF)", new ui.item({
                type: "radio",
                value: "unix",
                group: grpNewline
            }), 300, handle);

            menus.addItemByPath("View/Syntax/", new ui.menu({
                "onprop.visible" : function(e) {
                    if (e.value) {
                        if (!this.childNodes.length)
                            rebuildSyntaxMenu();
                        this.$initChildren();
                        var tab = tabs.focussedTab;
                        var c9Session = tab && tab.editor && tab.document.getSession();
                        
                        if (!c9Session || !c9Session.session) {
                            this.disable();
                        } else {
                            this.enable();
                            var val = c9Session.session.syntax || c9Session.session.customSyntax || "auto";
                            this.select(grpSyntax, val);
                        }
                    }
                },
                "onitemclick" : function(e) {
                    var tab = tabs.focussedTab;
                    if (tab) {
                        var session = tab.document.getSession();
                        setSyntax(session, e.value);
                    }
                }
            }), 300000, handle);
            
            menus.addItemByPath("View/~", new ui.divider(), 400000, handle);

            var wrapToggle = function(e) {
                var tab = tabs.focussedTab;
                var editor = tab && tab.editor;
                
                var mnuWrap = handle.getElement("mnuWrap");
                var mnuWrapPM = handle.getElement("mnuWrapPrintMargin");
                
                mnuWrapPM.setAttribute("disabled", !mnuWrap.checked);
                
                var wrap = mnuWrap.checked;
                if (mnuWrapPM.checked && (wrap || e.currentTarget == mnuWrapPM))
                    wrap = "printMargin";
                
                editor.setOption("wrap", wrap);
            };

            menus.addItemByPath("View/Wrap Lines", new ui.item({
                id: "mnuWrap",
                type: "check",
                onclick: wrapToggle,
                isAvailable: function(editor) {
                    if (!editor || editor.type != "ace")
                        return false;
                    
                    var mnuWrap = handle.getElement("mnuWrap");
                    var mnuWrapPrintMargin = handle.getElement("mnuWrapPrintMargin");
                        
                    var wrap = editor.getOption("wrap");
                    mnuWrap.setAttribute("checked", !ui.isFalse(wrap));
                    mnuWrapPrintMargin.setAttribute("checked", wrap == "printMargin");

                    return true;
                }
            }), 500000, handle),

            menus.addItemByPath("View/Wrap To Print Margin", new ui.item({
                id: "mnuWrapPrintMargin",
                type: "check",
                onclick: wrapToggle,
                isAvailable: function(editor) {
                    return editor && editor.type == "ace";
                }
            }), 600000, handle);
    
            c = 0;

            /**** Goto ****/

            menus.addItemByPath("Goto/~", new ui.divider(), c = 399, handle);

            addEditorMenu("Goto/Next Error", "goToNextError");
            addEditorMenu("Goto/Previous Error", "goToPreviousError");
            menus.addItemByPath("Goto/~", new ui.divider(), c += 200, handle);

            addEditorMenu("Goto/Word Right", "gotowordright");
            addEditorMenu("Goto/Word Left", "gotowordleft");
            menus.addItemByPath("Goto/~", new ui.divider(), c += 100, handle);

            addEditorMenu("Goto/Line End", "gotolineend");
            addEditorMenu("Goto/Line Start", "gotolinestart");
            menus.addItemByPath("Goto/~", new ui.divider(), c += 100, handle);

            addEditorMenu("Goto/Jump to Matching Brace", "jumptomatching");
            menus.addItemByPath("Goto/~", new ui.divider(), c += 100, handle);

            addEditorMenu("Goto/Scroll to Selection", "centerselection");
    
            tabs.on("focus", function(e) {
                var action = e.tab.editor.type != "ace" ? "disable" : "enable";
                
                ["Edit/Comment", "Edit/Text", "Edit/Code Folding", 
                 "Edit/Convert Case", "Edit/Line", "Edit/Selection", 
                 "View/Syntax", "View/Font Size",
                 "View/Syntax/Other", "View/Syntax",
                 "File/Line Endings"
                ].forEach(function(path) {
                    var menu = menus.get(path).menu;
                    if (menu) menu[action]();
                });
            });
            
            /**** Themes ****/
            
            grpThemes = new ui.group();
            
            menus.addItemByPath("View/Themes/", new ui.menu({
                "onprop.visible" : function(e) {
                    if (e.value)
                        grpThemes.setValue(settings.get("user/ace/@theme"));
                }
            }), 350000, handle);
            
            // Create Theme Menus
            for (var name in themes) {
                if (themes[name] instanceof Array) {
                    
                    // Add Menu Item (for submenu)
                    menus.addItemByPath("View/Themes/" + name + "/", null, themeCounter++, handle);
                    
                    themes[name].forEach(function (n) {
                        // Add Menu Item
                        var themeprop = Object.keys(n)[0];
                        addThemeMenu(name + "/" + themeprop, n[themeprop], -1);
                    });
                }
                else {
                    // Add Menu Item
                    addThemeMenu(name, null, themeCounter++);
                }
            }
            
            /**** Syntax ****/
            
            grpSyntax = new ui.group();
            handle.addElement(grpNewline, grpSyntax, grpThemes);
        }
        
        var preview;
        var setMenuThemeDelayed = lang.delayedCall(function(){
            setMenuTheme(preview, true);
        }, 150);
        function setMenuTheme(path, isPreview) {
            setTheme(path || settings.get("user/ace/@theme"), isPreview);
        }
        function addThemeMenu(name, path, index, plugin) {
            menus.addItemByPath("View/Themes/" + name, new ui.item({
                type: "radio",
                value: path || themes[name],
                group: grpThemes,
                
                onmouseover: function(e) {
                    preview = this.value;
                    setMenuThemeDelayed.schedule();
                },
                
                onmouseout: function(e) {
                    preview = null;
                    setMenuThemeDelayed.schedule();
                },

                onclick: function(e) {
                    setMenuTheme(e.currentTarget.value);
                }
            }), index == -1 ? undefined : index || themeCounter++, plugin || handle);
        }
        function addTheme(css, plugin){
            var theme = { cssText: css };
            var firstLine = css.split("\n", 1)[0].replace(/\/\*|\*\//g, "").trim();
            firstLine.split(";").forEach(function(n){
                if (!n) return;
                var info = n.split(":");
                theme[info[0].trim()] = info[1].trim();
            });
            theme.isDark = theme.isDark == "true";
            
            theme.id = "custom_themes/" + theme.name;
            theme.customCss = css;
            define.undef(theme.id);
            define(theme.id, [], theme);
            
            themes[theme.id] = theme;
            
            addThemeMenu(theme.name, theme.id, null, plugin);
            
            handleEmit("addTheme", theme);
            
            if (settings.get("user/ace/@theme") == theme.id)
                setTheme(theme.id);
            
            plugin.addOther(function(){
                removeTheme(theme, true);
            });
        }

        function removeTheme(theme, silent) {
            var el = document.getElementById(theme.cssClass);
            el && el.remove();
            delete themes[theme.name];
            silent || handleEmit("removeTheme");
        }

        function rebuildSyntaxMenu() {
            menus.remove("View/Syntax/");
            var c = 0;

            menus.addItemByPath("View/Syntax/Auto-Select", new ui.item({
                type: "radio",
                value: "auto",
                group: grpSyntax
            }), c += 100, handle);

            menus.addItemByPath("View/Syntax/Plain Text", new ui.item({
                type: "radio",
                value: "text",
                group: grpSyntax
            }), c += 100, handle);

            menus.addItemByPath("View/Syntax/~", new ui.divider(), c += 100, handle);
    
            var modeList = Object.keys(modes.byName).map(function(x) {
                return modes.byName[x];
            }).sort(function(m1, m2) {
                return m2.order - m1.order || m1.caption.localeCompare(m2.caption);
            });
            
            var groupNum = modeList[0] && modeList[0].order;
            for (var i = 0; i < modeList.length; i++) {
                var mode = modeList[i];
                if (mode.order < 0)
                    break;
                if (mode.order < groupNum) {
                    groupNum = Math.min(mode.order, groupNum / 1000);
                    menus.addItemByPath("View/Syntax/~", new ui.divider(), c += 100, handle);
                }
                menus.addItemByPath("View/Syntax/" + mode.caption, new ui.item({
                    type: "radio",
                    value: mode.name,
                    group: grpSyntax,
                }), c += 100, handle);
            }
        }
        
        var updateSyntaxMenu = lang.delayedCall(function() {
            rebuildSyntaxMenu();
            tabs.getTabs().forEach(function(tab) {
                if (tab.editorType == "ace") {
                    var c9Session = tab.document.getSession();
                    if (c9Session && c9Session.session) {
                        var syntax = getSyntax(c9Session, tab.path);
                        if (syntax)
                            c9Session.setOption("syntax", syntax);
                    }
                }
            });
        }, 50);
        
        /***** Syntax *****/
        
        function defineSyntax(opts) {
            if (!opts.name || !opts.caption)
                throw new Error("malformed syntax definition");
            
            var name = opts.name;
            modes.byCaption[opts.caption] = opts;
            modes.byName[name] = opts;
            
            opts.order = opts.order || 0;
            if (!opts.extensions)
                opts.extensions = "";
                
            opts.extensions.split("|").forEach(function(ext) {
                modes.extensions[ext] = name;
            });
            
            
            updateSyntaxMenu.schedule();
        }
        
        function getExtOrName(path) {
            var fileName = path.substr(path.lastIndexOf("/") + 1);
            var extPos = fileName.lastIndexOf(".") + 1;
            if (extPos)
                return fileName.substr(extPos).toLowerCase();
            
            // special case for new files
            if (/^Untitled\d+$/.test(fileName))
                fileName = fileName.replace(/\d+/, "");
            
            return "^" + fileName;
        }
        
        function getSyntaxForPath(path) {
            var ext = getExtOrName(path);
            var modeName = modes.customExtensions[ext] || modes.extensions[ext];
            return modes.byName[modeName] ? modeName : "";
        }
    
        function setSyntaxForPath(path, syntax, noOverwrite) {
            if (!path)
                return false;
            syntax = modes.byName[syntax] ? syntax : "";
    
            var ext = getExtOrName(path);
            var changed;
            if (syntax) {
                if (!modes.extensions[ext] || !noOverwrite) {
                    modes.customExtensions[ext] = syntax;
                    changed = true;
                }
            } else if (modes.customExtensions[ext]) {
                delete modes.customExtensions[ext];
                changed = true;
            }
            
            if (changed)
                settings.setJson("user/ace/custom-types", modes.customExtensions);
            return changed;
        }
        
        function getMode(syntax) {
            syntax = (syntax || settings.get("project/ace/@defaultSyntax") || "text").toLowerCase();
            if (syntax.indexOf("/") == -1)
                syntax = "ace/mode/" + syntax;
    
            return syntax;
        }
    
        function loadCustomExtensions() {
            var custom = settings.getJson("user/ace/custom-types");
            if (!custom) return;
            
            Object.keys(custom).forEach(function(ext) {
                var mode = custom[ext];
                if (modes.byName[mode])
                    modes.customExtensions[ext] = mode;
            });
        }
     
        function detectSyntax(c9Session, path) {
            if (!c9Session.session || !c9Session.session.getLine)
                return;
            // todo move this into ace mode util
            var firstLine = c9Session.session.getLine(0);
            var syntax = "";
            if (!firstLine) {
                return;
            }
            else if (/^#!/.test(firstLine)) {
                var match = firstLine.match(/\b(node|bash|sh)\b/);
                switch (match && match[1]) {
                    case "node": syntax = "javascript"; break;
                    case "sh": // fallthrough
                    case "bash": syntax = "sh"; break;
                    default: syntax = ""; break;
                }
            }
            else if (/<\?xml/.test(firstLine)) {
                syntax = "xml";
            }
            else if (/^{/.test(firstLine)) {
                syntax = "json";
            }
            else if (/\.(bash|inputrc|profile|zsh)/.test(path)) {
                syntax = "sh";
            }
            else if (/\.(git(attributes|config|ignore)|npmrc)$/.test(path)) {
                syntax = "ini";
            }
            return syntax;
        }
        
        function getSyntax(c9Session, path) {
            var syntax = c9Session.session.customSyntax
                || path && getSyntaxForPath(path)
                || detectSyntax(c9Session, path);
            return modes.byName[syntax] ? syntax : "";
        }
    
        function setSyntax(c9Session, syntax, forThisOnly) {
            var c9doc = c9Session.session.c9doc;
            syntax = modes.byName[syntax] ? syntax : "";
            var path = c9doc.tab.path;
            if (!forThisOnly && !setSyntaxForPath(path, syntax, true))
                c9Session.session.customSyntax = syntax;
            
            c9doc.editor.setOption("syntax", syntax || getSyntax(c9Session, path), c9Session);
        }
        
        function cloneSession(session, undoManager) {
            var s = new EditSession(session.getDocument(), session.getMode());
    
            if (!undoManager)
                undoManager = session.getUndoManager();
            if (undoManager) {
                s.setUndoManager(undoManager);
            }
    
            // Overwrite the default $informUndoManager function such that new deltas
            // aren't added to the undo manager from the new and the old session.
            s.$informUndoManager = lang.delayedCall(function() { s.$deltas = []; });
    
            // Copy over 'settings' from the session.
            s.setOptions(session.getOptions());
            s.$foldData = session.$cloneFoldData();
            
            var ignore = false;
            var changeAnnotation = function(){
                if (ignore) return;
                ignore = true;
                s.setAnnotations(session.getAnnotations());
                ignore = false;
            };
            var changeMode = function(e) {
                s.setMode(session.getMode());
            };
            var changeBreakpoint = function(){
                s.$breakpoints = session.$breakpoints;
                s._emit("changeBreakpoint", {});
            };
            var setWrap = function(e) {
                s.setOption("wrap", e.value);
            };
            
            session.on("changeAnnotation", changeAnnotation)();
            session.on("changeMode", changeMode);
            session.on("changeBreakpoint", changeBreakpoint)();
            session.on("setWrap", setWrap);
            
            s.on("changeAnnotation", function(){
                if (ignore) return;
                ignore = true;
                session.setAnnotations(s.getAnnotations());
                ignore = false;
            })();
            
            s.cleanup = function(){
                session.removeListener("changeAnnotation", changeAnnotation);
                session.removeListener("changeMode", changeMode);
                session.removeListener("changeBreakpoint", changeBreakpoint);
                session.removeListener("setWrap", setWrap);
            };
            
            s.c9doc  = session.c9doc;
            s.cloned = true;
            
            return s;
        }
        
        /**
         * The ace handle, responsible for events that involve all ace
         * instances. This is the object you get when you request the ace
         * service in your plugin.
         * 
         * Example:
         * 
         *     define(function(require, exports, module) {
         *         main.consumes = ["ace"];
         *         main.provides = ["myplugin"];
         *         return main;
         *     
         *         function main(options, imports, register) {
         *             var aceHandle = imports.ace;
         *             
         *             aceHandle.on("create", function(e) {
         *                 // This is an ace editor instance
         *                 var ace = e.editor;
         *             })
         *         });
         *     });
         * 
         * 
         * @class ace
         * @extends Plugin
         * @singleton
         */
        handle.freezePublicAPI({
            /**
             * The context menu that is displayed when right clicked in the ace
             * editing area.
             * @property {Menu} contextMenu
             * @readonly
             */
            get contextMenu(){ draw(); return mnuAce },
            
            /**
             * The context menu that is displayed when right clicked in the ace
             * gutter area.
             * @property {Menu} gutterContextMenu
             * @readonly
             */
            get gutterContextMenu(){ draw(); return mnuGutter },
            
            /**
             * Ace Themes
             * @property {Object} themese
             */
            themes: themes,
            
            _events: [
                /**
                 * Fires once for each ace instance that is instantiated.
                 * 
                 * Note that this event does not only fire for each ace instance
                 * that is created, but it also fires for all ace instances that
                 * have been created and are still around.
                 * 
                 * @event create
                 * @param {Object} e
                 * @param {Editor} e.editor
                 */
                "create",
                /**
                 * Fires when a new theme is initialized.
                 * @event themeInit
                 * @param {Object}  e
                 * @param {Object}  e.theme           Describes the theme that is initialized.
                 * @param {String}  e.theme.cssClass  The css class name related to the theme.
                 * @param {String}  e.theme.bg        The background color for this theme.
                 * @param {String}  e.theme.fg        The foreground color for this theme.
                 * @param {String}  e.theme.path      The path of this theme.
                 * @param {Boolean} e.theme.isDark    Specifies whether this is a dark theme or a light theme.
                 * @param {String}  e.path            The path of the theme.
                 */
                "themeInit",
                /**
                 * Fires when the current theme changes to another theme.
                 * 
                 * See also {@link ace#setTheme}.
                 * 
                 * @event themeChange
                 * @param {Object}  e
                 * @param {Object}  e.theme               Describes the theme that is initialized.
                 * @param {String}  e.theme.cssClass      The css class name related to the theme.
                 * @param {String}  e.theme.bg            The background color for this theme.
                 * @param {String}  e.theme.fg            The foreground color for this theme.
                 * @param {String}  e.theme.path          The path of this theme.
                 * @param {Boolean} e.theme.isDark        Specifies whether this is a dark theme or a light theme.
                 * @param {Object}  e.lastTheme           Describes the theme that is initialized.
                 * @param {String}  e.lastTheme.cssClass  The css class name related to the theme.
                 * @param {String}  e.lastTheme.bg        The background color for this theme.
                 * @param {String}  e.lastTheme.fg        The foreground color for this theme.
                 * @param {String}  e.lastTheme.path      The path of this theme.
                 * @param {Boolean} e.lastTheme.isDark    Specifies whether this is a dark theme or a light theme.
                 * @param {String}  e.path                The path of the theme.
                 */
                "themeChange",
                /**
                 * Fires when an ace's EditSession is inited for the Cloud9 document
                 * the ace's EditSession can be get using:
                 * doc.getSession().session
                 * 
                 * @event initAceSession
                 * @param {Object}  e
                 * @param {Object}  e.doc                 The document with the EditSession created
                 */
                "initAceSession",
                 /**
                  * Fires when the ace context menus are drawn
                  * @event draw
                  */
                 "draw"
            ],
            
            /**
             * Set the theme for ace.
             * 
             * Here's a list of default themes:
             * 
             * * ace/theme/ambiance
             * * ace/theme/chrome
             * * ace/theme/clouds
             * * ace/theme/clouds_midnight
             * * ace/theme/cobalt
             * * ace/theme/crimson_editor
             * * ace/theme/dawn
             * * ace/theme/dreamweaver
             * * ace/theme/eclipse
             * * ace/theme/github
             * * ace/theme/idle_fingers
             * * ace/theme/kr_theme
             * * ace/theme/merbivore
             * * ace/theme/merbivore_soft
             * * ace/theme/mono_industrial
             * * ace/theme/monokai
             * * ace/theme/pastel_on_dark
             * * ace/theme/solarized_dark
             * * ace/theme/solarized_light
             * * ace/theme/textmate
             * * ace/theme/tomorrow
             * * ace/theme/tomorrow_night
             * * ace/theme/tomorrow_night_blue
             * * ace/theme/tomorrow_night_bright
             * * ace/theme/tomorrow_night_eighties
             * * ace/theme/twilight
             * * ace/theme/vibrant_ink
             * * ace/theme/xcod
             * 
             * @method setTheme
             * @param {String} path  The path of the theme file.
             * @fires themeInit
             * @fires themeChange
             */
            setTheme: setTheme,
            
            /**
             * Add new syntax to the menu
             * 
             * See also {@link ace#setSyntax}.
             * 
             * @param {Object}  syntax
             * @param {Object}  syntax.caption        Caption to display in the menu
             * @param {Number}  syntax.order          order in the menu
             * @param {String}  syntax.name           The path to corresponding ace language mode. (if doesn't contain "/" assumed to be from "ace/mode/<name>")
             * @param {String}  syntax.extensions     file extensions in the form "ext1|ext2|^filename". this is case-insensitive
             */
            defineSyntax: defineSyntax,
            
            /**
             * @ignore
             */
            getSyntaxForPath: getSyntaxForPath,
            
            /**
             * @ignore this is used by statusbar
             */
            getSyntaxCaption: function(syntax) {
                var mode = modes.byName[syntax];
                return mode && mode.caption || "Text";
            },
            
            /**
             * Adds a menu item for a new theme
             * @param {String} css
             * @param {Plugin} plugin
             */
            addTheme: addTheme,
            
            /**
             * @ignore
             */
            draw: draw,
            
            /**
             * @ignore
             */
            cloneSession: cloneSession
        });
        
        /***** Initialization *****/
        
        function Ace(isBaseclass, exts) {
            if (!exts) exts = [];
            var plugin = new Editor("Ajax.org", main.consumes, 
                exts && exts.concat(extensions) || extensions);
            var emit = plugin.getEmitter();
            
            if (isBaseclass) plugin.freezePublicAPI.baseclass();
            
            var ace, currentSession, currentDocument, container, progress;
            var immutableSkin;
            
            plugin.on("draw", function(e) {
                // Create Ace
                container = e.htmlNode.appendChild(document.createElement("div"));
                container.className = "codeditorHolder";
                container.style.position = "absolute";
                container.style.left = "0px";
                container.style.right = "0px";
                container.style.top = ui.getStyle(e.htmlNode, "paddingTop");
                container.style.bottom = "0px";
        
                // Create Ace editor instance
                var theme = settings.get("user/ace/@theme");
                ace = new AceEditor(new VirtualRenderer(container, theme), null);
                
                
                // temporary workaround for apf focus bugs
                // only blur is needed sinse the rest is handled by tabManager
                // todo remove this when there is proper focus manager
                e.tab.$blur = function(e) {
                    var ace = plugin.ace; // can be null when called for destroyed tab
                    if (!ace || !e || !e.toElement || e.toElement.tagName == "menu") 
                        return;
                    if (!ace.isFocused())
                        ace.renderer.visualizeBlur();
                    else
                        ace.textInput.blur();
                };
                ace.on("focus", function() {
                    var page = apf.findHost(container);
                    if (apf.activeElement != page)
                        page.focus();
                });
                
                
                // Create Menu
                handle.draw();
                
                createProgressIndicator(e.htmlNode);
                
                var tab = e.tab;
                
                tab.on("contextmenu", function(e) { 
                    var target = e.htmlEvent.target;
                    var gutter = plugin.ace.container.querySelector(".ace_gutter");
                
                    // Set Gutter Context Menu
                    if (ui.isChildOf(gutter, target, true)) {
                        mnuGutter.show(e.x, e.y, "context");
                    }
                    // Set main Ace Context Menu
                    else {
                        mnuAce.show(e.x, e.y, "context");
                    }
                    return false;
                });
                
                addEditor(ace);
            });
            
            plugin.on("createAce", function(ace) {
                if (c9.readonly)
                    ace.setReadOnly(true);
                    
                addCorner(ace);
                
                ace.keyBinding.setDefaultHandler(null);
        
                // Route gutter events
                ace.on("gutterclick", function(e){ emit("guttermousedown", e); });
                ace.on("gutterdblclick", function(e){ emit("gutterdblclick", e); });

                // use global commandKeyBinding
                // ace.commands.commandKeyBinding = {};

                handle.on("settingsUpdate", function(e) {
                    setOptions(e.options);
                }, plugin);
                
                handle.on("themeChange", function(e) {
                    ace.setTheme(e.path);
                    changeTheme();
                    
                    emit("themeChange", e);
                }, plugin);
                
                if (handle.theme)
                    ace.setTheme(handle.theme.path);
            });
            
            plugin.on("newListener", function(event, listener) {
                if (event == "createAce" && ace)
                    listener(ace);
            });
            
            /***** Methods *****/
            
            function addEditor(ace) {
                emit("createAce", ace);
            }
            
            function focus(){
                if (container) {
                    ui.addClass(container, "aceFocus");
                    plugin.ace.focus();
                }
            }
            function blur(){
                if (container) {
                    ui.removeClass(container, "aceFocus");
                    ace.blur();
                }
            }
            
            var afterAnim;
            function resize(e) {
                var renderer = ace && ace.renderer;
                if (!renderer || !currentDocument) return;
                
                if (e.type == "anim") {
                    var htmlNode = ace.container;
                    if (!htmlNode)
                        return;
                    
                    if (e.vertical) {
                        var size = e.current === 0
                          ? Math.abs(e.delta) - 5
                            - currentDocument.tab.pane.aml.$buttons.offsetHeight
                          : htmlNode.offsetHeight + e.delta;
                        
                        renderer.onResize(true, null, null, size);
                    }
                    else {
                        renderer.onResize(true, null, 
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
            
            function getState(doc, state, filter) {
                if (filter) return;
                
                var session = doc.getSession().session;
                if (!session) return;
        
                // Folds
                state.folds = session.getAllFolds().map(function(fold) {
                    return {
                        start: fold.start,
                        end: fold.end,
                        placeholder: fold.placeholder
                    };
                });
        
                // Per document options
                var options = {};
                docSettings.forEach(function(setting) {
                    var name = setting[0];
                    options[name] = getOption(name, {session: session});
                });
                
                if (options.guessTabSize) {
                    delete options.tabSize;
                    delete options.useSoftTabs;
                }
                
                // Custom Type
                if (session.customSyntax)
                    state.customSyntax = session.customSyntax;
                
                // Scroll state
                state.scrolltop = session.getScrollTop();
                state.scrollleft = session.getScrollLeft();
                
                // Selection & options
                state.selection = session.selection.toJSON();
                state.options = options;
                
                var row = doc.editor.ace 
                    ? doc.editor.ace.renderer.getFirstVisibleRow()
                    : 0;
                state.firstLineState = row && session.bgTokenizer && {
                    row: row - 1,
                    state: session.bgTokenizer.states[row - 1],
                    mode: session.$mode.$id
                };
            }
            
            function setState(doc, state) {
                var c9Session = doc.getSession();
                var session = c9Session.session;
                if (!session) return; // Happens when called after tab is closed
                
                if (state.cleansed)
                    state.firstLineState = state.folds = null;
                
                // Set customSyntax
                if (state.customSyntax) {
                    session.customSyntax = state.customSyntax;
                    setSyntax(c9Session, session.customSyntax);
                }
        
                // Set folds
                if (state.folds) {
                    try {
                        state.folds.forEach(function(fold) {
                            session.addFold(fold.placeholder, 
                                Range.fromPoints(fold.start, fold.end));
                        });
                    } catch (e) {
                        state.folds = null;
                    }
                }
                
                if (state.firstLineState && session.bgTokenizer) {
                    var firstLineState = state.firstLineState;
                    var updateFirstLineState = function() {
                        session.bgTokenizer.states[firstLineState.row]
                            = firstLineState.state;
                    };
                    if (session.$mode.$id == state.firstLineState.mode) {
                        updateFirstLineState();
                    } else
                        session.once("changeMode", updateFirstLineState);
                }
                
                function updateSession(){
                    if (state.options && state.options.guessTabSize) {
                        delete state.options.tabSize;
                        delete state.options.useSoftTabs;
                    }
                    // Set per document options
                    setOptions(state.options, c9Session);
                    
                    // Jump to
                    if (state.jump) {
                        var row = state.jump.row;
                        var column = state.jump.column;
                        
                        if (typeof row === "number") {
                            scrollTo(row, column, state.jump.select, session);
                            state.scrolltop = state.scrollleft = undefined;
                        }
                    }
                    // Set selection
                    else if (state.selection)
                        session.selection.fromJSON(state.selection);
                    
                    // Set scroll state
                    if (state.scrolltop)
                        session.setScrollTop(state.scrolltop);
                    if (state.scrollleft)
                        session.setScrollLeft(state.scrollleft);
                }
                
                if (ace.session == session) 
                    updateSession();
                else {
                    var clean = function(){
                        ace.off("changeSession", listen);
                        session.off("unload", clean);
                    };
                    var listen = function(e) {
                        if (e.session == session) {
                            updateSession();
                            clean();
                        }
                    };
                    
                    ace.on("changeSession", listen);
                    session.on("unload", clean);
                }
            }
            
            function scrollTo(row, column, select, session) {
                if (row === undefined)
                    return;
                
                (currentSession && currentSession.session || session)
                    .unfold({row: row, column: column || 0});
    
                ace.selection.clearSelection();
                ace.moveCursorTo(row, column || 0);
                if (select)
                    session.getSelection().selectToPosition(select);
                
                var range = ace.selection.getRange();
                var initialScroll = ace.renderer.scrollTop;
                ace.renderer.scrollSelectionIntoView(range.start, range.end, 0.5);
                
                ace.renderer.animateScrolling(initialScroll);
            }
            
            function changeTheme(){
                if (immutableSkin || !currentSession) 
                    return;
                
                var theme = handle.theme;
                if (handle.theme && currentSession.cssClass != theme.cssClass) {
                    var tab = currentDocument.tab;
                    var html = plugin.aml.$int;
                    
                    if (theme.isDark) {
                        tab.classList.add("dark");
                        html.style.boxShadow = "";
                    }
                    else {
                        tab.classList.remove("dark");
                        html.style.boxShadow = skin.indexOf("flat") == -1
                            ? "0 1px 0 0 rgba(255, 255, 255, .3) inset"
                            : "";
                    }
                    
                    html.style.backgroundColor = theme.bg;
                    
                    tab.backgroundColor = theme.bg;
                    // tab.foregroundColor = theme.fg;
                    
                    currentSession.isDark = theme.isDark;
                }
            }
            
            function getOption(name, c9Session) {
                var session = (c9Session || currentSession).session;
                
                if (name == "syntax")
                    return session && session.syntax;
                else if (name == "useWrapMode")
                    return session && session.getOption("wrap") !== "off";
                else if (name == "wrapToView")
                    return session && session.getOption("wrap") !== "printMargin";
                else if (name == "guessTabSize")
                    return session && session.$guessTabSize;
                
                return (session.$options[name] ? session : ace).getOption(name);
            }
            
            function setOptions(options, c9Session) {
                for (var prop in options) {
                    setOption(prop, options[prop], c9Session);
                }
            }
            
            function setOption(name, value, c9Session) {
                if (!c9Session)
                    c9Session = currentSession;
                var session = (c9Session || {}).session;
                
                if (docLut[name] && c9Session)
                    c9Session.options[name] = value;
                
                if (ui.isFalse(value))
                    value = false;
                
                // Own Implementations
                switch (name) {
                    case "theme":
                        ace.setTheme(value);
                        return;
                    case "syntax":
                        if (session) {
                            var mode = getMode(value);
                            session.syntax = value;
                            session.setMode(mode);
                        }
                        return;
                    case "antialiasedfonts":
                        return;
                    case "useWrapMode":
                    case "wrapToView":
                        var useWrapMode, wrapToView;
                        if (!session) return;
                        
                        if (name != "useWrapMode") {
                            wrapToView = value;
                            useWrapMode = session.getOption("wrap") != "off";
                        }
                        else {
                            useWrapMode = value;
                            wrapToView = session.getOption("wrap") == "free";
                        }
                        
                        value = (useWrapMode ? wrapToView || "printMargin" : false);
                        
                        /* falls through */
                    case "wrap":
                        session._emit("setWrap", { value: value });
                        session.setOption("wrap", value);
                        return;
                    case "guessTabSize":
                        if (session)
                            session.$guessTabSize = value;
                        return;
                    case "tabSize": /* fallThrough */
                    case "useSoftTabs":
                        if (session)
                            session.$guessTabSize = false;
                        break;
                }
                
                if (session && docLut[name]) // this can be called for session different than current ace session
                    session.setOption(name, value);
                else // TODO when called with session this can refer to a wrong ace
                    ace.setOption(name, value);
            }

            function createProgressIndicator(parent) {
                var background = parent.appendChild(document.createElement("div"));
                background.style.cssText = "background: inherit;"
                    + "position:absolute;top:0;bottom:0;left:0;right:0;";
                    
                background.style.zIndex = 20000;
                background.style.transitionProperty = "opacity";
                background.style.display = "none";
                
                progress = background.appendChild(document.createElement("div"));
                progress.className = "ace_progress";
                progress.innerHTML = "<div></div>";
                
                progress.background = background;
            }
            
            function hideProgress(){
                if (!ace) return; // ace was destroyed during timeout
                var style = progress.background.style;
                function hide() {
                    style.display = "none";
                    style.transitionDuration = 0;
                    progress.firstChild.style.width = "0%";
                }
                if (ace.renderer.$frozen && ace.renderer.$changes) {
                    ace.renderer.once("afterRender", hide);
                    ace.renderer.$loop.schedule(ace.renderer.$changes);
                } else {
                    hide();
                }
                style.transitionDelay = 0;
                style.opacity = 0;
                
                ace.renderer.unfreeze();
            }
            
            function showProgress(value, upload, t) {
                if (!upload)
                    ace.renderer.freeze();
                    
                var growT = 200;
                if (progress.t && t && progress.t - t) {
                    var vTotal = value / t;
                    var vLast = progress.value / progress.t;
                    var v = 0.6 * vTotal + 0.4 * vLast;
                    growT = Math.max((value - progress.value) / v, 0) || 200;
                }
                
                if (upload) {
                    if (value === 0) {
                        progress.start = t;
                        return;
                    }
                    else if (t - progress.start < 100)
                        return;
                }
                
                if (value === undefined) value = 0;
                
                progress.value = value;
                progress.t = t;
                progress.firstChild.style.width = value + "%";
                progress.firstChild.style.transition = "width " + growT + "ms";
                
                progress.className = "ace_progress" + (upload ? " upload" : "");
                
                // todo should we use this instead of forcing transition with clientHeight ?
                // var fadeIn = function() {
                //     setTimeout(function () {
                //         if (bgStyle.display === "block") {
                //             bgStyle.opacity = 1;
                //         }
                //     });
                // };
                var bgStyle = progress.background.style;
                if (progress.noFadeIn || upload) {
                    bgStyle.display = "block";
                    bgStyle.opacity = 1;
                }
                else if (bgStyle.display !== "block") {
                    bgStyle.display = "block";
                    bgStyle.transitionDuration = Math.max(150 - (t || 0), 0) + "ms";
                    bgStyle.transitionDelay = Math.max(100 - (t || 0), 0) + "ms";
                    progress.forcedTransition = progress.background.clientHeight;
                    bgStyle.opacity = 1;
                }
                
                bgStyle.bottom = upload ? "" : 0;
            }
        
            function detectSettingsOnLoad(c9Session, doc) {
                var session = c9Session.session;
                if (settings.get("project/ace/@guessTabSize"))
                    whitespaceUtil.detectIndentation(session);
                if (!session.syntax) {
                    var syntax = detectSyntax(c9Session, doc && doc.tab && doc.tab.path);
                    if (syntax)
                        setSyntax(c9Session, syntax, true);
                }
                
                var newLineMode = session.doc.getNewLineMode();
                if (newLineMode === "auto") {
                    var autoNewLine = session.doc.$autoNewLine;
                    if (autoNewLine == "\r\n") {
                        newLineMode = "windows";
                    } else if (autoNewLine == "\n") {
                        newLineMode = "unix";
                    } else {
                        newLineMode = settings.get("project/ace/@newLineMode");
                    }
                    session.doc.setNewLineMode(newLineMode);
                }
            }
            
            /***** Lifecycle *****/
            
            // @todo set selection, scroll and file in header
            
            plugin.on("load", function(){
                
            });
            
            plugin.on("documentLoad", function(e) {
                var doc = e.doc;
                var c9Session = doc.getSession();
                
                // if load starts from another editor type
                // tabmanager will show us instantly
                // so we need to show progress bar instantly
                progress.noFadeIn = !currentDocument || !currentDocument.tab.active;
                
                // Value Retrieval
                doc.on("getValue", function get(e) {
                    var session = c9Session.session;
                    return session
                        ? session.doc.getValue(session.doc.$fsNewLine)
                        : e.value;
                }, c9Session);
                
                // Value setting
                doc.on("setValue", function set(e) { 
                    var aceSession = c9Session.session;
                    if (!aceSession)
                        return; // This is probably a deconstructed document
                    
                    // The first value that is set should clear the undo stack
                    // additional times setting the value should keep it.
                    if (aceSession.c9doc.hasValue()) {
                        merge.patchAce(e.value || "", aceSession.doc);
                        // aceSession.doc.setValue(e.value || "");
                    } else {
                        aceSession.setValue(e.value || "");
                        detectSettingsOnLoad(c9Session, doc);
                        hideProgress();
                    }
                    
                    if (e.state) // There is nowhere where e.state is set. Dead code?
                        setState(doc, e.state);
                        
                    if (currentDocument === doc)
                        ace.renderer.unfreeze();
                }, c9Session);
                
                doc.on("mergeState", function() {
                    return false;
                }, c9Session);
                
                doc.on("progress", function(e) {
                    if (e.complete) {
                        c9Session.progress = 0;
                    }
                    else {
                        var progress = ((e.loaded / e.total) * 100) || 0;
                        if (progress >= (c9Session.progress || 0) || (c9Session.progress == 100 && !progress)) {
                            c9Session.progress = progress;
                        } else if (c9Session.progress && e.upload) {
                            // see https://github.com/c9/newclient/issues/3682
                            // disabled warning for download since this happens very often with collab, 
                            // because socket is not able to keep up with the load
                            // todo reenable when collab issue is fixed
                            errorHandler.reportError("Weird progress value", {
                                newValue: progress,
                                oldValue: c9Session.progress,
                                upload: e.upload
                            });
                        }
                    }
                    
                    c9Session.upload = e.upload;
                    
                    if (currentSession != c9Session)
                        return;
                    
                    if (e.complete)
                        doc.hasValue() && setTimeout(hideProgress, 0);
                    else
                        showProgress(c9Session.progress, c9Session.upload, e.dt);
                }, c9Session);
                
                doc.on("clone", function(e){
                    var newsession = e.doc.getSession("ace");
                    // var newundo = new AceUndoManager(doc.undoManager, c9Session);
                    newsession.session = cloneSession(c9Session.session); //, newundo);
                    newsession.undoManager = newsession.session.$undoManager;
                }, c9Session);
                
                // Title & Tooltip
                function setTitle(e) {
                    var path = doc.tab.path;
                    if (!path) return;
                    
                    // Caption is the filename
                    doc.title = path.substr(path.lastIndexOf("/") + 1);
                    
                    // Tooltip is the full path
                    doc.tooltip = path;
                }
                setTitle({path: doc.tab.path || ""});
                
                // Update mode when the filename changes
                doc.tab.on("setPath", function(e) {
                    setTitle(e);
                    // This event is triggered also when closing files, 
                    // so session may be gone already.
                    if (c9Session.session) {
                        var syntax = getSyntax(c9Session, doc.tab.path);
                        setOption("syntax", syntax, c9Session);
                    }
                }, c9Session);
                
                // Prevent existing session from being reset
                if (c9Session.inited)
                    return;
                
                // Create an ace session
                var aceSession = e.state && e.state.session || c9Session.session;
                if (!aceSession) {
                    var acedoc = new Document(doc.value || "");
                    aceSession = e.state.session || new EditSession(acedoc);
                }
                c9Session.session = aceSession;
                c9Session.session.c9doc = doc;
                c9Session.options = {};
                c9Session.setOption = function(name, value) {
                    setOption(name, value, this);
                };
                c9Session.inited = true;
                
                if (!e.state || !e.state.options)
                    docSettings.forEach(function(setting) {
                        var name = setting[0];
                        setOption(name, setting[1], c9Session);
                    });
                
                if (e.state && e.state.customSyntax)
                    c9Session.session.customSyntax = e.state.customSyntax;
                    
                var syntax = getSyntax(c9Session, doc.tab.path);
                setOption("syntax", syntax, c9Session);
                
                if (e.state)
                    setState(doc, e.state);
                
                if (doc.meta.newfile) {
                    detectSettingsOnLoad(c9Session, doc);
                    aceSession.on("change", function detectIndentation() {
                        if (aceSession.$guessTabSize) {
                            if (aceSession.getLength() <= 2) return;
                            whitespaceUtil.detectIndentation(aceSession);
                            if (doc.editor && doc.editor.ace)
                                doc.editor.ace._signal("changeStatus");
                        }
                        aceSession.off("change", detectIndentation);
                    });
                } else if (doc.hasValue()) {
                    detectSettingsOnLoad(c9Session, doc);
                }
                
                // Create the ace like undo manager that proxies to 
                // the Cloud9 undo manager
                if (!c9Session.undoManager) {
                    c9Session.undoManager 
                        = new AceUndoManager(doc.undoManager, c9Session);
                
                    // Attach the ace undo manager to the current session
                    c9Session.session.setUndoManager(c9Session.undoManager);
                }

                handleEmit("initAceSession", { doc: doc });
                c9Session.getEmitter().sticky("init", { 
                    doc: doc, 
                    session: c9Session.session 
                });

                doc.on("unload", function(){
                    setTimeout(function() { //@todo is this still needed?
                        var session = c9Session.session;
                        if (!session)
                            return;
                        
                        if (session.cloned) {
                            session.cleanup();
                        }
                        else {
                            var doc = session.doc;
                            if (doc) {
                                doc.$lines = [];
                                doc._eventRegistry = null;
                                doc._defaultHandlers = null;
                            }
                            session.destroy();
                            session.bgTokenizer = null;
                            session.$rowCache = null;
                            session._eventRegistry = session.$mode = null;
                            session.$breakpoints = null;
                            session.$annotations = null;
                            session.languageAnnos = null;
                            session.c9doc = null;
                        }
                        
                        c9Session.session = null;
                        c9Session = null;
                    });
                });
            });
            plugin.on("documentActivate", function(e) {
                //editor.value = e.doc.value;
                currentDocument = e.doc;
                currentSession = e.doc.getSession();
                
                var options = currentSession.options;
                docSettings.forEach(function(setting) {
                    if (options[setting[2]])
                        setOption(setting[0], options[setting[2]]);
                });
                
                if (currentSession.session)
                    ace.setSession(currentSession.session);
                
                // if (!currentSession.progress && !e.doc.hasValue())
                //     console.warn("broken session progress state on documentActivate see #1144", e.doc);
                
                if (currentSession.progress || !e.doc.hasValue())
                    showProgress(currentSession.progress, currentSession.upload);
                else
                    hideProgress();

                // Theme support
                changeTheme();
            });
            plugin.on("documentUnload", function(e) {
                var session = e.doc.getSession();

                // Clear current session
                if (currentSession == session) {
                    currentSession = null;
                    currentDocument = null;
                    
                    if (ace) {
                        ace.setSession(dummySession);
                        ace.renderer.freeze();
                    }
                }
            });
            plugin.on("resize", function(e) {
                resize(e);
            });
            plugin.on("getState", function(e) {
                getState(e.doc, e.state, e.filter);
            });
            plugin.on("setState", function(e) {
                setState(e.doc, e.state);
            });
            plugin.on("clear", function(){
                if (currentSession)
                    currentSession.session.setValue("");
            });
            plugin.on("cut", function(e) {
                if (e.native) return; // Ace handles this herself
                
                var data = ace.getCopyText();
                ace.onCut();
                data && e.clipboardData.setData("text/plain", data);
            });
            plugin.on("copy", function(e) {
                if (e.native) return; // Ace handles this herself
                
                var data = ace.getCopyText();
                // check if user tries to copy text from line widget
                if (!data && document.activeElement != ace.textInput.getElement())
                    data = document.getSelection().toString().replace(/\xa0/, " ");
                data && e.clipboardData.setData("text/plain", data);
            });
            plugin.on("paste", function(e) {
                if (e.native) return; // Ace handles this herself
                
                var data = e.clipboardData.getData("text/plain");
                if (data !== false)
                    ace.onPaste(data);
            });
            plugin.on("blur", function(){
                blur();
            });
            plugin.on("focus", function(e) {
                if (e.lost) blur();
                else focus();
            });
            plugin.on("enable", function(){
                ui.removeClass(container, "aceDisabled");
            });
            plugin.on("disable", function(){
                ui.addClass(container, "aceDisabled");
            });
            plugin.on("unload", function(){
                ace.destroy();
                container.innerHTML = "";
                
                ace = null;
                container = null;
            });
            
            /***** Register and define API *****/
            
            /**
             * Ace Editor for Cloud9. Ace is the high performance code 
             * editor for the web, build and maintained by Cloud9. 
             * It is the main editor for code files and offers syntax 
             * highlighting for over 100 languages and formats. 
             * For more information see [ace's website](http://ace.c9.io). 
             * 
             * The editor exposes the [ace editor object](http://ace.c9.io/#nav=api&api=editor)
             * which in turn exposes many APIs that allow you to manipulate
             * the editor and it's contents. 
             * 
             * Example of instantiating a new terminal:
             * 
             *     tabManager.openFile("/file.js", true, function(err, tab) {
             *         if (err) throw err;
             * 
             *         var ace = tab.editor;
             *         ace.setOption("tabSize", 8);
             *     });
             * 
             * @class ace.Ace
             * @extends Editor
             */
            /**
             * The type of editor. Use this to create ace using
             * {@link tabManager#openEditor} or {@link editors#createEditor}.
             * @property {"ace"} type
             * @readonly
             */
            /**
             * Retrieves the state of a document in relation to this editor
             * @param {Document} doc  The document for which to return the state
             * @method getState
             * @return {Object}
             * @return {String}  return.customSyntax  The language mode for this document (if the default mode has been overridden).
             * @return {Number}  return.scrolltop   The amount of pixels scrolled from the top.
             * @return {Number}  return.scrollleft  The amount of pixels scrolled from the left.
             * @return {Array}   return.folds       Describing the current state
             *   of the folded code in the document.
             * @return {Object}  return.selection   Describing the current state 
             *   of the selection. This can become a complex object when 
             *   there are multiple selections.
             * @return {Object}  return.options
             * @return {String}  return.options.newLineMode            One of three values: "windows", "unix", "auto".
             * @return {Number}  return.options.tabSize                The number of spaces that is used to render a tab.
             * @return {Boolean} return.options.useSoftTabs            When set to true the tab button inserts spaces.
             * @return {Boolean} return.options.useWrapMode            Specifies whether the text is wrapped
             * @return {Boolean} return.options.wrapToView             Specifies whether the text is wrapped to the viewport, or to the print margin.
             * @return {Boolean} return.options.wrapBehavioursEnabled  Specifies whether selection wraps with Brackets, Quotes, etc.
             */
            /**
             * Sets the state of a document in relation to this editor
             * @method setState
             * @param {Document} doc    The document for which to set the state
             * @param {Object}   state  The state to set
             * @param {String}   [state.customSyntax]  The language mode for this document (if the default mode has been overridden).
             * @param {Number}   [state.scrolltop]   The amount of pixels scrolled from the top.
             * @param {Number}   [state.scrollleft]  The amount of pixels scrolled from the left.
             * @param {Array}    [state.folds]       Describing the current state
             *   of the folded code in the document.
             * @param {Object}   [state.selection]   Describing the current state 
             *   of the selection. This can become a complex object when 
             *   there are multiple selections.
             * @param {Object}   [state.options]
             * @param {String}   [state.options.newLineMode]            One of three values: "windows", "unix", "auto".
             * @param {Number}   [state.options.tabSize]                The number of spaces that is used to render a tab.
             * @param {Boolean}  [state.options.useSoftTabs]            When set to true the tab button inserts spaces.
             * @param {Boolean}  [state.options.useWrapMode]            Specifies whether the text is wrapped
             * @param {Boolean}  [state.options.wrapToView]             Specifies whether the text is wrapped to the viewport, or to the print margin.
             * @param {Boolean}  [state.options.wrapBehavioursEnabled]  Specifies whether selection wraps with Brackets, Quotes, etc.
             * @param {Object}   [state.jump]                           Scrolls the document (with an animation) to the specified location (and optionally selection).
             * @param {Number}   [state.jump.row]                       The row to jump to (0 based)
             * @param {Number}   [state.jump.column]                    The column to jump to (0 based)
             * @param {Object}   [state.jump.select]
             * @param {Number}   [state.jump.select.row]                The row to select to (0 based)
             * @param {Number}   [state.jump.select.column]             The column to select to (0 based)
             */
            plugin.freezePublicAPI({
                /**
                 * @ignore
                 */
                addEditor: addEditor,
                /**
                 * Reference to the ace editor object as described 
                 * [here](http://ace.c9.io/#nav=api&api=editor)
                 * @property {Ace.Editor} ace
                 * @readonly
                 */
                get ace(){ return emit("getAce") || ace; },
            
                /**
                 * The theme object currently used in this ace instance
                 * @property {Object}  theme               Describes the theme that is initialized.
                 * @property {String}  theme.cssClass      The css class name related to the theme.
                 * @property {String}  theme.bg            The background color for this theme.
                 * @property {String}  theme.fg            The foreground color for this theme.
                 * @property {String}  theme.path          The path of this theme.
                 * @property {Boolean} theme.isDark        Specifies whether this is a dark theme or a light theme.
                 * @readonly
                 */
                get theme(){ 
                    if (!ace) return "";
                    if (immutableSkin) {
                        var path = ace.getTheme();
                        try { var theme = require(path); } catch (e) {}
                        return theme || "";
                    }
                    else {
                        return handle.theme;
                    }
                },
                
                _events: [
                    /**
                     * Fires when a users clicks on the gutter.
                     * The gutter is the area that contains the line numbers.
                     * @event guttermousedown
                     * @param {Object} e  information on the mouse event
                     */
                    "guttermousedown",
                    /**
                     * Fires when a users clicks twice in fast succession on 
                     * the gutter. The gutter is the area that contains the 
                     * line numbers.
                     * @event gutterdblclick
                     * @param {Object} e  information on the mouse event
                     */
                    "gutterdblclick",
                    /**
                     * Fires when the current theme changes to another theme.
                     * 
                     * See also {@link ace#setTheme}.
                     * 
                     * @event themeChange
                     * @param {Object}  e
                     * @param {Object}  e.theme               Describes the theme that is initialized.
                     * @param {String}  e.theme.cssClass      The css class name related to the theme.
                     * @param {String}  e.theme.bg            The background color for this theme.
                     * @param {String}  e.theme.fg            The foreground color for this theme.
                     * @param {String}  e.theme.path          The path of this theme.
                     * @param {Boolean} e.theme.isDark        Specifies whether this is a dark theme or a light theme.
                     * @param {Object}  e.lastTheme           Describes the theme that is initialized.
                     * @param {String}  e.lastTheme.cssClass  The css class name related to the theme.
                     * @param {String}  e.lastTheme.bg        The background color for this theme.
                     * @param {String}  e.lastTheme.fg        The foreground color for this theme.
                     * @param {String}  e.lastTheme.path      The path of this theme.
                     * @param {Boolean} e.lastTheme.isDark    Specifies whether this is a dark theme or a light theme.
                     * @param {String}  e.path                The path of the theme.
                     */
                    "themeChange"
                ],
                
                /**
                 * @ignore This is here to overwrite default behavior
                 */
                isClipboardAvailable: function(e) { return !e.fromKeyboard },
                
                /**
                 * Retrieves the value of one of the ace options.
                 * 
                 * See {@link #setOption} for an overview of the options that can be retrieved.
                 * 
                 * @param {String} option  The option to retrieve
                 */
                getOption: getOption,
                
                /**
                 * Sets the value of one of the ace options.
                 * 
                 * <table>
                 * <tr><td>Option Name</td><td>              Possible Values</td></tr>
                 * <tr><td>"theme"</td><td>                  The path to the new theme.</td></tr>
                 * <tr><td>"syntax"</td><td>                 The path to the ace mode (e.g. ace/mode/javascript).</td></tr>
                 * <tr><td>"newLineMode"</td><td>            One of the following values: "windows", "unix", "auto".</td></tr>
                 * <tr><td>"tabSize"</td><td>                Number specifying the amount of spaces that represent a tab.</td></tr>
                 * <tr><td>"useSoftTabs"</td><td>            Boolean specifying whether to insert spaces when pressing the tab key.</td></tr>
                 * <tr><td>"useWrapMode"</td><td>            Specifies whether the text is wrapped</td></tr>
                 * <tr><td>"wrapToView"</td><td>             Specifies whether the text is wrapped to the viewport, or to the print margin.</td></tr>
                 * <tr><td>"wrapBehavioursEnabled"</td><td>  Specifies whether selection wraps with Brackets, Quotes, etc.</td></tr>
                 * <tr><td>"fontSize"</td><td>               Number specifying the font size in px.</td></tr>
                 * <tr><td>"fontFamily"</td><td>             String specifying the font family in css syntax.</td></tr>
                 * <tr><td>"overwrite"</td><td>              Boolean toggling overwrite mode.</td></tr>
                 * <tr><td>"selectionStyle"</td><td>         One of the following values: "line" (select the entire line), "text" (only select the text).</td></tr>
                 * <tr><td>"cursorStyle"</td><td>            One of the following values: "ace", "slim", "smooth", "wide"</td></tr>
                 * <tr><td>"highlightActiveLine"</td><td>    Boolean specifying whether to show highlighting of the line where the cursor is at.</td></tr>
                 * <tr><td>"highlightGutterLine"</td><td>    Boolean specifying whether to show highlighting in the gutter of the line where the cursor is at.</td></tr>
                 * <tr><td>"showInvisibles"</td><td>         Boolean specifying whether to show the invisible characters such as space, tab, newline.</td></tr>
                 * <tr><td>"printMarginColumn"</td><td>      Number specifying where the print margin will be in number of characters from the gutter.</td></tr>
                 * <tr><td>"showPrintMargin"</td><td>        Boolean specifying whether to show the print margin line (usually 80 chars)</td></tr>
                 * <tr><td>"displayIndentGuides"</td><td>    Boolean specifying whether to show the lines at each indentation mark</td></tr>
                 * <tr><td>"behavioursEnabled"</td><td>      Boolean specifying whether brackets are auto-paired.</td></tr>
                 * <tr><td>"scrollSpeed"</td><td>            Number specifying the number of rows that are scrolled when using the scrollwheel.</td></tr>
                 * <tr><td>"showGutter"</td><td>             Boolean specifying whether to show the gutter.</td></tr>
                 * <tr><td>"showFoldWidgets"</td><td>        Boolean specifying whether to show the fold widgets.</td></tr>
                 * <tr><td>"fadeFoldWidgets"</td><td>        Boolean specifying whether to fade the fold widgets into view on hover.</td></tr>
                 * <tr><td>"highlightSelectedWord"</td><td>  Boolean specifying whether to highlight words where the cursor is on.</td></tr>
                 * <tr><td>"animatedScroll"</td><td>         Boolean specifying whether scrolling is animated.</td></tr>
                 * <tr><td>"scrollPastEnd"</td><td>          Number specifying how far the user can scroll past the end. There are 3 possible values: 0, 0.5, 1.</td></tr>
                 * <tr><td>"mergeUndoDeltas"</td><td>        Boolean specifying whether to combine multiple operations as one on the undo stack.</td></tr>
                 * </table>
                 * 
                 * @param {String} option  The option to set
                 * @param {String} value   The value of the option
                 */
                setOption: setOption,
                
                /**
                 * Set multiple options by passing a multi-dimensional array
                 * with key/value pairs.
                 * 
                 * See also {@link #setOption}
                 * 
                 * @param {Array} options The options to set.
                 */
                setOptions: setOptions,
                
                /**
                 * Scrolls the currently active document to the specified row 
                 * and column and places the cursor there and optionally 
                 * select a piece of text.
                 * 
                 * @param {Number} row              The row to jump to (0 based)
                 * @param {Number} column           The column to jump to (0 based)
                 * @param {Object} [select]
                 * @param {Number} [select.row]     The row to select to (0 based)
                 * @param {Number} [select.column]  The column to select to (0 based)
                 */
                scrollTo: scrollTo
            });
            
            // Emit create event on handle
            setTimeout(function(){
                if (plugin.loaded) {
                    handleEmit.sticky("create", { editor: plugin }, plugin);
                }
            });
            
            plugin.load(null, "ace");
              
            return plugin;
        }
        
        register(null, {
            ace: handle
        });
    }
});
