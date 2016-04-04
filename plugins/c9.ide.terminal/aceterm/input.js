define(function(require, exports, module) {
    var isWindows = require("ace/lib/useragent").isWindows;
    module.exports = function initInput(ace) {
        // use showkey --ascii to test
        var HashHandler = require("ace/keyboard/hash_handler").HashHandler;
        var KEY_MODS = require("ace/lib/keys").KEY_MODS;
        var TERM_MODS = {
            "shift-"           : 2,
            "alt-"             : 3,
            "alt-shift-"       : 4,
            "ctrl-"            : 5,
            "ctrl-shift-"      : 6,
            "ctrl-alt-"        : 7,
            "ctrl-alt-shift-"  : 8,
        };
        var specialKeys = new HashHandler();
        // http://www.math.utah.edu/docs/info/features_7.html
        specialKeys.bindKeys({
            "Shift-PageUp"      : {command: "pageup"},
            "Shift-PageDown"    : {command: "pagedown"},
            "Ctrl-Up"           : {command: "scrollup"},
            "Ctrl-Down"         : {command: "scrolldown"},

            "Backspace"         : '\x7f',
            "Shift-Backspace"   : '\x08',
            "Alt-Backspace"     : '\x1b\x7f',
            "Tab"               : '\t',
            "Shift-Tab"         : '\x1b[Z',
            "Return"            : '\r',
            "Escape"            : '\x1b',
            "Left"              : '\x1b[D',
            "Right"             : '\x1b[C',
            "Up"                : '\x1b[A',
            "Down"              : '\x1b[B',
            "Delete"            : '\x1b[3~',
            "Insert"            : '\x1b[2~',
            "Home"              : '\x1b[1~',
            "End"               : '\x1b[4~',
            "PageUp"            : '\x1b[5~',
            "PageDown"          : '\x1b[6~',
            "F1"                : '\x1bOP',
            "F2"                : '\x1bOQ',
            "F3"                : '\x1bOR',
            "F4"                : '\x1bOS',
            "F5"                : '\x1b[15~',
            "F6"                : '\x1b[17~',
            "F7"                : '\x1b[18~',
            "F8"                : '\x1b[19~',
            "F9"                : '\x1b[20~',
            "F10"               : '\x1b[21~',
            "F11"               : '\x1b[23~',
            "F12"               : '\x1b[24~'
        });
        
        // make shell to behave more like regular editor
        var aliases = [{
            bindKey: {win: "Ctrl-left", mac: "Option-left"},
            name: "\u001bb" // "alt-b"
        }, {
            bindKey: {win: "Ctrl-right", mac: "Option-right"},
            name: "\u001bf" // "alt-b"
        }, {
            bindKey: {win: "Ctrl-Delete", mac: "Option-Delete"},
            name: "\u001bd" // "alt-d"
        }, {
            bindKey: {win: "Ctrl-Backspace", mac: "Option-Backspace"},
            name: "\x1b\x7f" // "alt-backspace"
        }, {
            bindKey: {win: "Ctrl-Delete", mac: "Option-Delete"},
            name: "\u001bd" // "alt-d"
        }, {
            bindKey: {win: "Alt-Backspace", mac: "Ctrl-Backspace"},
            name: "\u0015" // "ctrl-u"
        }, {
            bindKey: {win: "Alt-Delete", mac: "Ctrl-Delete"},
            name: "\u000b" // "ctrl-k"
        }, {
            bindKey: {win: "Ctrl-z", mac: "Cmd-z"},
            name: "\u0018\u0015" // "ctrl-x ctrl-u"
        }];
        
        specialKeys.addCommands(aliases);
        // SS3 as ^[O for 7-bit  '\x8fD';  SS3 as 0x8f for 8-bit
        var applicationKeys = {
            "left":      '\x1bOD',
            "right":     '\x1bOC',
            "up":        '\x1bOA',
            "down":      '\x1bOB',
            "home":      '\x1bOH',
            "end":       '\x1bOF'
        };
        
        function defaultHandler(ev) {
            var key = null;
            var keyCode = ev.keyCode;
            var isControl = ev.ctrlKey;
            var isMeta = specialKeys.platform == "mac" ? ev.metaKey : ev.altKey;
            // a-z and space
            if (isControl) {
                if (keyCode >= 65 && keyCode <= 90) {
                    key = String.fromCharCode(keyCode - 64);
                } else if (keyCode === 32 || keyCode == 192) {
                    // NUL
                    key = String.fromCharCode(0);
                } else if (keyCode >= 51 && keyCode <= 55) {
                    // escape, file sep, group sep, record sep, unit sep
                    key = String.fromCharCode(keyCode - 51 + 27);
                } else if (keyCode === 56) {
                    // delete
                    key = String.fromCharCode(127);
                } else if (keyCode === 219) {
                    // ^[ - escape
                    key = String.fromCharCode(27);
                } else if (keyCode === 221) {
                    // ^] - group sep
                    key = String.fromCharCode(29);
                } else if (keyCode === 189 || keyCode === 173) {
                    // _
                    key = String.fromCharCode(31);
                } else if (keyCode === 220) {
                    // SIGQUIT
                    key = String.fromCharCode(28);
                }
            } else if (isMeta) {
                if (keyCode >= 65 && keyCode <= 90) {
                    key = '\x1b' + String.fromCharCode(keyCode + 32);
                } else if (keyCode === 192) {
                    key = '\x1b`';
                } else if (keyCode >= 48 && keyCode <= 57) {
                    key = '\x1b' + (keyCode - 48);
                }
            }
            return key;
        } 
        
        this.handleKeyboard = function(data, hashId, keyString, keyCode, ev) {
            var term = data.editor.session.term;
            if (hashId == -1) {
                this.send(keyString);
                return {command: "null"};
            }
            if (term.applicationKeypad) {
                if (applicationKeys[keyString]) {
                    var mod = TERM_MODS[KEY_MODS[hashId]];
                    var str = applicationKeys[keyString];
                    if (mod)
                        str = "\u001b[1;" + mod + str.slice(-1);
                    this.send(str);
                    return {command: "null"};
                }
            }
            var key = specialKeys.findKeyCommand(hashId, keyString);
            if (typeof key == "string") {
                this.send(key);
                return {command: "null"};
            } else if (key && key.command) {
                return key;
            } else if (key && key.exec) {
                if (!key.isAvailable || key.isAvailable(ace))
                    return {command: key};
            } else if (key && key.name) {
                this.send(key.name);
                return {command: "null"};
            }
            
            key = defaultHandler(ev);
            if (key)
                this.send(key);

            return {
                command: "null",
                passEvent: !hashId || hashId === KEY_MODS.shift || (
                    // on mac key combos without ctrl or cmd trigger textinput
                    specialKeys.platform === "mac" && !(hashId & (KEY_MODS.ctrl | KEY_MODS.cmd))
                ) || (
                    // on windows 8+ calling preventDefault on win+space breaks textinput
                    specialKeys.platform === "win" && hashId == KEY_MODS.cmd && (keyCode == 32 || keyCode == -1)
                )
            };
        };

        var isCopyAvailable = function(ed) {
            if (ed && !ed.getCopyText)
                ed = ed.ace || ed.$editor;
            return ed && !!ed.getCopyText();
        };
        var noop = function() {};
        
        // Add special handling for editor keys
        specialKeys.addCommands([{
            name: "copy",
            bindKey: {mac: "Cmd-c", win: "Ctrl-c"},
            exec: noop,
            isAvailable: isCopyAvailable,
            passEvent: true
        },{
            name: "cut",
            bindKey: {mac: "Cmd-x", win: "Ctrl-x"},
            exec: noop,
            isAvailable: isCopyAvailable,
            passEvent: true
        },{
            name: "paste",
            bindKey: {mac: "Cmd-v", win: "Ctrl-v"},
            exec: noop,
            isAvailable: function(ed) {
                return true;
            },
            passEvent: true
        },{
            name: "clear",
            bindKey: {mac: "Cmd-K", win: "Ctrl-K"},
            exec: function(ed) {
                var term = ed.ace.session.term;
                term.clear();
                term.send("\x0c"); //"ctrl-l"
            },
            isAvailable: function(editor) {
                return true; // todo disable in vim?
            }
        }]);
        
        ace.onPaste = function(text) {
            this.send(text.replace(/\r\n?|\n/g, this.session.term.convertEol ? "\n" : "\r"));
        };
        
        ace.setKeyboardHandler(this);
        ace.keyBinding.addKeyboardHandler(ace.commands);
        ace.commands.commandKeyBinding = {};
        
        this.send = ace.send = function(text) {
            ace.session.send && ace.session.send(text);
        };
        return specialKeys;
    };
});