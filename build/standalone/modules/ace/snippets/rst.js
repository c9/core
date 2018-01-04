define("ace/requirejs/text!ace/snippets/rst.snippets",[],"# rst\n\nsnippet :\n	:${1:field name}: ${2:field body}\nsnippet *\n	*${1:Emphasis}*\nsnippet **\n	**${1:Strong emphasis}**\nsnippet _\n	\\`${1:hyperlink-name}\\`_\n	.. _\\`$1\\`: ${2:link-block}\nsnippet =\n	${1:Title}\n	=====${2:=}\n	${3}\nsnippet -\n	${1:Title}\n	-----${2:-}\n	${3}\nsnippet cont:\n	.. contents::\n	\n");

define("ace/snippets/rst",[], function(require, exports, module) {
"use strict";

exports.snippetText = require("../requirejs/text!./rst.snippets");
exports.scope = "rst";

});
