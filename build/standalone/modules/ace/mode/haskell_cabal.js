define("ace/mode/haskell_cabal_highlight_rules",[], function(require, exports, module) {
"use strict";

var oop = require("../lib/oop");
var TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

var CabalHighlightRules = function() {
    this.$rules = {
        "start" : [
            {
                token : "comment",
                regex : "^\\s*--.*$"
            }, {
                token: ["keyword"],
                regex: /^(\s*\w.*?)(:(?:\s+|$))/
            }, {
                token : "constant.numeric", // float
                regex : /[\d_]+(?:(?:[\.\d_]*)?)/
            }, {
                token : "constant.language.boolean",
                regex : "(?:true|false|TRUE|FALSE|True|False|yes|no)\\b"
            }, {
                token : "markup.heading",
                regex : /^(\w.*)$/
            }
        ]};

};

oop.inherits(CabalHighlightRules, TextHighlightRules);

exports.CabalHighlightRules = CabalHighlightRules;
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

define("ace/mode/folding/haskell_cabal",[], function(require, exports, module) {
"use strict";

var oop = require("../../lib/oop");
var BaseFoldMode = require("./fold_mode").FoldMode;
var Range = require("../../range").Range;

var FoldMode = exports.FoldMode = function() {};
oop.inherits(FoldMode, BaseFoldMode);

(function() {
  this.isHeading = function (session,row) {
      var heading = "markup.heading";
      var token = session.getTokens(row)[0];
      return row==0 || (token && token.type.lastIndexOf(heading, 0) === 0);
  };

  this.getFoldWidget = function(session, foldStyle, row) {
      if (this.isHeading(session,row)){
        return "start";
      } else if (foldStyle === "markbeginend" && !(/^\s*$/.test(session.getLine(row)))){
        var maxRow = session.getLength();
        while (++row < maxRow) {
          if (!(/^\s*$/.test(session.getLine(row)))){
              break;
          }
        }
        if (row==maxRow || this.isHeading(session,row)){
          return "end";
        }
      }
      return "";
  };


  this.getFoldWidgetRange = function(session, foldStyle, row) {
      var line = session.getLine(row);
      var startColumn = line.length;
      var maxRow = session.getLength();
      var startRow = row;
      var endRow = row;
      if (this.isHeading(session,row)) {
          while (++row < maxRow) {
              if (this.isHeading(session,row)){
                row--;
                break;
              }
          }

          endRow = row;
          if (endRow > startRow) {
              while (endRow > startRow && /^\s*$/.test(session.getLine(endRow)))
                  endRow--;
          }

          if (endRow > startRow) {
              var endColumn = session.getLine(endRow).length;
              return new Range(startRow, startColumn, endRow, endColumn);
          }
      } else if (this.getFoldWidget(session, foldStyle, row)==="end"){
        var endRow = row;
        var endColumn = session.getLine(endRow).length;
        while (--row>=0){
          if (this.isHeading(session,row)){
            break;
          }
        }
        var line = session.getLine(row);
        var startColumn = line.length;
        return new Range(row, startColumn, endRow, endColumn);
      }
    };

}).call(FoldMode.prototype);

});

define("ace/mode/haskell_cabal",[], function(require, exports, module) {
"use strict";

var oop = require("../lib/oop");
var TextMode = require("./text").Mode;
var CabalHighlightRules = require("./haskell_cabal_highlight_rules").CabalHighlightRules;
var FoldMode = require("./folding/haskell_cabal").FoldMode;

var Mode = function() {
    this.HighlightRules = CabalHighlightRules;
    this.foldingRules = new FoldMode();
    this.$behaviour = this.$defaultBehaviour;
};
oop.inherits(Mode, TextMode);

(function() {
    this.lineCommentStart = "--";
    this.blockComment = null;
    this.$id = "ace/mode/haskell_cabal";
}).call(Mode.prototype);

exports.Mode = Mode;
});
