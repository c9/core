define(function(require, exports, module) {
    main.consumes = [
        "Panel", "c9", "settings", "ui", "menus", "panels", "tabManager", 
        "language", "util", "language.jumptodef", "navigate", "layout",
        "commands", "jsonalyzer"
    ];
    main.provides = ["outline"];
    return main;

    function main(options, imports, register) {
        var Panel = imports.Panel;
        var settings = imports.settings;
        var ui = imports.ui;
        var util = imports.util;
        var menus = imports.menus;
        var panels = imports.panels;
        var layout = imports.layout;
        var navigate = imports.navigate;
        var tabs = imports.tabManager;
        var language = imports.language;
        var commands = imports.commands;
        var jsonalyzer = imports.jsonalyzer;
        var jumptodef = imports["language.jumptodef"];
        var escapeHTML = require("ace/lib/lang").escapeHTML;
        var Range = require("ace/range").Range;
        var search = require("../c9.ide.navigate/search");
        var markup = require("text!./outline.xml");
        var Tree = require("ace_tree/tree");
        var TreeData = require("./outlinedp");
        
        /***** Initialization *****/
        
        var plugin = new Panel("Ajax.org", main.consumes, {
            index: options.index || 50,
            width: 250,
            caption: "Outline",
            buttonCSSClass: "outline",
            minWidth: 130,
            where: options.where || "right",
            autohide: true
        });
        
        var fullOutline = [];
        var ignoreFocusOnce = false;
        var staticPrefix = options.staticPrefix;
        
        var tree, tdOutline, winOutline, textbox, treeParent; // UI Elements
        var originalLine, originalColumn, originalTab;
        var focussed, isActive, outline, timer, dirty, scheduled, scheduleWatcher;
        var isUnordered, lastFilter, hasNavigateOutline;
        var worker;
        
        var COLLAPSE_AREA = 14;
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            plugin.setCommand({
                name: "outline",
                hint: "search for a definition and jump to it",
                bindKey: { mac: "Command-Shift-E", win: "Ctrl-Shift-E" },
                exec: function() {
                    if (isActive) {
                        if (focussed) {
                            panels.deactivate("outline");
                            tabs.focussedTab && tabs.focussedTab.aml.focus();
                        }
                        else {
                            textbox.focus();
                        }
                    }
                    else {
                        panels.activate("outline");
                    }
                }
            });
            
            isActive = panels.isActive("outline");
            
            // Menus
            menus.addItemByPath("Goto/Goto Symbol...", 
                new apf.item({ command: "outline" }), 110, plugin);
            
            language.getWorker(function(err, worker) {
                worker.on("outline", onOutlineData); 
            });
            
            // Hook events to get the focussed tab
            tabs.on("open", function(e) {
                var tab = e.tab;
                if (!isActive 
                  || !tab.path && !tab.document.meta.newfile 
                  || !tab.editor.ace || tab != tabs.focussedTab)
                    return;
                
                if (!originalTab) 
                    originalTab = e.tab;
                
                updateOutline(true);
            });
            
            tabs.on("focusSync", onTabFocus);
            
            tabs.on("tabDestroy", function(e) {
                if (isActive && e.last)
                    clear();
            });
            
            var cursorTimeout;
            language.on("cursormove", function() {
                if (cursorTimeout || !isActive)
                    return;
                cursorTimeout = setTimeout(function moveSelection() {
                    if ((dirty || scheduled) && isActive)
                        return setTimeout(moveSelection, 50);
                    try {
                        handleCursor();
                    }
                    finally {
                        cursorTimeout = null;
                    }
                }, 100);
            });
            
            // TODO also in scm.commit - move to panel?
            panels.on("showPanelOutline", function(e) {
                plugin.autohide = !e.button;
            }, plugin);
            panels.on("hidePanelOutline", function(e) {
                plugin.autohide = true;
            }, plugin);
            
            if (isActive && tabs.focussedTab) {
                plugin.autohide = false;
                updateOutline();
                onTabFocus({ tab: tabs.focussedTab });
            }
            
            updateInitialOutline();
            
            // Extends navigate with outline support
            
            var wasActive, onsel = function() {
                if (!navigate.tree.isFocused()) return;
                var node = navigate.tree.selection.getCursor();
                if (node) onSelect(node);
            };
            navigate.on("outline", function(e) {
                var value = e.value;
                
                if (!tdOutline) createProvider();
                
                tabs.focusTab(e.tab, true);
                
                hasNavigateOutline = true;
                wasActive = isActive;
                isActive = true;
                onTabFocus(e, true);
                
                navigate.tree.off("changeSelection", onsel);
                navigate.tree.setDataProvider(tdOutline);
                navigate.tree.on("changeSelection", onsel);
                
                renderOutline(true, value);
                
                ui.setStyleClass(navigate.tree.container, "outline");
            });
            navigate.on("outline.stop", function(e) {
                hasNavigateOutline = false;
                renderOutline(true);
                navigate.tree.off("changeSelection", onsel);
                ui.setStyleClass(navigate.tree.container, "", ["outline"]);
                isActive = wasActive;
            });
        }
        
        /**
         * Get an initial outline, taking into account that there may
         * be some time required before all (unknown number of) outliner
         * language plugins are loaded.
         */
        function updateInitialOutline() {
            setTimeout(updateOutline.bind(null, true), 4000);
            setTimeout(updateOutline.bind(null, true), 6000);
            setTimeout(updateOutline.bind(null, true), 8000);
            setTimeout(updateOutline.bind(null, true), 10000);
            setTimeout(updateOutline.bind(null, true), 20000);
        }
        
        function onTabFocus(event, force) {
            var tab = event.tab;
            var session;
            
            if (originalTab == tab && force !== true)
                return;
            
            // Remove change listener
            if (originalTab) {
                session = originalTab.document.getSession().session;
                session && session.off("changeMode", onChange);
                session && session.off("change", onChange);
            }
            
            if ((!tab.path && !tab.document.meta.newfile) || tab.editorType !== "ace") {
                originalTab = null;
                return clear(tab.editorType);
            }
            
            if (!tab.editor)
                return tab.document.once("setEditor", onTabFocus.bind(null, event));
                
            // Add change listener
            session = tab.document.getSession().session;
            session && session.on("changeMode", onChange);
            session && session.on("change", onChange);
            
            originalTab = tab;
            
            if (isActive)
                updateOutline(true);
        }
        
        function onChange() {
            if (isActive && originalTab == tabs.focussedTab)
                updateOutline();
        }
        
        function handleCursor(ignoreFocus) {
            if (isActive && originalTab && originalTab == tabs.focussedTab) {
                var ace = originalTab.editor.ace;
                if (!outline || !ace.selection.isEmpty() || (!tree || tree.isFocused() && !ignoreFocus))
                    return;
                    
                var selected = findCursorInOutline(outline, ace.getCursorPosition());
            
                if (tdOutline.$selectedNode == selected)
                    return;
            
                if (selected)
                    tree.selection.selectNode(selected);
                else
                    tree.selection.selectNode(0);

                tree.renderer.scrollCaretIntoView(null, 0.5);
            }
        }

        function createProvider() {
            // Import CSS
            ui.insertCss(require("text!./outline.css"), staticPrefix, plugin);
            
            // Define data provider
            tdOutline = new TreeData();
            
            // Some global render metadata
            tdOutline.staticPrefix = staticPrefix;
        }
        
        var drawn = false;
        function draw(options) {
            if (drawn) return;
            drawn = true;
            
            // Create UI elements
            ui.insertMarkup(options.aml, markup, plugin);
            
            treeParent = plugin.getElement("outlineTree");
            textbox = plugin.getElement("textbox");
            winOutline = options.aml;
            
            var key = commands.getPrettyHotkey("outline");
            textbox.setAttribute("initial-message", "Filter (" + key + ")");
        
            // Create the Ace Tree
            tree = new Tree(treeParent.$int);
            tree.renderer.setScrollMargin(0, 10);
            tree.renderer.scrollBarV.$minWidth = 10;
            
            if (!tdOutline)
                createProvider();
            
            // Assign the dataprovider
            tree.setDataProvider(tdOutline);

            // @TODO this is probably not sufficient
            layout.on("resize", function() { tree.resize(); }, plugin);
            
            tree.textInput = textbox.ace.textInput;
            
            textbox.ace.commands.addCommands([
                {
                    bindKey: "ESC",
                    exec: function() {
                        if (!originalTab || !originalTab.loaded) 
                            return clear();
                        
                        if (originalLine) {
                            var ace = originalTab && originalTab.editor.ace;
                            ace.gotoLine(originalLine, originalColumn, 
                                settings.getBool("editors/code/@animatedscroll"));
                            
                            originalLine = originalColumn = null;
                        }
                        
                        textbox.setValue("");
                        tabs.focusTab(originalTab);
                    }
                }, {
                    bindKey: "Up",
                    exec: function() { tree.execCommand("goUp"); }
                }, {
                    bindKey: "Down",
                    exec: function() { tree.execCommand("goDown"); }
                }, {
                    bindKey: "Enter",
                    exec: function() {
                        onSelect();
                        
                        textbox.setValue("");
                        originalTab.loaded && tabs.focusTab(originalTab);
                    }
                }
            ]);
            
            textbox.ace.on("input", function(e) {
                renderOutline();
                onSelect();
            });
            
            tree.on("userSelect", function() {
                if (tree.isFocused())
                    onSelect();
            });
            
            function onAllBlur(e) {
                if (!winOutline.visible || !plugin.autohide)
                    return;
                
                var to = e.toElement;
                if (!to || apf.isChildOf(winOutline, to, true)) {
                    return;
                }
                
                // TODO add better support for overlay panels
                setTimeout(function() { plugin.hide(); }, 10);
            }
    
            apf.addEventListener("movefocus", onAllBlur);
            
            function onFocus() { 
                focussed = true;
                ui.setStyleClass(treeParent.$int, "focus"); 
                
                var tab = tabs.focussedTab;
                var ace = tab && tab.editor.ace;
                if (!ace) return;
                
                var cursor = ace.getCursorPosition();
                originalLine = cursor.row + 1;
                originalColumn = cursor.column;
            }
            function onBlur() { 
                focussed = false;
                ui.setStyleClass(treeParent.$int, "", ["focus"]); 
            }
            
            textbox.ace.on("blur", onBlur);
            textbox.ace.on("focus", onFocus);
            
            language.getWorker(function(err, _worker) {
                worker = _worker;
                timer = setInterval(function() {
                    if (dirty)
                        updateOutline(true);
                }, 1000);
            });
        }
        
        /***** Methods *****/
        
        function updateOutline(now) {
            if (!isActive)
                return;
            dirty = true;
            if (now && tabs.focussedTab && !scheduled) {
                if (!worker) {
                    return language.getWorker(function(err, _worker) {
                        worker = _worker;
                        updateOutline(true);
                    });
                }
                
                // have to use timeout since worker uses timeout as well
                setTimeout(function () {
                    dirty = false;
                    worker.emit("outline", { data: {
                        ignoreFilter: false,
                        path: tabs.focussedTab && tabs.focussedTab.path
                    }});
                });
                
                // Don't schedule new job until data received or timeout
                scheduled = true;
                clearTimeout(scheduleWatcher);
                scheduleWatcher = setTimeout(function() {
                    scheduled = false;
                }, 10000);
            }
        }
    
        function findCursorInOutline(json, cursor) {
            return isUnordered && findPrecise(json, cursor) || findApprox(json, cursor);
            
            function findPrecise(json, cursor) {
                for (var i = 0; i < json.length; i++) {
                    var elem = json[i];
                    if (cursor.row < elem.pos.sl || cursor.row > (elem.pos.el || elem.pos.sl))
                        continue;
                    var childResult = elem.items && findPrecise(elem.items, cursor);
                    return childResult || elem;
                }
                return null;
            }
            function findApprox(json, cursor) {
                var result;
                for (var i = 0; i < json.length; i++) {
                    var elem = json[i];
                    var childResult = elem.items && findApprox(elem.items, cursor);
                    if (childResult)
                        result = childResult;
                    else if (elem.pos.sl <= cursor.row)
                        result = elem;
                }
                return result;
            }
        }   
    
        function onOutlineData(event) {
            scheduled = false;
            if (hasNavigateOutline)
                return;
            var data = event.data;
            if (data.error) {
                // TODO: show error in outline?
                console.error("Oh noes! " + data.error);
                return;
            }
            
            var tab = tabs.focussedTab;
            var editor = tab && tab.editor;
            if (!tab || (!tab.path && !tab.document.meta.newfile) || !editor.ace)
                return;
                
            if (dirty || tab.path !== data.path)
                updateOutline(true);
            else
                clearTimeout(scheduleWatcher);
            
            fullOutline = event.data.body;
            isUnordered = event.data.isUnordered;
            renderOutline(event.data.showNow);
        }
        
        function renderOutline(ignoreFilter, filter) {
            var tab = tabs.focussedTab;
            var editor = tab && tab.editor;
            if (!tab || !tab.path && !tab.document.meta.newfile || !editor.ace)
                return;
                
            originalTab = tab;
            
            if (!filter)
                filter = ignoreFilter ? "" : (textbox ? textbox.getValue() : lastFilter);
            
            outline = search.treeSearch(fullOutline, filter, true);
            lastFilter = filter;
    
            var ace = editor.ace;
            var selected = findCursorInOutline(outline, ace.getCursorPosition());
            
            tdOutline.setRoot(outline);
            tdOutline.selected = selected;
            tdOutline.filter = filter;
            tdOutline.reFilter = escapeHTML(util.escapeRegExp(filter));
            
            if (filter) {
                tree && tree.select(tree.provider.getNodeAtIndex(0));
                if (hasNavigateOutline)
                    navigate.tree.select(navigate.tree.provider.getNodeAtIndex(0));
            }
            else if (selected) {
                tdOutline.selection.selectNode(selected);
            }
            
            if (drawn) {
                tree.resize();
                handleCursor(ignoreFocusOnce);
                ignoreFocusOnce = false;
            }
            
            return selected;
        }
    
        function onSelect(node) {
            if (!node) 
                node = tree.selection.getCursor();
            if (!node)
                return; // ok, there really is no node
                
            if (!originalTab.loaded) 
                return clear();
            
            var ace = originalTab.editor.ace; 
            var pos = jumptodef.addUnknownColumn(ace, node.pos, node.name);
            var displayPos = node.displayPos
                ? jumptodef.addUnknownColumn(ace, node.displayPos, node.name)
                : undefined;
            scrollToDefinition(ace, pos.sl, pos.el);
            var range = displayPos
                ? new Range(
                      displayPos.sl,
                      displayPos.sc,
                      displayPos.el || displayPos.sl,
                      displayPos.el > displayPos.sl
                        ? displayPos.ec || 0
                        : displayPos.ec || displayPos.sc
                  )
                : new Range(pos.sl, pos.sc, pos.sl, pos.sc);
            // todo fold back
            ace.session.unfold(range);
            ace.selection.setSelectionRange(range);
        }
        
        function clear(type) {
            if (textbox) {
                textbox.setValue("");
                if (type === "terminal")
                    tdOutline.setRoot([{ icon: "property", name: "Terminal" }]);
                else
                    tdOutline.setRoot({});
            }
        }
        
        function scrollToDefinition(ace, line, lineEnd) {
            var lineHeight = ace.renderer.$cursorLayer.config.lineHeight;
            var lineVisibleStart = ace.renderer.scrollTop / lineHeight;
            var linesVisible = ace.renderer.$size.height / lineHeight;
            lineEnd = Math.min(lineEnd, line + linesVisible);
            if (lineVisibleStart <= line && lineEnd <= lineVisibleStart + linesVisible)
                return;

            var SAFETY = 1.5;
            ace.scrollToLine(Math.round((line + lineEnd) / 2 - SAFETY), true);
        }
        
        function addOutlinePlugin(path, contents, plugin) {
            var template = require("text!./outline_template.js");
            
            template = template.replace("{{CONFIG}}", function() {
                return contents;
            });
            
            jsonalyzer.registerWorkerHandler(path, template);
            
            plugin.addOther(function() {
                if (jsonalyzer.unregisterWorkerHandler)
                    jsonalyzer.unregisterWorkerHandler(path);
            });
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("draw", function(e) {
            load();
            draw(e);
        });
        plugin.on("show", function(e) {
            isActive = true;
            tree.resize();
            plugin.autohide = !e.button;
            
            if (e.button === "restoreSettings")
                return;
            textbox.focus();
            textbox.select();
            
            updateOutline(true);
            handleCursor(true);
            ignoreFocusOnce = true;
        });
        plugin.on("hide", function(e) {
            // tree.clearSelection();
            isActive = false;
        });
        plugin.on("unload", function() {
            loaded = false;
            drawn = false;
            
            fullOutline = [];
            ignoreFocusOnce = false;
            // staticPrefix = options.staticPrefix;
            
            tree = null;
            tdOutline = null;
            winOutline = null;
            textbox = null;
            treeParent = null;
            originalLine = null;
            originalColumn = null;
            originalTab = null;
            focussed = null;
            isActive = null;
            outline = null;
            timer = null;
            dirty = null;
            scheduled = null;
            scheduleWatcher = null;
            isUnordered = null;
            lastFilter = null;
            hasNavigateOutline = null;
            worker = null;
            
            clearInterval(timer);
        });
        
        /***** Register and define API *****/
        
        /**
         * Outline panel. Allows a user to navigate to a file from a structured
         * listing of all it's members and events.
         * @singleton
         * @extends Panel
         **/
        /**
         * @command outline
         */
        /**
         * Fires when the outline panel shows
         * @event showPanelOutline
         * @member panels
         */
        /**
         * Fires when the outline panel hides
         * @event hidePanelOutline
         * @member panels
         */
        plugin.freezePublicAPI({
            /**
             * 
             */
            addOutlinePlugin: addOutlinePlugin
        });
        
        register(null, {
            outline: plugin
        });
    }
});
