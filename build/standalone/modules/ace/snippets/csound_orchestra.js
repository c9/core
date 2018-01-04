define("ace/requirejs/text!ace/snippets/csound_orchestra.snippets",[],"# else\nsnippet else\n	else\n		${1:/* statements */}\n# elseif\nsnippet elseif\n	elseif ${1:/* condition */} then\n		${2:/* statements */}\n# if\nsnippet if\n	if ${1:/* condition */} then\n		${2:/* statements */}\n	endif\n# instrument block\nsnippet instr\n	instr ${1:name}\n		${2:/* statements */}\n	endin\n# i-time while loop\nsnippet iwhile\n	i${1:Index} = ${2:0}\n	while i${1:Index} < ${3:/* count */} do\n		${4:/* statements */}\n		i${1:Index} += 1\n	od\n# k-rate while loop\nsnippet kwhile\n	k${1:Index} = ${2:0}\n	while k${1:Index} < ${3:/* count */} do\n		${4:/* statements */}\n		k${1:Index} += 1\n	od\n# opcode\nsnippet opcode\n	opcode ${1:name}, ${2:/* output types */ 0}, ${3:/* input types */ 0}\n		${4:/* statements */}\n	endop\n# until loop\nsnippet until\n	until ${1:/* condition */} do\n		${2:/* statements */}\n	od\n# while loop\nsnippet while\n	while ${1:/* condition */} do\n		${2:/* statements */}\n	od\n");

define("ace/snippets/csound_orchestra",[], function(require, exports, module) {
"use strict";

exports.snippetText = require("../requirejs/text!./csound_orchestra.snippets");
exports.scope = "csound_orchestra";

});
