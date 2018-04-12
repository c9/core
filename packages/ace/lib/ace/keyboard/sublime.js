// DO NOT COMMIT TO OPEN SOURCE ACE!

define(function(require, exports, module) {
"use strict";

var keyUtil = require("../lib/keys");
var oop = require("../lib/oop");
var useragent = require("../lib/useragent");
var HashHandler = require("../keyboard/hash_handler").HashHandler;


var keyMods = (function() {
    var keyMods = [];
    var mods = ["meta", "ctrl", "alt", "shift"];
    for (var i = mods.length; i--;) {
        keyMods[i] = mods.filter(function(x) {
            return i & keyUtil.KEY_MODS[x];
        }).join("-") + "-";
    }
    return keyMods;
})();

var commandMap = {
    "auto_complete"    : "complete",
    "build"            : "build",
    "clear_bookmarks"  : false,
    "clear_fields"     : false,
    "close"            : false,
    "close_file"       : "closetab",
    "close_pane"       : "closepane",
    "close_tag"        : false,
    "close_window"     : "closealltabs",
    "commit_completion": false,
    "context_menu"     : false,
    "decrease_font_size" : "smallerfont",
    "increase_font_size" : "largerfont"
    // "copy"
    // "cut"
    // "delete_to_mark"
    // "delete_word" :
    // "duplicate_line" : "duplicate"
    // "exec"
    // "expand_selection"
    // "find_all"
    // "find_all_under"
    // "find_next"
    // "find_prev"
    // "find_under"
    // "find_under_expand"
    // "find_under_expand_skip"
    // "find_under_prev"
    // "focus_group"
    // "focus_neighboring_group"
    // "focus_side_bar"
    // "fold"
    // "fold_by_level"
    // "fold_tag_attributes"
    // "goto_definition"
    // "goto_symbol_in_project"
    // "hide_auto_complete"
    // "hide_overlay"
    // "hide_panel"
    // "indent"
    // "insert"
    // "insert_best_completion"
    // "insert_snippet"
    // "join_lines"
    // "jump_back"
    // "jump_forward"
    // "left_delete"
    // "lower_case"
    // "move"
    // "move_to"
    // "move_to_group"
    // "move_to_neighboring_group"
    // "new_file"
    // "new_pane"
    // "new_window"
    // "next_bookmark"
    // "next_field"
    // "next_misspelling"
    // "next_result"
    // "next_view"
    // "next_view_in_stack"
    // "paste"
    // "paste_and_indent"
    // "paste_from_history"
    // "prev_bookmark"
    // "prev_field"
    // "prev_misspelling"
    // "prev_result"
    // "prev_view"
    // "prev_view_in_stack"
    // "prompt_open_file"
    // "prompt_save_as"
    // "prompt_select_workspace"
    // "redo"
    // "redo_or_repeat"
    // "reindent"
    // "reopen_last_file"
    // "replace_all"
    // "replace_completion_with_auto_complete"
    // "replace_completion_with_next_completion"
    // "replace_next"
    // "right_delete"
    // "run_macro"
    // "run_macro_file"
    // "save"
    // "scroll_lines"
    // "select_all"
    // "select_all_bookmarks"
    // "select_by_index"
    // "select_lines"
    // "select_to_mark"
    // "set_layout"
    // "set_mark"
    // "show_at_center"
    // "show_overlay"
    // "show_panel"
    // "show_scope_name"
    // "single_selection"
    // "slurp_find_string"
    // "slurp_replace_string"
    // "soft_redo"
    // "soft_undo"
    // "sort_lines"
    // "split_selection_into_lines"
    // "swap_line_down"
    // "swap_line_up"
    // "swap_with_mark"
    // "switch_file"
    // "toggle_bookmark"
    // "toggle_case_sensitive"
    // "toggle_comment"
    // "toggle_distraction_free"
    // "toggle_full_screen"
    // "toggle_overwrite"
    // "toggle_preserve_case"
    // "toggle_record_macro"
    // "toggle_regex"
    // "toggle_setting"
    // "toggle_side_bar"
    // "toggle_whole_word"
    // "transpose"
    // "undo"
    // "unfold"
    // "unfold_all"
    // "unindent"
    // "upper_case"
    // "wrap_block"
    // "wrap_lines"
    // "yank"
};

function getKeyValue(key, ace) {
    switch (key) {
        case "auto_complete_visible":
            // Returns true if the autocomplete list is visible.
            break;
        case "has_next_field":
            // Returns true if a next snippet field is available.
            break;
        case "has_prev_field":
            // Returns true if a previous snippet field is available.
            break;
        case "num_selections":
            // Returns the number of selections.
            return ace.selection.ranges.length || 1;
            break;
        case "overlay_visible":
            // Returns true if any overlay is visible.
            break;
        case "panel_visible":
            // Returns true if any panel is visible.
            break;
        case "following_text":
            // Restricts the test just to the text following the caret.
            var pos = ace.getCursorPosition();
            return ace.session.getLine(pos.row).substr(pos.column);
            break;
        case "preceding_text":
            // Restricts the test just to the text preceding the caret.
            pos = ace.getCursorPosition();
            return ace.session.getLine(pos.row).substr(pos.column);
            break;
        case "selection_empty":
            // Returns true if the selection is an empty region.
            break;
        case "text":
            // Restricts the test just to the selected text.
            return ace.getSelectedText();
            break;
        case "selector":
            // Returns the current scope.
            break;
        case "panel_has_focus":
            // Returns true if the current focus is on a panel.
            break;
        case "panel":
            // Returns true if the panel given as operand is visible.
            break;
        default:
            // case "setting.x":
            // Returns the value of the x setting. x can be any string.
    }
}
    
var operators = {
    isTrue: function(a){return !!a},
    equal: function(a,b){return a === b},
    not_equal: function(a,b){return a !== b},
    regex_match: function(a,b){ return typeof a == "string" && a.match(b) },
    not_regex_match: function(a,b){return typeof a == "string" && !a.match(b)},
    regex_contains: function(a,b){return typeof a == "string" && a.search(b) !== -1},
    not_regex_contains: function(a,b){return typeof a == "string" && a.search(b) === -1}
};
    
function testIsAvailable(editor, args, e) {
    if (!this.context)
        return true;
    return this.context.some(function(ctx) {
        if (!ctx.key)
            return;
        if (ctx.operator && ctx.operator.indexOf("regex") != -1) {
            if (ctx.operand && typeof ctx.operand == "string")
                ctx.operand = new RegExp(ctx.operand);
        }
        var op = operators[ctx.operator] || (
            ctx.operand ? operators.equal : operators.isTrue);
        
        var key = getKeyValue(ctx.key, editor, args, e);
        return op(key, ctx.operand);
    });
}

function SublimeHandler() {    
    this.commands = {};
    this.commandKeyBinding = {};
}

(function() {
    oop.implement(this, HashHandler.prototype);
    
    var sublimeToAceKey = {
        keypad0: "numpad0",
        keypad1: "numpad1",
        keypad2: "numpad2",
        keypad3: "numpad3",
        keypad4: "numpad4",
        keypad5: "numpad5",
        keypad6: "numpad6",
        keypad7: "numpad7",
        keypad8: "numpad8",
        keypad9: "numpad9",
        keypad_period: ".",
        keypad_divide: "/",
        keypad_multiply: "*",
        keypad_minus: "-",
        keypad_plus: "+",
        keypad_enter: "numpadEnter",
        equals: "=",
        plus: "+"
    };
    
    this.setKeyMap = function(keyMap) {
        var prev
        var all = keyMap.map(function(cm) {
            return cm.context && cm.context.operator
        }).sort().filter(function(x) {
            if (x == prev)
                return false;
            prev = x;
            return true;
        });
        console.log(all)
        ace.setValue(JSON.stringify(all))
    };
    
    this.addCommand = function(command) {
        if (this.commands[command.name])
            this.removeCommand(command);

        this.commands[command.name] = command;

        if (command.bindKey)
            this._buildKeyHash(command);
    };

    this.removeCommand = function(command) {
        var name = (typeof command === 'string' ? command : command.name);
        command = this.commands[name];
        delete this.commands[name];

        // exhaustive search is brute force but since removeCommand is
        // not a performance critical operation this should be OK
        var ckb = this.commandKeyBinding;
        for (var hashId in ckb) {
            for (var key in ckb[hashId]) {
                if (ckb[hashId][key] == command)
                    delete ckb[hashId][key];
            }
        }
    };

    this.bindKey = function(key, command) {
        if(!key)
            return;
        if (typeof command == "function") {
            this.addCommand({exec: command, bindKey: key, name: command.name || key});
            return;
        }

        var ckb = this.commandKeyBinding;
        key.split("|").forEach(function(keyPart) {
            var binding = this.parseKeys(keyPart, command);
            var hashId = binding.hashId;
            (ckb[hashId] || (ckb[hashId] = {}))[binding.key] = command;
        }, this);
    };

    this.addCommands = function(commands) {
        commands && Object.keys(commands).forEach(function(name) {
            var command = commands[name];
            if (!command)
                return;
            
            if (typeof command === "string")
                return this.bindKey(command, name);

            if (typeof command === "function")
                command = { exec: command };

            if (typeof command !== "object")
                return;

            if (!command.name)
                command.name = name;

            this.addCommand(command);
        }, this);
    };

    this.removeCommands = function(commands) {
        Object.keys(commands).forEach(function(name) {
            this.removeCommand(commands[name]);
        }, this);
    };

    this.bindKeys = function(keyList) {
        Object.keys(keyList).forEach(function(key) {
            this.bindKey(key, keyList[key]);
        }, this);
    };

    this._buildKeyHash = function(command) {
        var binding = command.bindKey;
        if (!binding)
            return;

        var key = typeof binding == "string" ? binding: binding[this.platform];
        this.bindKey(key, command);
    };

    // accepts keys in the form ctrl+Enter or ctrl-Enter
    // keys without modifiers or shift only 
    this.parseKeys = function(keys) {
        // todo support keychains 
        if (keys.indexOf(" ") != -1)
            keys = keys.split(/\s+/).pop();

        var parts = keys.toLowerCase().split(/[\-\+]([\-\+])?/).filter(function(x){return x});
        var key = parts.pop();

        var keyCode = keyUtil[key];
        if (keyUtil.FUNCTION_KEYS[keyCode])
            key = keyUtil.FUNCTION_KEYS[keyCode].toLowerCase();
        else if (!parts.length)
            return {key: key, hashId: -1};
        else if (parts.length == 1 && parts[0] == "shift")
            return {key: key.toUpperCase(), hashId: -1};

        var hashId = 0;
        for (var i = parts.length; i--;) {
            var modifier = keyUtil.KEY_MODS[parts[i]];
            if (modifier == null) {
                if (typeof console != "undefined")
                console.error("invalid modifier " + parts[i] + " in " + keys);
                return false;
            }
            hashId |= modifier;
        }
        return {key: key, hashId: hashId};
    };
    
    this.bindKey = function(key, command) {
        if (!key)
            return;
    
        var ckb = this.commandKeyBinding;
        key.split("|").forEach(function(keyPart) {
            keyPart = keyPart.toLowerCase();
            ckb[keyPart] = command;
            // register all partial key combos as null commands
            // to be able to activate key combos with arbitrary length
            // Example: if keyPart is "C-c C-l t" then "C-c C-l t" will
            // get command assigned and "C-c" and "C-c C-l" will get
            // a null command assigned in this.commandKeyBinding. For
            // the lookup logic see handleKeyboard()
            var keyParts = keyPart.split(" ").slice(0,-1);
            keyParts.reduce(function(keyMapKeys, keyPart, i) {
                var prefix = keyMapKeys[i-1] ? keyMapKeys[i-1] + ' ' : '';
                return keyMapKeys.concat([prefix + keyPart]);
            }, []).forEach(function(keyPart) {
                if (!ckb[keyPart]) ckb[keyPart] = "null";
            });
        }, this);
    };
    
    this.handleKeyboard = function(data, hashId, key, keyCode) {
        var editor = data.editor;
        // insertstring data.count times
        if (hashId == -1) {
            editor.pushEmacsMark();
            if (data.count) {
                var str = new Array(data.count + 1).join(key);
                data.count = null;
                return {command: "insertstring", args: str};
            }
        }
    
        if (key == "\x00") return undefined;
    
        var modifier = keyMods[hashId];
    
        if (modifier) key = modifier + key;
    
        // Key combos like CTRL+X H build up the data.keyChain
        if (data.keyChain) key = data.keyChain += " " + key;
    
        // Key combo prefixes get stored as "null" (String!) in this
        // this.commandKeyBinding. When encountered no command is invoked but we
        // buld up data.keyChain
        var command = this.commandKeyBinding[key];
        data.keyChain = command == "null" ? key : "";
    
        // there really is no command
        if (!command) return undefined;
    
        // we pass b/c of key combo
        if (command === "null") return {command: "null"};
    

    
        return {command: command, args: command.args};
    };


}).call(SublimeHandler.prototype);


exports.handler = new SublimeHandler();
var keyMap = require("../requirejs/text!./sublime/windows.sublime-keymap");
exports.handler.setKeyMap(eval("(" + keyMap + ")"))

});
