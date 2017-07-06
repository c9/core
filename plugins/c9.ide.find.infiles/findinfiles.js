define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "c9", "util", "settings", "ui", "layout", 
        "find", "anims", "menus", "tabManager", "commands", "tooltip", 
        "tree", "apf", "console", "preferences", "dialog.question", 
        "tree.favorites", "save"
    ];
    main.provides = ["findinfiles"];
    return main;

    function main(options, imports, register) {
        var c9 = imports.c9;
        var util = imports.util;
        var Plugin = imports.Plugin;
        var settings = imports.settings;
        var ui = imports.ui;
        var anims = imports.anims;
        var menus = imports.menus;
        var commands = imports.commands;
        var favs = imports["tree.favorites"];
        var c9console = imports.console;
        var layout = imports.layout;
        var tooltip = imports.tooltip;
        var tabs = imports.tabManager;
        var tree = imports.tree;
        var prefs = imports.preferences;
        var find = imports.find;
        var save = imports.save;
        var question = imports["dialog.question"].show;
        var apf = imports.apf;

        var markup = require("text!./findinfiles.xml");
        var lib = require("plugins/c9.ide.find.replace/libsearch");
        
        var SearchMode = require("ace/mode/c9search").Mode;

        /***** Initialization *****/

        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();

        var libsearch = lib(settings, execFind, toggleDialog, function() {});

        // Make ref available for other search implementations (specifically searchreplace)
        lib.findinfiles = plugin;

        var position, lastActiveAce;

        // ui elements
        var txtSFFind, txtSFPatterns, chkSFMatchCase;
        var chkSFRegEx, txtSFReplace, chkSFWholeWords, searchRow, chkSFConsole;
        var winSearchInFiles, ddSFSelection, tooltipSearchInFiles, btnSFFind;
        var btnSFReplaceAll, btnCollapse, currentProcess;

        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;

            commands.addCommand({
                name: "searchinfiles",
                hint: "search for a string through all files in the current workspace",
                bindKey: { mac: "Shift-Command-F", win: "Ctrl-Shift-F" },
                exec: function () {
                    toggleDialog(1);
                }
            }, plugin);

            menus.addItemByPath("Find/~", new ui.divider(), 10000, plugin),
            menus.addItemByPath("Find/Find in Files...", new ui.item({
                command: "searchinfiles"
            }), 20000, plugin);

            settings.on("read", function(e) {
                settings.setDefaults("state/findinfiles", [
                    ["regex", "false"],
                    ["matchcase", "false"],
                    ["wholeword", "false"],
                    ["console", "true"],
                    ["scope", "selection"],
                ]);
                settings.setDefaults("user/findinfiles", [
                    ["consolelaunch", "false"],
                    ["fullpath", "false"],
                    ["scrolldown", "false"],
                    ["project", "/"],
                    ["clear", "true"]
                ]);
            }, plugin);

            prefs.add({
               "General": {
                   "Find in Files": {
                       position: 30,
                        "Search In This Path When 'Project' Is Selected": {
                            type: "textbox",
                            position: 100,
                            path: "user/findinfiles/@project"
                        },
                        "Show Full Path in Results": {
                            type: "checkbox",
                            position: 100,
                            path: "user/findinfiles/@fullpath"
                        },
                        "Clear Results Before Each Search": {
                            type: "checkbox",
                            position: 100,
                            path: "user/findinfiles/@clear"
                        },
                        "Scroll Down as Search Results Come In": {
                            type: "checkbox",
                            position: 100,
                            path: "user/findinfiles/@scrolldown"
                        },
                        "Open Files when Navigating Results with ↓ ↑": {
                            type: "checkbox",
                            position: 100,
                            path: "user/findinfiles/@consolelaunch"
                        }
                   }
               }
            }, plugin);

            tabs.on("focus", function(e) {
                if (e.tab.editor.type == "ace" 
                  && !e.tab.document.meta.searchResults) {
                    lastActiveAce = e.tab;
                }
            }, plugin);
            
            var tab = tabs.focussedTab;
            lastActiveAce = tab && tab.editor.type == "ace" ? tab : null;
            
            // Context Menu
            tree.getElement("mnuCtxTree", function(mnuCtxTree) {
                menus.addItemToMenu(mnuCtxTree, new ui.item({
                    match: "file|folder|project",
                    command: "searchinfiles",
                    caption: "Search In This Folder",
                    onclick: function() {
                        draw();
                        ddSFSelection.setAttribute("value", "selection");
                    }
                }), 1030, plugin);
            });
            
            // add mouse interaction to restored session
            SearchMode.prototype.attachToSession = initC9SearchSession;
        }

        var drawn = false;
        function draw() {
            if (drawn) return;
            drawn = true;

            // Create UI elements
            searchRow = layout.findParent(plugin);
            ui.insertMarkup(null, markup, plugin);

            txtSFFind = plugin.getElement("txtSFFind");
            txtSFPatterns = plugin.getElement("txtSFPatterns");
            chkSFMatchCase = plugin.getElement("chkSFMatchCase");
            chkSFRegEx = plugin.getElement("chkSFRegEx");
            txtSFReplace = plugin.getElement("txtSFReplace");
            chkSFWholeWords = plugin.getElement("chkSFWholeWords");
            chkSFConsole = plugin.getElement("chkSFConsole");
            ddSFSelection = plugin.getElement("ddSFSelection");
            btnSFFind = plugin.getElement("btnSFFind");
            winSearchInFiles = plugin.getElement("winSearchInFiles");
            btnSFReplaceAll = plugin.getElement("btnSFReplaceAll");
            btnCollapse = plugin.getElement("btnCollapse");
            tooltipSearchInFiles = plugin.getElement("tooltipSearchInFiles");

            btnSFFind.on("click", function() { execFind(); });
            btnSFReplaceAll.on("click", function() { execReplace(); });
            btnCollapse.on("click", function() { toggleDialog(-1); });

            var first = 0;
            function resize() {
                if (first++ < 2) { return; } // Skip first 2 calls
                var h = winSearchInFiles.$ext.scrollHeight;
                if (Math.abs(winSearchInFiles.height - h) < 1) { return; }
                winSearchInFiles.setHeight(h);
                winSearchInFiles.$ext.style.height = "";
                ui.layout.forceResize(null, true);
            }
            
            txtSFFind.ace.renderer.on("autosize", resize);
            txtSFReplace.ace.renderer.on("autosize", resize);

            var control = {};
            function animate(e) {
                if (control && control.stop) control.stop();
                
                if (e.name == "focus") {
                    if (e.fromElement != control.toShrink)
                        control.toShrink = null;
                    control.toGrow = e.currentTarget;
                } else {
                    control.toShrink = e.currentTarget;
                    control.toGrow = null;
                }
                
                if (control.toShrink == control.toGrow)
                    return;
                
                // if (focused == txtSFPatterns || focused == txtSFReplace)
                control.timer = control.timer || setTimeout(function() {
                    control.timer = null;
                    startAnimation();
                });
            }
            function startAnimation() {
                applyTween(control.toGrow, true);
                applyTween(control.toShrink, false);
                
                function applyTween(amlNode, grow) {
                    if (!amlNode) return;
                    var domNode = amlNode.$ext;
                    var value = grow ? 3 : 1;
                    var type = "boxFlex";
                    if (amlNode != txtSFPatterns) {
                        domNode = domNode.parentNode;
                    } else {
                        value = value == 1 ? 0 : value;
                        if (!value)
                            domNode.style.flexBasis = "auto";
                        type = "boxFlexGrow";
                    }
                    // I'd rather use css anims, but they didn't seem to work
                    apf.tween.single(domNode, {
                        type: type,
                        from: domNode.style[apf.CSS_FLEX_PROP] || (grow ? 1 : 3),
                        to: value,
                        anim: apf.tween.easeOutCubic,
                        control: control,
                        steps: 15,
                        interval: 1,
                        onfinish: function() {
                            ui.layout.forceResize(null, true);
                        }
                    });
                }
            }
            txtSFReplace.on("focus", animate);
            txtSFReplace.on("blur", animate);
            txtSFPatterns.on("focus", animate);
            txtSFPatterns.on("blur", animate);

            commands.addCommand({
                name: "hidesearchinfiles",
                bindKey: { mac: "ESC", win: "ESC" },
                isAvailable: function(editor) {
                    return winSearchInFiles.visible;
                },
                exec: function(env, args, request) {
                    toggleDialog(-1);
                }
            }, plugin);
    
            winSearchInFiles.on("prop.visible", function(e) {
                if (e.value) {
                    tree.on("select", setSearchSelection);
                    setSearchSelection();
                }
                else {
                    if (tree)
                        tree.off("select", setSearchSelection);
                }
            });

            txtSFFind.ace.session.on("change", function() {
                if (chkSFRegEx.checked)
                    libsearch.checkRegExp(txtSFFind, tooltipSearchInFiles, winSearchInFiles);
            });
            libsearch.addSearchKeyboardHandler(txtSFFind, "searchfiles");

            var kb = libsearch.addSearchKeyboardHandler(txtSFReplace, "replacefiles");
            kb.bindKeys({
                "Return|Shift-Return": function() { execReplace(); }
            });

            kb = libsearch.addSearchKeyboardHandler(txtSFPatterns, "searchwhere");

            var tt = document.body.appendChild(tooltipSearchInFiles.$ext);
    
            chkSFRegEx.on("prop.value", function(e) {
                libsearch.setRegexpMode(txtSFFind, ui.isTrue(e.value));
            });
            libsearch.setRegexpMode(txtSFFind, chkSFRegEx.checked);
            
            libsearch.setReplaceFieldMode(txtSFReplace, "jsOnly");

            var cbs = winSearchInFiles.selectNodes("//a:checkbox");
            cbs.forEach(function(cb) {
                tooltip.add(cb.$ext, {
                    message: cb.label,
                    width: "auto",
                    timeout: 0,
                    tooltip: tt,
                    animate: false,
                    getPosition: function() {
                        var pos = ui.getAbsolutePosition(winSearchInFiles.$ext);
                        var left = cb.$ext.getBoundingClientRect().left;
                        var top = pos[1];
                        return [left, top - 16];
                    }
                }, plugin);
            });
            
            [txtSFReplace, txtSFPatterns].forEach(function(node) {
                tooltip.add(node.$ext, {
                    message: node.label,
                    width: "auto",
                    timeout: 0,
                    tooltip: tt,
                    animate: false,
                    getPosition: function() {
                        var pos = ui.getAbsolutePosition(winSearchInFiles.$ext);
                        var left = node.$ext.getBoundingClientRect().left;
                        var top = pos[1];
                        return [left, top - 16];
                    }
                }, plugin);
            });
            
            ddSFSelection.setAttribute("value", settings.get("state/findinfiles/@scope"));
            ddSFSelection.on("afterselect", function() {
                settings.set("state/findinfiles/@scope", ddSFSelection.value);
            });
            
            // Offline
            c9.on("stateChange", function(e) {
                // Online
                if (e.state & c9.STORAGE) {
                    winSearchInFiles.enable();
                }
                // Offline
                else {
                    winSearchInFiles.disable();
                    btnCollapse.enable();
                }
            }, plugin);

            emit("draw");
        }

        /***** Methods *****/

        function getSearchResultPages() {
            return tabs.getTabs().filter(function(tab) {
                return tab.document.meta.searchResults;
            });
        }

        function setSearchSelection(e) {
            var path, node, name, parts;

            if (tree.selected) {
                // If originating from an event
                node = e && e.nodes[0] || tree.selectedNode;
                parts = node.path.split("/");

                // get selected node in tree and set it as selection
                name = "";
                if (node.isFolder)
                    name = parts[parts.length - 1];
                else
                    name = parts[parts.length - 2];

                if (name.length > 25)
                    name = name.substr(0, 22) + "...";
            }
            else {
                path = settings.get("user/tree_selection/@path") || "/";
                parts = path.split("/");
                if ((name = parts.pop()).indexOf(".") > -1)
                    name = parts.pop();
            }

            ddSFSelection.childNodes[1].setAttribute("caption",
                "Project (excludes .gitignore'd)");

            ddSFSelection.childNodes[2].setAttribute("caption",
                "Selection: " + (name || "/"));

            if (ddSFSelection.value == "selection") {
                ddSFSelection.setAttribute("value", "");
                ddSFSelection.setAttribute("value", "selection");
            }
        }

        function getSelectedTreePath() {
            var node = tree.selectedNode;
            if (!node.isFolder)
                node = node.parent || node;
            return node.path;
        }

        function toggleDialog(force, isReplace, noselect, callback) {
            draw();

            tooltipSearchInFiles.$ext.style.display = "none";

            if (!force && !winSearchInFiles.visible || force > 0) {
                var tab = tabs.focussedTab;
                var editor = tab && tab.editor;
                if (editor && editor.type == "ace") {
                    var ace = editor.ace;
                    if (!ace.selection.isEmpty() && !ace.selection.isMultiLine())
                        txtSFFind.setValue(ace.getCopyText());
                }
                
                if (winSearchInFiles.visible && force != 2) {
                    txtSFFind.focus();
                    txtSFFind.select();
                    return;
                }
                

                layout.setFindArea(winSearchInFiles, {}, callback);

                position = -1;

                txtSFFind.focus();
                txtSFFind.select();

                btnCollapse.setValue(1);
            }
            else if (winSearchInFiles.visible) {
                if (txtSFFind.getValue())
                    libsearch.saveHistory(txtSFFind.getValue(), "searchfiles");

                if (!noselect && tabs.focussedTab)
                    tabs.focusTab(tabs.focussedTab); 
                
                layout.setFindArea(null, {}, callback);

                btnCollapse.setValue(0);
            }

            return false;
        }

        function searchinfiles() {
            toggleDialog(1);
        }
        
        function shouldSearchVCSIgnores() {
            if (ddSFSelection.value == "project") {
                return false;
            }
            
            return true;
        }

        function getOptions() {
            return {
                query: txtSFFind.getValue().replace(/\\n/g, "\n"),
                pattern: txtSFPatterns.getValue(),
                casesensitive: chkSFMatchCase.checked,
                regexp: chkSFRegEx.checked,
                replaceAll: false,
                replacement: txtSFReplace.getValue(),
                wholeword: chkSFWholeWords.checked,
                path: getTargetFolderPath(),
                addVCSIgnores: !shouldSearchVCSIgnores()
            };
        }
        
        function getTargetFolderPath() {
            // Determine the scope of the search
            var path;
            if (ddSFSelection.value == "selection") {
                if (!tree.selected) {
                    var paths = settings.getJson("user/tree_selection");
                    if (!paths || !(path = paths[0]))
                        path = "/";
                }
                if (!path) {
                    path = getSelectedTreePath();
                }
            }
            else if (ddSFSelection.value == "project") {
                path = settings.get("user/findinfiles/@project") || "/";
            }
            else {
                path = "/";
            }
            return path;
        }

        function execReplace(options) {
            if (options) {
                options.replaceAll = true;
                save.saveAll({ skipNewFiles: true }, function() {
                    execFind(options);
                });
                return;
            }
            
            options = getOptions();
            if (options.replacement || txtSFReplace.ace.isFocused()) {
                execReplace(options);
            } else {
                question(
                    "Replace in files",
                    "Replace all occurrences of " + (options.query) + " in " + options.path,
                    "Do you want continue? (This change cannot be undone)",
                    function(all) { // Yes
                        execReplace(options);
                    },
                    function(all, cancel) { // No
                    },
                    { all: false, yes: "Replace Text", no: "Cancel" }
                );
            }
        }
        
        function execFind(options, cb) {
            if (cb && typeof cb != "function")
                cb = undefined; // called from libsearch
            options = options || getOptions();
            
            makeSearchResultsPanel(function(err, tab) {
                if (err)
                    return console.error("Error creating search panel");
                
                var session = tab.document.getSession();
                var acesession = session.session;
                var doc = acesession.getDocument();
                
                acesession.mergeUndoDeltas = false;
                if (settings.getBool("user/findinfiles/@clear"))
                    doc.setValue("");

                appendLines(doc, messageHeader(options.path, options));
                
                doc.lastHeaderRow = doc.getLength() - 3;

                if (ddSFSelection.value == "selection") {
                    var selection = tree.selection;
                    if (selection.length > 1) {
                        options.startPaths = selection;
                        options.path = "";
                    }
                }
                else if (ddSFSelection.value == "active") {
                    var filename = lastActiveAce && lastActiveAce.isActive()
                        && lastActiveAce.path;

                    if (!filename) {
                        appendLines(doc, "Error: There is no active file. "
                            + "Focus the editor you want to search and try again.\n");
                        return;
                    }

                    options.startPaths = [filename];
                }
                else if (ddSFSelection.value == "open") {
                    var files = [];
                    tabs.getTabs().forEach(function(tab) {
                        var path = tab.path;
                        if (path && path != "/.c9/searchresults")
                            files.push(path);
                    });

                    if (files.length < 1) {
                        appendLines(doc, "Error: There are no open files. "
                            + "Open some files and try again.\n");
                        return;
                    }

                    options.startPaths = files;
                }
                else if (ddSFSelection.value == "favorites") {
                    options.startPaths = favs.getFavoritePaths();

                    if (!options.startPaths.length) {
                        appendLines(doc, "Error: There are no favorites. "
                            + "Add a favorite folder and try again.\n");
                        return;
                    }
                }

                // Set loading indicator
                tab.classList.remove("changed");
                tab.classList.remove("error");
                tab.classList.add("loading");

                // Regexp for chrooted path
                var reBase = settings.getBool("user/findinfiles/@fullpath")
                    ? false
                    : new RegExp("^" + util.escapeRegExp(find.basePath), "gm");

                if (currentProcess) {
                    currentProcess.kill();
                    currentProcess.stdout.removeAllListeners("data");
                    currentProcess.stdout.removeAllListeners("end");
                }
                find.findFiles(options, function(err, stream, process) {
                    if (err) {
                        acesession.mergeUndoDeltas = true;
                        appendLines(doc, "Error executing search: " + err.message);
                        tab.classList.remove("loading");
                        tab.classList.add("error");
                        return cb && cb(err);
                    }
                    
                    currentProcess = process;

                    var firstRun = true;
                    stream.on("data", function(chunk) {
                        if (firstRun && !settings.getBool("user/findinfiles/@scrolldown")) {
                            var currLength = doc.getLength() - 3; // the distance to the last message
                            doc.ace.scrollToLine(currLength, false, true);
                            firstRun = false;
                        }
                        acesession.mergeUndoDeltas = true;
                        appendLines(doc,
                            reBase ? chunk.replace(reBase, "") : chunk);
                    });
                    stream.on("end", function(data) {
                        appendLines(doc, "\n", tab);
                        tab.classList.remove("loading");
                        tab.classList.add("changed");
                        
                        currentProcess = null;
                        
                        var endRow = doc.getLength();
                        for (var i = 1; i < 5; i++) {
                            var line = doc.getLine(endRow - i);
                            if (line && /Found \d+/.test(line)) {
                                var headerRow = doc.lastHeaderRow;
                                acesession.mergeUndoDeltas = true;
                                doc.insertInLine({
                                    row: headerRow,
                                    column: doc.getLine(headerRow).length
                                }, " (" + line.trim() + ")");
                                break;
                            }
                        }
                        cb && cb();
                    });
                });

                libsearch.saveHistory(options.query, "searchfiles");
                position = 0;

                // ide.dispatchEvent("track_action", {type: "searchinfiles"});
            });
        }
        
        function initC9SearchSession(acesession) {
            if (!acesession.searchInited) {
                var doc = acesession.doc;
                acesession.searchInited = true;
                var dblclick = function() {
                    launchFileFromSearch(doc.ace);
                };
                var onEnter = function(e) {
                    if (e.keyCode == 13) { // ENTER
                        if (e.altKey === false) {
                            launchFileFromSearch(doc.ace, !e.shiftKey);
                        }
                        else {
                            doc.ace.insert("\n");
                        }
                        e.preventDefault();
                        e.stopPropagation();
                    }
                };
                var onKeyup = function(e) {
                    if (e.keyCode >= 37 && e.keyCode <= 40) { // KEYUP or KEYDOWN
                        if (settings.getBool("user/findinfiles/@consolelaunch")) {
                            launchFileFromSearch(doc.ace, false);
                            return false;
                        }
                    }
                };
            
                var updateEditorEventListeners = function(e) {
                    if (e.oldEditor) {
                        e.oldEditor.container.removeEventListener("dblclick", dblclick);
                        e.oldEditor.container.removeEventListener("keydown", onEnter);
                        e.oldEditor.container.removeEventListener("keyup", onKeyup);
                    }
                    
                    if (e.editor) {
                        e.editor.container.addEventListener("keydown", onEnter);
                        e.editor.container.addEventListener("keyup", onKeyup);
                        e.editor.container.addEventListener("dblclick", dblclick);
                        // Ref for appendLines
                        doc.ace = e.editor;
                    }
                };
                
                acesession.on("changeEditor", updateEditorEventListeners);
                var e = acesession.c9doc ? acesession.c9doc.tab.editor : doc;
                if (e && e.ace && e.ace.session === acesession)
                    updateEditorEventListeners({ editor: e.ace });
            }
        }

        var basePath = find.basePath.replace(/[\\\/]+/g, "/");
        var reBasePath = new RegExp("^" + util.escapeRegExp(basePath));
        var reHome = new RegExp("^" + util.escapeRegExp(c9.home));
        function launchFileFromSearch(editor, focus) {
            if (focus === undefined)
                focus = true;
            var session = editor.getSession();
            var currRow = editor.getCursorPosition().row;

            // "string" type is the parent filename
            var pathRow = currRow + 1;
            while (pathRow -- > 0) {
                var token = session.getTokenAt(pathRow, 0);
                if (token && token.type.indexOf("string") != -1)
                    break;
            }

            var path = editor.getSession().getLine(pathRow);

            if (path.charAt(path.length - 1) !== ":")
                return;

            path = path.slice(0, -1).replace(/[\\\/]+/g, "/")
                .replace(reBasePath, "")
                .replace(reHome, "~");

            if (!/[\/~]/.test(path.charAt(0)))
                path = "/" + path;

            if (!path)
                return;
                
            var jump = session.getLine(currRow).match(/\s+(\d+):(\d*)/); // number:text
            if (jump) {
                var row = parseInt(jump[1], 10) - 1;
                if (jump[2]) {
                    jump = {
                        row: row,
                        column: parseInt(jump[2], 10) - 1
                    };
                } else {
                    var range = editor.getSelectionRange();
                    var offset = jump[0].length + 1;
                    
                    jump = {
                        row: row,
                        column: range.start.column - offset,
                        select: {
                            row: row,
                            column: range.end.column - offset
                        }
                    };
                }
            }

            tabs.open({
                path: path,
                active: true,
                focus: focus,
                document: {
                    ace: {
                        jump: jump
                    }
                }
            }, function(err, tab) {
                if (err) return console.error(err);
            });
        }

        function appendLines(doc, content) {
            if (!content || (!content.length && !content.count)) // blank lines can get through
                return;

            if (typeof content != "string")
                content = content.join("\n");

            if (content.length > 0) {
                doc.insert({ row: doc.getLength(), column: 0 }, content);
            }
        }

        function messageHeader(path, options) {
            var optionsDesc = [];

            if (options.regexp === true)
                optionsDesc.push("regexp");
            if (options.casesensitive === true)
                optionsDesc.push("case sensitive");
            if (options.wholeword === true)
                optionsDesc.push("whole word");

            if (optionsDesc.length > 0)
                optionsDesc = "\x01" + optionsDesc.join(", ") + "\x01";
            else
                optionsDesc = "";

            var replacement = "";
            if (options.replaceAll)
                replacement = "\x01, replaced as \x01" + trim(options.replacement);

            if (ddSFSelection.value == "workspace")
                path = "your entire workspace";
            if (ddSFSelection.value == "project")
                path = "project files (excludes .gitignore'd files)";
            else if (ddSFSelection.value == "active")
                path = "the active file";
            else if (ddSFSelection.value == "open")
                path = "all open files";
            else if (ddSFSelection.value == "favorites")
                path = "all favorite folders";

            return "Searching for \x01" + trim(options.query) + replacement
                + "\x01 in\x01" + path + "\x01" + optionsDesc + "\n\n";
        }

        function trim(str) {
            return /.*/.exec(str)[0];
        }

        function makeSearchResultsPanel(callback) {
            var tab = tabs.findTab("/.c9/searchresults");
            
            if (!tab) {
                var root = chkSFConsole.checked ? c9console : tabs;
                root.open({
                    path: "/.c9/searchresults", // This allows the tab to be saved
                    focus: true,
                    document: {
                        title: "Search Results",
                        meta: {
                            searchResults: true,
                            ignoreSave: true,
                            newfile: true
                        },
                        "ace": {
                            customSyntax: "c9search",
                            options: {}
                        }
                    },
                    editorType: "ace",
                    name: "searchResults"
                }, function(err, tab, done) {
                    tab.on("unload", function() {
                        if (currentProcess)
                            currentProcess.kill();
                    });
                    
                    tab.document.value = " "; // prevent metadata from loading old search results
                    
                    callback(err, tab);
                    if (typeof done == "function")
                        done();
                });
            }
            else {
                tabs.focusTab(tab);
                callback(null, tab);
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
        });

        /***** Register and define API *****/

        /**
         * Implements the search in files UI for Cloud9.
         * @singleton
         */
        /**
         * Fetches a ui element. You can use this method both sync and async.
         * 
         * The search in files plugin has the following elements:
         * 
         * * txtSFFind - `{@link ui.textbox}`
         * * txtSFPatterns - `{@link ui.textbox}`
         * * chkSFMatchCase - `{@link ui.checkbox}`
         * * chkSFRegEx - `{@link ui.checkbox}`
         * * txtSFReplace - `{@link ui.button}`
         * * chkSFWholeWords - `{@link ui.checkbox}`
         * * chkSFConsole - `{@link ui.checkbox}`
         * * ddSFSelection - `{@link ui.dropdown}`
         * * btnSFFind - `{@link ui.button}`
         * * winSearchInFiles - `{@link ui.window}`
         * * btnSFReplaceAll - `{@link ui.button}`
         * * btnCollapse - `{@link ui.button}`
         * * tooltipSearchInFiles - `{@link ui.label}`
         * 
         * @method getElement
         * @param {String}   name       the id of the element to fetch.
         * @param {Function} [callback] the function to call when the 
         *     element is available (could be immediately)
         */
        plugin.freezePublicAPI({
            /**
             * 
             */
            get aml() { return winSearchInFiles; },
            
            /**
             * Toggles the visibility of the search in files panel.
             * @param {Number} force  Set to -1 to force hide the panel, 
             *   or set to 1 to force show the panel.
             */
            toggle: toggleDialog,
            /**
             * @ignore
             */
            execFind: execFind
        });

        register(null, {
            findinfiles: plugin
        });
    }
});
