define("ace/mode/jssm_highlight_rules",[], function(require, exports, module) {
"use strict";

var oop = require("../lib/oop");
var TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

var JSSMHighlightRules = function() {
    this.$rules = {
        start: [{
            token: "punctuation.definition.comment.mn",
            regex: /\/\*/,
            push: [{
                token: "punctuation.definition.comment.mn",
                regex: /\*\//,
                next: "pop"
            }, {
                defaultToken: "comment.block.jssm"
            }],
            comment: "block comment"
        }, {
            token: "comment.line.jssm",
            regex: /\/\//,
            push: [{
                token: "comment.line.jssm",
                regex: /$/,
                next: "pop"
            }, {
                defaultToken: "comment.line.jssm"
            }],
            comment: "block comment"
        }, {
            token: "entity.name.function",
            regex: /\${/,
            push: [{
                token: "entity.name.function",
                regex: /}/,
                next: "pop"
            }, {
                defaultToken: "keyword.other"
            }],
            comment: "js outcalls"
        }, {
            token: "constant.numeric",
            regex: /[0-9]*\.[0-9]*\.[0-9]*/,
            comment: "semver"
        }, {
            token: "constant.language.jssmLanguage",
            regex: /graph_layout\s*:/,
            comment: "jssm language tokens"
        }, {
            token: "constant.language.jssmLanguage",
            regex: /machine_name\s*:/,
            comment: "jssm language tokens"
        }, {
            token: "constant.language.jssmLanguage",
            regex: /machine_version\s*:/,
            comment: "jssm language tokens"
        }, {
            token: "constant.language.jssmLanguage",
            regex: /jssm_version\s*:/,
            comment: "jssm language tokens"
        }, {
            token: "keyword.control.transition.jssmArrow.legal_legal",
            regex: /<->/,
            comment: "transitions"
        }, {
            token: "keyword.control.transition.jssmArrow.legal_none",
            regex: /<-/,
            comment: "transitions"
        }, {
            token: "keyword.control.transition.jssmArrow.none_legal",
            regex: /->/,
            comment: "transitions"
        }, {
            token: "keyword.control.transition.jssmArrow.main_main",
            regex: /<=>/,
            comment: "transitions"
        }, {
            token: "keyword.control.transition.jssmArrow.none_main",
            regex: /=>/,
            comment: "transitions"
        }, {
            token: "keyword.control.transition.jssmArrow.main_none",
            regex: /<=/,
            comment: "transitions"
        }, {
            token: "keyword.control.transition.jssmArrow.forced_forced",
            regex: /<~>/,
            comment: "transitions"
        }, {
            token: "keyword.control.transition.jssmArrow.none_forced",
            regex: /~>/,
            comment: "transitions"
        }, {
            token: "keyword.control.transition.jssmArrow.forced_none",
            regex: /<~/,
            comment: "transitions"
        }, {
            token: "keyword.control.transition.jssmArrow.legal_main",
            regex: /<-=>/,
            comment: "transitions"
        }, {
            token: "keyword.control.transition.jssmArrow.main_legal",
            regex: /<=->/,
            comment: "transitions"
        }, {
            token: "keyword.control.transition.jssmArrow.legal_forced",
            regex: /<-~>/,
            comment: "transitions"
        }, {
            token: "keyword.control.transition.jssmArrow.forced_legal",
            regex: /<~->/,
            comment: "transitions"
        }, {
            token: "keyword.control.transition.jssmArrow.main_forced",
            regex: /<=~>/,
            comment: "transitions"
        }, {
            token: "keyword.control.transition.jssmArrow.forced_main",
            regex: /<~=>/,
            comment: "transitions"
        }, {
            token: "constant.numeric.jssmProbability",
            regex: /[0-9]+%/,
            comment: "edge probability annotation"
        }, {
            token: "constant.character.jssmAction",
            regex: /\'[^']*\'/,
            comment: "action annotation"
        }, {
            token: "entity.name.tag.jssmLabel.doublequoted",
            regex: /\"[^"]*\"/,
            comment: "jssm label annotation"
        }, {
            token: "entity.name.tag.jssmLabel.atom",
            regex: /[a-zA-Z0-9_.+&()#@!?,]/,
            comment: "jssm label annotation"
        }]
    };
    
    this.normalizeRules();
};

JSSMHighlightRules.metaData = {
    fileTypes: ["jssm", "jssm_state"],
    name: "JSSM",
    scopeName: "source.jssm"
};


oop.inherits(JSSMHighlightRules, TextHighlightRules);

exports.JSSMHighlightRules = JSSMHighlightRules;
});

