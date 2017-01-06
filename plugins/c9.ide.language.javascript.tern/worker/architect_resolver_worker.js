
define(function(require, exports, module) {

var plugin = require("./architect_resolver_tern_plugin");
var worker = require("plugins/c9.ide.language.core/worker");
var util = require("plugins/c9.ide.language/worker_util");
var completeUtil = require("plugins/c9.ide.language/complete_util");
var baseLanguageHandler = require('plugins/c9.ide.language/base_handler');
var handler = module.exports = Object.create(baseLanguageHandler);

var ready;
var pluginNames;

worker.sender.emit("architectPlugins");
worker.sender.on("architectPluginsResult", function(e) {
    plugin.setArchitectPlugins(e.data);
    pluginNames = Object.keys(e.data).map(function(key) {
        return key.substr(1);
    });
    ready = true;
});

handler.handlesLanguage = function(language) {
    // Note that we don't really support jsx here,
    // but rather tolerate it using error recovery...
    return language === "javascript" || language === "jsx";
};

handler.onceReady = function(callback) {
    if (ready)
        return callback();
    
    worker.sender.once("architectPluginsResult", function() {
        setTimeout(callback);
    });
};

handler.complete = function(doc, fullAst, pos, options, callback) {
    // We're string in '_ = [...string...]'
    var node = options.node;
    if (!ready
        || !node
        || node.cons !== "String"
        || !node.parent
        || !node.parent.parent
        || node.parent.parent.cons !== "Array"
        || !node.parent.parent.parent
        || node.parent.parent.parent.cons !== "Assign"
        )
        return callback();
    
    var lhs = node.parent.parent.parent[0];
    if (lhs.cons !== "PropAccess"
        || lhs[1].value !== "consumes")
        return callback();
    
    var line = doc.getLine(pos.row);
    var id = util.getPrecedingIdentifier(line, pos.column);
    var completions = completeUtil.findCompletions(id, pluginNames);

    callback(completions.map(function(c) {
        return {
            name: c,
            icon: "package",
            identifierRegex: /[a-zA-Z_0-9\$\/\.]/,
            replaceText: c,
            priority: 5
        };
    }));
};

});