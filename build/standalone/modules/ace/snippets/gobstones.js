define("ace/requirejs/text!ace/snippets/gobstones.snippets",[],"# Procedure\nsnippet proc\n	procedure ${1?:name}(${2:argument}) {\n		${3:// body...}\n	}\n\n# Function\nsnippet fun\n	function ${1?:name}(${2:argument}) {\n		return ${3:// body...}\n	}\n\n# Repeat\nsnippet rep\n	repeat ${1?:times} {\n		${2:// body...}\n	}\n\n# For\nsnippet for\n	foreach ${1?:e} in ${2?:list} {\n		${3:// body...}	\n	}\n\n# If\nsnippet if\n	if (${1?:condition}) {\n		${3:// body...}	\n	}\n\n# While\n  while (${1?:condition}) {\n    ${2:// body...}	\n  }\n");

define("ace/snippets/gobstones",[], function(require, exports, module) {
"use strict";

exports.snippetText = require("../requirejs/text!./gobstones.snippets");
exports.scope = "gobstones";

});