define("ace/mode/folding/fold_mode",[], function(require, exports, module) {
"use strict";

var Range = require("../../range").Range;

var FoldMode = exports.FoldMode = function() {};

(function() {

    this.foldingStartMarker = null;
    this.foldingStopMarker = null;
    this.getFoldWidget = function(session, foldStyle, row) {
        var line = session.getLine(row);
        if (this.foldingStartMarker.test(line))
            return "start";
        if (foldStyle == "markbeginend"
                && this.foldingStopMarker
                && this.foldingStopMarker.test(line))
            return "end";
        return "";
    };

    this.getFoldWidgetRange = function(session, foldStyle, row) {
        return null;
    };

    this.indentationBlock = function(session, row, column) {
        var re = /\S/;
        var line = session.getLine(row);
        var startLevel = line.search(re);
        if (startLevel == -1)
            return;

        var startColumn = column || line.length;
        var maxRow = session.getLength();
        var startRow = row;
        var endRow = row;

        while (++row < maxRow) {
            var level = session.getLine(row).search(re);

            if (level == -1)
                continue;

            if (level <= startLevel)
                break;

            endRow = row;
        }

        if (endRow > startRow) {
            var endColumn = session.getLine(endRow).length;
            return new Range(startRow, startColumn, endRow, endColumn);
        }
    };

    this.openingBracketBlock = function(session, bracket, row, column, typeRe) {
        var start = {row: row, column: column + 1};
        var end = session.$findClosingBracket(bracket, start, typeRe);
        if (!end)
            return;

        var fw = session.foldWidgets[end.row];
        if (fw == null)
            fw = session.getFoldWidget(end.row);

        if (fw == "start" && end.row > start.row) {
            end.row --;
            end.column = session.getLine(end.row).length;
        }
        return Range.fromPoints(start, end);
    };

    this.closingBracketBlock = function(session, bracket, row, column, typeRe) {
        var end = {row: row, column: column};
        var start = session.$findOpeningBracket(bracket, end);

        if (!start)
            return;

        start.column++;
        end.column--;

        return  Range.fromPoints(start, end);
    };
}).call(FoldMode.prototype);

});

