define(function(require, exports, module) {

var jsonalyzer = require("plugins/c9.ide.language.jsonalyzer/worker/jsonalyzer_worker");
var BaseHandler = require("plugins/c9.ide.language.jsonalyzer/worker/jsonalyzer_base_handler");
var ctagsUtil = require("plugins/c9.ide.language.jsonalyzer/worker/ctags/ctags_util");

var handler = module.exports = Object.create(BaseHandler);

handler.extensions = ["htm", "html"];
handler.languages = ["html"];
handler.maxCallInterval = handler.CALL_INTERVAL_BASIC;

var TAGS = [
    // General HTML
    { regex: /(?:^|\n)\s*<(xml|html)\b/g, kind: "package" },
    { regex: /(?:^|\n)\s*<(form|h1|body|head)\b/g, kind: "method", indent: 1 },
    
    // Angular
    { regex: /\sng-app=["']([A-Za-z0-9$_\.]+)/g, kind: "property", indent: 1 },
    { regex: /\sng-controller=["']([A-Za-z0-9$_\.]+)/g, kind: "property", indent: 1 },
    { regex: /\sng-repeat="[^\"]+ in ([^\"]+)/g, kind: "property2", indent: 1 },
    { regex: /\sng-repeat='[^\']+ in ([^\']+)/g, kind: "property2", indent: 1 },
    { regex: /\sng-click=["']([A-Za-z0-9$_\.]+)/g, kind: "property2", indent: 1 },
    { regex: /\sng-model=["']([A-Za-z0-9$_\.]+)/g, kind: "property2", indent: 1 },
    
    // Knockout
    { regex: /\sdata-bind="[^"]*\b(?:foreach|click|value|checked):\s*(?:\$root\.)?([A-Za-z0-9$_\.]+)/g, kind: "property2", indent: 1 },
    { regex: /\sdata-bind='[^']*\b(?:foreach|click|value|checked):\s*(?:\$root\.)?([A-Za-z0-9$_\.]+)/g, kind: "property2", indent: 1 },
];
var GUESS_FARGS = false;
var EXTRACT_DOCS = false;

handler.init = function(options, callback) {
    callback();
};

handler.analyzeCurrent = function(path, doc, ast, options, callback) {
    if (doc === "" || doc.length > jsonalyzer.getMaxFileSizeSupported())
        return callback(null, {});
    
    var results = {};
    TAGS.forEach(function(tag) {
        if (tag.kind === "import")
            return;
        ctagsUtil.findMatchingTags(path, doc, tag, GUESS_FARGS, EXTRACT_DOCS, results);
    });
    for (var id in results) {
        results[id].forEach(function(r) {
            r.noComplete = true;
        });
    }
    
    callback(null, { properties: results });
};

});
