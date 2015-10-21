define(function(require, module, exports) {
    main.consumes = [
        "Plugin", "menus", "settings", "layout", "ui", "commands", "fs", 
        "Tab", "editors", "Pane", "watcher", "c9", "dialog.alert", 
        "focusManager", "util"
    ];
    main.provides = ["tabManager"];
    return main;
    
    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var Tab = imports.Tab;
        var Pane = imports.Pane;
        var ui = imports.ui;
        var fs = imports.fs;
        var c9 = imports.c9;
        var settings = imports.settings;
        var util = imports.util;
        var menus = imports.menus;
        var editors = imports.editors;
        var commands = imports.commands;
        var layout = imports.layout;
        var watcher = imports.watcher;
        var focusManager = imports.focusManager;
        var alert = imports["dialog.alert"].show;
        
        var basename = require("path").basename;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        emit.setMaxListeners(100);
        
        var loadFilesAtInit = options.loadFilesAtInit;
        var ideProviderName = options.ideProviderName || "Cloud9";
        
        var PREFIX = "/////";
        var XPREVIEW = /\.(gz|tar|tgz|zip|rar|jar|exe|pyc|pdf)$/;
        
        var unfocussed = true;
        var showTabs = true;
        var panes = []; // aml pane elements
        var tabs = {}; // Tab objects (non-aml)
        var containers = [];
        var counter = 1;
        
        var focussedTab, previewTab, previewTimeout;
        var container, mnuEditors, collapsedMenu, isReady;
        
        // Ref to focusManager - this will be changed later
        focusManager.tabManager = plugin;
        
        var loaded = false, changed = false;
        function load(){
            if (loaded) return false;
            loaded = true;
            
            draw();
            
            // Commands & Menus
            
            commands.addCommand({
                name: "toggleButtons",
                group: "Tabs",
                exec: function(e) {
                    toggleButtons();
                }
            }, plugin);
            
            // commands.addCommand({
            //     name    : "newfile",
            //     group   : "Tabs",
            //     exec    : function(e) {
            //         plusNewFile({}, true);
            //     }
            // }, plugin);
            
            function getEditor(){
                var editor = focussedTab && focussedTab.editor;
                var subeditor = editor && editor.focussedWidget;
                return subeditor && subeditor.editor || editor;
            }
            commands.on("getEditor", getEditor, plugin);
            menus.on("getEditor", getEditor, plugin);
            
            menus.addItemByPath("View/Tab Buttons", new apf.item({
                type: "check",
                checked: "user/tabs/@show",
                command: "toggleButtons"
            }), 300, plugin);
            
            menus.on("focusEditor", function(){
                focussedTab && focussedTab.editor.focus();
            }, plugin);

            // Filesystem hooks

            fs.on("beforeRename", function(e) {
                var oldPath = e.args[0];
                var newPath = e.args[1];
                
                var changed = [];
                Object.keys(tabs).forEach(function(id) {
                    var tab = tabs[id];
                    if (tab.path && tab.path.indexOf(oldPath) === 0) {
                        var char = tab.path.charAt(oldPath.length);
                        // Make sure that a path like /Untitled1 is not matched
                        // by a path like /Untitled, which are clearly different
                        // files with no relation to each other
                        if (!char || char == "/") {
                            tab.path = tab.path.replace(oldPath, newPath);
                            changed.push(tab);
                        }
                    }
                });
                
                if (changed.length) {
                    e.revert = function(){
                        changed.forEach(function(tab) {
                            // TODO store id instead of tab
                            // var tab = pages[id];
                            tab.path = tab.path.replace(newPath, oldPath);
                        });
                    };
                }
            });
            fs.on("afterRename", function(e) {
                if (e.error && e.revert) 
                    e.revert();
            });
            function removeTab(e) {
                if (!e.error) { 
                    var tab = findTab(e.path);
                    if (tab) {
                        tab.document.meta.$ignoreSave = true;
                        tab.close();
                        delete tab.document.meta.$ignoreSave;
                    }
                }
            }
            fs.on("afterUnlink", removeTab);
            fs.on("afterRmfile", removeTab);
            fs.on("afterRmdir", function(e) {
                var path = e.path;
                Object.keys(tabs).forEach(function(id) {
                    var tab = tabs[id];
                    if (tab.path && tab.path.indexOf(path) === 0) {
                        tab.unload();
                    }
                });
            });
            // Close a pane when it doesn't open
            // @todo this should probably be interactive (unless during init)
            // @todo move this to tabbehaviours?
            fs.on("error", function(e) {
                if (e.name == "readFile") {
                    var tab = findTab(e.path);
                    if (tab)
                        tab.unload();
                }
            }, plugin);
            
            // Disconnect handler
            var disconnected;
            c9.on("disconnect", function(e) {
                disconnected = true;
            });
            c9.on("connect", function(e) {
                if (disconnected)
                    checkAllTabs();
                disconnected = false;
            });
            
            // Editors menu handling
            
            editors.on("menuClick", function(e) {
                if (!editors.findEditor(e.value).fileExtensions.length)
                    openEditor(e.value, true, function(){});
                else if (focussedTab)
                    switchEditor(focussedTab, e.value, function(){});
            });
            editors.on("menuShow", function(e) {
                var group, editor = focussedTab && focussedTab.editor;
                e.menu.childNodes.forEach(function(node) {
                    group = node.group;
                    
                    var path = focussedTab && focussedTab.path || "";
                    var type = node.value;
                    var isAvailable = editors.editorSupportsFile(type, path);
        
                    node.setAttribute("disabled", !isAvailable);
                });

                if (editor && group)
                    group.setValue(editor.type);
            });
            
            // Settings
            settings.on("read", function(e) {
                // Defaults
                settings.setDefaults("user/tabs", [
                    ["show", "true"], 
                    ["title", "false"],
                    ["asterisk", "false"]
                ]);
                settings.setDefaults("state/tabs", []);
                
                // Corner Handling
                collapsedMenu = settings.getBool("state/menus/@minimized");
                
                if (e.reset) {
                    setCornerPadding();
                    return;
                }
                
                // Create new tabs
                var state = settings.getJson("state/tabs");
                if (!state) {
                    state = {
                        type: "pane", 
                        nodes: []
                    };
                }
                
                setTimeout(function() {
                    // Only set the state if we're not testing something else
                    if (options.testing != 2 && !isReady) {
                        setState(state, !isReady, function(){
                            emit.sticky("ready");
                        });
                    }
                    isReady = true;
                    
                    showTabs = settings.getBool("user/tabs/@show");
                    toggleButtons(showTabs);
                }, 0);
                
                if (settings.getBool("user/tabs/@asterisk"))
                    ui.setStyleClass(container, "asterisk");
                
                changed = false;
                
            }, plugin);
            
            settings.on("write", function(e) {
                if (!changed && !e.unload)
                    return;
                
                // When testing another component, don't save state
                if (options.testing != 2) {
                    var state = getState(null, true);
                    settings.setJson("state/tabs", state);
                }

                changed = false;
            }, plugin);
            
            settings.on("user/tabs/@asterisk", function(value) {
                containers.forEach(function(container) {
                    if (value)
                        ui.setStyleClass(container, "asterisk");
                    else
                        ui.setStyleClass(container, "", ["asterisk"]);
                });
            });

            // Top Right Corner Handling
            var CSS1 = ".editor_tab.morepadding .btnsesssioncontainer";
            var CSS2 = ".editor_tab .btnsesssioncontainer";
            var clearAnim = function(prop){
                setTimeout(function(){
                    ui.setStyleRule(prop, "transition-duration", "0");
                }, 200);
            };
            
            menus.on("minimize", function(){
                collapsedMenu = true;
                
                ui.setStyleRule(CSS1, "transition-duration", ".2s");
                clearAnim(CSS1);
                
                setCornerPadding();
            });
            menus.on("restore", function(){
                collapsedMenu = false;
                if (lastCorner) {
                    ui.setStyleRule(CSS2, "transition-duration", ".2s");
                    clearAnim(CSS2);
                    
                    ui.setStyleClass(lastCorner.$ext, "", ["morepadding"]);
                    lastCorner = null;
                }
            });
            
            // Focus Handling
            apf.addEventListener("movefocus", function(e) {
                var iter = e.toElement, list = [], c = 0;
                
                if (iter && iter.localName == "menu")
                    return;
                
                while (iter && containers.indexOf(iter) == -1) 
                    iter = (list[c++] = iter).parentNode;
                if (!iter) {
                    // Editor can be unset during unload of tabs
                    if (!unfocussed && focussedTab && focussedTab.editor) {
                        focussedTab.editor.focus(false, true);
                        unfocussed = true;
                    }
                    return;
                }
                
                for (var pane, i = list.length - 1; i >= 0; i--) {
                    if ((pane = list[i]).localName == "tab") {
                        if (pane.getPages().length < 1 
                          || !pane.cloud9pane.visible) 
                            continue;
                        
                        var newFocus = pane.getPage().cloud9tab;
                        if (newFocus != focussedTab || unfocussed) {
                            var soft = e.toElement != newFocus.aml ? 2 : 0;
                            focusTab(newFocus, soft);
                        }
                        unfocussed = false;
                        
                        iter.$activePaneName = pane.cloud9pane.name;

                        return;
                    }
                }
                
                focusTab(); // Blur
            });
            
            // Title
            if (!c9.local) {
                plugin.on("focusSync", function(e){ updateTitle(e.tab) });
                plugin.on("tabDestroy", function(e){ if (e.last) updateTitle(); });
                settings.on("user/tabs", function(){ updateTitle(focussedTab); });
            }
        }
        
        var drawn = false;
        function draw(){
            if (drawn) return;
            drawn = true;
            
            // Don't draw Tabs if we're testing something that just depends 
            // on this plugin
            if (options.testing != 2) {
                container = layout.findParent(plugin).appendChild(new ui.bar({
                    "class"  : "codeditorHolder",
                    "style"  : "height:100%"
                    //style    : "position:absolute;"
                }));
                containers.push(container);
                plugin.addElement(container);
            }
            
            mnuEditors = apf.document.documentElement.appendChild(new ui.menu({
                id: "mnuEditors",
                style: "margin: 0px 0 0 4px",
                "onprop.visible" : function(e) {
                    if (e.value)
                        mnuEditors.pane = this.opener.parentNode.cloud9pane;
                }
            }));
            plugin.addElement(mnuEditors);
            
            menus.addItemToMenu(mnuEditors,
                new ui.item({
                    caption: "New File",
                    hotkey: "{commands.commandManager.newfile}",
                    onclick: function(e) {
                        e.pane = this.parentNode.pane;
                        plusNewFile(e, true);
                    },
                    enabled: !c9.readonly
                }), 100, plugin);
            
            emit("draw");
        }
        
        function plusNewFile(e, force) {
            if (force || emit("plusClick", e) !== false) {
                var name;
                do{ name = "/Untitled" + counter++; } while (findTab(name));
                
                open({
                    path: name,
                    active: true,
                    pane: e.pane,
                    value: "",
                    document: {
                        meta: {
                            newfile: true
                        }
                    }
                }, function(){});
            }
        }
        
        function createPane(state) {
            state.createPane = createPane;
            state.container = container;
            
            var pane = new Pane(state);
            
            pane.on("beforeSwitch", onbeforeswitch);
            pane.on("afterSwitch", onafterswitch);
            
            var btnPlus = pane.getElement("btnPlus");
            btnPlus.setAttribute("submenu", mnuEditors);
            
            pane.on("beforeClose", function(e) {
                return emit("tabBeforeClose", e);
            });
            pane.on("afterClose", function(e) {
                return emit("tabAfterClose", e);
            });
            
            pane.on("tabOrder", function(e) {
                changed = true;
                settings.save();

                return emit("tabOrder", e);
            });
            
            pane.on("unload", function(){
                panes.remove(pane);
                
                if (focussedTab && !focussedTab.isActive()) {
                    if (!panes.length) {
                        focussedTab = null;
                        unfocussed = true;
                    }
                    else
                        focusTab(panes[0].getTab(), true);
                }

                emit("paneDestroy", { pane: pane });
                
                setCornerPadding();
                
                changed = true;
                settings.save();
            });
            
            panes.push(pane);
            
            pane.aml.once("DOMNodeInsertedIntoDocument", function(){
                emit.sticky("paneCreate", { pane: pane }, pane);
            });
            
            if (!settings.getBool("user/tabs/@show"))
                ui.setStyleClass(pane.aml.$ext, "notabs", ["notabs"]);
            
            changed = true;
            settings.save();
        
            return pane;
        }
        
        function updateTitle(tab) {
            document.title = tab && settings.getBool("user/tabs/@title") && tab.title
                ? tab.title + " - "  + ideProviderName
                : c9.projectName + " - "  + ideProviderName;
        }
        
        var lastCorner;
        function setCornerPadding(){
            if (!collapsedMenu || c9.local) return;
            
            var tab = (function recur(node){
                if (!node) 
                    return false;
                else if (node.localName == "tab")
                    return node;
                else if (node.$vbox)
                    return recur(node.getFirstChild());
                else
                    return recur(node.getSecondChild() || node.getFirstChild());
            })(container.childNodes[0]);
            
            if (!tab || tab == lastCorner)
                return;
            
            if (lastCorner)
                ui.setStyleClass(lastCorner.$ext, "", ["morepadding"]);
            
            ui.setStyleClass(tab.$ext, "morepadding");
            
            lastCorner = tab;
        }
        
        function createTab(state){
            if (!state.pane) {
                if (focussedTab && ui.isChildOf(container, focussedTab.aml)) {
                    state.pane = focussedTab.pane;
                }
                if (!state.pane) {
                    var i = 0;
                    while (panes[i] && !ui.isChildOf(container, panes[i].aml)) { i++ }
                    state.pane = panes[i];
                }
                if (!state.pane) {
                    throw new Error("Called open too early. Please wait until "
                        + "a pane is available. Use the ready event.");
                }
            }
            
            var tab = new Tab(state);
            
            var id = !tab.document.meta.cloned && tab.path 
                ? tab.path 
                : PREFIX + tab.name;
            tabs[id] = tab;
            
            tab.on("close", function(e) {
                var id = !tab.document.meta.cloned && tab.path 
                    ? tab.path 
                    : PREFIX + tab.name;
                delete tabs[id];
                
                if (tab.path)
                    watcher.unwatch(tab.path);
                
                if (!(function(){for (var p in tabs){return true;}})()) {
                    focusTab();
                    focussedTab = null;
                    unfocussed = true;
                }
                else if (!tab.pane.getTabs().length) {
                    if (panes.every(function(pane) {
                        if (pane.activeTab && pane.visible) {
                            focusTab(pane.activeTab);
                            return false;
                        }
                        return true;
                    })) focusTab(); // blur
                }

                if (tab.document.canUnload() !== false)
                    tab.document.unload();
                
                emit("tabDestroy", {
                    tab: tab,
                    last: e.last,
                    htmlEvent: e.htmlEvent
                });
                
                changed = true;
                settings.save();
            });
            
            tab.on("setPath", function(e) {
                var meta = tab.document.meta;
                if (!meta.preview && !meta.ignoreState && !meta.cloned) {
                    watcher.unwatch(e.oldpath);
                    watcher.watch(e.path);
                }
                
                if (!meta.cloned) {
                    if (tabs[PREFIX + tab.name])
                        delete tabs[PREFIX + tab.name];
                    delete tabs[e.oldpath];
                    tabs[e.path] = tab;
                }
                
                updateTitle(tab);
                
                changed = true;
                settings.save();
            });
            
            tab.on("beforeReparent", function(e) {
                e.tab = tab;
                return emit("tabBeforeReparent", e);
            });
            tab.on("afterReparent", function(e) {
                e.tab = tab;
                emit("tabAfterReparent", e);
            });
            
            // Only watch pages with paths. Newfiles first need to be saved
            if (tab.path) {
                var meta = tab.document.meta;
                if (meta.newfile) {
                    fs.on("afterWriteFile", function startWatch(e) {
                        if (e.path == tab.path) {
                            watcher.watch(tab.path);
                            fs.off("afterWriteFile", startWatch);
                        }
                    }, tab); // Only exists for the lifetime of the tab
                }
                else {
                    // Previewed files shouldn't be watched
                    if (!meta.preview && !meta.ignoreState && !meta.nofs && !meta.cloned)
                        watcher.watch(tab.path);
                    else
                        console.warn("[watchers] ignoring preview/ignoreState tab " + tab.path);
                }
            }
                
            emit.sticky("tabCreate", { tab: tab }, tab);
            
            changed = true;
            settings.save();
            
            return tab;
        }
        
        /* Event Handlers */
        
        function onbeforeswitch(e) {
            var amlPane = e.pane.aml;
            var tab = e.tab;
            
            var editorTab = amlPane.getPage(tab.aml.type);
            if (!editorTab) return;
            
            if (emit("tabBeforeActivate", {
                tab: tab
            }) === false)
                return false;
        }
    
        function onafterswitch(e) {
            var tab = e.tab;
            
            if (!loaded || tab.document.meta.preview) 
                return;
            
            var lastTab = focussedTab;
            
            if (!focussedTab || focussedTab.pane == tab.pane && focussedTab != tab)
                focusTab(tab, true, true);
            
            // Undocumented
            emit("tabAfterActivateSync", {
                lastTab: lastTab,
                tab: tab
            });
                
            setTimeout(function(){
                emit("tabAfterActivate", {
                    lastTab: lastTab,
                    tab: tab
                });
    
                changed = true;
                settings.save();
            }, 500);
        }
        
        /***** Methods *****/
        
        function getState(subcontainer, filter) {
            var state = (function recur(node) {
                if (!node) return;
                
                var name = node.localName;
                var isPane = name == "tab";
                if (isPane) name = "pane";
                
                var state = {
                    type: name,
                    name: isPane ? node.cloud9pane.name : undefined,
                    nodes: node.childNodes
                        .filter(function(child) {
                            if (isPane
                              && (child.localName != "page" || !child.visible)
                              || child.localName == "splitter")
                                return false;
                            
                            // Exclude previewing pages;
                            var tab = child.cloud9tab;
                            return !tab || !tab.document.meta.preview
                                && !tab.document.meta.ignoreState;
                        })
                        .map(function(child) {
                            return isPane 
                                ? child.cloud9tab.getState(filter) 
                                : recur(child);
                        })
                };
                
                if (node.width)   state.width = node.width;
                if (node.height)  state.height = node.height;
                if (node.skin)    state.skin = node.skin;
                if (node.skinset) state.skinset = node.skinset;
                
                if (isPane && node.cloud9pane.meta) {
                    var meta = node.cloud9pane.meta;
                    for (var prop in meta) {
                        if (prop.charAt(0) != "$") {
                            if (!state.meta) 
                                state.meta = {};
                            state.meta[prop] = meta[prop] && meta[prop].toJson
                                ? meta[prop].toJson() : meta[prop];
                        }
                    }
                }
                
                return state;
            })(subcontainer || container.firstChild);
            
            if (state)
                state.focus = focussedTab 
                    && (focussedTab.path || focussedTab.name);
            
            return state;
        }
        
        function setState(state, init, callback) {
            if (typeof init == "function") {
                callback = init;
                init = false;
            }
            
            // Remove all existing tabs
            if (!init && !options.testing)
                clear();
            
            var count = 0;
            
            // Load State
            (function recur(parent, list) {
                list.forEach(function(state) {
                    var p;
                    
                    if (state.type == "pane") {
                        state.preventAutoActivate = state.nodes.length > 0;
                        p = createPane(state).aml;
                        parent.appendChild(p);
                    }
                    else if (state.type == "hsplitbox" || state.type == "vsplitbox") {
                        p = parent.appendChild(new ui[state.type]({
                            splitter: true,
                            padding: 1,
                            width: state.width,
                            height: state.height
                        }));
                    }
                    else if (state.type == "tab") {
                        var tab = findTab(state.id);
                        if (!tab) {
                            state.pane = parent.cloud9pane;
                            state.init = init;
                            
                            count++;
                            open(state, function(err, tab) {
                                if (!--count)
                                    callback();
                            });
                        }
                        else {
                            tab.attachTo(parent);
                        }
                        return;
                    }
                    recur(p, state.nodes);
                    
                    // If somehow we didn't record an active tab, 
                    // set the first tab as active.
                    if (state.type == "pane") {
                        var pane = p.cloud9pane;
                        if (!pane.activeTab) {
                            var next = pane.getTabs()[0];
                            next && next.activate();
                        }
                    }
                });
            })(state.container || container, [state]);
            
            // Set Focus
            if (state.focus)
                focusTab(findTab(state.focus));
            
            setCornerPadding();
            
            if (!count)
                callback();
        }
        
        function clear(soft, clearTabs /* For testing only */){
            var list = getPanes(container);
            
            for (var i = list.length - 1; i >= 0; i--) {
                var pane = list[i], nodes = pane.getTabs();
                for (var j = nodes.length - 1; j >= 0; j--) {
                    var tab = nodes[j];
                    if (!soft) tab.unload();
                    else {
                        tab.aml.parentNode.removeChild(tab.aml);
                        tab.pane = null;
                    }
                }
                // if (i > 0)
                    pane.unload();
            }
            if (!soft || clearTabs) tabs = [];
            panes = [];
        }
        
        function toggleButtons(to) {
            showTabs = to !== undefined ? to : !showTabs;
            
            settings.set("user/tabs/@show", showTabs);
            emit("visible", {value: showTabs});
            
            getPanes(container).forEach(function(pane) {
                ui.setStyleClass(pane.aml.$ext, showTabs ? "" : "notabs", ["notabs"]);
            });
        }
        
        var closeTimer;
        function resizePanes(cancel) {
            clearTimeout(closeTimer);
    
            if (cancel)
                return;
    
            closeTimer = setTimeout(function(){
                panes.forEach(function(pane) {
                    pane.aml.$waitForMouseOut = false;
                    pane.aml.$scaleinit(null, "sync");
                });
            }, 500);
        }
        
        function activateTab(tab) {
            if (typeof tab == "string")
                tab = findTab(tab);
            
            tab.activate();
            
            return tab;
        }
        
        function focusTab(tab, soft, async) {
            if (typeof tab == "string")
                tab = findTab(tab);
            
            if (previewTab && tab != previewTab)
                preview({ cancel: true });
            
            // do not focus a tab during close animation
            if (tab && tab.meta && tab.meta.$closing) {
                // Focus
                if (focussedTab && (!soft || soft !== 2 && !unfocussed) && focussedTab.editor) {
                    unfocussed = false;
                    focussedTab.editor.focus();
                }
                
                return tab;
            }
            
            if (focussedTab != tab) {
                // Blur
                if (focussedTab) {
                    var blurTab = focussedTab;
                    var blur = function (){
                        emit("blur", { tab: blurTab });
                        
                        // During destroy of the pane the editor can 
                        // not exist for a tab
                        if (blurTab.editor && focussedTab
                          && blurTab.editor != focussedTab.editor)
                            blurTab.editor.blur();
                    };
                    
                    blurTab.classList.remove("focus");
                    
                    blur();
                }
                
                if (!tab) {
                    focussedTab = null;
                    unfocussed = true;
                    return;
                }
                
                // Change focussedTab
                focussedTab = tab;
                
                tab.activate();
                
                // Focus
                if ((!soft || soft !== 2 && !unfocussed) && focussedTab.editor) {
                    unfocussed = false;
                    focussedTab.editor.focus();
                }
                
                focussedTab && focussedTab.classList.add("focus");
            }
            else {
                if (!focussedTab)
                    return;
                
                if ((!soft || soft !== 2 && !unfocussed) && focussedTab.editor) {
                    unfocussed = false;
                    focussedTab.editor.focus(true);
                }
                
                return tab;
            }
            
            emit("focusSync", { tab : tab });
            
            if (async) {
                setTimeout(function(){
                    emit("focus", { tab : tab });
                }, 500);
            }
            else
                emit("focus", { tab : tab });
            
            return tab;
        }
        
        function findTab(path) {
            return tabs[PREFIX + path] || tabs[util.normalizePath(path)];
        }
        
        function getTabs(container) {
            var result = Object.keys(tabs).map(function(path) {
                return tabs[PREFIX + path] || tabs[path];
            });
            
            if (!container)
                return result;
            
            return result.filter(function(tab) {
                return ui.isChildOf(container, tab.aml);
            });
        }
        
        function findPane(name) {
            for (var i = 0; i < panes.length; i++) {
                if (panes[i].name == name)
                    return panes[i];
            }
        }
        
        function getPanes(container) {
            return !container 
                ? panes.slice()
                : panes.filter(function(pane) {
                    return ui.isChildOf(container, pane.aml);
                });
        }
        
        /**** Main entry point for opening tabs ****/
        
        // Handler to show loading indicator
        function setLoading(tab) {
            tab.classList.add("loading");
            
            // TODO this gets called for things that have nothing to do
            // with filesystem :(
            if (!tab.path)
                return;
                
            var loadStartT = Date.now();
            fs.on("downloadProgress", function progress(e) {
                if (e.path == tab.path) {
                    e.dt = Date.now() - loadStartT;
                    tab.document.progress(e);
                    if (e.complete)
                        fs.off("downloadProgress", progress);
                }
            });
            // TODO move to fs
            // tab.document.progress({dt: 0, loaded: 0, total: 1});
        }
        
        function openFile(path, active, callback) {
            if (typeof active == "function")
                callback = active, active = false;
            
            return open({path: path, active: active}, callback);
        }
        
        function openEditor(type, active, callback) {
            if (typeof active == "function")
                callback = active, active = false;
            
            return open({editorType: type, active: active}, callback);
        }
        
        function open(options, callback) {
            var path = options.path = util.normalizePath(options.path);
            var type = options.editorType;
            var editor;
            
            // If a tab for this file already exist, activate it
            var id = !options.forceNew && !options.init && path || options.name;
            var tab = options.tab || (id
                ? findTab(id)
                : options.demandExisting
                  && getTabs().filter(function(t) {
                         return t.editorType === options.editorType
                             && (!options.title || (t.document 
                             && t.document.title === options.title));
                     })[0]);
            
            // prevent opening of same tab twice in non cloned mode
            // TODO move cloning into ace?
            if (!tab)
                tab = findTab(path);
            
            // Clone Tab
            if (((options.document || 0).meta || 0).cloned) {
                if (!tab) {
                    if (options.init) {
                        plugin.on("open", function wait(e){
                            if (e.tab.path == path) {
                                plugin.off("open", wait);
                                options.tab = e.tab;
                                open(options, callback);
                            }
                        }, plugin);
                        return;
                    }
                    else {
                        throw new Error("Missing tab when cloning");
                    }
                }
                
                options.path = path = tab.path;
                options.editorType = tab.editorType;
                options.document = tab.document.clone();
                
                // Tab variable will be overwritten below
                tab.on("unload", function(){ tab.unload(); }, tab.document);
            }
            // Process Existing Tab
            else if (tab) {
                if (tab.document.meta.preview)
                    keepPreview();

                if (options.active)
                    tab.activate();
                if (options.focus)
                    focusTab(tab, options.focus !== true);
                if (options.document)
                    tab.document.setState(options.document);
                callback && callback(null, tab, null, true);
                return tab;
            }

            // Find editor
            if (!type) {
                editor = path && editors.findEditorByFilename(path)
                    || editors.findEditor(editors.defaultEditor);
                type = editor && editor.type || editors.defaultEditor;
            }
            else {
                editor = editors.findEditor(type);
            }
            
            // Set sensible defaults
            if (typeof path != "string")
                options.path = null;
            if (!options.document)
                options.document = {};
            if (path && !options.document.title) {
                options.document.title = basename(path);
                options.document.tooltip = path;
            }
            if (typeof options.value == "string" && !options.newOnError)
                options.document.value = options.value;
            // if (options.document.filter === undefined)
            //     options.document.filter = true;
            options.editorType = type;
            
            // Create the tab
            tab = createTab(options);
            
            // Focus
            if (options.focus)
                focusTab(tab, options.focus !== true);
            
            var doc = options.document;
            var loadFromDisk = path 
              && (!doc || doc.value === undefined) 
              && (options.value === undefined || options.newOnError)
              // autoload to false prevents loading data, used by image editor
              && (!editor || editor.autoload !== false);
            
            // Handler to be used after content and state is loaded
            function done(err, value) {
                tab.classList.remove("loading");
                
                if (err && options.newOnError) {
                    tab.document.meta.newfile = true;
                    value = options.value || "";
                }
                else if (err) {
                    tab.classList.add("error");
                    tab.document.meta.error = true;
                    
                    alert("Error opening file", 
                        "Could not open file: " + tab.path,
                        err.code == "ENOENT"
                            ? "The file could not be found on the file system."
                            : "Unknown error: " + (err.message || err.code || err),
                        function(){
                            tab.close();
                            callback && callback(err);
                        });
                    
                    return;
                }
                
                var doc = tab.document;
                if (typeof value == "string")
                    doc.value = value;
                    
                // Set timestamp to now() to indicate that the file has been
                // loaded from disk without any changes
                if (!doc.meta.timestamp)
                    doc.meta.timestamp = Date.now() - settings.timeOffset;
                
                doc.ready = true;
                emit("open", { tab: tab, options: options });
                callback && callback(null, tab);
            }

            if (loadFilesAtInit === false && options.init 
              && emit.listeners("beforeOpen").length === 0)
                return tab;

            // Hooks for plugins that want to override value and state loading
            var event = { 
                options: options,
                tab: tab, 
                loadFromDisk: loadFromDisk,
                setLoading: setLoading,
                callback: done
            };
            if (emit("beforeOpen", event) === false)
                return tab;
            
            // todo why metadata does this?
            loadFromDisk = event.options.loadFromDisk = loadFromDisk 
                    && !tab.document.meta.newfile
                    && !tab.document.meta.nofs;
            
            // If no value is specified, lets load it from storage
            // todo metadata doesn't check for this! should we?
            if (options.value === -1) {
                setLoading(tab);
                callback(null, tab, function(){
                    tab.classList.remove("loading");
                    emit("open", { tab: tab, options: options });
                });
            }
            else if (loadFromDisk) {
                setLoading(tab);
                var xhr = fs.readFile(path, "utf8", done);

                // Cancel file opening when tab is closed
                var abort = function(){
                    xhr && xhr.abort();
                };
                tab.on("close", abort);
                plugin.on("open", function(e) {
                    if (e.tab == tab) 
                        tab.off("close", abort); 
                });
            }
            else {
                // done has to be called asynchronously
                setTimeout(function() {
                    done(null, null);
                });
            }
            
            return tab;
        }
        
        function clone(tab, pane, callback){
            open({
                pane: pane,
                tab: tab,
                focus: true,
                document: {
                    meta: { cloned: true }
                }
            }, function(err, tab){
                if (tab)
                    tab.document.progress({ complete: true });
                callback(err, tab);
            });
        }

        function reload(tab, callback) {
            if (!tab) tab = focussedTab;
            if (!tab || !tab.path) 
                return callback();
            
            if (tab.editor.autoload === false) {
                tab.document.setBookmarkedValue(tab.document.value);
                
                delete tab.document.meta.error;
                tab.classList.remove("error");
                tab.classList.remove("loading");
                emit("reload", { tab: tab });
                
                return callback();
            }
            
            setLoading(tab);
            
            fs.readFile(tab.path, "utf8", function(err, data) {
                if (err) {
                    tab.classList.remove("loading");
                    tab.classList.add("error");
                    tab.document.meta.error = true;
                    callback(err);
                    return;
                }
                
                // Update val
                tab.document.setBookmarkedValue(data);
                tab.document.meta.timestamp = Date.now() - settings.timeOffset;
                
                // Make sure the newfile flag is gone
                delete tab.document.meta.newfile;
                
                // Remove the error flag
                delete tab.document.meta.error;
                
                tab.classList.remove("error");
                tab.classList.remove("loading");
                emit("reload", { tab: tab });
                callback();
            });
        }
        
        function checkAllTabs() {
            getTabs().forEach(function(tab) {
                var meta = tab.document.meta;
                if (tab.path && !meta.newfile && !meta.preview && !meta.ignoreState && !meta.nofs)
                    watcher.check(tab.path, meta.timestamp);
            });
        }
        
        var lastPreviewTab;
        function preview(options, callback) {
            var pane;

            // Cancel previewing and show focussedTab again
            if (options.cancel)
                return cancelPreview(options.keep);
            
            // Exclude certain extensions from being previewed
            if (XPREVIEW.test(options.path))
                return;
            
            if (!options.editorType && previewTab && previewTab.path === options.path) {
                // keepPreview();
                return previewTab;
            }
            // Remove existing preview pane if it's there
            else if (previewTab) {
                pane = previewTab.pane;
                if (previewTab.document.meta.existing) {
                    delete previewTab.document.meta.preview;
                    delete previewTab.document.meta.existing;
                    
                    previewTab.classList.remove("preview");
                }
                
                // Or keep tab until the new one is loaded
                else {
                    previewTab.unload();
                }
            }

            if (!options.path && !options.editorType)
                throw new Error("No path or editorType specified for preview");
            
            return createPreview(options, pane, callback);
        }
        
        function createPreview(options, pane, callback) {
            var path = options.path;
            // Check if pane is already loaded
            var tab = findTab(path);
            if (tab) {
                // tab.document.meta.preview = true;
                // tab.document.meta.existing = true;
                tab.activate();
                clearTimeout(previewTimeout);
                callback(null, null);
            }
            // Else create preview pane
            else if (!previewTimeout || options.immediate) {
                var doc = options.document || {};
                doc.meta = {
                    readonly: true,
                    preview: true
                };
                
                previewTab = open({ 
                    path: path, 
                    editorType: options.editorType,
                    active: true, 
                    pane: pane,
                    noanim: true,
                    document: doc
                }, function(err, tab) {
                    // Previewing has already been cancelled
                    if (err || !tab.loaded)
                        return callback(new Error("Preview was cancelled"));
                    
                    // Activate previewTab showing content
                    tab.activate();
                    
                    // Open actual tab when the user starts editing
                    // @TODO cleanup
                    tab.document.undoManager.on("change", function(){
                        if (tab.document.undoManager.position > -1)
                            keepPreview();
                    });
                    
                    callback(null, tab);
                });
                previewTab.classList.add("preview");
            } else {
                clearTimeout(previewTimeout);
                previewTimeout = setTimeout(function() {
                    previewTimeout = null;
                    createPreview({
                        path: options.path,
                        immediate: true
                    }, pane, callback);
                }, 200);
            }
            
            return previewTab;
        }

        function cancelPreview(keep) {
            // Unload last preview tab
            if (lastPreviewTab) {
                lastPreviewTab.unload();
                lastPreviewTab = null;
            }
            
            if (!previewTab)
                return false;
            
            previewTab.classList.remove("preview");
            
            if (keep)
                return keepPreview();

            if (previewTab.document.meta.existing) {
                delete previewTab.document.meta.preview;
                delete previewTab.document.meta.existing;
            }
            else {
                previewTab.unload();
            }
            
            previewTab = null;
            focussedTab && focussedTab.activate();
            return false;
        }
        
        // Open actual tab
        function keepPreview(){
            if (!previewTab) return;
            
            if (previewTimeout) {
                previewTimeout = null;
                clearTimeout(previewTimeout);
            }
            
            if (!previewTab.loaded) {
                previewTab.unload();
                previewTab = null;
                return false;
            }
            
            previewTab.classList.remove("preview");
            
            if (previewTab.document.meta.existing) {
                delete previewTab.document.meta.existing;
                delete previewTab.document.meta.preview;
            }
            else {
                delete previewTab.document.meta.readonly;
                delete previewTab.document.meta.preview;
                previewTab.document.undoManager.off("change", keepPreview);
                emit("open", { tab: previewTab });
            }

            previewTab = null;
            return true;
        }
        
        function switchEditor(tab, type, callback) {
            tab.switchEditor(type, function(){
                emit("switchEditor", { tab: tab });
                callback.apply(this, arguments);
            });
        }
        
        /**** Support for state preservation ****/
    
        function pauseTabResize(){
            panes.forEach(function(pane) {
                pane.setAttribute("buttons", "close,order");
            });
        }
    
        function continueTabResize(){
            setTimeout(function(){
                panes.forEach(function(pane) {
                    pane.setAttribute("buttons", "close,scale,order");
                    pane.$waitForMouseOut = false;
                    pane.$scaleinit(null, "sync");
                });
            }, 300);
        }
    
        /***** Lifecycle *****/
        
        plugin.on("load", function(){
            load();
        });
        plugin.on("enable", function(){
            
        });
        plugin.on("disable", function(){
            
        });
        plugin.on("unload", function(){
            panes = [];
            tabs = [];
            loaded = false;
            drawn = false;
            lastPreviewTab = null;
        });
        
        /***** Register and define API *****/
        
        /**
         * Manages all tabs in all panes of Cloud9. This includes the panes
         * in the console. Use this plugin to open files and editors, to change
         * the focus of a tab, or to fetch panes and tabs.
         * 
         * The tabManager manages the whole of panes and tabs that are organized
         * as follows:
         * 
         * * {@link Pane} - Represent a single pane, housing multiple tabs
         *   * {@link Tab} - A single tab (button) in a pane
         *     * {@link Editor} - The editor responsible for displaying the file in the tab
         *     * {@link Document} - The representation of a file in the tab
         *       * {@link Session} - The session information of the editor
         *       * {@link UndoManager} - The object that manages the undo stack for this document
         * 
         * Panes can live in certain areas of Cloud9. By default these areas are:
         * 
         * * {@link panes}      - The main area where editor panes are displayed
         * * {@link console}    - The console in the bottom of the screen
         * 
         * This is the default way to open a new file in an editor:
         * 
         *     tabManager.openFile("/file.js", true, function(err, tab) {
         *         var doc = tab.document;
         *         console.log("The value is: ", doc.value);
         *     });
         * 
         * @class tabManager
         * @alternateClassName panes
         * @singleton
         **/
        plugin.freezePublicAPI({
            /**
             * The tab that currently has the focus. Multiple tabs can be 
             * active at the same time. However there can only be one tab
             * that has the focus at one time. If there are no tabs this 
             * property is null.
             * 
             * See also {@link tabManager#focusTab}
             * @property {Tab} focussedTab
             * @readonly
             */
            get focussedTab(){ return focussedTab || null; },
            /**
             * Specifies whether the tabManager has focus. When a component 
             * outside of the editors has focus (such as the tree or a menu 
             * item), then this property is set to false. Otherwise it is set
             * to true.
             * @property {Boolean} focussed
             * @readonly
             */
            get focussed(){ return !unfocussed; },
            /**
             * The tab that is shown as a preview. This property is set to null
             * if there is currently no preview being shown.
             * @property {Tab} previewTab
             * @readonly
             */
            get previewTab(){ return previewTab; },
            /**
             * An Array of all the HTML Elements that act as containers for
             * panes. Generally this is one for the main panes area and one for
             * the console.
             * @property {HTMLElement[]} containers
             * @readonly
             */
            get containers(){ return containers; },
            /**
             * The AMLElement for the main panes area.
             * @property {AMLElement} container
             * @readonly
             */
            get container(){ return container; },
            
            _events: [
                /**
                 * Fires after a tab received focus. This event is fired
                 * when the focussedTab property is set. There is about 500ms
                 * delay between the user action and the firing of this event.
                 * This delay prevents the UI from getting stuck while plugins
                 * update their UIs. If you MUST have a sync event, check out
                 * {@link tabManager#focusSync}.
                 * 
                 * @event focus
                 * @param {Object} e
                 * @param {Tab}    e.tab the tab that received focus
                 */
                "focus",
                /**
                 * Fires after a tab received focus. This event is fired
                 * when the focussedTab property is set. Do not use this event
                 * unless you ABSOLUTELY have to. Use {@link tabManager#focus}
                 * instead.
                 * 
                 * @event focusSync
                 * @param {Object} e
                 * @param {Tab}    e.tab the tab that received focus
                 */
                "focusSync",
                /**
                 * Fires after a tab lost focus. This event is fired
                 * when the focussedTab property is changed to another tab.
                 * 
                 * @event blur
                 * @param {Object} e
                 * @param {Tab}    e.tab the tab that lost focus
                 * @private
                 */
                "blur",
                /** 
                 * Fires before a tab is activated. A tab becomes active when
                 * it is the selected tab (button) of the pane it belongs to. 
                 * This is different from receiving the focus. A tab that has
                 * focus is always the active tab of it's parent pane. If a pane
                 * has at least one tab, it always has an active tab. You can
                 * cancel the activation of a tab by returning false in the 
                 * event listener. This will prevent the tab from becoming
                 * active.
                 * 
                 * See also {@link Pane#activeTab}.
                 * 
                 * @event tabBeforeActivate
                 * @cancellable
                 * @param {Object} e
                 * @param {Tab}    e.tab  the tab that will become active
                 */
                "tabBeforeActivate",
                /** 
                 * Fires after a tab is activated asynchronously. See 
                 * {@link #tabAfterActivateSync} for the synchronous event.
                 * A tab becomes active when
                 * it is the selected tab (button) of the pane it belongs to. 
                 * This is different from receiving the focus. A tab that has
                 * focus is always the active tab of it's parent pane. If a pane
                 * has at least one tab, it always has an active tab. You can
                 * cancel the activation of a tab by returning false in the 
                 * event listener. This will prevent the tab from becoming
                 * active.
                 * 
                 * See also {@link Pane#activeTab}.
                 * 
                 * @event tabAfterActivate
                 * @param {Object} e
                 * @param {Tab}    e.tab      the tab that has become active
                 * @param {Tab}    e.lastTab  the tab that is no longer active
                 */
                "tabAfterActivate",
                /**
                 * Fires after a tab is activated synchronously. See 
                 * {@link #tabAfterActivate} for the asynchronous event.
                 * A tab becomes active when
                 * it is the selected tab (button) of the pane it belongs to. 
                 * This is different from receiving the focus. A tab that has
                 * focus is always the active tab of it's parent pane. If a pane
                 * has at least one tab, it always has an active tab. You can
                 * cancel the activation of a tab by returning false in the 
                 * event listener. This will prevent the tab from becoming
                 * active.
                 * 
                 * See also {@link Pane#activeTab}.
                 * 
                 * @event tabAfterActivateSync
                 * @param {Object} e
                 * @param {Tab}    e.tab      the tab that has become active
                 * @param {Tab}    e.lastTab  the tab that is no longer active
                 */
                "tabAfterActivateSync",
                /** 
                 * Fires prior to closing a tab. The default action of closing
                 * the tab can be cancelled by returning false.
                 * 
                 * @event tabBeforeClose
                 * @cancellable
                 * @param {Object} e
                 * @param {Object} e.tab  the tab that is to be closed
                 */
                "tabBeforeClose",
                /** 
                 * Fires after a tab is closed, but not yet destroyed. Generally
                 * you want to use {@link tabManager#tabDestroy}.
                 * 
                 * @event tabAfterClose
                 * @param {Object} e
                 * @param {Tab}    e.tab  the tab that is to be closed
                 */
                "tabAfterClose",
                /** 
                 * Fires after a tab is newly created.
                 * @event tabCreate
                 * @param {Object} e
                 * @param {Tab}    e.tab  the tab that is created
                 */
                "tabCreate",
                /** 
                 * Fires after a tab is destroyed
                 * @event tabDestroy
                 * @param {Object} e
                 * @param {Tab}    e.tab    the tab that has been destroyed
                 * @param {Tab}    e.last   whether this was the last tab of a pane that was destroyed
                 */
                "tabDestroy",
                /** 
                 * Fires when a tab is moved within a pane.
                 * @event tabOrder
                 * @param {Object}  e
                 * @param {Tab}     e.tab   the tab that has been moved
                 * @param {Tab}     e.next  the tab on the right of e.tab.
                 */
                "tabOrder",
                /** 
                 * Fires before a tab is moved to a different pane. This usually
                 * happens when a pane is split, or when a tab is dragged to a
                 * different pane.
                 * 
                 * @event tabBeforeReparent
                 * @cancelable
                 * @param {Object} e
                 * @param {Tab}    e.tab      the tab that is moved.
                 * @param {Tab}    e.lastPane the previous pane that this tab was part of.
                 * @param {Pane}   e.pane     the pane that the tab is moved to.
                 */
                "tabBeforeReparent",
                /** 
                 * Fires after a tab is moved to a different pane. This usually
                 * happens when a pane is split, or when a tab is dragged to a
                 * different pane.
                 * 
                 * @event tabAfterReparent
                 * @param {Object} e
                 * @param {Tab}    e.tab      the tab that is moved.
                 * @param {Tab}    e.lastPane the previous pane that this tab was part of.
                 * @param {Pane}   e.pane     the pane that the tab is moved to.
                 */
                "tabAfterReparent",
                /** 
                 * Fires after a pane is newly created
                 * @event paneCreate
                 * @param {Object} e
                 * @param {Pane}   e.pane     the pane that is created
                 */
                "paneCreate",
                /** 
                 * Fires after a pane is destroyed
                 * @event paneDestroy
                 * @param {Object} e
                 * @param {Pane}   e.pane     the pane that is destroyed
                 */
                "paneDestroy",
                /** 
                 * Fires after a tab is opened and before it's contents is 
                 * loaded. This event can be cancelled by returning false. 
                 * Cancelling this event will prevent the data from being 
                 * loaded. It then becomes your reponsibility to load the
                 * contents and call e.callback(err, value) when done.
                 * 
                 * This event is primarily used by the {@link metadata} plugin.
                 * 
                 * @event beforeOpen
                 * @cancellable
                 * @param {Object}   e
                 * @param {Object}   e.options          The options object that was passed to the {@link tabManager#method-open} method.
                 * @param {Tab}      e.tab              The created tab that will present the file contents to the user.
                 * @param {Boolean}  e.loadFromDisk     Specifies whether the file contents will be loaded from disk if the event is not cancelled.
                 * @param {Function} e.setLoading       Call this function to set the tab into a loading state.
                 * @param {Tab}      e.setLoading.tab   Specify the tab to set in a loading state.
                 * @param {Function} e.callback         Call this function when the content is loaded.
                 * @param {Error}    e.callback.err     Specify an error if loading the contents has failed.
                 * @param {String}   e.callback.value   Specify the value of the content that is loaded.
                 */
                "beforeOpen",
                /** 
                 * Fires after a tab is opened and it's contents loaded
                 * @event open
                 * @param {Object} e
                 * @param {Tab}    e.tab      The tab that has been opened
                 * @param {Object} e.options  The options object that was passed to the {@link tabManager#method-open} method.
                 */
                "open",
                /** 
                 * Fires after the contents of a tab is reloaded
                 * @event reload
                 * @param {Object} e
                 * @param {Tab}    e.tab  The tab for which the contents is reloaded
                 */
                "reload",
                /** 
                 * Fires when the tab manager is ready to open tabs
                 * @event ready
                 */
                "ready",
                /** 
                 * Fires when the user clicked on the + button in pane.
                 * @event plusClick
                 * @cancellable
                 * @param {Object} e
                 * @param {Tab}    e.pane  The pane to which the + button belongs to
                 */
                "plusClick",
                /** 
                 * Fires after the panels container is drawn
                 * @event draw
                 */
                "draw"
            ],
            
            /**
             * Prevent all pane buttons from resizing for all panes.
             */
            pauseTabResize: pauseTabResize,
            
            /**
             * Re-enable pane button resizing for all panes.
             */
            continueTabResize: continueTabResize,
            
            /**
             * Sets the tab as the active tab of it's pane element
             * @param {Tab} tab  The tab to activate
             */
            activateTab: activateTab,
            
            /**
             * Gives the focus to the tab and it's editor and sets the tab as
             * the the active tab of it's pane.
             * @param {Tab} tab  The tab to activate
             * @fires focus
             * @fires focusSync
             * @fires blur
             */
            focusTab: focusTab,
            
            /**
             * Retrieves the state of all panes, tabs and documents 
             * as a single serializable object.
             * @param {HTMLElement} container  One of the items from the 
             *   {@link tabManager#containers} set, specifying which area it 
             *   should serialize. Defaults to the container from the panels.
             * @returns {Object}
             */
            getState: getState,
            
            /**
             * Loads the state of all panes panes, tabs anddocuments from a 
             * simple object.
             * @param {Object}  state      The state describing the pane layout.
             * @param {Boolean} [init]     When set to true, optimizes the state 
             *   loading for initialization of Cloud9.
             * @param {Function} callback  Called when the state loading is completed.
             */
            setState: setState,
            
            /**
             * Removes all panes, except one, and destroys all tabs, documents 
             * and editors. 
             * 
             * @param {Boolean} [soft=false] When set to true clear
             *   will not unload tabs. This can be useful when loading a new
             *   state with exactly the same tabs. WARNING: this can lead to
             *   leaking tabs/documents, etc. Use with caution! getTabs() will
             *   continue to return all the tabs. Even though they are no longer
             *   attached to a pane.
             */
            clear: clear,
            
            /**
             * Toggle the tab buttons between visible and hidden state.
             * @param {Number} [force] When set to 1 the buttons become visible, 
             *     when set to 2 they become hidden.
             */
            toggleButtons: toggleButtons,
            
            /**
             * Force a resize of all the tab buttons in all the panes.
             */
            resizePanes: resizePanes,
            
            /**
             * Retrieves a tab based on a path or it's unique identifier.
             * @param {String} path  The path or id of the tab to retrieve.
             */
            findTab: findTab,
            
            /**
             * Returns an array containing all the tabs.
             */
            getTabs: getTabs,
            
            /**
             * @ignore
             */
            checkAllTabs: checkAllTabs,
            
            /**
             * Retrieves a pane based on it's unique identifier.
             * @param {String} name  The name of the pane to retrieve.
             */
            findPane: findPane,
            
            /**
             * Returns an array containing all the panes (in a container).
             * @param {AMLElement} [container]  The container in which the panes 
             *   reside. If no container is specified all panes in all 
             *   containers are returned.
             */
            getPanes: getPanes,
            
            /**
             * Opens a new tab with an editor. If the tab with a specified
             * path already exists, that tab is activated.
             * (If no path was specified and option demandExisting is used,
             * we look for a tab with the same editor type and title.)
             * If state is given for a document, then that state is set prior
             * to loading the tab. If a path is specified the file contents is
             * loaded into the document. If no editorType is specified, the
             * editor is determined based on the extension of the filename.
             * 
             * @param options
             * @param {String}   [options.path]          The path of the file to open
             * @param {Pane}     [options.pane]          The pane to attach the new tab to
             * @param {String}   [options.editorType]    The type of the editor for this tab
             * @param {Boolean}  [options.active=false]  Whether this tab is set as active
             * @param {Boolean}  [options.focus=false]   Whether this tab is set as focussed
             * @param {Boolean}  [options.forceNew=false] Always create a tab
             * @param {Boolean}  [options.demandExisting=false] Whether to try opening an
             *   existing tab even for tabs without a path.
             * @param {Object}   [options.document]      Object describing the 
             *   state of the document (see {@link Document#method-getState}) 
             * @param {String}   [options.value]         The contents of the file
             * @param {String}   [options.title]         The title of the tab
             * @param {String}   [options.tooltip]       The tooltip at the button of the tab
             * @param {Function} callback 
             * @param {Error}    callback.err            An error that might 
             *   occur during the load of the file contents.
             * @param {Tab}      callback.tab            The created tab.
             * @param {Function} callback.done           Call this function 
             *   when done retrieving the value. This is only relevant if 
             *   -1 is passed to `value`. You are responsible for settings the 
             *   document value yourself, like so: `tab.document.value = "value";`
             * @returns {Tab}                            The created tab.
             * @fires open
             * @fires beforeOpen
             */
            open: open,
            
            /**
             * Opens a new pane tab with the default editor and loads the file
             * contents into the document. This is a convenience method. For
             * the full method see {@link tabManager#method-open}.
             * 
             * @param {String}   path          The path of the file to open.
             * @param {Boolean}  [active]      When set to true the new tab will become active in it's pane.
             * @param {Function} callback      Called when the file contents is loaded.
             * @param {Error}    callback.err  An error that might 
             *   occur during the load of the file contents.
             * @param {Tab}      callback.tab  The created tab.
             * @returns {Tab} The created tab.
             */
            openFile: openFile,
            
            /**
             * Opens a new tab with a specific editor
             * @param {String}   editorType    The type of the editor for this tab.
             * @param {Boolean}  [active]      When set to true the new tab will become active in it's pane.
             * @param {Function} callback      Called when the editor is loaded.
             * @param {Error}    callback.err  An error that might 
             *   occur during the load of the editor.
             * @param {Tab}      callback.tab  The created tab.
             * @returns {Tab} The created tab.
             */
            openEditor: openEditor,
            
            /**
             * Reloads the file contents of a tab. The tab needs to have a 
             * path property set.
             * @param {Tab} tab  The tab to reload.
             */
            reload: reload,
            
            /**
             * Opens a tab in preview mode, displaying the contents of a file with
             * it's editor. The options passed can be the same as for the 
             * {@link tabManager#method-open}
             * 
             * @param options
             * @param {String}   [options.path]          The path of the file to open
             * @param {Pane}     [options.pane]          The pane to attach the new tab to
             * @param {String}   [options.editorType]    The type of the editor for this tab
             * @param {Boolean}  [options.active=false]  Whether this tab is set as active
             * @param {Object}   [options.document]      Object describing the 
             *   state of the document (see {@link Document#method-getState}) 
             * @param {String}   [options.value]         The contents of the file
             * @param {String}   [options.title]         The title of the tab
             * @param {String}   [options.tooltip]       The tooltip at the button of the tab
             * @param {Function} callback 
             * @param {Error}    callback.err            An error that might 
             *   occur during the load of the file contents.
             * @param {Tab}      callback.tab            The created tab.
             * @param {Function} callback.done           Call this function 
             *   when done retrieving the value. This is only relevant if 
             *   -1 is passed to `value`. You are responsible for settings the 
             *   document value yourself, like so: `tab.document.value = "value";`
             * @returns {Tab} The created tab.
             * @fires open
             * @fires beforeOpen
             */
            preview: preview,
            
            /**
             * 
             */
            clone: clone,
            
            /**
             * 
             */
            switchEditor: switchEditor,
            
            /**
             * @ignore
             */
            get isReady(){ return isReady; },
        });
        
        register(null, {
            tabManager: plugin
            // panes      : plugin
        });
    }
});
