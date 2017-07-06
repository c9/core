/**
 * jumptodef Module for the Cloud9
 *
 * @copyright 2013, Ajax.org B.V.
 */

define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "tabManager", "ace", "language",
        "menus", "commands", "c9", "tabManager",
        "ui", "settings", "preferences", "proc",
        "dialog.error"
    ];
    main.provides = ["language.jumptodef"];
    return main;
    
    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var language = imports.language;
        var commands = imports.commands;
        var settings = imports.settings;
        var aceHandle = imports.ace;
        var prefs = imports.preferences;
        var tabs = imports.tabManager;
        var ui = imports.ui;
        var proc = imports.proc;
        var showError = imports["dialog.error"].show;
        var c9 = imports.c9;
        var util = require("plugins/c9.ide.language/complete_util");
        var HoverLink = require("./hover_link").HoverLink;
        var MouseHandler = require("ace/mouse/mouse_handler").MouseHandler;
        var useragent = require("ace/lib/useragent");
        var menus = imports.menus;
        
        var CRASHED_JOB_TIMEOUT = 30000;
        var worker;
        var loaded;
        var lastJump;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        
        function load() {
            if (loaded) return false;
            loaded = true;
            
            language.once("initWorker", function(e) {
                worker = e.worker;
        
                commands.addCommand({
                    name: "jumptodef",
                    bindKey: { mac: "F3", win: "F3" },
                    hint: "jump to the definition of the variable or function that is under the cursor",
                    exec: function() {
                        jumptodef();
                    }
                }, plugin);
        
                // right click context item in ace
                var mnuJumpToDef = new ui.item({
                    id: "mnuEditorJumpToDef",
                    caption: "Jump to Definition",
                    command: "jumptodef"
                });
                var mnuJumpToDef2 = new ui.item({
                    caption: "Jump to Definition",
                    command: "jumptodef",
                    id: "mnuEditorJumpToDef2"
                });
    
                aceHandle.getElement("menu", function(menu) {
                    menus.addItemToMenu(menu, mnuJumpToDef2, 750, plugin);
                    menu.on("prop.visible", function(e) {
                        // only fire when visibility is set to true
                        if (e.value) {
                            // because of delays we'll disable by default
                            mnuJumpToDef2.disable();
                            checkIsJumpToDefAvailable();
                        }
                    });
                });
                menus.addItemByPath("Goto/Jump to Definition", mnuJumpToDef, 1450, plugin);
    
                // when the context menu pops up we'll ask the worker whether we've
                // jumptodef available here
        
                // listen to the worker's response
                worker.on("definition", function(e) {
                    onDefinitions(e);
                });
        
                // when the analyzer tells us if the jumptodef result is available
                // we'll disable/enable the jump to definition item in the ctx menu
                worker.on("isJumpToDefinitionAvailableResult", function(ev) {
                    if (ev.data.value) {
                        mnuJumpToDef2.enable();
                    }
                    else {
                        mnuJumpToDef2.disable();
                    }
                    
                    var ace = tabs.focussedTab && tabs.focussedTab.editor && tabs.focussedTab.editor.ace;
                    if (ace && ace.hoverLink && ace.hoverLink.isOpen) {
                        var pos = ev.data.pos;
                        if (!ev.data.value) {
                            ace.hoverLink.range.contains(pos.row, pos.column);
                            ace.hoverLink.removeMarker();
                        }
                    }
                });
            });
            
            language.on("attachToEditor", function addBinding(ace) {
                // ace.$mouseHandler.$enableJumpToDef = true;
                var hoverLink = new HoverLink(ace);
                hoverLink.on("addMarker", function (e) {
                    worker.emit("isJumpToDefinitionAvailable", { data: e.range.start });
                });
                hoverLink.on("open", function(e, hoverLink) {
                    if (hoverLink.isOpen) {
                        var cursor = hoverLink.editor.getCursorPosition();
                        if (!hoverLink.range.contains(cursor.row, cursor.column))
                            hoverLink.editor.selection.setRange(hoverLink.range);
                        jumptodef();
                    }
                });
            });
            
            settings.on("read", function () {
                settings.setDefaults("user/language", [
                    ["overrideMultiselectShortcuts", "true"]
                ]);
                updateSettings();
            });
            prefs.add({
                "Language": {
                    "Input": {
                        "Use Cmd-Click for Jump to Definition": {
                            type: "checkbox",
                            path: "user/language/@overrideMultiselectShortcuts",
                            position: 6000
                        }
                    }
                }
            }, plugin);
            
            settings.on("user/language", updateSettings);
        }
        
        function updateSettings() {
            var key = useragent.isMac ? "cmd-" : "ctrl-";
            if (settings.getBool("user/language/@overrideMultiselectShortcuts")) {
                MouseHandler.prototype.$enableJumpToDef = true;
                HoverLink.prototype.$keyModifier = key;
            } else {
                MouseHandler.prototype.$enableJumpToDef = false;
                HoverLink.prototype.$keyModifier = key + "shift-";
            }
        }
        
        function addUnknownColumn(ace, pos, name) {
            if (pos.sc)
                return pos;
            var document = ace.document || ace.getSession().getDocument();
            if (!document)
                return pos;
            var line = document.getLine(pos.sl);
            if (!line)
                return pos;
            if (!name) {
                pos.sc = line.match(/^(\s*)/).length;
                return pos;
            }
            var index = line && line.indexOf(name);
            if (index < 0)
                return pos;
            pos.sc = index;
            pos.el = pos.el || pos.sl;
            if (pos.el === pos.sl)
                pos.ec = index + name.length;
            return pos;
        }
    
        /**
         * Fire an event to the worker that asks whether the jumptodef is available for the
         * current position.
         * Fires an 'isJumpToDefinitionAvailableResult' event on the same channel when ready
         */
        function checkIsJumpToDefAvailable() {
            var ace = tabs.focussedTab.editor.ace;
            if (!ace)
                return;
    
            worker.emit("isJumpToDefinitionAvailable", { data: ace.getSelection().getCursor() });
        }
    
        function jumptodef() {
            if (!tabs.focussedTab || !tabs.focussedTab.editor || !tabs.focussedTab.editor.ace)
                return;
            
            var tab = tabs.focussedTab;
            var ace = tab.editor.ace;
            var sel = ace.getSelection();
            var pos = sel.getCursor();
    
            activateSpinner(tabs.focussedTab);
            onJumpStart(ace);
            
            if (lastJump && lastJump.ace === ace
                && lastJump.row === pos.row && lastJump.column === pos.column) {
                clearSpinners(tab);
                jumpToPos(lastJump.sourcePath, lastJump.sourcePos);
                return;
            }
            
            lastJump = null;
    
            worker.emit("jumpToDefinition", {
                data: pos
            });
        }
    
        function onDefinitions(e) {
            var tab = tabs.findTab(e.data.path);
            if (!tab) return;
            
            clearSpinners(tab);
    
            var results = e.data.results;
    
            var editor = tab.editor;
    
            if (!results.length)
                return onJumpFailure(e, editor.ace);
    
            // We have no UI for multi jumptodef; we just take the last for now
            var lastResult;
            for (var i = results.length - 1; i >= 0; i--) {
                lastResult = results[i];
                if (!lastResult.isGeneric)
                    break;
            }
    
            var path = lastResult && lastResult.path || tab.path;
            
            jumpToPos(path, lastResult, e.data.path, e.data.pos);
        }
        
        function jumpToPos(path, pos, sourcePath, sourcePos, callback) {
            pos.row = pos.row || 0;
            pos.column = pos.column || 0;
            if (path.substr(0, 2) === "//") {
                if (path.indexOf(c9.workspaceDir + "/") === 1)
                    path = path.substr(c9.workspaceDir.length + 1);
                else if (path.indexOf(c9.homeDir + "/") === 1)
                    path = "~" + path.substr(c9.homeDir.length + 1);
                else
                    // HACK: read file outside of vfs roots
                    return proc.execFile("cat", { args: [path.substr(1)]}, function(err, result) {
                        if (err) return showError("Could not open refrenced file: " + path);
                        
                        openTab(result);
                    });
            }
            if (path[0] !== "/" && path[0] !== "~") {
                path = "/" + path;
            }
            openTab();
            
            function openTab(nonVFSValue) {
                tabs.open(
                    {
                        path: path,
                        active: true,
                        value: nonVFSValue
                    },
                    function(err, tab) {
                        if (err)
                            return;
                        
                        if (nonVFSValue) {
                            makeReadonly(tab);
                            if (tab.document)
                                tab.document.meta.closeOnError = true;
                        }
                            
                        var state = tab.document && tab.document.getState();
                        if (state && state.ace) {
                            pos = addUnknownColumn(tab.editor.ace, pos);
                            lastJump = sourcePos && {
                                ace: tab.editor.ace,
                                row: pos.row,
                                column: pos.column,
                                path: path,
                                sourcePos: sourcePos,
                                sourcePath: sourcePath
                            };
                            state.ace.jump = {
                                row: pos.row,
                                column: pos.column
                            };
                        }
                        delete state.value;
                        tab.document.setState(state);
                        tabs.focusTab(tab);
                        
                        callback && callback();
                    }
                );
            }
        }
        
        function makeReadonly(tab) {
            tab.editor.ace.setReadOnly(true);
            tab.editor.ace.session.on("changeEditor", function(e) {
                if (e.oldEditor) {
                    e.oldEditor.setReadOnly(false);
                }
                if (e.editor) {
                    e.editor.setReadOnly(true);
                }
            });
        }
    
        function onJumpFailure(event, ace) {
            // Add a short delay as additional feedback
            setTimeout(function() {
                var cursor = ace.getSelection().getCursor();
                var oldPos = event.data.pos;
                if (oldPos.row !== cursor.row || oldPos.column !== cursor.column)
                    return;
                var line = ace.getSession().getLine(oldPos.row);
                if (!line)
                    return;
                var preceding = util.retrievePrecedingIdentifier(line, cursor.column);
                var column = cursor.column - preceding.length;
                if (column === oldPos.column)
                    column = line.match(/^(\s*)/).length;
                var newPos = { row: cursor.row, column: column };
                ace.getSelection().setSelectionRange({ start: newPos, end: newPos });
            }, 300);
        }
    
        function onJumpStart(ace) {
            var cursor = ace.getSelection().getCursor();
            var line = ace.getSession().getDocument().getLine(cursor.row);
            if (!line)
                return;
            
            var preceding = util.retrievePrecedingIdentifier(line, cursor.column);
            var column = cursor.column - preceding.length;
            var following = util.retrieveFollowingIdentifier(line, column);
            var startPos = { row: cursor.row, column: column };
            
            var endPos = { row: cursor.row, column: column + following.length };
            
            ace.getSelection().setSelectionRange({ start: startPos, end: endPos });
        }
    
        function activateSpinner(tab) {
            tab.classList.add("loading");
            clearTimeout(tab.$jumpToDefReset);
            tab.$jumpToDefReset = setTimeout(function() {
                clearSpinners(tab);
            }, CRASHED_JOB_TIMEOUT);
        }
    
        function clearSpinners(tab) {
            clearTimeout(tab.$jumpToDefReset);
            tab.classList.remove("loading");
        }
        
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
        
        register(null, {
            "language.jumptodef": plugin.freezePublicAPI({
                /** @ignore */
                addUnknownColumn: addUnknownColumn,
                /** @ignore */
                jumpToPos: jumpToPos
            })
        });
    }
});
