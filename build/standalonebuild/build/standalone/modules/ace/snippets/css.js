define("ace/requirejs/text!ace/snippets/css.snippets",[],"snippet .\n	${1} {\n		${2}\n	}\nsnippet !\n	 !important");

define("ace/snippets/css",[], function(require, exports, module) {
"use strict";

exports.snippetText = require("../requirejs/text!./css.snippets");
exports.scope = "css";

});
