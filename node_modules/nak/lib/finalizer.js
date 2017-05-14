var fs = require("fs"),
    mergesort = require("./mergesort"),
    isBinaryFile = require("isbinaryfile");

function readPath(options, path, size) {
  var text = null;
  if (options.onFilepathSearchFn && (text = options.onFilepathSearchFn(path)))
    return text;

  var fd = fs.openSync(path, "r");
  try {
    var binaryBuffer = new Buffer(512);
    var bytesRead = fs.readSync(fd, binaryBuffer, 0, 512);

    if (!isBinaryFile(binaryBuffer, bytesRead)) {
      var remainingBytes = size - bytesRead;
      if (remainingBytes > 0) {
        var textBuffer = new Buffer(size);
        binaryBuffer.copy(textBuffer, 0, 0, bytesRead);
        bytesRead += fs.readSync(fd, textBuffer, bytesRead, remainingBytes);
        text = textBuffer.toString("utf8", 0, bytesRead);
      }
      else {
        text = binaryBuffer.toString("utf8", 0, bytesRead);
      }
    }
    return text;
  } finally {
    fs.closeSync(fd);
  }
}


function Finalizer(fpath, options, allPaths, allStats, printCb, done) {
  var dirKeys = mergesort(Object.keys(allPaths)), parent = "", d, dLength;

  if (options.list || !options.query) {
    var results = "";
    var joinChar = options.list ? "\n" : ":\n";
    for (d = 0, dLength = dirKeys.length; d < dLength; d++) {
      parent = allPaths[dirKeys[d]];
      results += fpath + mergesort(parent).join(joinChar + fpath) + joinChar;
    }

    printCb(results);
  }
  else {
    var allFiles = [], originalQuery = options.query, originalQueryClean = options.queryClean;
    var ACKMATE = options.ackmate;

    for (d = 0, dLength = dirKeys.length; d < dLength; d++) {
      parent = allPaths[dirKeys[d]];
      allFiles = mergesort(parent);

      for (var i = 0, allFilesLength = allFiles.length; i < allFilesLength; i++) {
        var filepath = allFiles[i];
        var str = readPath(options, fpath + filepath, allStats[filepath].size);
        if (originalQueryClean.test(str)) {
          if (typeof options.replacement == "string") {
            var replacedContents = str.replace(originalQuery, options.replacement);
            // TODO: could we be better here?
            fs.writeFileSync(fpath + filepath, replacedContents);
          }
          
          var totalMatches = 0;
          var last = originalQuery.lastIndex = 0;
          var m, row = 0;
          var lines = "";
          var newLinePos = -1;
          var lastNewLinePos = 0;
          var matchLine;
          var strPos = [];
          
          while ((m = originalQuery.exec(str))) {
            last = m.index;
            if (newLinePos < last) {
              if (ACKMATE && strPos.length) {
                lines += row + ";" + strPos.join(",") + ":" + matchLine + "\n";
                strPos = [];
              }
                
              do {
                lastNewLinePos = str.indexOf("\n", newLinePos);
                row++;
                if (lastNewLinePos === -1)
                  lastNewLinePos = str.length;
                if (lastNewLinePos >= last) {
                  matchLine = str.substring(newLinePos, lastNewLinePos);
                  newLinePos = lastNewLinePos + 1;
                  break;
                }
                newLinePos = lastNewLinePos + 1;
              } while (true);
              
              if (!ACKMATE) {
                lines += "\t" + row + ": " + matchLine + "\n";
              }
            }
            if (ACKMATE) {
              strPos.push(last - lastNewLinePos + matchLine.length + " " + m[0].length);
            }
            
            totalMatches++;
            if (!m[0].length) {
              originalQuery.lastIndex = last += 1;
            }
          }
          if (ACKMATE && strPos.length) {
            lines += row + ";" + strPos.join(",") + ":" + matchLine + "\n";
            strPos = [];
          }
          
          printCb(ACKMATE
            ? ":" + fpath + filepath
            : fpath + filepath + ":", lines, totalMatches);
        }
      }
    }
    done();
  }
}

module.exports = Finalizer;
