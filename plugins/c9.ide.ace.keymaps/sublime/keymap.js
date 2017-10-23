define(function(require, exports, module) {

/* ide commands */
exports.ideKeymap = [
// fallback to c9 defaults
// {
//     bindKey: {mac: "cmd-w", win: "ctrl-w|ctrl-f4"},
//     name: "close"
// }, {
//     bindKey: {mac: "cmd-shift-w", win: "ctrl-shift-w"},
//     name: "close_window"
// }, {
//     bindKey: {linux: "ctrl-q", mac: "cmd-q"},
//     name: "exit"
// }, {
//     bindKey: {mac: "cmd-n", win: "ctrl-n"},
//     name: "new_file"
// }, 
// {
//     bindKey: {mac: "cmd-o", win: "ctrl-o"},
//     name: "newfile"
// }, {
//     bindKey: {mac: "cmd-shift-s", win: "ctrl-shift-s"},
//     name: "saveas"
// }, {
//     bindKey: {mac: "cmd-s", win: "ctrl-s"},
//     name: "save"
// }, {
//     bindKey: {mac: "cmd-alt-s"},
//     name: "saveall"
// }, {
//     bindKey: {mac: "cmd-shift-n", win: "ctrl-shift-n"},
//     name: "newWindow"
// },

{
    // todo
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

/* panels */
// {
//     bindKey: {mac: "cmd-k cmd-down", win: "ctrl-k ctrl-down"},
//     name: "mergeWithOtherPanels"
// }, 
// {
//     bindKey: {mac: "ctrl-1", win: "ctrl-1"},
//     name: "focus_group",
//     args: {group: 0}
// }, {
//     bindKey: {mac: "ctrl-9", win: "ctrl-9"},
//     name: "focus_group",
//     args: {group: 8}
// }, {
//     bindKey: {mac: "ctrl-2", win: "ctrl-2"},
//     name: "focus_group",
//     args: {group: 1}
// }, {
//     bindKey: {mac: "ctrl-3", win: "ctrl-3"},
//     name: "focus_group",
//     args: {group: 2}
// }, {
//     bindKey: {mac: "ctrl-4", win: "ctrl-4"},
//     name: "focus_group",
//     args: {group: 3}
// }, {
//     bindKey: {mac: "ctrl-5", win: "ctrl-5"},
//     name: "focus_group",
//     args: {group: 4}
// }, {
//     bindKey: {mac: "ctrl-6", win: "ctrl-6"},
//     name: "focus_group",
//     args: {group: 5}
// }, {
//     bindKey: {mac: "ctrl-8", win: "ctrl-8"},
//     name: "focus_group",
//     args: {group: 7}
// }, {
//     bindKey: {mac: "ctrl-7", win: "ctrl-7"},
//     name: "focus_group",
//     args: {group: 6}
// }, {
//     bindKey: {mac: "cmd-k cmd-right", win: "ctrl-k ctrl-right"},
//     name: "focus_neighboring_group"
// }, {
//     bindKey: {mac: "cmd-k cmd-left", win: "ctrl-k ctrl-left"},
//     name: "focus_neighboring_group",
//     args: {forward: false}
// }, {
//     bindKey: {mac: "ctrl-0", win: "ctrl-0"},
//     name: "focus_side_bar"
// }, {
//     bindKey: {mac: "ctrl-shift-9", win: "ctrl-shift-9"},
//     name: "move_to_group",
//     args: {group: 8}
// }, {
//     bindKey: {mac: "ctrl-shift-2", win: "ctrl-shift-2"},
//     name: "move_to_group",
//     args: {group: 1}
// }, {
//     bindKey: {mac: "ctrl-shift-8", win: "ctrl-shift-8"},
//     name: "move_to_group",
//     args: {group: 7}
// }, {
//     bindKey: {mac: "ctrl-shift-7", win: "ctrl-shift-7"},
//     name: "move_to_group",
//     args: {group: 6}
// }, {
//     bindKey: {mac: "ctrl-shift-1", win: "ctrl-shift-1"},
//     name: "move_to_group",
//     args: {group: 0}
// }, {
//     bindKey: {mac: "ctrl-shift-6", win: "ctrl-shift-6"},
//     name: "move_to_group",
//     args: {group: 5}
// }, {
//     bindKey: {mac: "ctrl-shift-5", win: "ctrl-shift-5"},
//     name: "move_to_group",
//     args: {group: 4}
// }, {
//     bindKey: {mac: "ctrl-shift-4", win: "ctrl-shift-4"},
//     name: "move_to_group",
//     args: {group: 3}
// }, {
//     bindKey: {mac: "ctrl-shift-3", win: "ctrl-shift-3"},
//     name: "move_to_group",
//     args: {group: 2}
// }, {
//     bindKey: {mac: "cmd-9", win: "alt-9"},
//     name: "select_by_index",
//     args: {index: 8}
// }, {
//     bindKey: {mac: "cmd-1", win: "alt-1"},
//     name: "select_by_index",
//     args: {index: 0}
// }, {
//     bindKey: {mac: "cmd-0", win: "alt-0"},
//     name: "select_by_index",
//     args: {index: 9}
// }, {
//     bindKey: {mac: "cmd-8", win: "alt-8"},
//     name: "select_by_index",
//     args: {index: 7}
// }, {
//     bindKey: {mac: "cmd-3", win: "alt-3"},
//     name: "select_by_index",
//     args: {index: 2}
// }, {
//     bindKey: {mac: "cmd-7", win: "alt-7"},
//     name: "select_by_index",
//     args: {index: 6}
// }, {
//     bindKey: {mac: "cmd-2", win: "alt-2"},
//     name: "select_by_index",
//     args: {index: 1}
// }, {
//     bindKey: {mac: "cmd-6", win: "alt-6"},
//     name: "select_by_index",
//     args: {index: 5}
// }, {
//     bindKey: {mac: "cmd-5", win: "alt-5"},
//     name: "select_by_index",
//     args: {index: 4}
// }, {
//     bindKey: {mac: "cmd-4", win: "alt-4"},
//     name: "select_by_index",
//     args: {index: 3}
// }, {
//     bindKey: {mac: "cmd-k cmd-shift-right", win: "ctrl-k ctrl-shift-right"},
//     name: "move_to_neighboring_group"
// }, {
//     bindKey: {mac: "cmd-k cmd-shift-left", win: "ctrl-k ctrl-shift-left"},
//     name: "move_to_neighboring_group",
//     args: {forward: false}
// }, {
//     bindKey: {mac: "cmd-k cmd-up", win: "ctrl-k ctrl-up"},
//     name: "new_pane"
// }, {
//     bindKey: {mac: "cmd-k cmd-shift-up", win: "ctrl-k ctrl-shift-up"},
//     name: "new_pane",
//     args: {move: false}
// }, {
//     bindKey: {mac: "cmd-alt-4", win: "alt-shift-4"},
//     name: "set_layout",
//     args: {cols: [0, 0.25, 0.5, 0.75, 1], rows: [0, 1], cells: [[0, 0, 1, 1], [1, 0, 2, 1], [2, 0, 3, 1], [3, 0, 4, 1] ]}
// }, {
//     bindKey: {mac: "cmd-alt-shift-2", win: "alt-shift-8"},
//     name: "set_layout",
//     args: {cols: [0, 1], rows: [0, 0.5, 1], cells: [[0, 0, 1, 1], [0, 1, 1, 2] ]}
// }, {
//     bindKey: {mac: "cmd-alt-shift-3", win: "alt-shift-9"},
//     name: "set_layout",
//     args: {cols: [0, 1], rows: [0, 0.33, 0.66, 1], cells: [[0, 0, 1, 1], [0, 1, 1, 2], [0, 2, 1, 3] ]}
// }, {
//     bindKey: {mac: "cmd-alt-5", win: "alt-shift-5"},
//     name: "set_layout",
//     args: {cols: [0, 0.5, 1], rows: [0, 0.5, 1], cells: [[0, 0, 1, 1], [1, 0, 2, 1], [0, 1, 1, 2], [1, 1, 2, 2] ]}
// }, {
//     bindKey: {mac: "cmd-alt-3", win: "alt-shift-3"},
//     name: "set_layout",
//     args: {cols: [0, 0.33, 0.66, 1], rows: [0, 1], cells: [[0, 0, 1, 1], [1, 0, 2, 1], [2, 0, 3, 1] ]}
// }, {
//     bindKey: {mac: "cmd-alt-2", win: "alt-shift-2"},
//     name: "set_layout",
//     args: {cols: [0, 0.5, 1], rows: [0, 1], cells: [[0, 0, 1, 1], [1, 0, 2, 1] ]}
// }, {
//     bindKey: {mac: "cmd-alt-1", win: "alt-shift-1"},
//     name: "set_layout",
//     args: {cols: [0, 1], rows: [0, 1], cells: [[0, 0, 1, 1] ]}
// }, 

// {
//     bindKey: {mac: "cmd-ctrl-shift-f", win: "shift-f11"},
//     name: "toggle_distraction_free"
// }, {
//     bindKey: {mac: "cmd-ctrl-f", win: "f11"},
//     name: "toggle_full_screen"
// }, 

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


// {
//     bindKey: {mac: "cmd-alt-up", win: "alt-o"},
//     name: "switch_file",
//     args: {extensions: ["cpp", "cxx", "cc", "c", "hpp", "hxx", "h", "ipp", "inl", "m", "mm"] }
// }, 

{
    bindKey: { linux: "ctrl--", mac: "cmd--", win: "ctrl--|ctrl-shift-=|ctrl-shift-+" },
    name: "smallerfont"
}, {
    bindKey: { linux: "ctrl--|ctrl-=", mac: "cmd-=|cmd-+", win: "ctrl--|ctrl-=|ctrl-+" },
    name: "largerfont"
}, 


/* bookmarks */
// {
//     bindKey: {mac: "cmd-shift-f2", win: "ctrl-shift-f2"},
//     name: "clear_bookmarks"
// }, {
//     bindKey: {mac: "cmd-k cmd-g", win: "ctrl-k ctrl-g"},
//     name: "clear_bookmarks",
//     args: {name: "mark"}
// }, {
//     bindKey: {mac: "f2", win: "f2"},
//     name: "next_bookmark"
// }, {
//     bindKey: {mac: "shift-f2", win: "shift-f2"},
//     name: "prev_bookmark"
// }, {
//     bindKey: {mac: "alt-f2", win: "alt-f2"},
//     name: "select_all_bookmarks"
// }, {
//     bindKey: {mac: "cmd-f2", win: "ctrl-f2"},
//     name: "toggle_bookmark"
// }, 

{
    bindKey: { mac: "cmd-e", win: "ctrl-e" },
    name: "revealtab" // todo
}, 

/* find replace */
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
// {
//     bindKey: {mac: "f4", win: "f4"},
//     name: "next_result"
// }, {
//     bindKey: {mac: "shift-f4", win: "shift-f4"},
//     name: "prev_result"
// }, 
// todo incremental_find
// {
//     bindKey: {mac: "cmd-alt-c", win: "alt-c"},
//     name: "toggle_case_sensitive",
// }, {
//     bindKey: {mac: "cmd-i", win: "ctrl-i"},
//     name: "show_panel",
//     args: {panel: "incremental_find", reverse: false}
// }, {
//     bindKey: {mac: "cmd-shift-i", win: "ctrl-shift-i"},
//     name: "show_panel",
//     args: {panel: "incremental_find", reverse: true}
// }, 

// {
//     bindKey: {mac: "cmd-alt-a", win: "alt-a"},
//     name: "toggle_preserve_case",
// }, {
//     bindKey: {mac: "cmd-alt-r", win: "alt-r"},
//     name: "toggle_regex",
// }, {
//     bindKey: {mac: "cmd-alt-w", win: "alt-w"},
//     name: "toggle_whole_word",
// }, 
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

/* editor commands */
exports.editorKeymap = [{
    bindKey: { linux: "alt-/|ctrl-space", mac: "ctrl-space", win: "ctrl-space" },
    name: "complete"
},
// {
//     bindKey: {mac: "cmd-c", win: "ctrl-insert|ctrl-c"},
//     name: "copy"
// }, {
//     bindKey: {mac: "cmd-x", win: "shift-delete|ctrl-x"},
//     name: "cut"
// },


// {
//     bindKey: {mac: "cmd-k cmd-w", win: "ctrl-k ctrl-w"},
//     name: "delete_to_mark"
// }, {
//     bindKey: {mac: "cmd-k cmd-a", win: "ctrl-k ctrl-a"},
//     name: "select_to_mark"
// }, {
//     bindKey: {mac: "cmd-k cmd-space", win: "ctrl-k ctrl-space"},
//     name: "set_mark"
// }, {
//     bindKey: {mac: "cmd-k cmd-x", win: "ctrl-k ctrl-x"},
//     name: "swap_with_mark"
// }, {
//     bindKey: {mac: "cmd-k cmd-y|ctrl-y", win: "ctrl-k ctrl-y"},
//     name: "yank"
// }, 

// // TODO check if these are same as ace
// {
//     bindKey: {win: "ctrl-delete"},
//     name: "delete_word",
//     args: {forward: true}
// }, {
//     bindKey: {mac: "ctrl-backspace"},
//     name: "delete_word",
//     args: {forward: false, sub_words: true}
// }, {
//     bindKey: {mac: "ctrl-delete"},
//     name: "delete_word",
//     args: {forward: true, sub_words: true}
// }, {
//     bindKey: {win: "ctrl-backspace"},
//     name: "delete_word",
//     args: {forward: false}
// }, {
//     bindKey: {win: "backspace|shift-backspace|ctrl-shift-backspace"},
//     name: "left_delete"
// }, {
//     bindKey: {win: "delete"},
//     name: "right_delete"
// }, 
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
// {
//     bindKey: {mac: "cmd-shift-a", win: "ctrl-shift-a"},
//     name: "expand_selection",
//     args: {to: "tag"}
// }, {
//     bindKey: {mac: "cmd-shift-j", win: "ctrl-shift-j"},
//     name: "expand_selection",
//     args: {to: "indentation"}
// }, {
//     bindKey: {mac: "ctrl-shift-m", win: "ctrl-shift-m"},
//     name: "expand_selection",
//     args: {to: "brackets"}
// }, {
//     bindKey: {mac: "cmd-shift-space", win: "ctrl-shift-space"},
//     name: "expand_selection",
//     args: {to: "scope"}
// },
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

/* fold */
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
// {
//     bindKey: {mac: "cmd-k cmd-2", win: "ctrl-k ctrl-2"},
//     name: "fold_by_level",
//     args: {level: 2}
// }, {
//     bindKey: {mac: "cmd-k cmd-3", win: "ctrl-k ctrl-3"},
//     name: "fold_by_level",
//     args: {level: 3}
// }, {
//     bindKey: {mac: "cmd-k cmd-4", win: "ctrl-k ctrl-4"},
//     name: "fold_by_level",
//     args: {level: 4}
// }, {
//     bindKey: {mac: "cmd-k cmd-5", win: "ctrl-k ctrl-5"},
//     name: "fold_by_level",
//     args: {level: 5}
// }, {
//     bindKey: {mac: "cmd-k cmd-6", win: "ctrl-k ctrl-6"},
//     name: "fold_by_level",
//     args: {level: 6}
// }, {
//     bindKey: {mac: "cmd-k cmd-7", win: "ctrl-k ctrl-7"},
//     name: "fold_by_level",
//     args: {level: 7}
// }, {
//     bindKey: {mac: "cmd-k cmd-8", win: "ctrl-k ctrl-8"},
//     name: "fold_by_level",
//     args: {level: 8}
// }, {
//     bindKey: {mac: "cmd-k cmd-9", win: "ctrl-k ctrl-9"},
//     name: "fold_by_level",
//     args: {level: 9}
// }, {
//     bindKey: {mac: "cmd-k cmd-t", win: "ctrl-k ctrl-t"},
//     name: "fold_tag_attributes"
// }, 

/* move */
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

// todo implement move by subwords
// {
//     bindKey: {mac: "ctrl-alt-shift-right|ctrl-shift-right", win: "alt-shift-right"},
//     name: "move",
//     args: {by: "subword_ends", forward: true, extend: true}
// }, {
//     bindKey: {mac: "ctrl-alt-shift-left|ctrl-shift-left", win: "alt-shift-left"},
//     name: "move",
//     args: {by: "subwords", forward: false, extend: true}
// }, {
//     bindKey: {mac: "ctrl-alt-right|ctrl-right", win: "alt-right"},
//     name: "move",
//     args: {by: "subword_ends", forward: true}
// }, {
//     bindKey: {mac: "ctrl-alt-left|ctrl-left", win: "alt-left"},
//     name: "move",
//     args: {by: "subwords", forward: false}
// }, 
{
    bindKey: { mac: "ctrl-m", win: "ctrl-m" },
    name: "jumptomatching",
    args: { to: "brackets" }
}, 
/* other */
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
// {
//     bindKey: {mac: "ctrl-shift-w", win: "alt-shift-w"},
//     name: "surrowndWithTag",
//     args: {name: "Packages/XML/long-tag.sublime-snippet"}
// },{
//     bindKey: {mac: "cmd-alt-.", win: "alt-."},
//     name: "close_tag"
// }, 
{
    bindKey: { mac: "cmd-j", win: "ctrl-j" },
    name: "joinlines"
}, 

// {
//     bindKey: {mac: "ctrl--", win: "alt--"},
//     name: "jump_back"
// }, {
//     bindKey: {mac: "ctrl-shift--", win: "alt-shift--"},
//     name: "jump_forward"
// }, 

{
    bindKey: { mac: "cmd-k cmd-l", win: "ctrl-k ctrl-l" },
    name: "tolowercase"
}, {
    bindKey: { mac: "cmd-k cmd-u", win: "ctrl-k ctrl-u" },
    name: "touppercase"
}, 

// {
//     bindKey: {mac: "cmd-v", win: "shift-insert|ctrl-v"},
//     name: "paste"
// }, {
//     bindKey: {mac: "cmd-shift-v", win: "ctrl-shift-v"},
//     name: "paste_and_indent"
// }, {
//     bindKey: {mac: "cmd-k cmd-v|cmd-alt-v", win: "ctrl-k ctrl-v"},
//     name: "paste_from_history"
// }, 


// {
//     bindKey: {mac: "cmd-z", win: "ctrl-z"},
//     name: "undo"
// }, {
//     bindKey: {mac: "cmd-shift-z", win: "ctrl-shift-z"},
//     name: "redo"
// }, {
//     bindKey: {mac: "cmd-y", win: "ctrl-y"},
//     name: "redo_or_repeat"
// }, {
//     bindKey: {mac: "cmd-shift-u", win: "ctrl-shift-u"},
//     name: "soft_redo"
// }, {
//     bindKey: {mac: "cmd-u", win: "ctrl-u"},
//     name: "soft_undo"
// }, 

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
// {
//     bindKey: {mac: "ctrl-f5", win: "ctrl-f9"},
//     name: "sortlines",
//     args: {case_sensitive: true}
// },
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
    // name: "toggle_record_macro"
    name: "togglerecording"
}, {
    bindKey: { linux: "ctrl-alt-shift-q", mac: "ctrl-shift-q", win: "ctrl-shift-q" },
    // name: "run_macro"
    name: "replaymacro"
}, 


{
    bindKey: { mac: "ctrl-t", win: "ctrl-t" },
    name: "transpose"
}

];

});


// won't implement
// {
//     bindKey: {mac: "cmd-alt-q", win: "alt-q"},
//     name: "wrap_lines"
// }, 

// {
//     bindKey: {mac: "f6", win: "f6"},
//     name: "toggle_setting",
//     args: {setting: "spell_check"}
// }, {
//     bindKey: {mac: "cmd-alt-p|ctrl-shift-p", win: "ctrl-alt-shift-p"},
//     name: "show_scope_name"
// }, 

// {
//     bindKey: {mac: "cmd-alt-o", win: "insert"},
//     name: "toggle_overwrite"
// },
// {
//     bindKey: {mac: "alt-f2", win: "context_menu"},
//     name: "context_menu"
// }, 