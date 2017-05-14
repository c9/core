define("ace/requirejs/text!ace/snippets/drools.snippets",[],"\nsnippet rule\n	rule \"${1?:rule_name}\"\n	when\n		${2:// when...} \n	then\n		${3:// then...}\n	end\n\nsnippet query\n	query ${1?:query_name}\n		${2:// find} \n	end\n	\nsnippet declare\n	declare ${1?:type_name}\n		${2:// attributes} \n	end\n\n");

define("ace/snippets/drools",[], function(require, exports, module) {
"use strict";

exports.snippetText = require("../requirejs/text!./drools.snippets");
exports.scope = "drools";

});
