define(function(require, exports, module) {
    "use strict";
    
    main.consumes = ["Plugin"];
    main.provides = ["threewaymerge"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        
        var Range = require("ace/range").Range;
        var diff = require("./diff");
        var dmplib = require("./diff_match_patch_amd");
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        
        /***** Methods *****/
        
        function merge(root, theirs, oursDocument) {
            var ours = oursDocument.getValue();
            var merged = diff3(theirs, root, ours);
            patchAce(ours, merged, oursDocument);
            return merged;
        }
        
        function patchAce(oldValue, newValue, doc, options) {
            if (typeof doc === "undefined") {
                doc = newValue;
                newValue = oldValue;
                oldValue = doc.getValue();
            }
            newValue = newValue.replace(/\r\n|\r|\n/g, doc.getNewLineCharacter());
            oldValue = oldValue.replace(/\r\n|\r|\n/g, doc.getNewLineCharacter());
            
            var dmp = new dmplib.diff_match_patch();
            if (options && options.method == "quick") {
                dmp.Diff_Timeout = 0.2;
            }
            var d = dmp.diff_main(oldValue, newValue, true);
        
            if (!d.length)
                return;
        
            var i = options && options.offset || 0;
            d.forEach(function(chunk) {
                var op = chunk[0];
                var text = chunk[1];
                
                if (op === 0) {
                    i += text.length;
                }
                else if (op === -1) {
                    doc.remove(Range.fromPoints(
                        doc.indexToPosition(i),
                        doc.indexToPosition(i + text.length)
                    ));
                }
                else if (op === 1) {
                    doc.insert(doc.indexToPosition(i), text);
                    i += text.length;
                }
            });
        }
        
        function diff3(a, o, b) {
            var mapping = linesToChars(a, o, b);
            function charsToLine(chars) {
                var text = [];
                for (var y = 0; y < chars.length; y++) {
                    text[y] = mapping.lineArray[chars.charCodeAt(y)];
                }
        
                return text.join("");
            }
        
            var merger = diff.diff3_merge(mapping.chars1, mapping.chars2, mapping.chars3, true);
        
            var lines = [];
            for (var i = 0; i < merger.length; i++) {
                var item = merger[i];
                if (item.ok) {
                    lines.push(charsToLine(item.ok.join("")));
                } else {
                    a = charsToLine(item.conflict.a);
                    o = charsToLine(item.conflict.o);
                    b = charsToLine(item.conflict.b);
        
                    var lineMerge = diff.diff3_merge(a, o, b, true);
                    if (lineMerge.length === 1 && lineMerge[0].ok) {
                        lines.push(lineMerge[0].ok.join(""));
                    }
                    else {
                        lines.push(
                            "<<<<<<<<< saved version\n",
                            a.replace(/\n?$/, "\n"),
                            "=========\n",
                            b.replace(/\n?$/, "\n"),
                            ">>>>>>>>> local version"
                        );
                        if (i !== merger.length - 1)
                             lines.push("\n");
                    }
                }
            }
        
            return lines.join("");
        }
        
        function linesToChars(text1, text2, text3) {
          var lineArray = [];  // e.g. lineArray[4] == 'Hello\n'
          var lineHash = {};   // e.g. lineHash['Hello\n'] == 4
        
          // '\x00' is a valid character, but various debuggers don't like it.
          // So we'll insert a junk entry to avoid generating a null character.
          lineArray[0] = '';
        
          /**
           * Split a text into an array of strings.  Reduce the texts to a string of
           * hashes where each Unicode character represents one line.
           * Modifies linearray and linehash through being a closure.
           * @param {string} text String to encode.
           * @return {string} Encoded string.
           * @private
           */
          function diff_linesToCharsMunge_(text) {
            var chars = '';
            // Walk the text, pulling out a substring for each line.
            // text.split('\n') would would temporarily double our memory footprint.
            // Modifying text would create many large strings to garbage collect.
            var lineStart = 0;
            var lineEnd = -1;
            // Keeping our own length variable is faster than looking it up.
            var lineArrayLength = lineArray.length;
            while (lineEnd < text.length - 1) {
              lineEnd = text.indexOf('\n', lineStart);
              if (lineEnd == -1) {
                lineEnd = text.length - 1;
              }
              var line = text.substring(lineStart, lineEnd + 1);
              lineStart = lineEnd + 1;
        
              if (lineHash.hasOwnProperty ? lineHash.hasOwnProperty(line) :
                  (lineHash[line] !== undefined)) {
                chars += String.fromCharCode(lineHash[line]);
              } else {
                chars += String.fromCharCode(lineArrayLength);
                lineHash[line] = lineArrayLength;
                lineArray[lineArrayLength++] = line;
              }
            }
            return chars;
          }
        
          var chars1 = diff_linesToCharsMunge_(text1);
          var chars2 = diff_linesToCharsMunge_(text2);
          var chars3 = diff_linesToCharsMunge_(text3);
          return { chars1: chars1, chars2: chars2, chars3: chars3, lineArray: lineArray };
        }
        
        /***** Register and define API *****/
        
        /**
         * 
         **/
        plugin.freezePublicAPI({
            /**
             * The data structure representing a diff is an array of tuples:
             * [[DIFF_DELETE, 'Hello'], [DIFF_INSERT, 'Goodbye'], [DIFF_EQUAL, ' world.']]
             * which means: delete 'Hello', add 'Goodbye' and keep ' world.'
             */
            DIFF_DELETE: dmplib.DIFF_DELETE,
            /**
             * The data structure representing a diff is an array of tuples:
             * [[DIFF_DELETE, 'Hello'], [DIFF_INSERT, 'Goodbye'], [DIFF_EQUAL, ' world.']]
             * which means: delete 'Hello', add 'Goodbye' and keep ' world.'
             */
            DIFF_INSERT: dmplib.DIFF_INSERT,
            /**
             * The data structure representing a diff is an array of tuples:
             * [[DIFF_DELETE, 'Hello'], [DIFF_INSERT, 'Goodbye'], [DIFF_EQUAL, ' world.']]
             * which means: delete 'Hello', add 'Goodbye' and keep ' world.'
             */
            DIFF_EQUAL: dmplib.DIFF_EQUAL,

            /**
             * Patch an ace document from old value to new value performing
              * only the required insertion/deletion operations
             */
            patchAce: patchAce,

            /**
             * Merges two versions of the same document and updates the ace
             * instance to represent the changes. If conflicts occur during the
             * merge, they are displayed as git merge conflicts.
             * @param {String}       root          The version that is on this machine.
             * @param {String}       theirs        The version of the remote machine.
             * @param {ace.Document} oursDocument  The ace document that represents the docment.
             * @returns {String} the merged version
             */
            merge: merge,
            
            /**
             * 
             */
            diff3: diff3,
            
            /**
             * Class containing the diff, match and patch methods.
             * @constructor
             */
            DiffMatchPatch: dmplib.diff_match_patch
        });
        
        register(null, {
            threewaymerge: plugin
        });
    }
});