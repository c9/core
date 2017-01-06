define(function(require, exports, module) {
  "use strict";

  var Range = require("ace/range").Range;

  var JSResolver = function(value, ast) {
    this.addResolutions = function(markers) {
      var _self = this;
      markers.forEach(function(curMarker) {
        curMarker.resolutions = _self.getResolutions(curMarker);
      });
    };
    
    this.getResolutions = function(marker) {
      var type = this.getType(marker);
      if (type) {
        if (typeof this[type] === 'function') {
          return this[type](marker);
        }
      }
      return [];
    }; 

    this.getType = function(marker) {
        var msg = marker.message;
        if (msg.indexOf("Missing semicolon") !== -1) {
            return "missingSemicolon";
        }
        else if (msg.indexOf("Unnecessary semicolon") !== -1) {
            return "unnecessarySemicolon";
        }
    }; 
    
    this.missingSemicolon = function(marker) {
        var message = "Add semicolon";
        var image = "";
        var row = marker.pos.sl;
        var column = marker.pos.sc;
        
        var lines = value.split("\n");
        var before = lines[row].substring(0, column);
        var after = lines[row].substring(column);
        var preview = "<b>Add semicolon</b><p>" + before + "<b>; </b>" + after + "</p>";
        
        var insert = ";";
        if (after.length) {
            insert += " ";
        }

        var delta = {
            action: "insert",
            range: new Range(row, column, row, column + insert.length),
            text: insert
        };
        
        return [{
            message: message,
            image: image,
            previewHtml: preview,
            deltas: [delta]
        }];
    };
    
    this.unnecessarySemicolon = function(marker) {
        var message = "Remove semicolon";
        var image = "";
        var row = marker.pos.sl;
        var column = marker.pos.sc;
        
        var lines = value.split("\n");
        var before = lines[row].substring(0, column);
        var after = lines[row].substring(column + 1);
        var preview = "<b>Remove semicolon</b><p>" + before + "<del>;</del>" + after + "</p>";

        var delta = {
            action: "removeText",
            range: new Range(row, column, row, column + 1)
        };
        
        return [{
            message: message,
            image: image,
            preview: preview,
            deltas: [delta]
        }];
    };

  };

  exports.JSResolver = JSResolver;

});
