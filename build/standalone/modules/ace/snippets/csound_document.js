define("ace/requirejs/text!ace/snippets/csound_document.snippets",[],"# <CsoundSynthesizer>\nsnippet synth\n	<CsoundSynthesizer>\n	<CsInstruments>\n	${1}\n	</CsInstruments>\n	<CsScore>\n	e\n	</CsScore>\n	</CsoundSynthesizer>\n");

define("ace/snippets/csound_document",[], function(require, exports, module) {
"use strict";

exports.snippetText = require("../requirejs/text!./csound_document.snippets");
exports.scope = "csound_document";

});