define("ace/mode/folding/cstyle",[], function(require, exports, module) {
"use strict";

var oop = require("../../lib/oop");
var Range = require("../../range").Range;
var BaseFoldMode = require("./fold_mode").FoldMode;

var FoldMode = exports.FoldMode = function(commentRegex) {
    if (commentRegex) {
        this.foldingStartMarker = new RegExp(
            this.foldingStartMarker.source.replace(/\|[^|]*?$/, "|" + commentRegex.start)
        );
        this.foldingStopMarker = new RegExp(
            this.foldingStopMarker.source.replace(/\|[^|]*?$/, "|" + commentRegex.end)
        );
    }
};
oop.inherits(FoldMode, BaseFoldMode);

(function() {
    
    this.foldingStartMarker = /([\{\[\(])[^\}\]\)]*$|^\s*(\/\*)/;
    this.foldingStopMarker = /^[^\[\{\(]*([\}\]\)])|^[\s\*]*(\*\/)/;
    this.singleLineBlockCommentRe= /^\s*(\/\*).*\*\/\s*$/;
    this.tripleStarBlockCommentRe = /^\s*(\/\*\*\*).*\*\/\s*$/;
    this.startRegionRe = /^\s*(\/\*|\/\/)#?region\b/;
    this._getFoldWidgetBase = this.getFoldWidget;
    this.getFoldWidget = function(session, foldStyle, row) {
        var line = session.getLine(row);
    
        if (this.singleLineBlockCommentRe.test(line)) {
            if (!this.startRegionRe.test(line) && !this.tripleStarBlockCommentRe.test(line))
                return "";
        }
    
        var fw = this._getFoldWidgetBase(session, foldStyle, row);
    
        if (!fw && this.startRegionRe.test(line))
            return "start"; // lineCommentRegionStart
    
        return fw;
    };

    this.getFoldWidgetRange = function(session, foldStyle, row, forceMultiline) {
        var line = session.getLine(row);
        
        if (this.startRegionRe.test(line))
            return this.getCommentRegionBlock(session, line, row);
        
        var match = line.match(this.foldingStartMarker);
        if (match) {
            var i = match.index;

            if (match[1])
                return this.openingBracketBlock(session, match[1], row, i);
                
            var range = session.getCommentFoldRange(row, i + match[0].length, 1);
            
            if (range && !range.isMultiLine()) {
                if (forceMultiline) {
                    range = this.getSectionRange(session, row);
                } else if (foldStyle != "all")
                    range = null;
            }
            
            return range;
        }

        if (foldStyle === "markbegin")
            return;

        var match = line.match(this.foldingStopMarker);
        if (match) {
            var i = match.index + match[0].length;

            if (match[1])
                return this.closingBracketBlock(session, match[1], row, i);

            return session.getCommentFoldRange(row, i, -1);
        }
    };
    
    this.getSectionRange = function(session, row) {
        var line = session.getLine(row);
        var startIndent = line.search(/\S/);
        var startRow = row;
        var startColumn = line.length;
        row = row + 1;
        var endRow = row;
        var maxRow = session.getLength();
        while (++row < maxRow) {
            line = session.getLine(row);
            var indent = line.search(/\S/);
            if (indent === -1)
                continue;
            if  (startIndent > indent)
                break;
            var subRange = this.getFoldWidgetRange(session, "all", row);
            
            if (subRange) {
                if (subRange.start.row <= startRow) {
                    break;
                } else if (subRange.isMultiLine()) {
                    row = subRange.end.row;
                } else if (startIndent == indent) {
                    break;
                }
            }
            endRow = row;
        }
        
        return new Range(startRow, startColumn, endRow, session.getLine(endRow).length);
    };
    this.getCommentRegionBlock = function(session, line, row) {
        var startColumn = line.search(/\s*$/);
        var maxRow = session.getLength();
        var startRow = row;
        
        var re = /^\s*(?:\/\*|\/\/|--)#?(end)?region\b/;
        var depth = 1;
        while (++row < maxRow) {
            line = session.getLine(row);
            var m = re.exec(line);
            if (!m) continue;
            if (m[1]) depth--;
            else depth++;

            if (!depth) break;
        }

        var endRow = row;
        if (endRow > startRow) {
            return new Range(startRow, startColumn, endRow, line.length);
        }
    };

}).call(FoldMode.prototype);

});

define("ace/mode/jssm",[], function(require, exports, module) {
"use strict";

var oop = require("../lib/oop");
var TextMode = require("./text").Mode;
var JSSMHighlightRules = require("./jssm_highlight_rules").JSSMHighlightRules;
var FoldMode = require("./folding/cstyle").FoldMode;

var Mode = function() {
    this.HighlightRules = JSSMHighlightRules;
    this.foldingRules = new FoldMode();
};
oop.inherits(Mode, TextMode);

(function() {
    this.lineCommentStart = "//";
    this.blockComment = {start: "/*", end: "*/"};
    this.$id = "ace/mode/jssm";
}).call(Mode.prototype);

exports.Mode = Mode;
});
