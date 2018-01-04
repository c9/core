define("ace/requirejs/text!ace/snippets/html.snippets",[],"# Some useful Unicode entities\n# Non-Breaking Space\nsnippet nbs\n	&nbsp;\n# ←\nsnippet left\n	&#x2190;\n# →\nsnippet right\n	&#x2192;\n# ↑\nsnippet up\n	&#x2191;\n# ↓\nsnippet down\n	&#x2193;\n# ↩\nsnippet return\n	&#x21A9;\n# ⇤\nsnippet backtab\n	&#x21E4;\n# ⇥\nsnippet tab\n	&#x21E5;\n# ⇧\nsnippet shift\n	&#x21E7;\n# ⌃\nsnippet ctrl\n	&#x2303;\n# ⌅\nsnippet enter\n	&#x2305;\n# ⌘\nsnippet cmd\n	&#x2318;\n# ⌥\nsnippet option\n	&#x2325;\n# ⌦\nsnippet delete\n	&#x2326;\n# ⌫\nsnippet backspace\n	&#x232B;\n# ⎋\nsnippet esc\n	&#x238B;\n");

define("ace/snippets/html",[], function(require, exports, module) {
"use strict";

exports.snippetText = require("../requirejs/text!./html.snippets");
exports.scope = "html";

});
