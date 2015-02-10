/**
 * The main class required to set up a Tree instance in the browser.
 *
 * @class Tree
 **/

define(function(require, exports, module) {
"use strict";

// var UndoManager = require("./undomanager").UndoManager;
var Renderer = require("./virtual_renderer").VirtualRenderer;
// var MultiSelect = require("./multi_select").MultiSelect;

exports.config = require("./config");

var oop = require("ace/lib/oop");
var lang = require("ace/lib/lang");
var useragent = require("ace/lib/useragent");
var TextInput = require("ace/keyboard/textinput").TextInput;
var MouseHandler = require("./mouse/mouse_handler").MouseHandler;
var KeyBinding = require("ace/keyboard/keybinding").KeyBinding;
var Selection = require("./selection").Selection;
var EventEmitter = require("ace/lib/event_emitter").EventEmitter;
var CommandManager = require("ace/commands/command_manager").CommandManager;
var defaultCommands = require("./commands/default_commands").commands;
var config = require("./config");

var quickSearch = require("./quicksearch");
/**
 * @class Tree
 **/

/**
 * Creates a new `Tree` object.
 * @param {Object} element The html element the Tree table renders in.
 *
 *
 * @constructor
 **/
var Tree = function(element, cellWidth, cellHeight) {
    this.cellWidth  = cellWidth || 80;
    this.cellHeight = cellHeight || 24;
    
    this.renderer = new Renderer(element, this.cellWidth, this.cellHeight);
    this.container = this.renderer.container;

    this.commands = new CommandManager(useragent.isMac ? "mac" : "win", defaultCommands);
    this.textInput  = new TextInput(this.container, this);
    this.keyBinding = new KeyBinding(this);

    // TODO detect touch event support
    this.$mouseHandler = new MouseHandler(this);

    this.$blockScrolling = 0;
    
    var _self = this;
    this.renderer.on("edit", function(e){
        _self._emit("edit", e);
    });
    
    this.commands.on("exec", function() {
        this.selectionChanged = false;
    }.bind(this));
    this.commands.on("afterExec", function() {
        if (this.selectionChanged) {
            this.selectionChanged = false;
            this.renderer.scrollCaretIntoView();
            this._signal("userSelect");
        }
    }.bind(this));
    this.on("changeSelection", function() {
        if (this.$mouseHandler.isMousePressed)
            this._signal("userSelect");
    }.bind(this));
    
    
    // var Tooltip = require("./tooltip")
    // new Tooltip(this)

    config.resetOptions(this);
    config._emit("Tree", this);
};

(function(){

    oop.implement(this, EventEmitter);

    /**
     *
     **/
    this.setDataProvider = function(provider) {
        if (this.provider) {
            var oldProvider = this.provider;
            // this.session.off("changeScrollLeft", this.$onScrollLeftChange);

            this.selection.off("changeCaret", this.$onCaretChange);
            this.selection.off("change", this.$onSelectionChange);
            
            oldProvider.off("changeClass", this.$onChangeClass);
            oldProvider.off("expand", this.$redraw);
            oldProvider.off("collapse", this.$redraw);
            oldProvider.off("change", this.$redraw);
            oldProvider.off("changeScrollTop", this.$onScrollTopChange);
            oldProvider.off("changeScrollLeft", this.$onScrollLeftChange);
        }

        this.provider = provider;
        if (provider) {
            this.renderer.setDataProvider(provider);
    
            // this.$onScrollLeftChange = this.onScrollLeftChange.bind(this);
            // this.session.on("changeScrollLeft", this.$onScrollLeftChange);
            
            if (!this.$redraw) this.$redraw = this.redraw.bind(this);
            
            this.provider.on("expand", this.$redraw);
            this.provider.on("collapse", this.$redraw);
            this.provider.on("change", this.$redraw);
    
            // FIXME
            if (!this.provider.selection) {
                this.provider.selection = new Selection(this.provider);
            }
            
            this.selection = this.provider.selection;
            
            this.$onCaretChange = this.onCaretChange.bind(this);
            this.selection.on("changeCaret", this.$onCaretChange);
            this.$onChangeClass = this.$onChangeClass.bind(this);
            this.provider.on("changeClass", this.$onChangeClass);
    
            this.$onSelectionChange = this.onSelectionChange.bind(this);
            this.selection.on("change", this.$onSelectionChange);
            
            
            this.$onScrollTopChange = this.onScrollTopChange.bind(this);
            this.provider.on("changeScrollTop", this.$onScrollTopChange);
    
            this.$onScrollLeftChange = this.onScrollLeftChange.bind(this);
            this.provider.on("changeScrollLeft", this.$onScrollLeftChange);
            
            this.$blockScrolling += 1;
            this.onCaretChange();
            this.$blockScrolling -= 1;
    
            this.onScrollTopChange();
            this.onScrollLeftChange();
            this.onSelectionChange();
            this.renderer.updateFull();
        }

        this._emit("changeDataProvider", {
            provider: provider,
            oldProvider: oldProvider
        });
    };
    
    this.redraw = function() {
        this.renderer.updateFull();
    };
    
    this.getLength = function(){
        return 0; // this.renderer.$treeLayer.length;
    };
    
    this.getLine = function(row){
        return {
            length : 0 // this.renderer.$horHeadingLayer.length - 1
        };
    };

    /**
     * Returns the current session being used.
     **/
    this.getDataProvider = function() {
        return this.provider;
    };

    /**
     *
     * Returns the currently highlighted selection.
     * @returns {String} The highlighted selection
     **/
    this.getSelection = function() {
        return this.selection;
    };

    /**
     * {:VirtualRenderer.onResize}
     * @param {Boolean} force If `true`, recomputes the size, even if the height and width haven't changed
     *
     *
     * @related VirtualRenderer.onResize
     **/
    this.resize = function(force) {
        this.renderer.onResize(force);
    };

    /**
     *
     * Brings the current `textInput` into focus.
     **/
    this.focus = function(once) {
        // Safari needs the timeout
        // iOS and Firefox need it called immediately
        // to be on the save side we do both
        var _self = this;
        once || setTimeout(function() {
            _self.textInput.focus();
        });
        this.textInput.focus();
    };

    /**
     * Returns `true` if the current `textInput` is in focus.
     * @return {Boolean}
     **/
    this.isFocused = function() {
        return this.textInput.isFocused();
    };

    /**
     *
     * Blurs the current `textInput`.
     **/
    this.blur = function() {
        this.textInput.blur();
    };

    /**
     * Emitted once the editor comes into focus.
     * @event focus
     *
     *
     **/
    this.onFocus = function() {
        if (this.$isFocused)
            return;
        this.$isFocused = true;
        this.renderer.visualizeFocus();
        this._emit("focus");
    };

    /**
     * Emitted once the editor has been blurred.
     * @event blur
     *
     *
     **/
    this.onBlur = function() {
        if (!this.$isFocused)
            return;
        this.$isFocused = false;
        this.renderer.visualizeBlur();
        this._emit("blur");
    };

    this.onScrollTopChange = function() {
        this.renderer.scrollToY(this.provider.getScrollTop());
    };

    this.onScrollLeftChange = function() {
        this.renderer.scrollToX(this.renderer.getScrollLeft());
    };
    
    this.$onChangeClass = function() {
        this.renderer.updateCaret();
    };

    /**
     * Emitted when the selection changes.
     *
     **/
    this.onCaretChange = function() {
        this.$onChangeClass();

        if (!this.$blockScrolling)
            this.selectionChanged = true;

        this._emit("changeSelection");
    };
    
    this.onSelectionChange = function(e) {
        this.onCaretChange();
    };

    this.execCommand = function(command, args) {
        this.commands.exec(command, this, args);
    };

    this.onTextInput = function(text) {
        this.keyBinding.onTextInput(text);
    };

    this.onCommandKey = function(e, hashId, keyCode) {
        this.keyBinding.onCommandKey(e, hashId, keyCode);
    };
    
    this.insertSting = function(str) {
        if (this.startFilter) 
            return this.startFilter(str);
        
        quickSearch(this, str);    
    };
    
    this.setTheme = function(theme) {
        this.renderer.setTheme(theme);
    };

    /**
     * Returns an object indicating the currently selected rows. The object looks like this:
     *
     * ```json
     * { first: range.start.row, last: range.end.row }
     * ```
     *
     * @returns {Object}
     **/
    this.$getSelectedRows = function() {
        var range = this.getSelectionRange().collapseRows();

        return {
            first: range.start.row,
            last: range.end.row
        };
    };

    /**
     * {:VirtualRenderer.getVisibleNodes}
     * @param {Number} tolerance fraction of the node allowed to be hidden while node still considered visible (default 1/3)
     * @returns {Array}
     * @related VirtualRenderer.getVisibleNodes
     **/
    this.getVisibleNodes = function(tolerance) {
        return this.renderer.getVisibleNodes(tolerance);
    };
    /**
     * Indicates if the node is currently visible on the screen.
     * @param {Object} node The node to check
     * @param {Number} tolerance fraction of the node allowed to be hidden while node still considered visible (default 1/3)
     *
     * @returns {Boolean}
     **/
    this.isNodeVisible = function(node, tolerance) {
        return this.renderer.isNodeVisible(node, tolerance);
    };

    this.$moveByPage = function(dir, select) {
        var renderer = this.renderer;
        var config = this.renderer.layerConfig;
        config.lineHeight = this.provider.rowHeight;
        var rows = dir * Math.floor(config.height / config.lineHeight);

        this.$blockScrolling++;
        this.selection.moveSelection(rows, select);
        this.$blockScrolling--;

        var scrollTop = renderer.scrollTop;

        renderer.scrollBy(0, rows * config.lineHeight);
        if (select != null)
            renderer.scrollCaretIntoView(null, 0.5);

        renderer.animateScrolling(scrollTop);
    };

    /**
     * Selects the text from the current position of the document until where a "page down" finishes.
     **/
    this.selectPageDown = function() {
        this.$moveByPage(1, true);
    };

    /**
     * Selects the text from the current position of the document until where a "page up" finishes.
     **/
    this.selectPageUp = function() {
        this.$moveByPage(-1, true);
    };

    /**
     * Shifts the document to wherever "page down" is, as well as moving the cursor position.
     **/
    this.gotoPageDown = function() {
       this.$moveByPage(1, false);
    };

    /**
     * Shifts the document to wherever "page up" is, as well as moving the cursor position.
     **/
    this.gotoPageUp = function() {
        this.$moveByPage(-1, false);
    };

    /**
     * Scrolls the document to wherever "page down" is, without changing the cursor position.
     **/
    this.scrollPageDown = function() {
        this.$moveByPage(1);
    };

    /**
     * Scrolls the document to wherever "page up" is, without changing the cursor position.
     **/
    this.scrollPageUp = function() {
        this.$moveByPage(-1);
    };

    /**
     * Scrolls to a row. If `center` is `true`, it puts the row in middle of screen (or attempts to).
     * @param {Number} row The row to scroll to
     * @param {Boolean} center If `true`
     * @param {Boolean} animate If `true` animates scrolling
     * @param {Function} callback Function to be called when the animation has finished
     *
     *
     * @related VirtualRenderer.scrollToRow
     **/
    this.scrollToRow = function(row, center, animate, callback) {
        this.renderer.scrollToRow(row, center, animate, callback);
    };

    /**
     * Attempts to center the current selection on the screen.
     **/
    this.centerSelection = function() {
        var range = this.getSelectionRange();
        var pos = {
            row: Math.floor(range.start.row + (range.end.row - range.start.row) / 2),
            column: Math.floor(range.start.column + (range.end.column - range.start.column) / 2)
        };
        this.renderer.alignCaret(pos, 0.5);
    };

    /**
     * Gets the current position of the Caret.
     * @returns {Object} An object that looks something like this:
     *
     * ```json
     * { row: currRow, column: currCol }
     * ```
     *
     * @related Selection.getCursor
     **/
    this.getCursorPosition = function() {
        return this.selection.getCursor();
    };

    /**
     * Returns the screen position of the Caret.
     * @returns {Number}
     **/
    this.getCursorPositionScreen = function() {
        return this.session.documentToScreenPosition(this.getCursorPosition());
    };

    /**
     * {:Selection.getRange}
     * @returns {Range}
     * @related Selection.getRange
     **/
    this.getSelectionRange = function() {
        return this.selection.getRange();
    };


    /**
     * Selects all the text in editor.
     * @related Selection.selectAll
     **/
    this.selectAll = function() {
        this.$blockScrolling += 1;
        this.selection.selectAll();
        this.$blockScrolling -= 1;
    };

    /**
     * {:Selection.clearSelection}
     * @related Selection.clearSelection
     **/
    this.clearSelection = function() {
        this.selection.clearSelection();
    };

    /**
     * Moves the Caret to the specified row and column. Note that this does not de-select the current selection.
     * @param {Number} row The new row number
     * @param {Number} column The new column number
     *
     *
     * @related Selection.moveCaretTo
     **/
    this.moveCaretTo = function(row, column) {
        this.selection.moveCaretTo(row, column);
    };

    /**
     * Moves the Caret to the position indicated by `pos.row` and `pos.column`.
     * @param {Object} pos An object with two properties, row and column
     *
     *
     * @related Selection.moveCaretToPosition
     **/
    this.moveCaretToPosition = function(pos) {
        this.selection.moveCaretToPosition(pos);
    };

    /**
     * Moves the Caret to the specified row number, and also into the indiciated column.
     * @param {Number} rowNumber The row number to go to
     * @param {Number} column A column number to go to
     * @param {Boolean} animate If `true` animates scolling
     *
     **/
    this.gotoRow = function(rowNumber, column, animate) {
        this.selection.clearSelection();
        
        if (column === undefined)
            column = this.selection.getCursor().column;

        this.$blockScrolling += 1;
        this.moveCaretTo(rowNumber - 1, column || 0);
        this.$blockScrolling -= 1;

        if (!this.isRowFullyVisible(rowNumber - 1))
            this.scrollToRow(rowNumber - 1, true, animate);
    };

    /**
     * Moves the Caret to the specified row and column. Note that this does de-select the current selection.
     * @param {Number} row The new row number
     * @param {Number} column The new column number
     *
     *
     * @related Editor.moveCaretTo
     **/
    this.navigateTo = function(row, column) {
        this.clearSelection();
        this.moveCaretTo(row, column);
    };

    /**
     * Moves the Caret up in the document the specified number of times. Note that this does de-select the current selection.
     * @param {Number} times The number of times to change navigation
     *
     *
     **/
    this.navigateUp = function() {
        var node = this.provider.navigate("up");
        node && this.selection.setSelection(node);
        this.$scrollIntoView();
    };

    /**
     * Moves the Caret down in the document the specified number of times. Note that this does de-select the current selection.
     * @param {Number} times The number of times to change navigation
     *
     *
     **/
    this.navigateDown = function() {
        var node = this.provider.navigate("down");
        node && this.selection.setSelection(node);
    };

    /**
     * Moves the Caret left in the document the specified number of times. Note that this does de-select the current selection.
     **/
    this.navigateLevelUp = function(toggleNode) {
        var node = this.selection.getCursor();
        if (!node) {
            // continue
        } else if (toggleNode && this.provider.isOpen(node)) {
            this.provider.close(node);
        } else {
            this.selection.setSelection(node.parent);
        }
    };

    /**
     * Moves the Caret right in the document the specified number of times. Note that this does de-select the current selection.
     **/
    this.navigateLevelDown = function() {
        var node = this.selection.getCursor();
        var hasChildren = this.provider.hasChildren(node);
        if (!hasChildren || this.provider.isOpen(node))
            return this.selection.moveSelection(1);
        
        this.provider.open(node);
    };
    
    this.navigateStart = function() {
        var node = this.getFirstNode();
        this.selection.setSelection(node);
    };
    
    this.navigateEnd = function() {
        var node = this.getLastNode();
        this.selection.setSelection(node);
    };
    this.getFirstNode = function() {
        var index = this.provider.getMinIndex();
        return this.provider.getNodeAtIndex(index);
    };
    this.getLastNode = function() {
        var index = this.provider.getMaxIndex();
        return this.provider.getNodeAtIndex(index);
    };
    
    this.$scrollIntoView = function(node) {
        this.renderer.scrollCaretIntoView();
    };
    
    this.select = function(node) {
        this.selection.setSelection(node);
    };
    
    this.getCopyText = function(node) {
        return "";
    };
    this.onPaste = function(node) {
        return "";
    };

    this.reveal = function(node, animate) {
        var provider = this.provider;
        var parent = node.parent;
        while (parent) {
            if (!provider.isOpen(parent))
                provider.expand(parent);
            parent = parent.parent;
        }
        
        this.select(node);
        var scrollTop = this.renderer.scrollTop;
        this.renderer.scrollCaretIntoView(node, 0.5);
        if (animate !== false)
            this.renderer.animateScrolling(scrollTop);
    };
    
    /**
     * {:UndoManager.undo}
     * @related UndoManager.undo
     **/
    this.undo = function() {
        this.$blockScrolling++;
        this.session.getUndoManager().undo();
        this.$blockScrolling--;
        this.renderer.scrollCaretIntoView(null, 0.5);
    };

    /**
     * {:UndoManager.redo}
     * @related UndoManager.redo
     **/
    this.redo = function() {
        this.$blockScrolling++;
        this.session.getUndoManager().redo();
        this.$blockScrolling--;
        this.renderer.scrollCaretIntoView(null, 0.5);
    };
    
    /**
     * Returns `true` if the editor is set to read-only mode.
     * @returns {Boolean}
     **/
    this.getReadOnly = function() {
        return this.getOption("readOnly");
    };

    /**
     *
     * Cleans up the entire editor.
     **/
    this.destroy = function() {
        this.renderer.destroy();
        this._emit("destroy", this);
    };
    
    this.setHorHeadingVisible = function(value){
        this.renderer.setHorHeadingVisible(value);
    };
    
    this.setVerHeadingVisible = function(value){
        this.renderer.setVerHeadingVisible(value);
    };
    
    this.enable = function() {
        this.$disabled = false;
        this.container.style.pointerEvents = "";
        this.container.style.opacity = "";
    };
    
    this.disable = function() {
        this.$disabled = true;
        this.container.style.pointerEvents = "none";
        this.container.style.opacity = "0.9";
        if (this.isFocused())
            this.blur();
    };

}).call(Tree.prototype);

config.defineOptions(Tree.prototype, "Tree", {
    toggle: {
        set: function(toggle) {
            
        },
        initialValue: false
    },
    readOnly: {
        set: function(readOnly) {
            this.textInput.setReadOnly(readOnly);
        },
        initialValue: false
    },

    animatedScroll: "renderer",
    maxLines: "renderer",
    minLines: "renderer",

    scrollSpeed: "$mouseHandler",
    enableDragDrop: "$mouseHandler"
});

module.exports = Tree;
});
