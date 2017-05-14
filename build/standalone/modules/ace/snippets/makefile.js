define("ace/requirejs/text!ace/snippets/makefile.snippets",[],"snippet ifeq\n	ifeq (${1:cond0},${2:cond1})\n		${3:code}\n	endif\n");

define("ace/snippets/makefile",[], function(require, exports, module) {
"use strict";

exports.snippetText = require("../requirejs/text!./makefile.snippets");
exports.scope = "makefile";

});
