/*global nativeRequire nwDispatcher windowManager*/
define(function(require, exports, module) {
    main.consumes = [
        "c9", "Plugin", "menus", "tabManager", "settings", "ui", "proc", 
        "tree.favorites", "upload", "commands", "dialog.question", "openfiles", 
        "tree", "layout", "dialog.error", "util", "openPath", "preview",
        "MenuItem", "terminal", "auth", "window.frame"
    ];
    main.provides = ["local"];
    return main;

    function main(options, imports, register) {
        var c9 = imports.c9;
        var ui = imports.ui;
        var Plugin = imports.Plugin;
        var C9MenuItem = imports.MenuItem;
        var openfiles = imports.openfiles;
        var commands = imports.commands;
        var openPath = imports.openPath;
        var upload = imports.upload;
        var menus = imports.menus;
        var settings = imports.settings;
        var tabs = imports.tabManager;
        var favs = imports["tree.favorites"];
        var tree = imports.tree;
        var frame = imports["window.frame"];
        var preview = imports.preview;
        var terminal = imports.terminal;
        var auth = imports.auth;

        // Some require magic to get nw.gui
        var nw = nativeRequire("nw.gui"); 
        
        // Ref to window
        var win = nw.Window.get();
            
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        // var emit = plugin.getEmitter();
        
        var overrides = [
            [ "newfile", { "mac": "Command-N|Ctrl-N", "win": "Ctrl-N" } ],
            [ "newfiletemplate", { "mac": "Command-Shift-N|Ctrl-Shift-N", "win": "Ctrl-Shift-N" } ],
            [ "closeallbutme", { "mac": "Command-Option-W|Option-Ctrl-W", "win": "Ctrl-Alt-W" } ],
            [ "closealltabs", { "mac": "Command-Shift-W|Option-Shift-W", "win": "Ctrl-Shift-W" } ],
            [ "closetab", { "mac": "Command-W|Option-W", "win": "Ctrl-W" } ],
            [ "closepane", { "mac": "Command-Ctrl-W", "win": "Ctrl-Option-W" } ],
            [ "nextpane", { "mac": "Command-ESC|Option-ESC", "win": "Ctrl-ESC" } ],
            [ "previouspane", { "mac": "Command-Shift-ESC|Option-Shift-ESC", "win": "Ctrl-Shift-ESC" } ],
            [ "openterminal", { "mac": "Command-T|Option-T", "win": "Alt-T" } ],
            [ "gototableft", { "mac": "Command-Shift-[|Command-[", "win": "Ctrl-Alt-[" } ],
            [ "gototabright", { "mac": "Command-Shift-]|Command-]", "win": "Ctrl-Alt-]" } ]
        ];
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            // When the UI is loaded, show the window
            c9.once("ready", function() {
                // Set commands
                overrides.forEach(function(item) {
                    commands.setDefault(item[0], item[1]);
                });
                
            }, plugin);
            
            c9.on("quit", function() {
                win.removeAllListeners();
            });
            
            tabs.once("ready", function() {
                // Parse argv
                if (win.options) {
                    var path = win.options.filePath;
                    delete win.options.filePath;
                    path && open(path);
                }
                win.on("openFile", function(e) {
                    var path = e.path;
                    path && open(path, function(err, tab) {
                        if (tab && !favs.favorites.length && tree.area.activePanel == "tree") {
                            tree.expandAndSelect(tab.path);
                        }
                    });
                });
            }, plugin);
            

            tree.getElement("mnuCtxTree", function(mnuCtxTree) {
                ui.insertByIndex(mnuCtxTree, new ui.item({
                    match: "folder|file",
                    caption: process.platform == "darwin"
                        ? "Reveal in Finder"
                        : "Show item in Explorer",
                    onclick: function() {
                        var path = tree.selected;
                        if (!path) return;
                        if (process.platform == "win32")
                            path = path.substr(1).replace(/\//g, "\\");
                        nw.Shell.showItemInFolder(path);
                    }
                }), 1020, plugin);
            });


            // Tabs
            tabs.on("focusSync", function(e) {
                win.title = e.tab.title + (win.displayName ? " - " + win.displayName : "") + " - Cloud9";
                frame.setTitle(win.title);
            });
            tabs.on("tabDestroy", function(e) {
                if (e.last) {
                    win.title = (win.displayName ? win.displayName + " - " : "") + "Cloud9";
                    frame.setTitle(win.title);
                }
            });


            // Drag&Drop upload
            upload.on("upload.drop", function(e) {
                function transformPath(path) {
                    if (c9.platform == "win32")
                        path = "/" + path.replace(/\\/g, "/");
                    return path;
                }
                var files = e.entries;
                if (files.length == 1 && files[0].isDirectory) {
                    var path = e.files[0].path;
                    favs.addFavorite(c9.toInternalPath(path));
                    openfiles.showTree();
                    return false;
                }
                else if (typeof e.path == "string") {
                    // Do nothing
                }
                else { //if (e.type == "tab") 
                    for (var i = 0; i < files.length; i++) {
                        if (!files[i].isDirectory)
                            tabs.openFile(transformPath(e.files[i].path), true);
                    }
                    return false;
                }
            });
            
            tree.once("draw", function() {
                // todo click event from tree isn't fired for empty tree
                tree.tree.container.addEventListener("click", function() {
                    if (favs.favorites.length || tree.tree.provider.visibleItems.length)
                        return;
                    var input = document.createElement("input");
                    input.type = "file";
                    input.nwdirectory = true;
                    input.onchange = function() {
                        var path = input.files[0].path;
                        favs.addFavorite(c9.toInternalPath(path));
                        openfiles.showTree();
                    };
                    input.click();
                });
            });
            
            // Preview
            preview.settingsMenu.append(new C9MenuItem({ 
                caption: "Show Dev Tools", 
                onclick: function() {
                    var previewTab = tabs.focussedTab;
                    var previewEditor = previewTab.editor;
                    
                    var reload = function (iframe) {
                        win.once("devtools-opened", function wait(url) {
                            devtools.iframe.src = url;
                        });
                        win.showDevTools(iframe, true);
                    };
                    
                    var session = previewTab.document.getSession();
                    var devtools = previewEditor.meta.$devtools;
                    var iframe = session.iframe;
                    
                    // Clear console
                    if (!console.fake) {
                        console.clear();
                        console = { fake: true };
                        console.clear = console.log = console.warn = 
                        console.error = function() {};
                    }
                    
                    if (!devtools) {
                        previewEditor.meta.$devtools = devtools = {};
                        
                        devtools.container = new ui.vsplitbox({
                            htmlNode: iframe.parentNode,
                            anchors: "0 0 0 0",
                            splitter: true,
                            childNodes: [
                                new ui.bar({ height: "50%" }),
                                devtools.pane = new ui.bar({ 
                                    style: "background:#f1f1f1"
                                })
                            ]
                        });
                        
                        // Reparent Iframe
                        devtools.container.firstChild.$ext.appendChild(iframe);
                        
                        // Create dev tools iframe
                        var deviframe = devtools.container.lastChild.$ext
                                .appendChild(document.createElement("iframe"));
                        devtools.iframe = deviframe;
                        
                        deviframe.style.width = "100%";
                        deviframe.style.height = "100%";
                        deviframe.style.border = "0";
                        
                        deviframe.addEventListener("load", function() {
                            function wait() {
                                setTimeout(function() {
                                    var doc = deviframe.contentWindow.document;
                                    var btn = doc.querySelector(".close-button");
                                    if (!btn) return wait();
                                    
                                    btn.addEventListener("click", function() {
                                        devtools.pane.hide();
                                    });
                                }, 10);
                            }
                            wait();
                        });
                        
                        // Update url when session switches or navigates is loaded
                        var update = function(e) {
                            var session = e.session || e.doc.getSession();
                            if (devtools.pane.visible)
                                reload(session.iframe);
                        };
                        previewEditor.on("navigate", update);
                        previewEditor.on("reload", update);
                        previewEditor.on("documentActivate", update);
                    }
                    else {
                        devtools.pane.show();
                    }
                    
                    reload(iframe);
                } 
            }));
            
            menus.height = 27;
            menus.minimizedHeight = settings.getBool("user/local/@nativeMenus") 
                && process.platform == "darwin" ? 1 : 8;

            terminal.on("setTerminalCwd", function() {
                return favs.favorites[0];
            });
            
            // login/logout
            auth.on("logout", function(argument) {
                clearCookies("c9.io");
                clearCookies("github.com");
                clearCookies("bitbucket.org");
                clearCookies();
            });
            
            // Add undo redo support for html elements
            var ta = { "INPUT": 1, "TEXTAREA": 1, "SELECT": 1, "PRE": 1 };
            document.addEventListener("focusin", function(e) {
                var html = e.target;
                
                if (html.contentEditable || ta[html.tagName]) {
                    windowManager.connection.send(0, {
                        type: "enableUndoRedo"
                    });
                }
            });
        }
        
        /***** Methods *****/
        
        function focusWindow() {
            // To support all platforms, we need to call both show and focus
            win.show();
            win.focus();
        }

        
        function installMode() {
            focusWindow();
        }
        
        function open(path, cb) {
            openPath.open(path, cb);
            focusWindow();
        }
        
        function clearCookies(domain) {
            win.cookies.getAll(domain ? { domain: domain } : {}, function(cookies) {
                cookies.forEach(function(c) {
                    win.cookies.remove({
                        url: "http" + (c.secure ? "s" : "") + "://" + c.domain + c.path,
                        name: c.name
                    });
                });
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
         * Draws the file tree
         * @event afterfilesave Fires after a file is saved
         * @param {Object} e
         *     node     {XMLNode} description
         *     oldpath  {String} description
         **/
        plugin.freezePublicAPI({
            /**
             * 
             */
            focusWindow: focusWindow,
            
            /**
             * 
             */
            installMode: installMode,
            
            /**
             * 
             */
            open: open
        });
        
        register(null, {
            local: plugin
        });
    }
});
