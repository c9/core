define("ace/requirejs/text!ace/snippets/snippets.snippets",[],"# snippets for making snippets :)\nsnippet snip\n	snippet ${1:trigger}\n		${2}\nsnippet msnip\n	snippet ${1:trigger} ${2:description}\n		${3}\nsnippet v\n	{VISUAL}\n");

define("ace/snippets/snippets",[], function(require, exports, module) {
"use strict";

exports.snippetText = require("../requirejs/text!./snippets.snippets");
exports.scope = "snippets";

});
