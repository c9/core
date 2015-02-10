define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "settings", "ui", "watcher", "menus", "tabManager", "find", "fs", 
        "panels", "fs.cache", "preferences", "c9", "commands", "tree"
    ];
    main.provides = ["navigate"];
    return main;
    
    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var settings = imports.settings;
        var ui = imports.ui;
        var c9 = imports.c9;
        var fs = imports.fs;
        var fsCache = imports["fs.cache"];
        var tabs = imports.tabManager;
        var menus = imports.menus;
        var watcher = imports.watcher;
        var commands = imports.commands;
        var panels = imports.panels;
        var find = imports.find;
        var filetree = imports.tree;
        var prefs = imports.preferences;
        
        var markup = require("text!./navigate.xml");
        var search = require('./search');
        var Tree = require("ace_tree/tree");
        var ListData = require("./dataprovider");
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var winGoToFile, txtGoToFile, tree, ldSearch;
        var lastPanel, lastSearch, lastPreviewed;
        
        var dirty = true;
        var arrayCache = [];
        var timer;
        
        var loaded = false;
        function load(){
            if (loaded) return false;
            loaded = true;
            
            // Register this panel on the left-side panels
            panels.register({
                index: 200,
                caption: "Navigate",
                command: "navigate",
                hint: "search for a filename, line or symbol and jump to it",
                bindKey: { mac: "Command-E|Command-P", win: "Ctrl-E|Ctrl-P" },
                panel: plugin,
                elementName: "winGoToFile",
                minWidth: 130,
                autohide: true,
                draw: draw
            });
            
            panels.on("showpanelNavigate", function(e) {
                lastPanel = e.lastPanel;
                txtGoToFile.focus();
                txtGoToFile.select();
                tree.resize();
            });
            panels.on("hidepanelNavigate", function(e) {
                tree.clearSelection();
            });
            
            // Menus
            var mnuItem = new apf.item({ command : "navigate" });
            menus.addItemByPath("File/Open...", mnuItem, 500, plugin);
            menus.addItemByPath("Goto/Goto File...", mnuItem.cloneNode(false), 100, plugin);
    
            // Settings
            settings.on("read", function(){
                settings.setDefaults("user/general", [["preview-navigate", "false"]]);
            }, plugin);
            
            // Prefs
            prefs.add({
                "General" : {
                    "General" : {
                        "Enable Preview on Navigation" : {
                            type: "checkbox",
                            position: 2000,
                            path: "user/general/@preview-navigate"
                        }
                    }
                }
            }, plugin);
    
            // Update when the fs changes
            fs.on("afterWriteFile", function(e) {
                // Only mark dirty if file didn't exist yet
                if (arrayCache.indexOf(e.path) == -1)
                    markDirty(e);
            });
            fs.on("afterUnlink",    markDirty);
            fs.on("afterRmfile",    markDirty);
            fs.on("afterRmdir",     markDirty);
            fs.on("afterCopy",      markDirty);
            fs.on("afterRename",    markDirty);
            fs.on("afterSymlink",   markDirty);
            
            // Or when a watcher fires
            watcher.on("delete",     markDirty);
            watcher.on("directory",  markDirty);
            
            // Or when the user refreshes the tree
            filetree.on("refresh", markDirty); 
            
            // Or when we change the visibility of hidden files
            fsCache.on("setShowHidden", markDirty);
            
            // Pre-load file list
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
            ui.insertMarkup(options.panel, markup, plugin);
            
            // Import CSS
            ui.insertCss(require("text!./style.css"), plugin);
            
            var treeParent = plugin.getElement("tree");
            txtGoToFile = plugin.getElement("txtGoToFile");
            winGoToFile = plugin.getElement("winGoToFile");
            txtGoToFile = plugin.getElement("txtGoToFile");

            // Create the Ace Tree
            tree = new Tree(treeParent.$int);
            ldSearch = new ListData(arrayCache);
            ldSearch.search = search;
            
            // Assign the dataprovider
            tree.setDataProvider(ldSearch);

            // @TODO this is probably not sufficient
            window.addEventListener("resize", function(){ tree.resize() });
            
            tree.textInput = txtGoToFile.ace.textInput;
            
            // @Harutyun; is this the right way to do it?
            function available(){ return tree.isFocused() }
            
            txtGoToFile.ace.commands.addCommands([
                {
                    bindKey: "ESC",
                    exec: function(){ hide(); }
                }, {
                    bindKey: "Up",
                    exec: function(){ tree.execCommand("goUp"); }
                }, {
                    bindKey: "Down",
                    exec: function(){ tree.execCommand("goDown"); }
                }, {
                    bindKey: "Enter",
                    exec: function(){ openFile(true); }
                }
            ]);
            
            tree.on("mousedown", function(e) {
                var pos = e.getDocumentPosition();
                var node = tree.provider.findItemAtOffset(pos.y);
                ldSearch.selectNode(node);
                openFile(true);
            })
            
            txtGoToFile.ace.on("input", function(e) {
                var val = txtGoToFile.getValue();
                filter(val);
    
                if (dirty && val.length > 0 && ldSearch.loaded) {
                    dirty = false;
                    updateFileCache(true);
                }
            });

            // @Harutyun, the select event should be on the tree or the selection object
            //      I just hacked it into the dataprovider for now, but that is very wrong.
            // tree.getSelection().on("changeSelection", function(){ previewFile(); });
            // tree.on("select", function(){ previewFile(); });
            ldSearch.on("select", function(){ previewFile(); });
    
            function onblur(e) {
                if (!winGoToFile.visible)
                    return;
                
                var to = e.toEasdasdasdasdaaaasssdddlement;
                if (!to || apf.isChildOf(winGoToFile, to, true)
                  || (lastPreviewed && tabs.previewTab 
                  && tabs.previewTab === lastPreviewed
                  && (apf.isChildOf(lastPreviewed.aml.relPage, to, true)
                  || lastPreviewed.aml == to))) {
                    return;
                }
                
                hide();
            }
    
            apf.addEventListener("movefocus", onblur);
    
            // Focus the input field
            txtGoToFile.focus();
            
            // Offline
            c9.on("stateChange", offlineHandler, plugin);
            offlineHandler({ state: c9.status });
        
            emit("draw");
        }
        
        /***** Methods *****/
        
        function reloadResults(){
            if (!winGoToFile)
                return;
            
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
            
            // @Harutyun, how do I get the selection, scrollTop?
            
            // var sel = [];
            // dgGoToFile.getSelection().forEach(function(node) {
            //     var i = node.firstChild.nodeValue;
            //     sel.push(searchResults[i]);
            // });
            
            // var state = {
            //     sel : sel, //store previous selection
            //     caret : dgGoToFile.caret && searchResults[dgGoToFile.caret.firstChild.nodeValue],
            //     scrollTop : dgGoToFile.$viewport.getScrollTop()
            // };

            if (lastSearch)
                filter(lastSearch);//, state.sel.length);
            else
                ldSearch.updateData(arrayCache);

            // @Harutyun, how do I set the selection, scrollTop?
            
            // if (state.sel.length && state.sel.length < 100) {
            //     var list = [];
            //     sel = state.sel;
            //     for (var i = 0, l = sel.length; i < l; i++) {
            //         list.push(dgGoToFile.queryNode("//d:href[text()='"
            //             + searchResults.indexOf(sel[i]) + "']"));
            //     }
            //     dgGoToFile.selectList(list);
            //     if (state.caret)
            //         dgGoToFile.setCaret(dgGoToFile.queryNode("//d:href[text()='"
            //             + searchResults.indexOf(state.caret) + "']"));
            //     dgGoToFile.$viewport.setScrollTop(state.scrollTop);
            // }
        }
    
        function markDirty(options) {
            // Ignore hidden files
            var path = options && options.path || "";
            if (path && !fsCache.showHidden && path.charAt(0) == ".")
                return;
            
            dirty = true;
            if (panels.isActive("navigate")) {
                clearTimeout(timer);
                timer = setTimeout(function(){ updateFileCache(true); }, 2000);
            }
        }
    
        function updateFileCache(isDirty) {
            clearTimeout(timer);
            
            find.getFileList({
                path: "/",
                nocache: isDirty,
                hidden: fsCache.showHidden,
                buffer: true
            }, function(err, data) {
                if (err)
                    return;

                arrayCache = data.trim().split("\n");
                reloadResults();
            });
            
            dirty = false;
        }
        
        /**
         * Searches through the dataset
         *
         */
        function filter(keyword, nosel) {
            keyword = keyword.replace(/\*/g, "");
    
            if (!ldSearch.loaded) {
                lastSearch = keyword;
                return;
            }
            
            // Needed for highlighting
            ldSearch.keyword = keyword;
            
            var searchResults;
            if (!keyword || !keyword.length) {
                var result = arrayCache.slice();
                // More prioritization for already open files
                tabs.getTabs().forEach(function (tab) {
                    if (!tab.path
                      || pages[i].document.meta.preview) return;
                    
                    var idx = result.indexOf(tab.path);
                    if (idx > -1) {
                        result.splice(idx, 1);
                        result.unshift(tab.path);
                    }
                });
                searchResults = result;
            }
            else {
                // @Harutyun, how do I set the scroll position?
                // dgGoToFile.$viewport.setScrollTop(0);
                searchResults = search.fileSearch(arrayCache, keyword);
            }
    
            lastSearch = keyword;
    
            if (searchResults && searchResults.length)
                ldSearch.updateData(searchResults);
                
            if (nosel || !searchResults.length)
                return;
    
            // See if there are open files that match the search results
            // and the first if in the displayed results
            var pages = tabs.getTabs(), hash = {};
            for (var i = pages.length - 1; i >= 0; i--) {
                if (!pages[i].document.meta.preview)
                    hash[pages[i].path] = true;
            }
            
            // loop over all visible items. If we find a visible item
            // that is in the `hash`, select it and return.
            var first = tree.renderer.getFirstVisibleRow();
            var last = tree.renderer.getLastVisibleRow();
            for (var i = first; i < last; i++) {
                if (hash[ldSearch.visibleItems[i]]) {
                    tree.select(i);
                    return;
                }
            }
    
            // select the first item in the list
            if (keyword) {
                tree.select(0);
            }
        }

        function openFile(noanim) {
            if (!ldSearch.loaded)
                return false;
                
            // @Harutyun, How do I get the selection (multiple)
            // var nodes = dgGoToFile.getSelection();
    
            // Temporary
            var nodes = [];
            var row = ldSearch.selectedRow;
            nodes.push(ldSearch.visibleItems[row]);
    
            // Cancel Preview and Keep the tab if there's only one
            if (tabs.preview({ cancel: true, keep : nodes.length == 1 }) === true)
                return hide();
            
            hide();
            
            var fn = function(){};
            for (var i = 0, l = nodes.length; i < l; i++) {
                var path = "/" + nodes[i].replace(/^[\/]+/, "");
                
                tabs.open({
                    path: path, 
                    noanim: l > 1,
                    active: i == l - 1
                }, fn);
            }
            
            lastPreviewed = null;
        }
        
        function previewFile(noanim) {
            if (!settings.getBool("user/general/@preview-navigate"))
                return;
            
            if (!ldSearch.loaded)
                return false;
            
            var row = ldSearch.selectedRow;
            var value = ldSearch.visibleItems[row];
            if (!value)
                return;
                
            var path = "/" + value.replace(/^[\/]+/, "");
            lastPreviewed = tabs.preview({ path: path }, function(){});
        }

        function show() {
            panels.activate("navigate");
        }
        
        function hide(){
            if (panels.isActive("navigate")) {
                if (lastPanel)
                    panels.activate(lastPanel);
                else
                    panels.deactivate("navigate");
                
                // Cancel Preview
                tabs.preview({ cancel: true });
                
                if (tabs.focussedTab)
                    tabs.focussedTab.editor.focus();
            }
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
            loaded = false;
            drawn = false;
        });
        
        /***** Register and define API *****/
        
        /**
         * Navigation panel. Navigates to files, lines and symbols
         **/
        plugin.freezePublicAPI({
            /**
             * 
             */
            show: show
        });
        
        register(null, {
            navigate: plugin
        });
    }
});