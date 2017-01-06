define(function(require, exports, module) {

var oop = require("ace/lib/oop");
var TextMode = require("ace/mode/text").Mode;
var Range = require("ace/range").Range;
var dom = require("ace/lib/dom");
var FoldMode = require("ace/mode/folding/cstyle").FoldMode;

var foldMode = new FoldMode();
foldMode.foldingStartMarker = /(^#>>)|(\{|\[)[^\}\]]*$|^\s*(\/\*)/;
foldMode.getFoldWidgetRange = function(session, foldStyle, row) {
	var line = session.getLine(row);
	var match = line.match(this.foldingStartMarker);
	if (match) {
		var i = match.index;

		if (match[1]) {
			var cell = session.$mode.getCellBounds(row);
			var start = { row: row, column: session.$mode.dl };
			var end = { row: cell.bodyEnd, column: session.getLine(cell.bodyEnd).length };
			var placeholder = session.getLine(cell.headerStart).slice(0, 10) + "=====================";
			range = Range.fromPoints(start, end);
			range.placeholder = placeholder;
			return range;
		}
		
		if (match[3]) {
			var range = session.getCommentFoldRange(row, i + match[0].length);
			range.end.column -= 2;
			return range;
		}

		var start = { row: row, column: i + 1 };
		var end = session.$findClosingBracket(match[2], start);
		if (!end)
			return;

		var fw = session.foldWidgets[end.row];
		if (fw == null)
			fw = this.getFoldWidget(session, end.row);

		if (fw == "start") {
			end.row --;
			end.column = session.getLine(end.row).length;
		}
		return Range.fromPoints(start, end);
	}
};


dom.importCssString("\
\
.ace_cellHead{\
	background:rgba(120,50,100,0.1);\
	color: darkred;\
}\
.ace_filler{\
    position: absolute;\
    left: 0;\
    display: inline-block;\
	border-top: 1px solid gray;\
    width: 100%;\
}");

var commands = [{
    name: "newCell",
    bindKey: { win: "Shift-Return", mac: "Shift-Return" },
    exec: function(editor) {
        var session = editor.session;
        var c = editor.getCursorPosition();
        var end = session.insert(c, c.column == 0 ? "#>>" : "\n#>>");
        
        var addNewLine = (c.column != 0 || c.row == 0) 
            && c.column != session.getLine(c.row).length;

        if (addNewLine) {
            session.insert(end, "\n");
            editor.selection.setSelectionRange({ start: end, end: end });
        }
    }
}];

var JSMode = require("ace/mode/javascript").Mode;

var modes = {
	js: new JSMode()
};
var jsMode = modes.js;



var tk = {};
var delimiter = '#>>';
var dl = delimiter.length;
function testLang(lang, fullName) {
	lang = lang.toLowerCase();
	fullName = fullName.toLowerCase();
	var lastI = 0;
	for (var j = 0, ftLen = lang.length; j < ftLen; j++) {
		lastI = fullName.indexOf(lang[j], lastI);
		if (lastI === -1)
			return false; // doesn't match
		lastI++;
	}
	return true;
}
var states = {};
var $getState = function(state, lang, isHeader) {
    var g = lang + state + isHeader;
    return states[g] || (states[g] = { state: state, lang: lang, isHeader: isHeader });
};
tk.getLineTokens = function(line, startState) {
	var match, lang, isHeader = 0;
	if (typeof startState == 'object') {
		lang = startState.lang;
		isHeader = startState.isHeader || 0;
		startState = startState.state || "start";
	} else {
		lang = 'js';
	}

	if (line.substr(0, dl) == delimiter) {
		var index = dl;
		var type = !isHeader ? 'firstcell.' : '';
		var tok = [{ type: type + 'cellHead', value: delimiter }];
		if ((match = line.match(/lang\s*=\s*(\w+)\b/))) {
			lang = testLang(match[1], 'coffeeScript') ? 'coffee' : 'js';

			if (dl < match.index) {
				tok.push({ type: type, value: line.substring(dl, match.index) });
			}
			tok.push({ type: type + 'comment.doc', value: match[0] });
			index = match.index + match[0].length;
		}
		tok.push({ type: type, value: line.substr(index) });
		
		if (!isHeader) {
			tok.push({ type: 'filler', value: ' ' });
		}
		ans = {
			tokens: tok,
			state: $getState("start", lang, isHeader + 1)
		};
	}
	else {	
		var ans = (modes[lang] || jsMode).getTokenizer().getLineTokens(line, startState);
		ans.state = $getState(ans.state, lang);
	}
	return ans;
};

var Mode = function() {
    this.$tokenizer = tk;
	this.foldingRules = foldMode;
};
oop.inherits(Mode, TextMode);

(function() {
	this.delimiter = delimiter;
	this.dl = dl;
	this.getCellBounds = function(row, editor) {
		var lines = editor.session.doc.$lines;
		var cur = row;
		
		// go to header end if row is inside header
		var line = lines[row];
		while (line && line.substr(0, dl) == delimiter) {
			line = lines[++row];
		}
		if (!line)
			line = lines[--row];

		// read up to header
		var i = row;
		while (line != null) {
			if (line.substr(0, dl) == delimiter)
				break;
			line = lines[--i];
		}
		var minI = i + 1;
		
		// read header
		while (line != null) {
			if (line.substr(0, dl) != delimiter)
				break;
			line = lines[--i];
		}		
		var headerI = i + 1;
		// read rest of the body
		i = row + 1;
		line = lines[i];
		while (line != null) {
			if (line.substr(0, dl) == delimiter)
				break;
			line = lines[++i];
		}
		var maxI = i - 1;

		return {
			headerStart: headerI,
			headerEnd: minI - 1,
			bodyStart: minI,
			bodyEnd: maxI,
			cursor: cur
		};
	};
	
	this.getHeaderText = function(cell) {
		if (cell) {
			cell.headerText = cell.header.join('\n')
					.replace(/lang\s*=\s*(\w+)\b/g, '')
					.replace(delimiter, '', 'g')
					.trim();
			return cell;
		}	
	};
	
	this.getCurrentCell = function(editor) {
		var cursor = editor.getCursorPosition();
		var session = editor.session;
		
		var cell = this.getCellBounds(cursor.row, editor);
		cell.header = session.getLines(cell.headerStart, cell.headerEnd);
		cell.body = session.getLines(cell.bodyStart, cell.bodyEnd);
		cell.lang = session.getState(cell.headerStart).lang;
		
		this.getHeaderText(cell);

		return cell;			
	};
	
	this.setCellText = function(text, editor) {
		var cursor = editor.getCursorPosition();
		var session = editor.session;
		
		var cell = this.getCellBounds(cursor.row, editor);
		var end = session.getLine(cell.bodyEnd).length;
		
		if (cell.bodyStart > cell.bodyEnd) { // empty cell
			var range = new Range(cell.bodyEnd, end, cell.bodyEnd, end);
			text = '\n' + text;
		} else
			var range = new Range(cell.bodyStart, 0, cell.bodyEnd, end);
		
		session.replace(range, text);
		return text;
	};
	
	
    this.toggleCommentLines = function(state, doc, startRow, endRow) {
		(modes[state.lang] || jsMode).toggleCommentLines(state.state, doc, startRow, endRow);
    };

    this.getNextLineIndent = function(state, line, tab, lineEnd) {
        return (modes[state.lang] || jsMode).getNextLineIndent(state.state, line, tab, lineEnd);
    };

    this.checkOutdent = function(state, line, input) {
        return (modes[state.lang] || jsMode).checkOutdent(state.state, line, input);
    };

    this.autoOutdent = function(state, doc, row) {
        return (modes[state.lang] || jsMode).autoOutdent(state.state, doc, row);
    };
    
    this.createWorker = function(session) {
        return null;
    };
	
	this.transformAction = function(state, action, editor, session, param) {
        return (modes[state.lang] || jsMode).transformAction(state.state, action, editor, session, param);
    };

}).call(Mode.prototype);




exports.Mode = Mode;
exports.commands = commands;


});