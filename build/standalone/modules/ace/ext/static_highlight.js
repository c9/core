define("ace/layer/lines",[], function(require, exports, module) {
"use strict";

var dom = require("../lib/dom");

var Lines = function(element, canvasHeight) {
    this.element = element;
    this.canvasHeight = canvasHeight || 500000;
    this.element.style.height = (this.canvasHeight * 2) + "px";
    
    this.cells = [];
    this.cellCache = [];
    this.$offsetCoefficient = 0;
};

(function() {
    
    this.moveContainer = function(config) {
        dom.translate(this.element, 0, -((config.firstRowScreen * config.lineHeight) % this.canvasHeight) - config.offset * this.$offsetCoefficient);
    };    
    
    this.pageChanged = function(oldConfig, newConfig) {
        return (
            Math.floor((oldConfig.firstRowScreen * oldConfig.lineHeight) / this.canvasHeight) !==
            Math.floor((newConfig.firstRowScreen * newConfig.lineHeight) / this.canvasHeight)
        );
    };
    
    this.computeLineTop = function(row, config, session) {
        var screenTop = config.firstRowScreen * config.lineHeight;
        var screenPage = Math.floor(screenTop / this.canvasHeight);
        var lineTop = session.documentToScreenRow(row, 0) * config.lineHeight;
        return lineTop - (screenPage * this.canvasHeight);
    };
    
    this.computeLineHeight = function(row, config, session) {
        return config.lineHeight * session.getRowLength(row);
    };
    
    this.getLength = function() {
        return this.cells.length;
    };
    
    this.get = function(index) {
        return this.cells[index];
    };
    
    this.shift = function() {
        this.$cacheCell(this.cells.shift());
    };
    
    this.pop = function() {
        this.$cacheCell(this.cells.pop());
    };
    
    this.push = function(cell) {
        if (Array.isArray(cell)) {
            this.cells.push.apply(this.cells, cell);
            var fragment = dom.createFragment(this.element);
            for (var i=0; i<cell.length; i++) {
                fragment.appendChild(cell[i].element);
            }
            this.element.appendChild(fragment);
         } else {
            this.cells.push(cell);
            this.element.appendChild(cell.element);
         }
    };
    
    this.unshift = function(cell) {
        if (Array.isArray(cell)) {
            this.cells.unshift.apply(this.cells, cell);
            var fragment = dom.createFragment(this.element);
            for (var i=0; i<cell.length; i++) {
                fragment.appendChild(cell[i].element);
            }
            if (this.element.firstChild)
                this.element.insertBefore(fragment, this.element.firstChild);
            else
                this.element.appendChild(fragment);
         } else {
            this.cells.unshift(cell);
            this.element.insertAdjacentElement("afterbegin", cell.element);
         }
    };
    
    this.last = function() {
        if (this.cells.length)
            return this.cells[this.cells.length-1];
        else
            return null;
    };
    
    this.$cacheCell = function(cell) {
        if (!cell)
            return;
            
        cell.element.remove();
        this.cellCache.push(cell);
    };
    
    this.createCell = function(row, config, session, initElement) {
        var cell = this.cellCache.pop();
        if (!cell) {
            var element = dom.createElement("div");
            if (initElement)
                initElement(element);
            
            this.element.appendChild(element);
            
            cell = {
                element: element,
                text: "",
                row: row
            };
        }
        cell.row = row;
        
        return cell;
    };
    
}).call(Lines.prototype);

exports.Lines = Lines;

});

