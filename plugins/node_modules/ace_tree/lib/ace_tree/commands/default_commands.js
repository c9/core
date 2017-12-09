/* ***** BEGIN LICENSE BLOCK *****
 * Distributed under the BSD license:
 *
 * Copyright (c) 2010, Ajax.org B.V.
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *     * Redistributions of source code must retain the above copyright
 *       notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above copyright
 *       notice, this list of conditions and the following disclaimer in the
 *       documentation and/or other materials provided with the distribution.
 *     * Neither the name of Ajax.org B.V. nor the
 *       names of its contributors may be used to endorse or promote products
 *       derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL AJAX.ORG B.V. BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * ***** END LICENSE BLOCK ***** */

define(function(require, exports, module) {
"use strict";

function bindKey(win, mac) {
    return {win: win, mac: mac};
}

exports.commands = [{
    name: "selectAll",
    bindKey: bindKey("Ctrl-A", "Command-A"),
    exec: function(editor) { editor.selectAll(); }
}, {
    name: "centerselection",
    bindKey: bindKey(null, "Ctrl-L"),
    exec: function(editor) { editor.centerSelection(); }
}, {
    name: "closeOrlevelUp",
    bindKey: bindKey("Left", "Left|Ctrl-B"),
    exec: function(editor) { editor.navigateLevelUp(true); }
}, , {
    name: "levelUp",
    bindKey: bindKey("Shift-Left", "Shift-Left|Ctrl-B"),
    exec: function(editor) { editor.navigateLevelUp(); }
}, {
    name: "levelDown",
    bindKey: bindKey("Right", "Right|Ctrl-F"),
    exec: function(editor) { editor.navigateLevelDown(); }
}, {
    name: "goToStart",
    editorKey: bindKey("Ctrl-Home", "Ctrl-Home"),
    bindKey: bindKey("Home|Ctrl-Home", "Home|Ctrl-Home"),
    exec: function(editor) { editor.navigateStart(); }
}, {
    name: "goToEnd",
    editorKey: bindKey("Ctrl-End", "Ctrl-End"),
    bindKey: bindKey("End|Ctrl-End", "End|Ctrl-End"),
    exec: function(editor) { editor.navigateEnd(); }
}, {
    name: "closeAllFromSelected",
    bindKey: bindKey("Ctrl-Left", "Ctrl-Left"),
    exec: function(ed) { ed.provider.close(ed.selection.getCursor(), true); }
}, {
    name: "openAllFromSelected",
    bindKey: bindKey("Ctrl-Right", "Ctrl-Right"),
    exec: function(ed) { ed.provider.open(ed.selection.getCursor(), true); }
}, {
    name: "pageup",
    bindKey: "Option-PageUp",
    exec: function(editor) { editor.scrollPageUp(); }
}, {
    name: "gotopageup",
    bindKey: "PageUp",
    exec: function(editor) { editor.gotoPageUp(); }
}, {
    name: "pagedown",
    bindKey: "Option-PageDown",
    exec: function(editor) { editor.scrollPageDown(); }
}, {
    name: "gotopageDown",
    bindKey: "PageDown",
    exec: function(editor) { editor.gotoPageDown(); }
}, {
    name: "scrollup",
    bindKey: bindKey("Ctrl-Up", null),
    exec: function(e) { e.renderer.scrollBy(0, -2 * e.renderer.layerConfig.lineHeight); }
}, {
    name: "scrolldown",
    bindKey: bindKey("Ctrl-Down", null),
    exec: function(e) { e.renderer.scrollBy(0, 2 * e.renderer.layerConfig.lineHeight); }
}, {
    name: "insertstring",
    exec: function(e, args) { e.insertSting(args) }
}, {
    name: "goUp",
    bindKey: bindKey("Up", "Up|Ctrl-P"),
    exec: function(editor) { editor.selection.moveSelection(-1); }
}, {
    name: "goDown",
    bindKey: bindKey("Down", "Down|Ctrl-N"),
    exec: function(editor) { editor.selection.moveSelection(1); }
}, {
    name: "selectUp",
    bindKey: bindKey("Shift-Up", "Shift-Up"),
    exec: function(editor) { editor.selection.moveSelection(-1, true); }
}, {
    name: "selectDown",
    bindKey: bindKey("Shift-Down", "Shift-Down"),
    exec: function(editor) { editor.selection.moveSelection(1, true); }
}, {
    name: "selectToUp",
    bindKey: bindKey("Ctrl-Up", "Ctrl-Up"),
    exec: function(editor) { editor.selection.moveSelection(-1, false, true); }
}, {
    name: "selectToDown",
    bindKey: bindKey("Ctrl-Down", "Ctrl-Down"),
    exec: function(editor) { editor.selection.moveSelection(1, false, true); }
}, {
    name: "selectMoreUp",
    bindKey: bindKey("Ctrl-Shift-Up", "Ctrl-Shift-Up"),
    exec: function(editor) { editor.selection.moveSelection(-1, true, true); }
}, {
    name: "selectMoreDown",
    bindKey: bindKey("Ctrl-Shift-Down", "Ctrl-Shift-Down"),
    exec: function(editor) { editor.selection.moveSelection(1, true, true); }
}, {
    name: "rename",
    bindKey: "F2",
    exec: function(tree) { tree.edit && tree.edit.startRename(); }
}, {
    name: "chose",
    bindKey: "Enter",
    exec: function(tree) { tree._emit("afterChoose"); }
}, {
    name: "delete",
    bindKey: "Delete",
    exec: function(tree) { tree._emit("delete"); }
}, {
    name: "foldOther",
    bindKey: bindKey("Alt-0", "Command-Option-0"),
    exec: function(tree) {
        tree.provider.close(tree.provider.root, true); 
        tree.reveal(tree.selection.getCursor());
    }
}


];

});
