define(function(require, exports, module) {
    main.consumes = [
        "Editor", "editors", "settings", "ui", "proc", "c9", "util",
        "preferences", "layout", "tabManager", "tree", "commands", "menus",
        "dialog.error", "dialog.alert", "save", "Menu", "MenuItem", "Divider"
    ];
    main.provides = ["preview"];
    return main;
    
    // @todo - Add XML Plugin
    // @todo - Add JSON Plugin
    // @todo - Add Coffee Plugin
    // @todo - Add Jade Plugin
    // @todo - Fix the activate/deactivate events on session. They leak / are not cleaned up
    
    function main(options, imports, register) {
        var Editor = imports.Editor;
        var editors = imports.editors;
        var ui = imports.ui;
        var c9 = imports.c9;
        var settings = imports.settings;
        var commands = imports.commands;
        var menus = imports.menus;
        var layout = imports.layout;
        var tree = imports.tree;
        var save = imports.save;
        var proc = imports.proc;
        var util = imports.util;
        var tabs = imports.tabManager;
        var prefs = imports.preferences;
        var Menu = imports.Menu;
        var MenuItem = imports.MenuItem;
        var Divider = imports.Divider;
        var showError = imports["dialog.error"].show;
        var showAlert = imports["dialog.alert"].show;
        
        var basename = require("path").basename;
        
        var extensions = ["pdf", "swf", "mov", "mp3", "mp4", "mpg", "ogg", "webm", "wma"];
        
        var previewUrl = options.previewUrl.replace(/^[/]/, function() {
            return c9.location.replace(/^(\w+:[/]+[^/#?]+).*/, "$1/");
        }).replace(/[/]$/, "");
        
        /***** Initialization *****/
        
        var handle = editors.register("preview", "Preview", Preview, extensions);
        var handleEmit = handle.getEmitter();
        
        var BGCOLOR = { 
            "flat-light": "#F1F1F1", 
            "flat-dark": "#303130",
            "light": "#d6d5d5", 
            "light-gray": "#d6d5d5",
            "dark": "#303130",
            "dark-gray": "#303130" 
        };
        
        var previewers = {};
        var menu, liveMenuItem, mnuSettings;
        
        function load() {
            var parent = layout.findParent({ name: "preview" });
            if (!options.hideButton) {
                var submenu = new ui.menu({
                    "onprop.visible": function(e) {
                        if (e.value)
                            updatePreviewMenu(e, submenu);
                    }
                });
                
                var button = new ui.button({
                    skin: "c9-toolbarbutton-glossy",
                    "class": "preview",
                    // tooltip  : "Preview the current document",
                    caption: "Preview",
                    submenu: submenu
                });
                button && ui.insertByIndex(parent, button, 10, handle);
                
                menus.addItemByPath("Tools/Preview/", submenu, 1000, handle);
                liveMenuItem = new ui.item({
                    onclick: function(e) { commands.exec("preview", null, { newTab: e && e.button == 1 }); }
                });
                menus.addItemByPath("Tools/Preview/Live Preview Files",
                    liveMenuItem, 100, handle);
                menus.addItemByPath("Tools/Preview/Preview Running Application", new ui.item({
                    onclick: function(e) {
                        commands.exec("preview", null, {
                            server: true,
                            newTab: e && e.button == 1
                        });
                    }
                }), 200, handle);
                menus.addItemByPath("Tools/Preview/~", new ui.divider({}), 2000, handle);
                menus.addItemByPath("Tools/Preview/~", new ui.divider({}), 4000, handle);
                menus.addItemByPath("Tools/Preview/Configure Preview URL...", new ui.item({
                    onclick: function(e) { commands.exec("openpreferences", null, {panel: "project", section: "Run & Debug"}); }
                }), 4200, handle);
                menus.addItemByPath("Tools/Preview/Show Active Servers...", new ui.item({
                    onclick: function(e) { commands.exec("showprocesslist", null, { mode: "lsof" }); }
                }), 4300, handle);
            }
            
            settings.on("read", function(e) {
                settings.setDefaults("user/preview", [
                    ["running_app", options.defaultRunApp || "false"],
                    ["default", options.defaultPreviewer || "raw"],
                    ["onSave", "false"]
                ]);
            }, handle);
            
            // Context menu for tree
            tree.getElement("mnuCtxTree", function(mnuCtxTree) {
                var itemCtxTreePreview = new ui.item({
                    match: "file",
                    caption: "Preview",
                    isAvailable: function() {
                        return tree.selectedNode && !tree.selectedNode.isFolder
                            && (options.local || util.normalizePath(tree.selectedNode.path).charAt(0) != "~");
                    },
                    onclick: function() {
                        openPreview(tree.selected);
                    }
                });
                ui.insertByIndex(mnuCtxTree, itemCtxTreePreview, 160, handle);
            });
            
            // Context menu for settings
            mnuSettings = new Menu({}, handle);
            
            // Command
            commands.addCommand({
                name: "preview",
                exec: function(editor, args) {
                    var path, pane;
                    var tab = tabs.focussedTab;
                    
                    function findPane() {
                        if (!tab) return;
                        
                        // Find a good location to open preview side-by-side
                        var pane;
                        var otherPreview = search();
                        if (otherPreview && tab.pane != otherPreview) {
                            pane = otherPreview;
                        }
                        else if (args.pane) {
                            pane = args.pane;
                        }
                        else {
                            var nodes = tab.pane.group;
                            if (!nodes)
                                pane = tab.pane.hsplit(true);
                            else
                                pane = nodes[nodes.indexOf(tab.pane) === 0 ? 1 : 0];
                        }
                        
                        return pane;
                    }
                    
                    if (args.server) {
                        var openInNewTab = args.newTab;
                        path = args.url;
                        
                        if (!path)
                            path = "https://$C9_HOSTNAME";
                        
                        path = expandUrl(path);
                        
                        if (window.location.protocol == "https:" && !path.startsWith("https:"))
                            openInNewTab = true;
                        
                        if (openInNewTab)
                            return util.openNewWindow(path);
                        
                        pane = findPane();
                        return openPreview(path, pane, args && args.active);
                    }
                    else if (args.path) {
                        path = args.path;
                    }
                    else {
                        if (!tab || (tab.editor.type === "preview" || !tab.path))
                            return;
                        
                        pane = findPane();
                        path = tab.path.replace(/[#?]/g, escape);
                    }
                    
                    if (searchTab(path))
                        return commands.exec("reloadpreview");
                    
                    // Open Preview
                    openPreview(path, pane, args && args.active);
                }
            }, handle);
            
            commands.addCommand({
                name: "reloadpreview",
                bindKey: { mac: "Command-Enter", win: "Ctrl-Enter" },
                isAvailable: function() {
                    var path = tabs.focussedTab && tabs.focussedTab.path;
                    var tab = searchTab(path) || searchTab() || searchTab(-1);
                    return tab ? true : false;
                },
                exec: function() {
                    var path = tabs.focussedTab && tabs.focussedTab.path;
                    var tab = searchTab(path) || searchTab() || searchTab(-1);
                    if (tab) {
                        if (tabs.focussedTab && tabs.focussedTab.document.changed) {
                            save.save(tabs.focussedTab, null, function() {
                                tab.editor.reload();
                            });
                        }
                        else {
                            tab.editor.reload();
                        }
                    }
                }
            }, handle);
            
            save.on("afterSave", function(e) {
                if (settings.get("user/preview/@onSave") !== "true")
                    return;
                var tab = searchTab(e.path) || searchTab() || searchTab(-1);
                tab && tab.editor.reload();
            });
            
            menu = new Menu({}, handle);
            
            // Preferences
            var key = commands.getPrettyHotkey("reloadpreview");
            
            prefs.add({
                "Project": {
                    position: 100,
                    "Run & Debug": {
                        position: 300,
                        "Preview URL": {
                            type: "textbox",
                            path: "project/preview/@url"
                        },
                    }
                }
            }, handle);
            
            prefs.add({
                "Run": {
                    position: 600,
                    "Preview": {
                        position: 200,
                        "Preview Running Apps": {
                            type: "checkbox",
                            path: "user/preview/@running_app",
                            position: 400
                        },
                        "Default Previewer": {
                            type: "dropdown",
                            path: "user/preview/@default",
                            position: 500,
                            items: [
                                // @todo this should come from plugin api
                                { caption: "Raw", value: "preview.raw" },
                                { caption: "Browser", value: "preview.browser" }
                            ]
                        },
                        "When Saving Reload Preview": {
                            type: "dropdown",
                            path: "user/preview/@onSave",
                            position: 600,
                            items: [
                                { caption: "Only on " + key, value: "false" },
                                { caption: "Always", value: "true" },
                            ]
                        },
                    }
                }
            }, handle);
        }
        
        var drawn = false;
        function drawHandle() {
            if (drawn) return;
            drawn = true;
            
            // Import CSS
            var css = require("text!./preview.css");
            ui.insertCss(css, null, handle);
            
            handleEmit.sticky("draw");
        }
        
        //Search through pages
        function search() {
            var pane;
            tabs.getTabs().every(function(tab) {
                if (tab.editorType == "preview") {
                    pane = tab.pane;
                    return false;
                }
                return true;
            });
            return pane;
        }
        function searchTab(path) {
            var pane;
            tabs.getTabs().every(function(tab) {
                if (tab.editorType == "preview" 
                  && (!path && tab.isActive()
                  || path && path != -1 
                  && path == (tab.document.getSession() || {}).path)) {
                    pane = tab;
                    return false;
                }
                return true;
            });
            return pane;
        }
        
        function expandUrl(url) {
            var hostname = c9.hostname;
            if (!c9.hosted && !hostname)
                hostname = window.location.hostname;
            return url.replace(/\$C9_HOSTNAME\b/, hostname);
        }
        
        function registerPlugin(plugin, matcher) {
            previewers[plugin.name] = {
                plugin: plugin,
                matcher: matcher
            };
        }
        
        function unregisterPlugin(plugin) {
            delete previewers[plugin.name];
        }
        
        function openPreview(path, pane, active, callback) {
            return tabs.open({
                name: "preview-" + path,
                editorType: "preview",
                pane: pane,
                active: active !== false,
                document: {
                    title: "[P] " + path,
                    preview: {
                        path: path
                    }
                }
            }, function(err, tab, done, existing) {
                if (existing)
                    tab.editor.reload();
                
                callback && callback(err, tab);
            });
        }
        
        function findPreviewer(path, id) {
            if (id) return previewers[id].plugin;
            else if (path) {
                for (id in previewers) {
                    if (previewers[id].matcher(path))
                        return previewers[id].plugin;
                }
            }
            
            id = settings.get("user/preview/@default");
            return previewers[id].plugin;
        }
        
        function warnNoServer(hostname) {
            showAlert("Could not find a server running.",
                "No server running at " + hostname,
                "Please start your server at " + hostname + " to enable preview "
                + "via this menu. Alternatively you can start a regular preview "
                + "and change the hostname in the location bar.");
        }
        
        function updatePreviewMenu(e, submenu) {
            var tab = tabs.focussedTab;
            var isKnown = false;
            var title = "Live Preview File";
            if (tab && tab.path) {
                var path = tab.path;
                for (var name in previewers) {
                    if (previewers[name].matcher(path)) {
                        isKnown = true;
                        break;
                    }
                }
                if (!isKnown) {
                    title = "Raw Content of " + basename(path);
                    isKnown = true;
                }
                else {
                    title += " (" + basename(path) + ")";
                }
            }
            
            liveMenuItem.setAttribute("caption", title);  
            if (isKnown) 
                liveMenuItem.enable();
            else
                liveMenuItem.disable();
            // user configured elements
            var url = settings.get("project/preview/@url");
            if (!Array.isArray(url)) url = [url];
            var added = false;
            var index = 0;
            var children = submenu.childNodes;
            while (children[index] && children[index].localName != "divider") {
                index++;
            }
            var appMenu = children[index - 1];
            var firstDivider = children[index];
            index++;
            for (var i = 0; i < url.length; i++) {
                if (typeof url[i] != "string" || !url[i]) continue;
                var oldNode = children[index];
                if (!oldNode || oldNode.localName != "item") {
                    oldNode = submenu.insertBefore(new ui.item({
                        onclick: openUrl
                    }), oldNode);
                }
                oldNode.value = url[i];
                var caption = "Open " + expandUrl(url[i]);
                oldNode.setAttribute("caption", caption);
                added = true;
                index++;
            }
            while(index < children.length - 3) 
                submenu.removeChild(children[index]);
            
            appMenu.setAttribute("visible", !added);
            firstDivider.setAttribute("visible", added);
            
            function openUrl(e) {
                commands.exec("preview", null, { 
                    newTab: e.button == 1,
                    url: e.currentTarget.value,
                    server: true
                });
            }
        }
        
        /**
         * The preview handle, responsible for managing preview plugins. 
         * This is the object you get when you request the preview
         * service in your plugin.
         * 
         * Example:
         * 
         *     define(function(require, exports, module) {
         *         main.consumes = ["preview"];
         *         main.provides = ["myplugin"];
         *         return main;
         *     
         *         function main(options, imports, register) {
         *             var preview = imports.preview;
         *             
         *             var previewer = preview.findPreviewer("preview.browser");
         *         });
         *     });
         * 
         * @class preview
         * @extends Plugin
         * @singleton
         */
        handle.freezePublicAPI({
            /**
             * The base URL for previewing files
             * @property {String} previewUrl
             */
            get previewUrl() { return previewUrl; },
            
            /**
             * The menu shown to select the previewer
             * @property {Menu} previewMenu
             */
            get previewMenu() { return menu; },
            
            /**
             * 
             */
            get settingsMenu() { return mnuSettings; },
            
            /**
             * 
             */
            openPreview: openPreview,
            
            /**
             * Adds a previewer to the list of known previewers.
             * 
             * *N.B. The {@link Previewer} base class already calls this method.*
             * 
             * @param {Previewer} previewer  the previewer to register.
             * @private
             */
            register: registerPlugin,
            
            /**
             * Removes a previewer from the list of known previewers. 
             * 
             * *N.B. The {@link Previewer} base class already calls this method.*
             * 
             * @param {Previewer} previewer  the previewer to unregister.
             * @private
             */
            unregister: unregisterPlugin,
            
            /**
             * Retrieves a previewer based on a file path or id.
             * @param {String} path  The path of the file that is to be previewed
             * @param {String} id    The unique name of the previewer to retrieve
             * @return {Previewer}
             */
            findPreviewer: findPreviewer,
        });
        
        handle.on("load", load);
        
        function Preview() {
            var plugin = new Editor("Ajax.org", main.consumes, extensions);
            var emit = plugin.getEmitter();
            
            var currentDocument, currentSession;
            var container, txtPreview, btnMode, btnBack, btnForward;
            var btnPopOut, btnSettings;
            
            plugin.on("draw", function(e) {
                drawHandle();
                
                var buttons = options.local ? [
                    btnBack = new ui.button({
                        skin: "c9-toolbarbutton-glossy",
                        "class": "goback",
                        tooltip: "Back",
                        width: "29",
                        disabled: true,
                        onclick: function(e) { goBack(); }
                    }),
                    btnForward = new ui.button({
                        skin: "c9-toolbarbutton-glossy",
                        "class": "goforward",
                        tooltip: "Forward",
                        disabled: true,
                        width: "29",
                        onclick: function(e) { goForward(); }
                    })
                ] : [];
                
                buttons.push(
                    new ui.button({
                        skin: "c9-toolbarbutton-glossy",
                        "class": "refresh",
                        tooltip: "Refresh",
                        width: "29",
                        onclick: function(e) { reload(); }
                    })
                );
                
                // Create UI elements
                var bar = e.tab.appendChild(new ui.vsplitbox({
                    anchors: "0 0 0 0",
                    childNodes: [
                        new ui.hsplitbox({
                            "class": "toolbar-top previewbar",
                            height: 35,
                            edge: "4",
                            padding: 3,
                            childNodes: [
                                new ui.bar({
                                    width: options.local ? 87 : 29,
                                    "class": "fakehbox aligncenter",
                                    childNodes: buttons
                                }),
                                new ui.hbox({
                                    padding: 3,
                                    childNodes: [
                                        new ui.bar({
                                            id: "locationbar",
                                            "class": "locationbar",
                                            flex: 1,
                                            childNodes: [
                                                new ui.textbox({
                                                    id: "txtPreview",
                                                    class: "ace_searchbox tb_textbox searchbox searchTxt tb_console",
                                                    value: "",
                                                    focusselect: true
                                                }),
                                                new ui.button({
                                                    id: "btnMode",
                                                    submenu: menu.aml,
                                                    icon: true,
                                                    skin: "btn-switcher",
                                                    caption: "browser"
                                                })
                                            ]
                                        }),
                                        btnPopOut = new ui.button({
                                            id: "btnPopOut",
                                            skin: "c9-toolbarbutton-glossy",
                                            "class": "popout",
                                            tooltip: "Pop Out Into New Window",
                                            width: "30",
                                            onclick: function(e) { popout(); }
                                        }),
                                        btnSettings = new ui.button({
                                            id: "btnSettings",
                                            skin: "c9-toolbarbutton-glossy",
                                            "class": "settings",
                                            tooltip: "Preview Settings",
                                            width: "30",
                                            submenu: mnuSettings.aml
                                        })
                                    ]
                                })
                            ]
                        }),
                        new ui.bar({
                            id: "container"
                        })
                    ]
                }));
                plugin.addElement(bar);
                
                btnMode = plugin.getElement("btnMode");
                txtPreview = plugin.getElement("txtPreview");
                container = plugin.getElement("container").$int;
                
                txtPreview.$input.onkeydown = function(e) {
                    if (e.keyCode == 13) {
                        currentSession.previewer.navigate({ url: this.value });
                        txtPreview.blur();
                    }
                };
                
                txtPreview.addEventListener("contextmenu", function(e) {
                    e.cancelBubble = true;
                    return true;
                });
            });
            
            /***** Method *****/
            
            function reload() {
                var session = currentSession;
                if (session) 
                    session.previewer.reload();
            }
            
            function popout() {
                currentSession.previewer.popout();
            }
            
            function setPreviewer(id) {
                var session = currentSession;
                if (session) {
                    // Check if previewer is available
                    if (!previewers[id]) 
                        return showError("Could not find previewer:" + id);
                    
                    // If this previewer is already active, do nothing
                    if (session.previewer.name == id)
                        return;
                    
                    var doc = currentDocument;
                    var state = plugin.getState(doc);
                    
                    // Unload the previous previewer
                    if (session.previewer) {
                        session.previewer.unloadDocument(doc);
                        session.cleanUp();
                        session.destroy && session.destroy();
                    }
                        
                    // Enable the new previewer
                    var previewer = previewers[id].plugin;
                    session.previewer = previewer;
                    
                    btnSettings.show();
                    btnPopOut.show();
                    
                    previewer.loadDocument(doc, plugin, state);
                    previewer.activateDocument(doc);
                    previewer.navigate({ url: session.path });
                }
            }
            
            function goBack() {
                currentSession.previewer.navigate({ 
                    url: currentSession.back()
                });
                updateButtons();
            }
            function goForward() {
                currentSession.previewer.navigate({ 
                    url: currentSession.forward()
                });
                updateButtons();
            }
            
            function setLocation(value, visualOnly) {
                if (!value || !currentSession) return;
                
                if (!visualOnly) {
                    var session = currentSession;
                    var current = session.stack[session.position];
                    if (current != value)
                        session.add(value);
                }
                    
                txtPreview.setValue(value);
                updateButtons();
            }
            
            function setButtonStyle(caption, icon) {
                btnMode.setCaption(caption);
                btnMode.setIcon(icon);
            }
            
            function updateButtons() {
                if (!btnBack) return;
                btnBack.setAttribute("disabled", currentSession.position < 1);
                btnForward.setAttribute("disabled", 
                    currentSession.position == currentSession.stack.length - 1);
            }
            
            /***** Lifecycle *****/
            
            plugin.on("load", function() {
            });
            plugin.on("documentLoad", function(e) {
                var doc = e.doc;
                var tab = doc.tab;
                var session = doc.getSession();
                
                session.doc = doc;
                session.tab = tab;
                
                if (session.inited) {
                    session.previewer.loadDocument(doc, plugin);
                    return;
                }
                
                function setTheme(e) {
                    var isDark = e.theme == "dark";
                    tab.backgroundColor = BGCOLOR[e.theme];
                    if (isDark) tab.classList.add("dark");
                    else tab.classList.remove("dark");
                }
                
                layout.on("themeChange", setTheme, doc);
                setTheme({ theme: settings.get("user/general/@skin") });
                
                // session.path = session.path || e.state.path;
                session.initPath = session.path || e.state.path || doc.tab.path;
                session.inited = true;
                if (e.state.trusted || e.state.trustedPath)
                    session.trustedPath = e.state.trustedPath || e.state.path;
            
                session.previewer = findPreviewer(session.initPath, (e.state || 0).previewer);
                session.previewer.loadDocument(doc, plugin, e.state);
                
                var handler = function(type, e) {
                    if (currentSession == e.session)
                        emit(type, { 
                            previewer: session.previewer,
                            session: session,
                            url: e.url
                        });
                };
                session.previewer.on("navigate", handler.bind(null, "navigate"), session);
                session.previewer.on("reload", handler.bind(null, "reload"), session);
                
                session.stack = [];
                session.position = -1;
                session.add = function(value) {
                    session.stack.splice(session.position + 1);
                    session.stack.push(value);
                    session.position++;
                };
                session.back = function() {
                    if (session.position === 0) 
                        return false;
                    session.position--;
                    return session.stack[session.position];
                };
                session.forward = function() {
                    if (session.position === session.stack.length - 1) 
                        return false;
                    session.position++;
                    return session.stack[session.position];
                };
            
                tabs.on("open", function(e) {
                    if (!session.previewTab && e.options && e.options.path == session.path) {
                        session.previewTab = e.tab;
                        session.previewer.navigate({ url: session.path, tab: e.tab });
                    }
                }, doc);
            });
            plugin.on("documentActivate", function(e) {
                if (currentDocument)
                    currentSession.previewer.deactivateDocument(currentDocument);
                
                currentDocument = e.doc;
                currentSession = e.doc.getSession();
                
                btnSettings.show();
                btnPopOut.show();
                
                var previewer = currentSession.previewer;
                previewer.activateDocument(currentDocument);
                
                // @todo shouldn't previewTab be set here?
                if (currentSession.initPath) {
                    previewer.navigate({ url: currentSession.initPath });
                    delete currentSession.initPath;
                }
                
                updateButtons();
            });
            plugin.on("documentUnload", function(e) {
                var doc = e.doc;
                var session = doc.getSession();
                
                session.previewer.navigate(doc, true); // Remove the listener
                session.previewer.unloadDocument(doc, e);
                
                if (session == currentSession) {
                    currentDocument = null;
                    currentSession = null;
                }
            });
            plugin.on("getState", function(e) {
                var state = e.state;
                var session = e.doc.getSession();
                
                state.path = session.path;
                
                if (!session.previewer)
                    return;

                state.previewer = session.previewer.name;
                session.previewer.getState(e.doc, state);
            });
            plugin.on("setState", function(e) {
                var state = e.state;
                var session = e.doc.getSession();
                
                session.path = state.path;
                // session.previewer = state.previewer;
                
                session.previewer.setState(e.doc, state);
            });
            plugin.on("clear", function() {
            });
            plugin.on("focus", function(e) {
                if (currentSession)
                    currentSession.previewer.focus(e);
            });
            plugin.on("blur", function(e) {
                if (currentSession)
                    currentSession.previewer.blur(e);
            });
            plugin.on("enable", function() {
            });
            plugin.on("disable", function() {
            });
            plugin.on("unload", function() {
                // unload all previewers?
            });
            
            /***** Register and define API *****/
            
            /**
             * Preview pane for previewing files and content in a Cloud9 tab.
             * 
             * There are a few default previewers (i.e. 
             * {@link preview.browser browser}, {@link preview.raw raw},
             * {@link preview.markdown markdown}).
             * 
             * It's easy to make additional previewers. See {@link Previewer}.
             * 
             * Plugins can open a preview tab using the {@link tab} API:
             * 
             *     tabManager.open({
             *         editorType : "preview",
             *         active     : true,
             *         document   : {
             *             preview : {
             *                 path: "https://c9.io"
             *             }
             *         }
             *     }, function(err, tab) {});
             * 
             * Alternatively, use an urlView to open just the page without
             * the browser controls and URL bar:
             * 
             *     tabManager.open({
             *         value      : "http://www.c9.io",
             *         editorType : "urlview",
             *         active     : true,
             *         document   : {
             *             urlview : {
             *                 backgroundColor : "#FF0000",
             *                 dark            : true
             *             }
             *         }
             *     }, function(err, tab) {})
             **/
            plugin.freezePublicAPI({
                /**
                 * The HTML element to attach your custom previewer to.
                 * @property {HTMLElement} container
                 */
                get container() { return container; },
                
                /**
                 * Trigger a reload of the content displayed in the previewer.
                 */
                reload: reload,
                
                /**
                 * Pop the previewer out of the Cloud9 tab into a new window.
                 * @ignore Not implemented
                 */
                popout: popout,
                
                /**
                 * Change to a different previewer for the displayed content.
                 * @param {String} name  The name of the previewer to show (e.g. "previewer.browser").
                 */
                setPreviewer: setPreviewer,
                
                /**
                 * Set the value of the location bar of the preview pane.
                 * @param {String} value  The value of the location bar.
                 */
                setLocation: setLocation,
                
                /**
                 * Set the icon and label of the button in the preview bar that
                 * allows users to choose which previewer to use.
                 * @param {String} caption  The caption of the button.
                 * @param {String} icon     The icon of the button.
                 */
                setButtonStyle: setButtonStyle
            });
            
            plugin.load(null, "preview");
            
            return plugin;
        }
        
        register(null, {
            preview: handle
        });
    }
});
