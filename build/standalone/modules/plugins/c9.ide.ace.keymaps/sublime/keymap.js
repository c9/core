define("plugins/c9.ide.ace.keymaps/sublime/keymap",[], function(require, exports, module) {
exports.ideKeymap = [
{
    bindKey: { mac: "cmd-ctrl-p", win: "ctrl-alt-p" },
    name: "prompt_select_workspace"
}, {
    bindKey: { mac: "cmd-shift-t", win: "ctrl-shift-t" },
    name: "reopenLastTab"
},

{
    bindKey: { mac: "f7|cmd-b", win: "f7|ctrl-b" },
    name: "build"
}, {
    bindKey: { mac: "cmd-shift-b", win: "ctrl-shift-b" },
    name: "run"
}, {
    bindKey: { mac: "ctrl-break", win: "ctrl-break" },
    name: "stopbuild"
},

{
    bindKey: { mac: "cmd-t|cmd-p", win: "ctrl-p" },
    name: "navigate"
}, {
    bindKey: { mac: "cmd-r|cmd-shift-r", win: "ctrl-r|ctrl-shift-r" },
    name: "outline",
    args: { overlay: "goto", text: "@" }
}, {
    bindKey: { mac: "ctrl-g", win: "ctrl-g" },
    name: "gotoline",
    args: { overlay: "goto", text: ":" }
},
{
    bindKey: { mac: "cmd-shift-p", win: "ctrl-shift-p" },
    name: "commands"
}, {
    bindKey: { mac: "ctrl-`", win: "ctrl-`" },
    name: "toggleconsole"
}, {
    bindKey: { mac: "cmd-k cmd-b", win: "ctrl-k ctrl-b" },
    name: "toggletree"
},

{
    bindKey: { mac: "f12|cmd-alt-down", win: "f12" },
    name: "jumptodef"
},
{
    bindKey: { mac: "cmd-shift-]|cmd-alt-right", win: "ctrl-pagedown" },
    name: "gototabright"
}, {
    bindKey: { mac: "cmd-shift-[|cmd-alt-left", win: "ctrl-pageup" },
    name: "gototableft"
}, {
    bindKey: { mac: "ctrl-tab", win: "ctrl-tab" },
    name: "nexttab"
}, {
    bindKey: { mac: "ctrl-shift-tab", win: "ctrl-shift-tab" },
    name: "previoustab"
}, 

{
    bindKey: {},
    name: "nextpane"
},
{
    bindKey: { mac: "ctrl+alt+f", win: "ctrl+alt+f" }, // shortcut from codeformatter plugin
    name: "formatcode"
},
{
    bindKey: { linux: "ctrl--", mac: "cmd--", win: "ctrl--|ctrl-shift-=|ctrl-shift-+" },
    name: "smallerfont"
}, {
    bindKey: { linux: "ctrl--|ctrl-=", mac: "cmd-=|cmd-+", win: "ctrl--|ctrl-=|ctrl-+" },
    name: "largerfont"
}, 
{
    bindKey: { mac: "cmd-e", win: "ctrl-e" },
    name: "revealtab" // todo
}, 
{
    bindKey: { mac: "cmd-alt-f", win: "ctrl-h" },
    name: "replace"
}, {
    bindKey: { mac: "cmd-alt-e", win: "ctrl-shift-h" },
    name: "replacenext"
}, {
    bindKey: { mac: "cmd-e", win: "ctrl-e" },
    name: "slurp_find_string" // todo
}, {
    bindKey: { mac: "cmd-shift-e", win: "ctrl-shift-e" },
    name: "slurp_replace_string"
}, {
    bindKey: { mac: "ctrl-alt-enter", win: "ctrl-alt-enter" },
    name: "replaceall"
}, {
    bindKey: { mac: "cmd-f", win: "ctrl-f" },
    name: "find"
}, {
    bindKey: { mac: "cmd-shift-f", win: "ctrl-shift-f" },
    name: "searchinfiles",
},  {
    bindKey: { mac: "", win: "" },
    name: "restartc9",
}, 
];


exports.editorCommands = [{
    name: "find_all_under",
    exec: function(editor) {
        if (editor.selection.isEmpty())
            editor.selection.selectWord();
        editor.findAll();
    },
    readOnly: true
}, {
    name: "find_under",
    exec: function(editor) {
        if (editor.selection.isEmpty())
            editor.selection.selectWord();
        editor.findNext();
    },
    readOnly: true
}, {
    name: "find_under_prev",
    exec: function(editor) {
        if (editor.selection.isEmpty())
            editor.selection.selectWord();
        editor.findPrevious();
    },
    readOnly: true
}, {
    name: "find_under_expand",
    exec: function(editor) {
        editor.selectMore(1, false, true);
    },
    scrollIntoView: "animate",
    readOnly: true
}, {
    name: "find_under_expand_skip",
    exec: function(editor) {
        editor.selectMore(1, true, true);
    },
    scrollIntoView: "animate",
    readOnly: true
}, {
    name: "delete_to_hard_bol",
    exec: function(editor) {
        var pos = editor.selection.getCursor();
        editor.session.remove({
            start: { row: pos.row, column: 0 },
            end: pos
        });
    },
    multiSelectAction: "forEach",
    scrollIntoView: "cursor",
}, {
    name: "delete_to_hard_eol",
    exec: function(editor) {
        var pos = editor.selection.getCursor();
        editor.session.remove({
            start: pos,
            end: { row: pos.row, column: Infinity }
        });
    },
    multiSelectAction: "forEach",
    scrollIntoView: "cursor",
}, {
    name: "moveToWordStartLeft",
    exec: function(editor) {
        editor.selection.moveCursorLongWordLeft();
        editor.clearSelection();
    },
    multiSelectAction: "forEach",
    scrollIntoView: "cursor",
}, {
    name: "moveToWordEndRight",
    exec: function(editor) {
        editor.selection.moveCursorLongWordRight();
        editor.clearSelection();
    },
    multiSelectAction: "forEach",
    scrollIntoView: "cursor",
}, {
    name: "selectToWordStartLeft",
    exec: function(editor) {
        var sel = editor.selection;
        sel.$moveSelection(sel.moveCursorLongWordLeft);
    },
    multiSelectAction: "forEach",
    scrollIntoView: "cursor",
}, {
    name: "selectToWordEndRight",
    exec: function(editor) {
        var sel = editor.selection;
        sel.$moveSelection(sel.moveCursorLongWordRight);
    },
    multiSelectAction: "forEach",
    scrollIntoView: "cursor",
}, 
];
exports.editorKeymap = [{
    bindKey: { linux: "alt-/|ctrl-space", mac: "ctrl-space", win: "ctrl-space" },
    name: "complete"
},
{
    bindKey: { mac: "cmd-k cmd-backspace|cmd-backspace", win: "ctrl-shift-backspace|ctrl-k ctrl-backspace" },
    name: "delete_to_hard_bol"
}, {
    bindKey: { mac: "cmd-k cmd-k|cmd-delete|ctrl-k", win: "ctrl-shift-delete|ctrl-k ctrl-k" },
    name: "delete_to_hard_eol"
}, 

{
    bindKey: { mac: "cmd-shift-d", win: "ctrl-shift-d" },
    name: "duplicateSelection"
}, {
    bindKey: { mac: "cmd-l", win: "ctrl-l" },
    name: "expandtoline",
}, 
{
    bindKey: { mac: "ctrl-cmd-g", win: "alt-f3" },
    name: "find_all_under"
}, {
    bindKey: { mac: "alt-cmd-g", win: "ctrl-f3" },
    name: "find_under"
}, {
    bindKey: { mac: "shift-alt-cmd-g", win: "ctrl-shift-f3" },
    name: "find_under_prev"
}, {
    bindKey: { mac: "cmd-g", win: "f3" },
    name: "findnext"
}, {
    bindKey: { mac: "shift-cmd-g", win: "shift-f3" },
    name: "findprevious"
}, {
    bindKey: { mac: "cmd-d", win: "ctrl-d" },
    name: "find_under_expand"
}, {
    bindKey: { mac: "cmd-k cmd-d", win: "ctrl-k ctrl-d" },
    name: "find_under_expand_skip"
}, 
{
    bindKey: { mac: "cmd-alt-[", win: "ctrl-shift-[" },
    name: "toggleFoldWidget"
}, {
    bindKey: { mac: "cmd-alt-]", win: "ctrl-shift-]" },
    name: "unfold"
}, {
    bindKey: { mac: "cmd-k cmd-0|cmd-k cmd-j", win: "ctrl-k ctrl-0|ctrl-k ctrl-j" },
    name: "unfoldall"
}, {
    bindKey: { mac: "cmd-k cmd-1", win: "ctrl-k ctrl-1" },
    name: "foldOther",
    args: { level: 1 }
},
{
    bindKey: { win: "ctrl-left", mac: "alt-left" },
    name: "moveToWordStartLeft"
}, {
    bindKey: { win: "ctrl-right", mac: "alt-right" },
    name: "moveToWordEndRight"
}, {
    bindKey: { win: "ctrl-shift-left", mac: "alt-shift-left" },
    name: "selectToWordStartLeft",
}, {
    bindKey: { win: "ctrl-shift-right", mac: "alt-shift-right" },
    name: "selectToWordEndRight",
}, 
{
    bindKey: { mac: "ctrl-m", win: "ctrl-m" },
    name: "jumptomatching",
    args: { to: "brackets" }
}, 
{
    bindKey: { mac: "ctrl-f6", win: "ctrl-f6" },
    name: "goToNextError"
}, {
    bindKey: { mac: "ctrl-shift-f6", win: "ctrl-shift-f6" },
    name: "goToPreviousError"
},

{
    bindKey: { mac: "ctrl-o" },
    name: "splitline",
}, 
{
    bindKey: { mac: "cmd-j", win: "ctrl-j" },
    name: "joinlines"
}, 
{
    bindKey: { mac: "cmd-k cmd-l", win: "ctrl-k ctrl-l" },
    name: "tolowercase"
}, {
    bindKey: { mac: "cmd-k cmd-u", win: "ctrl-k ctrl-u" },
    name: "touppercase"
}, 
{
    bindKey: { mac: "cmd-shift-enter", win: "ctrl-shift-enter" },
    name: "addLineBefore"
}, {
    bindKey: { mac: "cmd-enter", win: "ctrl-enter" },
    name: "addLineAfter"
}, {
    bindKey: { mac: "ctrl-shift-k", win: "ctrl-shift-k" },
    name: "removeline"
}, {
    bindKey: { mac: "ctrl-alt-up", win: "ctrl-up" },
    name: "scrollup",
}, {
    bindKey: { mac: "ctrl-alt-down", win: "ctrl-down" },
    name: "scrolldown",
}, {
    bindKey: { mac: "cmd-a", win: "ctrl-a" },
    name: "selectall"
}, {
    bindKey: { linux: "alt-shift-down", mac: "ctrl-shift-down", win: "ctrl-alt-down" },
    name: "addCursorBelow",
}, {
    bindKey: { linux: "alt-shift-up", mac: "ctrl-shift-up", win: "ctrl-alt-up" },
    name: "addCursorAbove",
},


{
    bindKey: { mac: "cmd-k cmd-c|ctrl-l", win: "ctrl-k ctrl-c" },
    name: "centerselection"
}, 

{
    bindKey: { mac: "f5", win: "f9" },
    name: "sortlines"
}, 
{
    bindKey: { mac: "cmd-shift-l", win: "ctrl-shift-l" },
    name: "splitIntoLines"
}, {
    bindKey: { mac: "ctrl-cmd-down", win: "ctrl-shift-down" },
    name: "movelinesdown"
}, {
    bindKey: { mac: "ctrl-cmd-up", win: "ctrl-shift-up" },
    name: "movelinesup"
}, {
    bindKey: { mac: "alt-down", win: "alt-down" },
    name: "modifyNumberDown"
}, {
    bindKey: { mac: "alt-up", win: "alt-up" },
    name: "modifyNumberUp"
}, {
    bindKey: { mac: "cmd-/", win: "ctrl-/" },
    name: "togglecomment"
}, {
    bindKey: { mac: "cmd-alt-/", win: "ctrl-shift-/" },
    name: "toggleBlockComment"
},


{
    bindKey: { linux: "ctrl-alt-q", mac: "ctrl-q", win: "ctrl-q" },
    name: "togglerecording"
}, {
    bindKey: { linux: "ctrl-alt-shift-q", mac: "ctrl-shift-q", win: "ctrl-shift-q" },
    name: "replaymacro"
}, 


{
    bindKey: { mac: "ctrl-t", win: "ctrl-t" },
    name: "transpose"
}

];

});
// },
