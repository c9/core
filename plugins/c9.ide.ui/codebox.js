/*
 * See the NOTICE file distributed with this work for additional
 * information regarding copyright ownership.
 *
 * This is free software; you can redistribute it and/or modify it
 * under the terms of the GNU Lesser General Public License as
 * published by the Free Software Foundation; either version 2.1 of
 * the License, or (at your option) any later version.
 *
 * This software is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this software; if not, write to the Free
 * Software Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA
 * 02110-1301 USA, or see the FSF site: http://www.fsf.org.
 *
 */

// #ifdef __AMLCODEEDITOR || __INC_ALL

/**
 * Element allowing the user to type code.
 *
 * @constructor
 * @define codeeditor
 * @addnode elements
 *
 * @inherits apf.StandardBinding
 *
 * @author      Ruben Daniels (ruben AT ajax DOT org)
 * @author      Fabian Jakobs (fabian AT ajax DOT org)
 * @version     %I%, %G%
 * @since       0.1
 */

define(function(require, exports, module) {
"use strict";

var Editor = require("ace/editor").Editor;
var VirtualRenderer = require("ace/virtual_renderer").VirtualRenderer;
var UndoManager = require("ace/undomanager").UndoManager;
var MultiSelect = require("ace/multi_select").MultiSelect;
var dom = require("ace/lib/dom");

require("ace/lib/fixoldbrowsers");

function init(apf) {

apf.codebox = function(struct, tagName) {
    this.$init(tagName || "codebox", apf.NODE_VISIBLE, struct);
};

(function() {
    this.$isTextInput = function(e) {
        return true;
    };
    this.$focussable = true; // This object can get the focus
    this.$childProperty = "value";
    this.value = "";

    this.$draw = function(){
        // Build Main Skin
        this.$ext = this.$getExternal();
        this.$input = this.$getLayoutNode("main", "input", this.$ext);
        this.$button = this.$getLayoutNode("main", "button", this.$ext);
        this.$inputInitFix = this.$getLayoutNode("main", "initialfix", this.$ext);

        this.addEventListener("resize", function(e) {
            this.ace.resize();
        });

        this.$input.style.textShadow = "none";
        var ace = this.createSingleLineAceEditor(this.$input);

        // disable unneded commands
        ace.commands.removeCommands(["find", "replace", "replaceall", "gotoline", 
            "findnext", "findprevious", "expandtoline"]);
        // todo is there a property for these?
        ace.commands.removeCommands(["indent", "outdent"]);
        ace.commands.commandKeyBinding = Object.create(null);
        ace.commands.addCommand(ace.commands.byName.undo);
        ace.commands.addCommand(ace.commands.byName.redo);

        this.$editor = this.ace = ace;
        ace.renderer.setPadding(2);
        this.ace.codebox = this;
        
        var checkInitial = function() {
            var value = ace.getValue();
            if (value && ace.renderer.initialMessageNode) {
                ace.renderer.off("afterRender", checkInitial);
                dom.removeCssClass(ace.container, "ace_initialMsg");
                ace.renderer.scroller.removeChild(ace.renderer.initialMessageNode);
                ace.renderer.initialMessageNode = null;
            }
            else if (!value && !ace.renderer.initialMessageNode) {
                ace.renderer.on("afterRender", checkInitial);
                dom.addCssClass(ace.container, "ace_initialMsg");
                var el = document.createElement("div");
                el.className = "tb_textboxInitialMsg";
                el.textContent = ace.codebox["initial-message"] || "";
                ace.renderer.initialMessageNode = el;
                ace.renderer.scroller.appendChild(ace.renderer.initialMessageNode);
            }
        };
        ace.on("input", checkInitial);

        setTimeout(checkInitial, 100);
        
        // todo should we do this here?
        // ace.on("resize", function(){apf.layout.forceResize();});
        
        if (apf.isTrue(this.getAttribute("clearbutton"))) {
            var _self = this;
            var visible = false;
            ace.renderer.on("afterRender", function() {
                var show = !!ace.getValue()
                if (visible != show) {
                    visible = show;
                    _self.$button.style.display = visible ? "block" : "";
                }
            });
            this.$button.addEventListener("click", function() {
                ace.setValue("");
            }, false)
        }
        this.$ext.addEventListener("mousedown", function() {
            ace.focus();
        }, false);
    };
    this.getValue = function() {
        return this.ace.getValue();
    };
    this.setValue = function(val) {
        return this.ace.setValue(val);
    };
    this.select = function() {
        return this.ace.selectAll();
    };
    this.$focus = function(e) {
        if (!this.$ext || this.disabled)
            return;

        this.$setStyleClass(this.$ext, this.$baseCSSname + "Focus");

        this.ace.focus();
    };
    this.$blur = function (){
        if (!this.$ext)
            return;

        this.$setStyleClass(this.$ext, "", [this.$baseCSSname + "Focus"]);
        if (this.ace)
            this.ace.blur();
    };
    
    this.$enable = function(){ this.ace.setReadOnly(false); };
    this.$disable = function(){ this.ace.setReadOnly(true); };

    this.execCommand = function(command) {
        this.ace.commands.exec(command, this.ace);
    };

    this.createSingleLineAceEditor = function(el) {
        var renderer = new VirtualRenderer(el);

        renderer.screenToTextCoordinates = function(x, y) {
            var pos = this.pixelToScreenCoordinates(x, y);
            return this.session.screenToDocumentPosition(
                Math.min(this.session.getScreenLength() - 1, Math.max(pos.row, 0)),
                Math.max(pos.column, 0)
            );
        };

        renderer.setOption("maxLines", 4);

        renderer.setStyle("ace_one-line");
        var editor = new Editor(renderer);
        new MultiSelect(editor);
        editor.session.setUndoManager(new UndoManager());

        editor.setOption("indentedSoftWrap", false);
        editor.setHighlightActiveLine(false);
        editor.setShowPrintMargin(false);
        editor.renderer.setShowGutter(false);
        editor.renderer.setHighlightGutterLine(false);

        editor.$mouseHandler.$focusWaitTimout = 0;
        
        editor.setReadOnly = function(readOnly) {
            if (this.$readOnly != readOnly) {
                this.codebox.$ext.style.pointerEvents = readOnly ? "none" : "";
            }
            this.setOption("readOnly", readOnly);
        };

        return editor;
    },

    this.$loadAml = function(){
        if (typeof this["clearbutton"] == "undefined")
            this.$setInheritedAttribute("clearbutton");
        if (typeof this["initial-message"] == "undefined")
            this.$setInheritedAttribute("initial-message");
        if (apf.isTrue(this["singleline"])) {
            this.ace.on("paste", function(e) {
                e.text = e.text.replace(/\r\n|\r|\n/g, " ");
            });
        }
    };

}).call(apf.codebox.prototype = new apf.StandardBinding());
apf.aml.setElement("codebox", apf.codebox);

}

return init;

});
// #endif
