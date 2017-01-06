/**
 * Cloud9 Language Foundation
 *
 * @copyright 2013, Ajax.org B.V.
 */
define(function(require, exports, module) {
var snippetManager = require("ace/snippets").snippetManager;
var config = require("ace/config");

exports.init = function(worker) {
    var loadSnippetsForMode = function(mode) {
        var id = mode.$id;
        if (!snippetManager.files)
            snippetManager.files = {};
        loadSnippetFile(id);
        if (mode.modes)
            mode.modes.forEach(loadSnippetsForMode);
    };

    function loadSnippetFile(id) {
        if (!id || snippetManager.files[id])
            return;
        var snippetFilePath = id.replace(/\/modes?\//, /snippets/);
        snippetManager.files[id] = {};
        config.loadModule(snippetFilePath, function(m) {
            if (m) {
                snippetManager.files[id] = m;
                if (m.snippetText)
                    m.snippets = snippetManager.parseSnippetFile(m.snippetText);
                snippetManager.register(m.snippets, m.scope);
                if (m.includeScopes) {
                    snippetManager.snippetMap[m.scope].includeScopes = m.includeScopes;
                    m.includeScopes.forEach(function(x) {
                        loadSnippetFile("ace/mode/" + x);
                    });
                }
            }
        });
    }
    
    function sendSnippetsToWorker(e) {
        worker.emit("loadSnippets", { data: {
            language: e.scope,
            snippets: snippetManager.snippetNameMap[e.scope]
        }});
    }
    
    worker.on("changeMode", function(e) {
        loadSnippetsForMode(worker.$doc.$mode);
    });
    
    worker.on("terminate", function() {
        snippetManager.off("registerSnippets", sendSnippetsToWorker);
    });
    snippetManager.on("registerSnippets", sendSnippetsToWorker);
};

});
