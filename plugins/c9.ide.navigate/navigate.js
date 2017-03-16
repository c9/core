define(function(require, exports, module) {
    main.consumes = [
        "Panel", "settings", "ui", "watcher", "menus", "tabManager", "find", 
        "fs", "panels", "fs.cache", "preferences", "c9", "tree", "commands",
        "layout", "util", "c9.analytics"
    ];
    main.provides = ["navigate"];
    return main;
    
    function main(options, imports, register) {
        var Panel = imports.Panel;
        var settings = imports.settings;
        var ui = imports.ui;
        var c9 = imports.c9;
        var fs = imports.fs;
        var fsCache = imports["fs.cache"];
        var tabs = imports.tabManager;
        var menus = imports.menus;
        var layout = imports.layout;
        var watcher = imports.watcher;
        var panels = imports.panels;
        var util = imports.util;
        var find = imports.find;
        var filetree = imports.tree;
        var prefs = imports.preferences;
        var commands = imports.commands;
        var analytics = imports["c9.analytics"];
        
        var markup = require("text!./navigate.xml");
        var search = require('./search');
        var Tree = require("ace_tree/tree");
        var ListData = require("./dataprovider");
        var basename = require("path").basename;
        
        /***** Initialization *****/
        
        var plugin = new Panel("Ajax.org", main.consumes, {
            index: options.index || 200,
            caption: "Navigate",
            buttonCSSClass: "navigate",
            minWidth: 130,
            autohide: true,
            where: options.where || "left"
        });
        var emit = plugin.getEmitter();
        
        var winGoToFile, txtGoToFile, tree, ldSearch;
        var lastSearch, lastPreviewed, cleaning, intoOutline;
        var isReloadScheduled;
        
        var dirty = true;
        var arrayCache = [];
        var loadListAtInit = options.loadListAtInit;
        var timer;
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            var command = plugin.setCommand({
                name: "navigate",
                hint: "search for a filename, line or symbol and jump to it",
                bindKey: { mac: "Command-E|Command-P", win: "Ctrl-E" },
                extra: function(editor, args, e) {
                    if (args && args.keyword) {
                        txtGoToFile.setValue(args.keyword);
                        filter(args.keyword);
                    }
                    if (args && args.source !== "click") {
                        analytics.log("Opened Navigate using shortcut");
                    }
                }
            });
            
            commands.addCommand({
                name: "navigate_altkey",
                hint: "search for a filename, line or symbol and jump to it",
                bindKey: { mac: "Command-O", win: "Ctrl-O" },
                group: "Panels",
                exec: command.exec
            }, plugin);
            
            panels.on("afterAnimate", function() {
                if (panels.isActive("navigate"))
                    tree && tree.resize();
            });
            
            // Menus
            menus.addItemByPath("Goto/Goto Anything...", new ui.item({ 
                command: "navigate" 
            }), 100, plugin);
    
            // Settings
            settings.on("read", function() {
                settings.setDefaults("user/general", [["preview-navigate", "false"]]);
            }, plugin);
            
            // Prefs
            prefs.add({
                "General": {
                    "Tree & Navigate": {
                        "Enable Preview on Navigation": {
                            type: "checkbox",
                            position: 2000,
                            path: "user/general/@preview-navigate"
                        }
                    }
                }
            }, plugin);
    
            // Update when the fs changes
            var quickUpdate = markDirty.bind(null, null, 2000);
            
            var newfile = function(e) {
                // Only mark dirty if file didn't exist yet
                if (arrayCache.indexOf(e.path) == -1 
                  && !e.path.match(/(?:^|\/)\./)
                  && !e.path.match(/\/(?:state|user|project)\.settings$/))
                    arrayCache.push(e.path);
            };
            fs.on("afterWriteFile", newfile);
            fs.on("afterSymlink", newfile);
            var rmfile = function(e) {
                var idx = arrayCache.indexOf(e.path);
                if (~idx) arrayCache.splice(idx, 1);
            };
            fs.on("afterUnlink", rmfile);
            fs.on("afterRmfile", rmfile);
            var rmdir = function(e) {
                var path = e.path;
                var len = path.length;
                for (var i = arrayCache.length - 1; i >= 0; i--) {
                    if (arrayCache[i].substr(0, len) == path)
                        arrayCache.splice(i, 1);
                }
            };
            fs.on("afterRmdir", rmdir);
            fs.on("afterCopy", quickUpdate);
            fs.on("afterMkdir", quickUpdate);
            fs.on("afterMkdirP", quickUpdate);
            fs.on("afterRename", function(e) {
                rmfile(e);
                newfile({ path: e.args[1] });
            });
            
            // Or when a watcher fires
            watcher.on("delete", quickUpdate);
            watcher.on("directory", quickUpdate);
            
            // Or when the user refreshes the tree
            filetree.on("refresh", markDirty); 
            
            // Or when we change the visibility of hidden files
            fsCache.on("setShowHidden", quickUpdate);
            
            // Pre-load file list
            if (loadListAtInit)
                updateFileCache();
        }
        
        function offlineHandler(e) {
            // Online
            if (e.state & c9.STORAGE) {
                txtGoToFile.enable();
                //@Harutyun This doesn't work
                // tree.enable();
            }
            // Offline
            else {
                // do not close panel while typing
                if (!txtGoToFile.ace.isFocused())
                    txtGoToFile.disable();
                //@Harutyun This doesn't work
                // tree.disable();
            }
        }
        
        var drawn = false;
        function draw(options) {
            if (drawn) return;
            drawn = true;
            
            // Create UI elements
            ui.insertMarkup(options.aml, markup, plugin);
            
            // Import CSS
            ui.insertCss(require("text!./style.css"), plugin);
            
            var treeParent = plugin.getElement("navigateList");
            txtGoToFile = plugin.getElement("txtGoToFile");
            winGoToFile = options.aml;

            // Create the Ace Tree
            tree = new Tree(treeParent.$int);
            ldSearch = new ListData(arrayCache);
            ldSearch.search = search;
            
            ldSearch.isLoading = function() { return updating; };
            
            // Assign the dataprovider
            tree.setDataProvider(ldSearch);
            
            tree.renderer.setScrollMargin(0, 10);

            // @TODO this is probably not sufficient
            layout.on("resize", function() { tree.resize(); }, plugin);
            
            tree.textInput = txtGoToFile.ace.textInput;
            
            var key = commands.getPrettyHotkey("navigate");
            txtGoToFile.setAttribute("initial-message", key);
            
            txtGoToFile.ace.commands.addCommands([
                {
                    bindKey: "ESC",
                    exec: function() { plugin.hide(); }
                }, {
                    bindKey: "Enter",
                    exec: function() { openFile(true); }
                }, {
                    bindKey: "Shift-Enter",
                    exec: function() { openFile(false, true); }
                }, {
                    bindKey: "Shift-Space",
                    exec: function() { previewFile(true); }
                },
            ]);
            function forwardToTree() {
                cleanInput();
                tree.execCommand(this.name);
            }
            txtGoToFile.ace.commands.addCommands([
                "centerselection",
                "goToStart",
                "goToEnd",
                "pageup",
                "gotopageup",
                "pagedown",
                "gotopageDown",
                "scrollup",
                "scrolldown",
                "goUp",
                "goDown",
                "selectUp",
                "selectDown",
                "selectMoreUp",
                "selectMoreDown"
            ].map(function(name) {
                var command = tree.commands.byName[name];
                return {
                    name: command.name,
                    bindKey: command.editorKey || command.bindKey,
                    exec: forwardToTree
                };
            }));
            
            tree.on("click", function(ev) {
                var e = ev.domEvent;
                if (!e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey)
                if (tree.selection.getSelectedNodes().length === 1)
                    openFile(true);
            });
            
            tree.selection.$wrapAround = true;
            
            txtGoToFile.ace.on("input", onInput);
            
            tree.selection.on("change", function() {
                previewFile(); 
            });
    
            function onblur(e) {
                if (!winGoToFile || !winGoToFile.visible)
                    return;
                
                var to = e.toElement;
                if (!to || apf.isChildOf(winGoToFile, to, true)
                  || (lastPreviewed && tabs.previewTab 
                  && tabs.previewTab === lastPreviewed
                  && (apf.isChildOf(lastPreviewed.aml.relPage, to, true)
                  || lastPreviewed.aml == to))) {
                    return;
                }
                if (to.localName == "menu")
                    return;
                
                // TODO add better support for overlay panels
                setTimeout(function() { plugin.hide(); }, 10);
            }
    
            apf.addEventListener("movefocus", onblur);
    
            // Focus the input field
            setTimeout(function() {
                txtGoToFile.focus();
            }, 10);
            
            // Offline
            c9.on("stateChange", offlineHandler, plugin);
            offlineHandler({ state: c9.status });
        }
        
        /***** Methods *****/
        
        function onInput(updatePreview) {
            var val = txtGoToFile.getValue();
            var parts, tab;
            
            if (cleaning) {
                cleaning = false;
                return;
            }
            
            if (~val.indexOf("@")) {
                parts = val.split("@");
                if (parts[0]) {
                    if (lastSearch != parts[0])
                        filter(parts[0]);
                    if (updatePreview !== false) previewFile(true);
                    tab = lastPreviewed || tabs.focussedTab;
                    if (tab) {
                        emit("outline", { value: parts[1], tab: tab });
                        intoOutline = true;
                    }
                }
                else {
                    tab = tabs.focussedTab;
                    if (tab) {
                        emit("outline", { value: parts[1], tab: tab });
                        intoOutline = true;
                    }
                }
            }
            else {
                if (intoOutline)
                    stopOutline();
                
                if (~val.indexOf(":"))
                    parts = /^(.*?):(\d*)(?::(\d+))?$/g.exec(val);
                if (parts) {
                    if (parts[1]) {
                        if (lastSearch != parts[1])
                            filter(parts[1]);
                        if (updatePreview !== false) previewFile(true);
                        tab = lastPreviewed || tabs.focussedTab;
                        if (tab && parts[2])
                            tab.editor.ace.gotoLine(parts[2], parts[3]);
                    }
                    else {
                        tab = tabs.focussedTab;
                        if (tab && parts[2])
                            tab.editor.ace.gotoLine(parts[2], parts[3]);
                    }
                }
                else if (updatePreview !== false) {
                    filter(val);
                }
            }

            if (dirty && val.length > 0 && ldSearch.loaded) {
                dirty = false;
                updateFileCache(true);
            }
        }
        
        function reloadResults() {
            if (!winGoToFile) {
                if (isReloadScheduled)
                    return;
                isReloadScheduled = true;
                plugin.once("draw", function() {
                    isReloadScheduled = false;
                    reloadResults();
                });
                return;
            }
            
            // Wait until window is visible
            if (!winGoToFile.visible) {
                winGoToFile.on("prop.visible", function visible(e) {
                    if (e.value) {
                        reloadResults();
                        winGoToFile.off("prop.visible", visible);
                    }
                });
                return;
            }
            
            var sel = tree.selection.getSelectedNodes();
            if (lastSearch) {
                filter(lastSearch, sel.length, true);
            } else {
                ldSearch.updateData(arrayCache);
            }
        }
    
        function markDirty(options, timeout) {
            // Ignore hidden files
            var path = options && options.path || "";
            if (path && !fsCache.showHidden && path.charAt(0) == ".")
                return;
            
            if (timeout <= 0) {
                clearTimeout(timer);
                if (timeout < 0) {
                    timer = setTimeout(function() { 
                        updateFileCache(true); 
                    }, -1 * timeout);
                }
                else {
                    updateFileCache(true);
                }
                return;
            }
            
            dirty = true;
            if (panels.isActive("navigate")) {
                clearTimeout(timer);
                timer = setTimeout(function() { 
                    updateFileCache(true); 
                }, timeout || 60000);
            }
        }
    
        var updating = false;
        function updateFileCache(isDirty) {
            clearTimeout(timer);
            if (updating || c9.readOnly)
                return;
            
            updating = true;
            find.getFileList({
                path: "/",
                nocache: isDirty,
                hidden: fsCache.showHidden,
                buffer: true
            }, function(err, data) {
                if (err)
                    console.error(err);
                else
                    arrayCache = data.trim().split("\n");
                
                updating = false;
                reloadResults();
            });
            
            dirty = false;
        }
        
        function stopOutline() {
            if (!intoOutline) return;
            
            emit("outline.stop");
            tree.setDataProvider(ldSearch);
            intoOutline = false;
        }
        
        function cleanInput() {
            var value = txtGoToFile.getValue();
            if (value.match(/[:\@]/)) {
                cleaning = true;
                txtGoToFile.setValue(value.split(":")[0].split("@")[0]);
            }
        }
        
        /**
         * Searches through the dataset
         *
         */
        var lastResults;
        function filter(keyword, nosel, clear) {
            keyword = keyword.replace(/\*/g, "").replace(/^\.\//, "");
    
            if (!arrayCache.length) {
                lastSearch = keyword;
                return;
            }
            
            // Needed for highlighting
            ldSearch.keyword = keyword;
            
            var searchResults;
            if (!keyword) {
                var result = arrayCache.slice();
                // More prioritization for already open files
                tabs.getTabs().forEach(function (tab) {
                    if (!tab.path
                      || tab.document.meta.preview) return;
                    
                    var idx = result.indexOf(tab.path);
                    if (idx > -1) {
                        result.splice(idx, 1);
                        result.unshift(tab.path);
                    }
                });
                searchResults = result;
            }
            else {
                tree.provider.setScrollTop(0);
                
                var base;
                if (lastSearch && !clear)
                    base = keyword.substr(0, lastSearch.length) == lastSearch
                        ? lastResults : arrayCache;
                else
                    base = arrayCache;
                
                searchResults = search.fileSearch(base, keyword);
            }
    
            lastSearch = keyword;
            lastResults = searchResults.newlist;
    
            if (searchResults)
                ldSearch.updateData(searchResults);
                
            if (nosel || !searchResults.length)
                return;
    
            var first = -1;
            if (keyword) {
                first = 0;
                // See if there are open files that match the search results
                // and the first if in the displayed results
                var openTabs = tabs.getTabs(), hash = {};
                for (var i = openTabs.length - 1; i >= 0; i--) {
                    var tab = openTabs[i];
                    if (!tab.document.meta.preview && tab.path) {
                        if (basename(tab.path).indexOf(keyword) === 0)
                            hash[tab.path] = true;
                    }
                }
                
                // loop over all visible items. If we find a visible item
                // that is in the `hash`, select it and return.
                
                var last = tree.renderer.$size.height / tree.provider.rowHeight;
                for (var i = 0; i < last; i++) {
                    if (hash[ldSearch.visibleItems[i]]) {
                        first = i;
                        break;
                    }
                }
            }
            // select the first item in the list
            tree.select(tree.provider.getNodeAtIndex(first));
        }
        
        function openFile(noanim, nohide) {
            if (!ldSearch.loaded)
                return false;

            var nodes = tree.selection.getSelectedNodes();
            var cursor = tree.selection.getCursor();
    
            // Cancel Preview and Keep the tab if there's only one
            if (tabs.preview({ cancel: true, keep: nodes.length == 1 }) === true 
              || intoOutline)
                return nohide || plugin.hide();
            
            nohide || plugin.hide();
            
            var fn = function() {};
            for (var i = 0, l = nodes.length; i < l; i++) {
                var id = nodes[i].id;
                if (!id) continue;
                
                var path = id;
                var focus = id === cursor.id;
                
                tabs.open({
                    path: path, 
                    noanim: l > 1,
                    focus: focus && (nohide ? "soft" : true)
                }, fn);
            }
            
            lastPreviewed = null;
        }
        
        function previewFile(force) {
            if ((!lastPreviewed || !lastPreviewed.loaded)
              && !settings.getBool("user/general/@preview-navigate") && !force)
                return;
            
            if (!ldSearch.loaded)
                return false;
            
            var node = tree.selection.getCursor();
            var value = node && node.id;
            if (!value)
                return;
                
            var path = util.normalizePath(value);
            lastPreviewed = tabs.preview({ path: path }, function() {
                onInput(false);
            });
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("draw", function(e) {
            draw(e);
        });
        plugin.on("enable", function() {
            
        });
        plugin.on("disable", function() {
            
        });
        plugin.on("show", function(e) {
            analytics.log("Opened Navigate");
            cleanInput();
            txtGoToFile.focus();
            txtGoToFile.select();
            if (dirty)
                updateFileCache(true);
        });
        plugin.on("hide", function(e) {
            // Cancel Preview
            tabs.preview({ cancel: true });
            // Stop Outline if there
            stopOutline();
            // Prevent files from being refreshed
            clearTimeout(timer);
            txtGoToFile.blur();
        });
        plugin.on("unload", function() {
            loaded = false;
            drawn = false;
            
            winGoToFile = null;
            txtGoToFile = null;
            tree = null;
            ldSearch = null;
            lastSearch = null;
            lastPreviewed = null;
            cleaning = null;
            intoOutline = null;
            isReloadScheduled = null;
            
            dirty = true;
            updating = false;
        });
        
        /***** Register and define API *****/
        
        /**
         * Navigation panel. Allows a user to navigate to files by searching
         * for a fuzzy string that matches the path of the file.
         * @singleton
         * @extends Panel
         **/
        /**
         * @command navigate
         */
        /**
         * Fires when the navigate panel shows
         * @event showPanelNavigate
         * @member panels
         */
        /**
         * Fires when the navigate panel hides
         * @event hidePanelNavigate
         * @member panels
         */
        plugin.freezePublicAPI({
            /**
             * @property {Object}  The tree implementation
             * @private
             */
            get tree() { return tree; },
            
            /**
             * 
             */
            markDirty: markDirty
        });
        
        register(null, {
            navigate: plugin
        });
    }
});
