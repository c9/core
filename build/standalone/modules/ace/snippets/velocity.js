define("ace/requirejs/text!ace/snippets/velocity.snippets",[],"# macro\nsnippet #macro\n	#macro ( ${1:macroName} ${2:\\$var1, [\\$var2, ...]} )\n		${3:## macro code}\n	#end\n# foreach\nsnippet #foreach\n	#foreach ( ${1:\\$item} in ${2:\\$collection} )\n		${3:## foreach code}\n	#end\n# if\nsnippet #if\n	#if ( ${1:true} )\n		${0}\n	#end\n# if ... else\nsnippet #ife\n	#if ( ${1:true} )\n		${2}\n	#else\n		${0}\n	#end\n#import\nsnippet #import\n	#import ( \"${1:path/to/velocity/format}\" )\n# set\nsnippet #set\n	#set ( $${1:var} = ${0} )\n");

define("ace/snippets/velocity",[], function(require, exports, module) {
"use strict";

exports.snippetText = require("../requirejs/text!./velocity.snippets");
exports.scope = "velocity";
exports.includeScopes = ["html", "javascript", "css"];

});
