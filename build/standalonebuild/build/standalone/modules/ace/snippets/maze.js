define("ace/requirejs/text!ace/snippets/maze.snippets",[],"snippet >\ndescription assignment\nscope maze\n	-> ${1}= ${2}\n\nsnippet >\ndescription if\nscope maze\n	-> IF ${2:**} THEN %${3:L} ELSE %${4:R}\n");

define("ace/snippets/maze",[], function(require, exports, module) {
"use strict";

exports.snippetText = require("../requirejs/text!./maze.snippets");
exports.scope = "maze";

});
