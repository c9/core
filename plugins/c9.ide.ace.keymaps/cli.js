define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "ui", "layout", "commands", "fs", "navigate", "save", 
        "tabbehavior", "ace", "commands", "tabManager"
    ];
    main.provides = ["vim.cli"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var ui = imports.ui;
        var commands = imports.commands;
        var layout = imports.layout;
        var fs = imports.fs;
        var navigate = imports.navigate;
        var save = imports.save;
        var tabbehavior = imports.tabbehavior;
        var tabManager = imports.tabManager;
        var ace = imports.ace;
        
        var Vim = require('ace/keyboard/vim').Vim;
        var Editor = require("ace/editor").Editor;
        var lang = require("ace/lib/lang");
        var pathLib = require("path");

        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var cmdLine;
        
        var searchStore = {
            current: "",
            options: {
                needle: "",
                backwards: false,
                wrap: true,
                caseSensitive: false,
                wholeWord: false,
                regExp: false
            }
        };
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
        }
        
        var drawn = false;
        function draw() {
            if (drawn) return;
            drawn = true;
            
            cmdLine = new apf.codebox();
            layout.findParent(plugin).appendChild(cmdLine);
            cmdLine.setHeight(23);
            cmdLine.$ext.className = "searchbox tb_console vimInput";
            
            updateTheme();
            initCmdLine(cmdLine.ace);
            
            ace.on("themeChange", updateTheme, plugin);
            
            emit("draw");
        }
        
        function updateTheme() {
            if (!cmdLine)
                return;
                
            var activeTheme = ace.theme; // themes.getActiveTheme();
            if (!activeTheme)
                return;
                
            cmdLine.ace.setTheme(activeTheme);
            
            var htmlNode = cmdLine.ace.container.parentNode;
            var style = htmlNode.style;
            style.background = activeTheme.bg;
            
            activeTheme.isDark
                ? ui.setStyleClass(htmlNode, "dark")
                : ui.setStyleClass(htmlNode, "", ["dark"]);
        }
        
        function show() {
            draw();
            layout.setFindArea(cmdLine, { isDefault: true });
        }
        
        function hide() {
            if (cmdLine) {
                layout.setFindArea(null, { isDefault: true });
            }
        }
        
        function toggle(force, a, b, callback) {
            if (force == -1)
                hide();
            else
                show();
                
            callback && callback();
        }
        
        /***** Methods *****/
        
        var cliCmds = {};
        
        cliCmds.ascii = {
            name: "ascii",
            description: "",
            exec: function(editor) {
                var onSelectionChange = lang.delayedCall(function(e) {
                    var c = editor.getCursorPosition();
                    var ch = editor.session.getLine(c.row)[c.column - 1] || "\n";
                    var code = ch.charCodeAt(0);
                    var msg = JSON.stringify(ch).slice(1, -1) + "=" + " ";
                    var str = code.toString(16);
                    str = [, "\\x0", "\\x", "\\u0", "\\u"][str.length] + str;
                    msg += str + " ";
                    msg += "\\" + code.toString(8) + " ";
                    msg += "&#" + code + ";";
                    editor.cmdLine.setMessage(msg);
                    clear.delay(2000);
                });
        
                var clear = lang.delayedCall(function(e) {
                    editor.removeListener(editor.asciiMessageListener);
                    editor.asciiMessageListener = null;
                    editor.cmdLine.setMessage("");
                });
        
                if (editor.asciiMessageListener) {
                    return clear.call();
                }
                editor.on("changeSelection", editor.asciiMessageListener = function() {
                    onSelectionChange.schedule(200);
                });
                onSelectionChange.call();
            }
        };
        
        cliCmds.set = {
            name: "set",
            description: "set editor option",
            exec: function(editor, args) {
                var cmd = args.text.split(" ");
                var optName = cmd[1];
                var optValue = parseOption(cmd[2]);
                editor.setOption(optName, optValue);
            },
            getCompletions: function() {
                return Object.keys(Editor.prototype.$options);
            }
        };
        
        function parseOption(optValue) {
            if (/^\d+$/.test(optValue))
                optValue = parseInt(optValue, 10);
            if (/^[\d.\^e]+$/.test(optValue))
                optValue = parseFloat(optValue);
            else if (/^(true|false)$/i.test(optValue))
                optValue = optValue.length = 4;
            return optValue;
        }
        
        cliCmds["/"] = {
            name: "/",
            history: [],
            cliExec: function(ed, data) { }
        };
        
        cliCmds["?"] = {
            name: "?",
            history: cliCmds["/"].history,
            cliExec: cliCmds["/"].cliExec
        };
        
        cliCmds[":"] = {
            name: ":",
            history: [],
            getCompletions: function() {
                return Object.keys(this.commands).concat(Object.keys(commands.commands));
            }
        };
        
        cliCmds[':'].reCommands = {
            /**
             * @see {@link http://vim.wikia.com/wiki/Search_and_replace|Vim wiki - sed}
             */
            'sed': {
                regex: /^(%|'<,'>|(?:\d+|\.),(?:\+?\d+|\$|\.))?s(\/|#)(.*?)\2(.*?)\2([giIc]*)$/,
                action: function (editor, cmd, data) {
                    Vim.handleEx(editor.state.cm, cmd);
                }
            }
        };
        
        cliCmds[":"].commands = {
            w: function(editor, data, callback) {
                var tab = tabManager.focussedTab;
                if (!tab || !tab.path)
                    return;
                var lines = editor.session.getLength();
                if (data.argv.length === 2 && data.argv[1]) {
                    var path = pathLib.join(pathLib.dirname(tab.path), data.argv[1]);
        
                    save.save(tab, { path: path }, function(err) {
                        if (!err)
                            editor.cmdLine.setTimedMessage(path + " [New] " + lines + "L, ##C written to ");
                        callback && callback();
                    });
                }
                else {
                    save.save(tab, {}, function(err) {
                        if (!err)
                            editor.cmdLine.setTimedMessage(tab.path + " " + lines + "L, ##C written");
                        callback && callback();
                    });
                }
            },
            e: function(editor, data) {
                var path = data.argv[1];
                if (!path) {
                    navigate.show();
                    return false;
                }
                else {
                    var currentPath = tabManager.focussedTab && tabManager.focussedTab.path || "/";
                    path = pathLib.join(pathLib.dirname(currentPath), data.argv[1]);
                    fs.exists(path, function(exists) {
                        if (exists) {
                            tabManager.openFile(path, { focus: true }, function() {});
                        }
                        else {
                            tabManager.open({
                                path: path,
                                focus: true,
                                document: {
                                    meta: {
                                        newfile: true,
                                        cli: true
                                    }
                                }
                            });
                        }
                    });
                }
            },
            x: function(editor, data) {
                var page = tabManager.focussedTab;
                if (!page)
                    return;
                    
                if (page.document.changed) {
                    cliCmds[":"].commands.wq(editor, data);
                    return;
                }
                else {
                    cliCmds[":"].commands.q();
                }
            },
            wq: function(editor, data) {
                cliCmds[":"].commands.w(editor, data, function() {
                    cliCmds[":"].commands.q();
                });
            },
            wa: function(editor, data) {
                commands.exec("saveall");
            },
            q: function(editor, data) {
                var page = tabManager.focussedTab;
                if (!page) return;
                
                if (data && data.force)
                    page.document.undoManager.bookmark();
                
                page.close();
            },
            "q!": function() {
                cliCmds[":"].commands.q(null, { force: true });
            },
            tabn: "gototabright",
            tabp: "gototableft",
            tabfirst: function() {
                tabbehavior.cycleTab("first", { editorType: "ace" });
            },
            tablast: function() {
                tabbehavior.cycleTab("last", { editorType: "ace" });
            },
            tabnew: function(editor, data) {
                var path = data.argv[1];
                if (!path) {
                    tabManager.open({
                        path: "",
                        document: {
                            meta: {
                                newfile: true
                            }
                        },
                        focus: true
                    });
                }
                else {
                   cliCmds[":"].commands.e(editor, data); 
                }
            },
            tabclose: "closetab",
            tabmove: function(editor, data) {
                // todo
            },
            ascii: cliCmds.ascii,
            sort: function(editor, data) {
                commands.exec("sortlines");
            },
        };
        
        // aliases
        cliCmds[":"].commands["tab drop"] = cliCmds[":"].commands.e;
        cliCmds[":"].commands.write = cliCmds[":"].commands.w;
        cliCmds[":"].commands.tabNext = cliCmds[":"].commands.tabn;
        cliCmds[":"].commands.tabPrevious = cliCmds[":"].commands.tabp;
        cliCmds[":"].commands.tabc = cliCmds[":"].commands.tabclose;
        
        cliCmds[":"].commands.set = {
            vimOpts: [
                "cursorline", "cul", "nocursorline", "nocul", //, "highlightActiveLine",
                "expandtab", "et", "noexpandtab", "noet", //"useSoftTabs",
                "number", "nu", "nonumber", "nonu" // "showGutter"
                // ["relativenumber", "rnu", "norelativenumber", "nornu"]
                // 'softtabstop' 'sts' number
                // 'tabstop' 'ts' number
            ],
            exec: function(ed, args) {
                var optName = args.argv[1];
                var optval = optName.slice(0, 2) != "no";
                if (optName[optName.length - 1] == "!") {
                    var toggle = true;
                    optName = optName.slice(0, -1);
                }
                var i = this.vimOpts.indexOf(optName);
                if (i == -1) {
                    ed.cmdLine.setTimedMessage("Unrecognised option '" + optName + "'.", 1500);
                    return;
                } else if (i < 4) {
                    optName = "highlightActiveLine";
                } else if (i < 8) {
                    optName = "useSoftTabs";
                } else if (i < 12) {
                    optName = "showGutter";
                }        
                if (toggle) 
                    optval = !ed.getOption(optName);
                ed.setOption(optName, optval);
            },
            getCompletions: function(e) {
                return this.vimOpts; //.concat(Object.keys(Editor.prototype.$options));
            }
        };
        
        cliCmds[":"].commands.syntax = commands.commands.syntax;
        
        cliCmds[":"].cliExec = function(ed, cmd, tokens) {
            var last = tokens[tokens.length - 1];
            if (last && last.type == "invisible")
                cmd += last.value;
            cmd = cmd.substr(1).trim();
            var args = cmd.split(/\s+/);
            var firstCmd = args[0];
        
            if (this.commands[firstCmd]) {
                cmd = this.commands[firstCmd];
                if (typeof cmd == "string")
                    return commands.exec(cmd, null, { argv: args });
                else if (typeof cmd == "function")
                    return cmd(ed, { argv: args });
                else if (cmd.exec)
                    return cmd.exec(ed, { argv: args });
            }
            else if (commands.commands[firstCmd]) {
                commands.exec(firstCmd, null, { argv: args });
            }
            else if (/^[+\-\d,]+$/.test(cmd)) {
                Vim.handleEx(ed.state.cm, cmd);
            }
            else {
                for (var key in this.reCommands) {
                    var reCmd = this.reCommands[key];
                    var match = reCmd.regex.exec(cmd);
                    if (match) {
                        return reCmd.action(ed, cmd, {
                            match: match,
                            argv: cmd.split(match[0], 1).slice(-1)[0].split(/\s+/)
                        });
                    }
                }
                
                ed.cmdLine.setTimedMessage(
                    'Vim command "' + cmd + '" not implemented.', 3500);
            }
        };
        
        var allCommands;
        function getCompletions(command) {
            if (command) {
                if (command.getCompletions)
                    return command.getCompletions() || [];
                if (command.commands)
                    return Object.keys(command.commands);
                return [];
            }
        
            if (!allCommands) {
                allCommands = Object.keys(commands.commands)
                    .concat(Object.keys(cliCmds));
            }
            return allCommands;
        }
        
        function getCommand(name, root) {
            if (root && root.commands && root.commands[name])
                return root.commands[name];
            if (root)
                return root;
            return cliCmds[name] || commands.commands[name];
        }
        
        function getActiveEditor() {
            var tab = tabManager.focussedTab;
            if (tab && tab.editorType == "ace")
                return tab.editor.ace;
        }
        
        function processCommandParts(ed, tokens, text) {
            for (var i = 0; i < tokens.length; i++) {
                var tok = tokens[i];
                var cmd = tok.command;
                if (!cmd)
                    continue;
                    
                if (cmd.name !== tok.value) {
                    var next = tokens[i + 1];
                    if (!next || next.type !== "invisible")
                        continue;
                }
                
                if (cmd.cliExec)
                    return cmd.cliExec(ed, text, tokens);
                else if (cmd.exec)
                    return cmd.exec(ed, {
                        argv: text.split(/\s+/), 
                        text: text, 
                        tokens: tokens
                    });
            }
        }
        
        function endCommandInput(cmdLine) {
            cmdLine.addToHistory();
            cmdLine.setValue("");
            var editor = getActiveEditor();
            if (editor) editor.textInput.focus();
        }
        
        function initCmdLine(cmdLine) {
            cmdLine.commands.addCommands([{
                bindKey: "Shift-Return|Ctrl-Return|Alt-Return",
                name: "insertNewLine",
                exec: function(cmdLine) { 
                    cmdLine.insert("\n"); 
                },
            }, {
                bindKey: "Esc|Shift-Esc|Ctrl-[",
                name: "cancel",
                exec: function(cmdLine) {
                    endCommandInput(cmdLine);
                }
            }, {
                bindKey: "Return",
                name: "run",
                exec: function run(cmdLine) {
                    var editor = cmdLine.editor || getActiveEditor();
                    var tokens = cmdLine.session.getTokens(0);
                    if (editor) editor.cmdLine = cmdLine;
                    processCommandParts(editor, tokens, cmdLine.getValue());
                    endCommandInput(cmdLine);
                },
            }, {
                bindKey: "Tab",
                name: "tabNext",
                exec: function tabNext(ed) { tabCycle(ed, 1); },
            }, {
                bindKey: "Shift-Tab",
                name: "tabPrevious",
                exec: function tabPrevious(ed) { tabCycle(ed, -1); },
            }, {
                bindKey: "Right",
                name: "arrowCompleteRight",
                exec: function arrowCompleteRight(ed) {
                    var session = ed.session;
                    var col = ed.selection.isEmpty() ? ed.selection.lead.column : -1;
                    ed.navigateRight();
                    var tok = session.getTokenAt(0, col + 1);
                    if (col == ed.selection.lead.column && tok && tok.type == "invisible")
                        session.doc.insertInLine({ row: 0, column: col }, tok.value);
                },
            }, {
                bindKey: "Up",
                name: "Up",
                exec: function(cmdLine) {cmdLine.navigateHistory(-1);},
            }, {
                bindKey: "Down",
                name: "Down",
                exec: function(cmdLine) {cmdLine.navigateHistory(1);},
            }, {
                bindKey: "Ctrl-Home|PageUp",
                name: "firstInHistory",
                exec: function(cmdLine) {cmdLine.navigateHistory(0);},
            }, {
                bindKey: "Ctrl-End|PageDown",
                name: "lastInHistory",
                exec: function(cmdLine) {cmdLine.navigateHistory();}
            }]);
        
            function tabCycle(ed, dir) {
                var session = ed.session;
                var range = ed.getSelectionRange();
                var line = session.getLine(0);
                var len = line.length;
                
                if (range.end.column != len || !range.isEmpty()) {
                    ed.navigateLineEnd();
                    return;
                }
        
                if (!ed.$tabCycle) {
                    var tok = session.getTokenAt(0, len) || { value: "", type: "" };
                    var matches = session.getState(0);
        
                    if (matches == "start")
                        matches = getCompletions();
                    if (!matches)
                        return;
        
                    if (matches.length == 1 && tok.value == matches[0]) {
                        if (tok.command) {
                            matches = getCompletions(tok.command);
                            tok = { value: "", type: "" };
                        }
                        if (!matches)
                            return;
                    }
        
                    ed.$tabCycle = {
                        matches: matches,
                        index: tok.value == matches[0] ? 0 : -1,
                        start: len - tok.value.length
                    };
                    ed.commands.on("exec", function onExec(e) {
                        var name = e.command && e.command.name;
                        if (name !== "tabNext" && name !== "tabPrevious") {
                            ed.$tabCycle = null;
                            ed.commands.removeListener("exec", onExec);
                        }
                    });
                }
        
                var matches = ed.$tabCycle.matches;
                var index = ed.$tabCycle.index;
                var start = ed.$tabCycle.start;
        
                index += dir;
                index %= matches.length;
                if (index < 0)
                    index = matches.length + index;
                ed.$tabCycle.index = index;
        
                var match = matches[index];
                if (!match)
                    return;
        
                var i = 0;
                while (match[i] && match[i] == line[start + i])
                    i++;
                start += i;
                match = match.substr(i);
        
                if (i === 0 && (/\w/.test(match[0]) && /\w/.test(line[start - 1])))
                    match = " " + match;
                if (/\w$/.test(match))
                    match += " ";
        
                range.start.column = start;
                range.end.column = len;
                session.replace(range, match);
        
                if (ed.$tabCycle.matches.length == 1)
                    ed.$tabCycle = null;
            }
        
            cmdLine.history = [];
            cmdLine.navigateHistory = function(dir) {
                var cliCmd = this.getCurrentCommandWithHistory() || {};
                var history = cliCmd.history || this.history;
                var index = history.index;
                var cmd = history[index] || "";
        
                if (dir === 0) {
                    index = 0;
                } else if (dir === null) {
                    index = history.length;
                } else if (typeof dir == "number") {
                    index += dir;
                    if (index < 0)
                        index = 0;
                    if (index > history.length)
                        index = history.length;
                }
        
                cmd = history[index] || "";
                if (cliCmd.history && cliCmd.name)
                    cmd = cliCmd.name + cmd;
                // TODO keep history.lastTyped
                this.setValue(cmd, 1);
                history.index = index;
            };
        
            cmdLine.addToHistory = function(val) {
                var cliCmd = this.getCurrentCommandWithHistory() || {};
                var history = cliCmd.history || this.history;
                val = val || this.getValue();
                if (cliCmd.name && cliCmd.history)
                    val = val.substr(cliCmd.name.length);
        
                if (val && val != history[history.index]) {
                    history.push(val);
                    history.index = history.length;
                }
            };
        
            cmdLine.getCurrentCommand = function() {
                var tokens = this.session.getTokens(0);
                var tok = tokens[tokens.length - 1];
                return tok && tok.command;
            };
        
            cmdLine.getCurrentCommandWithHistory = function() {
                var tokens = this.session.getTokens(0);
                for (var i = tokens.length; i--;) {
                    var tok = tokens[i];
                    if (tok && tok.command && tok.command.history)
                        return tok.command;
                }
            };
        
            cmdLine.on("blur", function() {
                cmdLine.renderer.$cursorLayer.element.style.opacity = 0;
                if (!cmdLine.getValue()) {
                    cmdLine.renderer.content.style.visibility = "hidden";
                    cmdLine.$messageNode.style.display = "";
                    cmdLine.$inMessageMode = true;
                    cmdLine.$messageNode.textContent = cmdLine.$message || "";
                }
            });
        
            cmdLine.on("focus", function() {
                cmdLine.renderer.$cursorLayer.element.style.opacity = "";
                cmdLine.renderer.content.style.visibility = "";
                cmdLine.$messageNode.style.display = "none";
                cmdLine.$inMessageMode = false;
            });
        
            cmdLine.commands.on("exec", function(e) {
                if (!e.command)
                    return;
                if (e.command.name == "insertstring") {
        
                }
                cmdLine.commands.lastCommandName = e.command.name;
            });
        
            cmdLine.session.bgTokenizer.$tokenizeRow = function(row) {
                var line = this.doc.getLine(row);
                var command = null;
                var tokens = [];
                function add(type, value) {
                    tokens.push({ type: type, value: value, command: command });
                }
        
                while (line.length) {
                    var names = getCompletions(command);
                    var matches = matchCommand(line, names);
        
                    if (!matches.length) {
                        add("text", line);
                        break;
                    }
                    var cur = matches[0];
                    command = getCommand(cur, command);
                    if (cur.length >= line.length) {
                        add("keyword", line);
                        add("invisible", cur.substring(line.length));
                    } else {
                        add("keyword", cur);
                    }
                    line = line.substr(cur.length);
                    var i = line.search(/\S|$/);
                    if (i > 0) {
                        add("text", line.substring(0, i));
                        line = line.substr(i);
                        if (!line.length)
                            matches = getCompletions(command);
                    }
                }
        
                this.lines[row] = tokens;
                this.states[row] = matches;
                return tokens;
            };
        
            function matchCommand(line, names) {
                var matches = [];
                names.forEach(function(name) {
                    if (name.length < line.length) {
                        var isMatch = line.lastIndexOf(name, 0) === 0;
                        if (isMatch && /\w/.test(name[name.length - 1]))
                            isMatch = !/\w/.test(line[name.length]);
                    } else {
                        var isMatch = name.lastIndexOf(line, 0) === 0;
                    }
                    if (isMatch)
                        matches.push(name);
                });
                return matches;
            }
        
            cmdLine.$messageNode = document.createElement("div");
            cmdLine.$messageNode.style.cssText = "position:absolute;"
                + "opacity:0.8;padding:0 5px;top:0;font-size:11px";
            cmdLine.container.appendChild(cmdLine.$messageNode);
            
            cmdLine.$clearMessageDelayed = lang.delayedCall(function() {
                cmdLine.setMessage("");
            });
            cmdLine.setTimedMessage = function(text, timeout) {
                this.setMessage(text);
                this.once("setMessage", function() {
                    cmdLine.$clearMessageDelayed.cancel();
                });
                cmdLine.$clearMessageDelayed.schedule(timeout || 2000);
            };
        
            cmdLine.setMessage = function(text, from) {
                this._signal("setMessage", text);
                this.$message = text;
                if (this.$inMessageMode)
                    this.$messageNode.textContent = text;
            };
        
            if (!cmdLine.isFocused())
                cmdLine._emit("blur");
        
            cmdLine.commands.removeCommands(
                ["find", "gotoline", "findall", "replace", "replaceall"]);
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
         * 
         **/
        plugin.freezePublicAPI({
            /**
             * @ignore
             */
            searchStore: searchStore,
            
            /**
             * 
             */
            get aml() { return cmdLine; },
            
            /**
             * 
             */
            get ace() { return cmdLine.ace; }, 
            
            /**
             * 
             */
            show: show,
            
            /**
             * 
             */
            hide: hide,
            
            /**
             * 
             */
            toggle: toggle
        });
        
        register(null, {
            "vim.cli": plugin
        });
    }
});
