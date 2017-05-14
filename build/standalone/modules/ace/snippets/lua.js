define("ace/requirejs/text!ace/snippets/lua.snippets",[],"snippet #!\n	#!/usr/bin/env lua\n	$1\nsnippet local\n	local ${1:x} = ${2:1}\nsnippet fun\n	function ${1:fname}(${2:...})\n		${3:-- body}\n	end\nsnippet for\n	for ${1:i}=${2:1},${3:10} do\n		${4:print(i)}\n	end\nsnippet forp\n	for ${1:i},${2:v} in pairs(${3:table_name}) do\n	   ${4:-- body}\n	end\nsnippet fori\n	for ${1:i},${2:v} in ipairs(${3:table_name}) do\n	   ${4:-- body}\n	end\n");

define("ace/snippets/lua",[], function(require, exports, module) {
"use strict";

exports.snippetText = require("../requirejs/text!./lua.snippets");
exports.scope = "lua";

});