define("ace/layer/text",[], function(require, exports, module) {
"use strict";

var oop = require("../lib/oop");
var dom = require("../lib/dom");
var lang = require("../lib/lang");
var Lines = require("./lines").Lines;
var EventEmitter = require("../lib/event_emitter").EventEmitter;

var Text = function(parentEl) {
    this.dom = dom; 
    this.element = this.dom.createElement("div");
    this.element.className = "ace_layer ace_text-layer";
    parentEl.appendChild(this.element);
    this.$updateEolChar = this.$updateEolChar.bind(this);
    this.$lines = new Lines(this.element);
};

(function() {

    oop.implement(this, EventEmitter);

    this.EOF_CHAR = "\xB6";
    this.EOL_CHAR_LF = "\xAC";
    this.EOL_CHAR_CRLF = "\xa4";
    this.EOL_CHAR = this.EOL_CHAR_LF;
    this.TAB_CHAR = "\u2014"; //"\u21E5";
    this.SPACE_CHAR = "\xB7";
    this.$padding = 0;
    this.MAX_LINE_LENGTH = 10000;

    this.$updateEolChar = function() {
        var doc = this.session.doc;
        var unixMode = doc.getNewLineCharacter() == "\n" && doc.getNewLineMode() != "windows";
        var EOL_CHAR = unixMode ? this.EOL_CHAR_LF : this.EOL_CHAR_CRLF;
        if (this.EOL_CHAR != EOL_CHAR) {
            this.EOL_CHAR = EOL_CHAR;
            return true;
        }
    };

    this.setPadding = function(padding) {
        this.$padding = padding;
        this.element.style.margin = "0 " + padding + "px";
    };

    this.getLineHeight = function() {
        return this.$fontMetrics.$characterSize.height || 0;
    };

    this.getCharacterWidth = function() {
        return this.$fontMetrics.$characterSize.width || 0;
    };
    
    this.$setFontMetrics = function(measure) {
        this.$fontMetrics = measure;
        this.$fontMetrics.on("changeCharacterSize", function(e) {
            this._signal("changeCharacterSize", e);
        }.bind(this));
        this.$pollSizeChanges();
    };

    this.checkForSizeChanges = function() {
        this.$fontMetrics.checkForSizeChanges();
    };
    this.$pollSizeChanges = function() {
        return this.$pollSizeChangesTimer = this.$fontMetrics.$pollSizeChanges();
    };
    this.setSession = function(session) {
        this.session = session;
        if (session)
            this.$computeTabString();
    };

    this.showInvisibles = false;
    this.setShowInvisibles = function(showInvisibles) {
        if (this.showInvisibles == showInvisibles)
            return false;

        this.showInvisibles = showInvisibles;
        this.$computeTabString();
        return true;
    };

    this.displayIndentGuides = true;
    this.setDisplayIndentGuides = function(display) {
        if (this.displayIndentGuides == display)
            return false;

        this.displayIndentGuides = display;
        this.$computeTabString();
        return true;
    };

    this.$tabStrings = [];
    this.onChangeTabSize =
    this.$computeTabString = function() {
        var tabSize = this.session.getTabSize();
        this.tabSize = tabSize;
        var tabStr = this.$tabStrings = [0];
        for (var i = 1; i < tabSize + 1; i++) {
            if (this.showInvisibles) {
                var span = this.dom.createElement("span");
                span.className = "ace_invisible ace_invisible_tab";
                span.textContent = lang.stringRepeat(this.TAB_CHAR, i);
                tabStr.push(span);
            } else {
                tabStr.push(this.dom.createTextNode(lang.stringRepeat(" ", i), this.element));
            }
        }
        if (this.displayIndentGuides) {
            this.$indentGuideRe =  /\s\S| \t|\t |\s$/;
            var className = "ace_indent-guide";
            var spaceClass = "";
            var tabClass = "";
            if (this.showInvisibles) {
                className += " ace_invisible";
                spaceClass = " ace_invisible_space";
                tabClass = " ace_invisible_tab";
                var spaceContent = lang.stringRepeat(this.SPACE_CHAR, this.tabSize);
                var tabContent = lang.stringRepeat(this.TAB_CHAR, this.tabSize);
            } else {
                var spaceContent = lang.stringRepeat(" ", this.tabSize);
                var tabContent = spaceContent;
            }

            var span = this.dom.createElement("span");
            span.className = className + spaceClass;
            span.textContent = spaceContent;
            this.$tabStrings[" "] = span;
            
            var span = this.dom.createElement("span");
            span.className = className + tabClass;
            span.textContent = tabContent;
            this.$tabStrings["\t"] = span;
        }
    };

    this.updateLines = function(config, firstRow, lastRow) {
        if (this.config.lastRow != config.lastRow ||
            this.config.firstRow != config.firstRow) {
            return this.update(config);
        }
        
        this.config = config;

        var first = Math.max(firstRow, config.firstRow);
        var last = Math.min(lastRow, config.lastRow);

        var lineElements = this.element.childNodes;
        var lineElementsIdx = 0;

        for (var row = config.firstRow; row < first; row++) {
            var foldLine = this.session.getFoldLine(row);
            if (foldLine) {
                if (foldLine.containsRow(first)) {
                    first = foldLine.start.row;
                    break;
                } else {
                    row = foldLine.end.row;
                }
            }
            lineElementsIdx ++;
        }

        var heightChanged = false;
        var row = first;
        var foldLine = this.session.getNextFoldLine(row);
        var foldStart = foldLine ? foldLine.start.row : Infinity;

        while (true) {
            if (row > foldStart) {
                row = foldLine.end.row+1;
                foldLine = this.session.getNextFoldLine(row, foldLine);
                foldStart = foldLine ? foldLine.start.row :Infinity;
            }
            if (row > last)
                break;

            var lineElement = lineElements[lineElementsIdx++];
            if (lineElement) {
                this.dom.removeChildren(lineElement);
                this.$renderLine(
                    lineElement, row, row == foldStart ? foldLine : false
                );
                var height = (config.lineHeight * this.session.getRowLength(row)) + "px";
                if (lineElement.style.height != height) {
                    heightChanged = true;
                    lineElement.style.height = height;
                }
            }
            row++;
        }
        if (heightChanged) {
            while (lineElementsIdx < this.$lines.cells.length) {
                var cell = this.$lines.cells[lineElementsIdx++];
                cell.element.style.top = this.$lines.computeLineTop(cell.row, config, this.session) + "px";
            }
        }
    };

    this.scrollLines = function(config) {
        var oldConfig = this.config;
        this.config = config;

        if (this.$lines.pageChanged(oldConfig, config))
            return this.update(config);
            
        this.$lines.moveContainer(config);
        
        var lastRow = config.lastRow;
        var oldLastRow = oldConfig ? oldConfig.lastRow : -1;

        if (!oldConfig || oldLastRow < config.firstRow)
            return this.update(config);

        if (lastRow < oldConfig.firstRow)
            return this.update(config);

        if (!oldConfig || oldConfig.lastRow < config.firstRow)
            return this.update(config);

        if (config.lastRow < oldConfig.firstRow)
            return this.update(config);

        if (oldConfig.firstRow < config.firstRow)
            for (var row=this.session.getFoldedRowCount(oldConfig.firstRow, config.firstRow - 1); row>0; row--)
                this.$lines.shift();

        if (oldConfig.lastRow > config.lastRow)
            for (var row=this.session.getFoldedRowCount(config.lastRow + 1, oldConfig.lastRow); row>0; row--)
                this.$lines.pop();

        if (config.firstRow < oldConfig.firstRow) {
            this.$lines.unshift(this.$renderLinesFragment(config, config.firstRow, oldConfig.firstRow - 1));
        }

        if (config.lastRow > oldConfig.lastRow) {
            this.$lines.push(this.$renderLinesFragment(config, oldConfig.lastRow + 1, config.lastRow));
        }
    };

    this.$renderLinesFragment = function(config, firstRow, lastRow) {
        var fragment = [];
        var row = firstRow;
        var foldLine = this.session.getNextFoldLine(row);
        var foldStart = foldLine ? foldLine.start.row : Infinity;

        while (true) {
            if (row > foldStart) {
                row = foldLine.end.row+1;
                foldLine = this.session.getNextFoldLine(row, foldLine);
                foldStart = foldLine ? foldLine.start.row : Infinity;
            }
            if (row > lastRow)
                break;

            var line = this.$lines.createCell(row, config, this.session);
            
            var lineEl = line.element;
            this.dom.removeChildren(lineEl);
            dom.setStyle(lineEl.style, "height", this.$lines.computeLineHeight(row, config, this.session) + "px");
            dom.setStyle(lineEl.style, "top", this.$lines.computeLineTop(row, config, this.session) + "px");
            this.$renderLine(lineEl, row, row == foldStart ? foldLine : false);

            if (this.$useLineGroups()) {
                lineEl.className = "ace_line_group";
            } else {
                lineEl.className = "ace_line";
            }
            fragment.push(line);

            row++;
        }
        return fragment;
    };

    this.update = function(config) {
        this.$lines.moveContainer(config);
        
        this.config = config;

        var firstRow = config.firstRow;
        var lastRow = config.lastRow;

        var lines = this.$lines;
        while (lines.getLength())
            lines.pop();
            
        lines.push(this.$renderLinesFragment(config, firstRow, lastRow));
    };

    this.$textToken = {
        "text": true,
        "rparen": true,
        "lparen": true
    };

    this.$renderToken = function(parent, screenColumn, token, value) {
        var self = this;
        var re = /(\t)|( +)|([\x00-\x1f\x80-\xa0\xad\u1680\u180E\u2000-\u200f\u2028\u2029\u202F\u205F\uFEFF\uFFF9-\uFFFC]+)|(\u3000)|([\u1100-\u115F\u11A3-\u11A7\u11FA-\u11FF\u2329-\u232A\u2E80-\u2E99\u2E9B-\u2EF3\u2F00-\u2FD5\u2FF0-\u2FFB\u3001-\u303E\u3041-\u3096\u3099-\u30FF\u3105-\u312D\u3131-\u318E\u3190-\u31BA\u31C0-\u31E3\u31F0-\u321E\u3220-\u3247\u3250-\u32FE\u3300-\u4DBF\u4E00-\uA48C\uA490-\uA4C6\uA960-\uA97C\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFAFF\uFE10-\uFE19\uFE30-\uFE52\uFE54-\uFE66\uFE68-\uFE6B\uFF01-\uFF60\uFFE0-\uFFE6]|[\uD800-\uDBFF][\uDC00-\uDFFF])/g;
        
        var valueFragment = this.dom.createFragment(this.element);

        var m;
        var i = 0;
        while (m = re.exec(value)) {
            var tab = m[1];
            var simpleSpace = m[2];
            var controlCharacter = m[3];
            var cjkSpace = m[4];
            var cjk = m[5];
            
            if (!self.showInvisibles && simpleSpace)
                continue;

            var before = i != m.index ? value.slice(i, m.index) : "";

            i = m.index + m[0].length;
            
            if (before) {
                valueFragment.appendChild(this.dom.createTextNode(before, this.element));
            }
                
            if (tab) {
                var tabSize = self.session.getScreenTabSize(screenColumn + m.index);
                valueFragment.appendChild(self.$tabStrings[tabSize].cloneNode(true));
                screenColumn += tabSize - 1;
            } else if (simpleSpace) {
                if (self.showInvisibles) {
                    var span = this.dom.createElement("span");
                    span.className = "ace_invisible ace_invisible_space";
                    span.textContent = lang.stringRepeat(self.SPACE_CHAR, simpleSpace.length);
                    valueFragment.appendChild(span);
                } else {
                    valueFragment.appendChild(this.com.createTextNode(simpleSpace, this.element));
                }
            } else if (controlCharacter) {
                var span = this.dom.createElement("span");
                span.className = "ace_invisible ace_invisible_space ace_invalid";
                span.textContent = lang.stringRepeat(self.SPACE_CHAR, controlCharacter.length);
                valueFragment.appendChild(span);
            } else if (cjkSpace) {
                var space = self.showInvisibles ? self.SPACE_CHAR : "";
                screenColumn += 1;
                
                var span = this.dom.createElement("span");
                span.style.width = (self.config.characterWidth * 2) + "px";
                span.className = self.showInvisibles ? "ace_cjk ace_invisible ace_invisible_space" : "ace_cjk";
                span.textContent = self.showInvisibles ? self.SPACE_CHAR : "";
                valueFragment.appendChild(span);
            } else if (cjk) {
                screenColumn += 1;
                var span = dom.createElement("span");
                span.style.width = (self.config.characterWidth * 2) + "px";
                span.className = "ace_cjk";
                span.textContent = cjk;
                valueFragment.appendChild(span);
            }
        }
        
        valueFragment.appendChild(this.dom.createTextNode(i ? value.slice(i) : value, this.element));

        if (!this.$textToken[token.type]) {
            var classes = "ace_" + token.type.replace(/\./g, " ace_");
            var span = this.dom.createElement("span");
            if (token.type == "fold")
                span.style.width = (token.value.length * this.config.characterWidth) + "px";
                
            span.className = classes;
            span.appendChild(valueFragment);
            
            parent.appendChild(span);
        }
        else {
            parent.appendChild(valueFragment);
        }
        
        return screenColumn + value.length;
    };

    this.renderIndentGuide = function(parent, value, max) {
        var cols = value.search(this.$indentGuideRe);
        if (cols <= 0 || cols >= max)
            return value;
        if (value[0] == " ") {
            cols -= cols % this.tabSize;
            var count = cols/this.tabSize;
            for (var i=0; i<count; i++) {
                parent.appendChild(this.$tabStrings[" "].cloneNode(true));
            }
            return value.substr(cols);
        } else if (value[0] == "\t") {
            for (var i=0; i<cols; i++) {
                parent.appendChild(this.$tabStrings["\t"].cloneNode(true));
            }
            return value.substr(cols);
        }
        return value;
    };

    this.$createLineElement = function(parent) {
        var lineEl = this.dom.createElement("div");
        lineEl.className = "ace_line";
        lineEl.style.height = this.config.lineHeight + "px";
        
        return lineEl;
    };

    this.$renderWrappedLine = function(parent, tokens, splits) {
        var chars = 0;
        var split = 0;
        var splitChars = splits[0];
        var screenColumn = 0;

        var lineEl = this.$createLineElement();
        parent.appendChild(lineEl);
        
        for (var i = 0; i < tokens.length; i++) {
            var token = tokens[i];
            var value = token.value;
            if (i == 0 && this.displayIndentGuides) {
                chars = value.length;
                value = this.renderIndentGuide(lineEl, value, splitChars);
                if (!value)
                    continue;
                chars -= value.length;
            }

            if (chars + value.length < splitChars) {
                screenColumn = this.$renderToken(lineEl, screenColumn, token, value);
                chars += value.length;
            } else {
                while (chars + value.length >= splitChars) {
                    screenColumn = this.$renderToken(
                        lineEl, screenColumn,
                        token, value.substring(0, splitChars - chars)
                    );
                    value = value.substring(splitChars - chars);
                    chars = splitChars;

                    lineEl = this.$createLineElement();
                    parent.appendChild(lineEl);

                    lineEl.appendChild(this.dom.createTextNode(lang.stringRepeat("\xa0", splits.indent), this.element));

                    split ++;
                    screenColumn = 0;
                    splitChars = splits[split] || Number.MAX_VALUE;
                }
                if (value.length != 0) {
                    chars += value.length;
                    screenColumn = this.$renderToken(
                        lineEl, screenColumn, token, value
                    );
                }
            }
        }
    };

    this.$renderSimpleLine = function(parent, tokens) {
        var screenColumn = 0;
        var token = tokens[0];
        var value = token.value;
        if (this.displayIndentGuides)
            value = this.renderIndentGuide(parent, value);
        if (value)
            screenColumn = this.$renderToken(parent, screenColumn, token, value);
        for (var i = 1; i < tokens.length; i++) {
            token = tokens[i];
            value = token.value;
            if (screenColumn + value.length > this.MAX_LINE_LENGTH)
                return this.$renderOverflowMessage(parent, screenColumn, token, value);
            screenColumn = this.$renderToken(parent, screenColumn, token, value);
        }
    };
    
    this.$renderOverflowMessage = function(parent, screenColumn, token, value) {
        this.$renderToken(parent, screenColumn, token,
            value.slice(0, this.MAX_LINE_LENGTH - screenColumn));
            
        var overflowEl = this.dom.createElement("span");
        overflowEl.className = "ace_inline_button ace_keyword ace_toggle_wrap";
        overflowEl.style.position = "absolute";
        overflowEl.style.right = "0";
        overflowEl.textContent = "<click to see more...>";
        
        parent.appendChild(overflowEl);        
    };
    this.$renderLine = function(parent, row, foldLine) {
        if (!foldLine && foldLine != false)
            foldLine = this.session.getFoldLine(row);

        if (foldLine)
            var tokens = this.$getFoldLineTokens(row, foldLine);
        else
            var tokens = this.session.getTokens(row);

        var lastLineEl = parent;
        if (tokens.length) {
            var splits = this.session.getRowSplitData(row);
            if (splits && splits.length) {
                this.$renderWrappedLine(parent, tokens, splits);
                var lastLineEl = parent.lastChild;
            } else {
                var lastLineEl = parent;
                if (this.$useLineGroups()) {
                    lastLineEl = this.$createLineElement();
                    parent.appendChild(lastLineEl);
                }
                this.$renderSimpleLine(lastLineEl, tokens);
            }
        } else if (this.$useLineGroups()) {
            lastLineEl = this.$createLineElement();
            parent.appendChild(lastLineEl);
        }

        if (this.showInvisibles && lastLineEl) {
            if (foldLine)
                row = foldLine.end.row;

            var invisibleEl = this.dom.createElement("span");
            invisibleEl.className = "ace_invisible ace_invisible_eol";
            invisibleEl.textContent = row == this.session.getLength() - 1 ? this.EOF_CHAR : this.EOL_CHAR;
            
            lastLineEl.appendChild(invisibleEl);
        }
    };

    this.$getFoldLineTokens = function(row, foldLine) {
        var session = this.session;
        var renderTokens = [];

        function addTokens(tokens, from, to) {
            var idx = 0, col = 0;
            while ((col + tokens[idx].value.length) < from) {
                col += tokens[idx].value.length;
                idx++;

                if (idx == tokens.length)
                    return;
            }
            if (col != from) {
                var value = tokens[idx].value.substring(from - col);
                if (value.length > (to - from))
                    value = value.substring(0, to - from);

                renderTokens.push({
                    type: tokens[idx].type,
                    value: value
                });

                col = from + value.length;
                idx += 1;
            }

            while (col < to && idx < tokens.length) {
                var value = tokens[idx].value;
                if (value.length + col > to) {
                    renderTokens.push({
                        type: tokens[idx].type,
                        value: value.substring(0, to - col)
                    });
                } else
                    renderTokens.push(tokens[idx]);
                col += value.length;
                idx += 1;
            }
        }

        var tokens = session.getTokens(row);
        foldLine.walk(function(placeholder, row, column, lastColumn, isNewRow) {
            if (placeholder != null) {
                renderTokens.push({
                    type: "fold",
                    value: placeholder
                });
            } else {
                if (isNewRow)
                    tokens = session.getTokens(row);

                if (tokens.length)
                    addTokens(tokens, lastColumn, column);
            }
        }, foldLine.end.row, this.session.getLine(foldLine.end.row).length);

        return renderTokens;
    };

    this.$useLineGroups = function() {
        return this.session.getUseWrapMode();
    };

    this.destroy = function() {
        clearInterval(this.$pollSizeChangesTimer);
        if (this.$measureNode)
            this.$measureNode.parentNode.removeChild(this.$measureNode);
        delete this.$measureNode;
    };

}).call(Text.prototype);

exports.Text = Text;

});

define("ace/requirejs/text!ace/ext/static.css",[],".ace_static_highlight {\n    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', 'Droid Sans Mono', monospace;\n    font-size: 12px;\n    white-space: pre-wrap\n}\n\n.ace_static_highlight .ace_gutter {\n    width: 2em;\n    text-align: right;\n    padding: 0 3px 0 0;\n    margin-right: 3px;\n}\n\n.ace_static_highlight.ace_show_gutter .ace_line {\n    padding-left: 2.6em;\n}\n\n.ace_static_highlight .ace_line { position: relative; }\n\n.ace_static_highlight .ace_gutter-cell {\n    -moz-user-select: -moz-none;\n    -khtml-user-select: none;\n    -webkit-user-select: none;\n    user-select: none;\n    top: 0;\n    bottom: 0;\n    left: 0;\n    position: absolute;\n}\n\n\n.ace_static_highlight .ace_gutter-cell:before {\n    content: counter(ace_line, decimal);\n    counter-increment: ace_line;\n}\n.ace_static_highlight {\n    counter-reset: ace_line;\n}\n");

define("ace/ext/static_highlight",[], function(require, exports, module) {
"use strict";

var EditSession = require("../edit_session").EditSession;
var TextLayer = require("../layer/text").Text;
var baseStyles = require("../requirejs/text!./static.css");
var config = require("../config");
var dom = require("../lib/dom");

var simpleDom = {
    createTextNode: function(textContent) {
        return textContent;
    },
    createElement: function(type) {
        var element = {
            type: type,
            style: {},
            childNodes: [],
            appendChild: function(child) {
                element.childNodes.push(child);
            },
            toString: function() {
                var internal = {
                    type: 1,
                    style: 1,
                    className: 1,
                    textContent: 1,
                    childNodes: 1,
                    appendChild: 1,
                    toString: 1
                };
                var stringBuilder = [];
                
                if (element.type != "fragment") {
                    stringBuilder.push("<", element.type);
                    if (element.className)
                        stringBuilder.push(" class='", element.className, "'");
                    var styleStr = [];
                    for (var key in element.style) {
                        styleStr.push(key, ":", element.style[key]);
                    }
                    if (styleStr.length)
                        stringBuilder.push(" style='", styleStr.join(""), "'");
                    for (var key in element) {
                        if (!internal[key]) {
                            stringBuilder.push(" ", key, "='", element[key], "'");
                        }
                    }
                    stringBuilder.push(">");
                }
                
                if (element.textContent) {
                    stringBuilder.push(element.textContent);
                } else {
                    for (var i=0; i<element.childNodes.length; i++) {
                        var child = element.childNodes[i];
                        if (typeof child == "string")
                            stringBuilder.push(child);
                        else
                            stringBuilder.push(child.toString());
                    }
                }
                
                if (element.type != "fragment") {
                    stringBuilder.push("</", element.type, ">");
                }
                
                return stringBuilder.join("");
            }
        };
        return element;
    },
    createFragment: function() {
        return this.createElement("fragment");
    }
};

var SimpleTextLayer = function() {
    this.config = {};
    this.dom = simpleDom;
};
SimpleTextLayer.prototype = TextLayer.prototype;

var highlight = function(el, opts, callback) {
    var m = el.className.match(/lang-(\w+)/);
    var mode = opts.mode || m && ("ace/mode/" + m[1]);
    if (!mode)
        return false;
    var theme = opts.theme || "ace/theme/textmate";
    
    var data = "";
    var nodes = [];

    if (el.firstElementChild) {
        var textLen = 0;
        for (var i = 0; i < el.childNodes.length; i++) {
            var ch = el.childNodes[i];
            if (ch.nodeType == 3) {
                textLen += ch.data.length;
                data += ch.data;
            } else {
                nodes.push(textLen, ch);
            }
        }
    } else {
        data = el.textContent;
        if (opts.trim)
            data = data.trim();
    }
    
    highlight.render(data, mode, theme, opts.firstLineNumber, !opts.showGutter, function (highlighted) {
        dom.importCssString(highlighted.css, "ace_highlight");
        el.innerHTML = highlighted.html;
        var container = el.firstChild.firstChild;
        for (var i = 0; i < nodes.length; i += 2) {
            var pos = highlighted.session.doc.indexToPosition(nodes[i]);
            var node = nodes[i + 1];
            var lineEl = container.children[pos.row];
            lineEl && lineEl.appendChild(node);
        }
        callback && callback();
    });
};
highlight.render = function(input, mode, theme, lineStart, disableGutter, callback) {
    var waiting = 1;
    var modeCache = EditSession.prototype.$modes;
    if (typeof theme == "string") {
        waiting++;
        config.loadModule(['theme', theme], function(m) {
            theme = m;
            --waiting || done();
        });
    }
    var modeOptions;
    if (mode && typeof mode === "object" && !mode.getTokenizer) {
        modeOptions = mode;
        mode = modeOptions.path;
    }
    if (typeof mode == "string") {
        waiting++;
        config.loadModule(['mode', mode], function(m) {
            if (!modeCache[mode] || modeOptions)
                modeCache[mode] = new m.Mode(modeOptions);
            mode = modeCache[mode];
            --waiting || done();
        });
    }
    function done() {
        var result = highlight.renderSync(input, mode, theme, lineStart, disableGutter);
        return callback ? callback(result) : result;
    }
    return --waiting || done();
};
highlight.renderSync = function(input, mode, theme, lineStart, disableGutter) {
    lineStart = parseInt(lineStart || 1, 10);

    var session = new EditSession("");
    session.setUseWorker(false);
    session.setMode(mode);

    var textLayer = new SimpleTextLayer();
    textLayer.setSession(session);

    session.setValue(input);
    var length =  session.getLength();
    
    var outerEl = simpleDom.createElement("div");
    outerEl.className = theme.cssClass;
    
    var innerEl = simpleDom.createElement("div");
    innerEl.className = "ace_static_highlight" + (disableGutter ? "" : " ace_show_gutter");
    innerEl.style["counter-reset"] = "ace_line " + (lineStart - 1);
    outerEl.appendChild(innerEl);

    for (var ix = 0; ix < length; ix++) {
        var lineEl = simpleDom.createElement("div");
        lineEl.className = "ace_line";
        
        if (!disableGutter) {
            var gutterEl = simpleDom.createElement("span");
            gutterEl.className ="ace_gutter ace_gutter-cell";
            gutterEl.unselectable ="on";
            gutterEl.textContent = ""; /*(ix + lineStart) + */
            lineEl.appendChild(gutterEl);
        }
        textLayer.$renderLine(lineEl, ix, false);
        innerEl.appendChild(lineEl);
    }
    textLayer.destroy();

    return {
        css: baseStyles + theme.cssText,
        html: outerEl.toString(),
        session: session
    };
};

module.exports = highlight;
module.exports.highlight = highlight;
});
