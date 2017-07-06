/**
 * Cloud9 Language Foundation
 *
 * @copyright 2013, Ajax.org B.V.
 */
define(function(require, exports, module) {
    main.consumes = ["language", "tabManager"];
    main.provides = [];
    return main;

    function main(options, imports, register) {
        var language = imports.language;
        var tabs = imports.tabManager;
        var completeUtil = require("plugins/c9.ide.language/complete_util");
    
        language.registerLanguageHandler('plugins/c9.ide.language.javascript.immediate/immediate_complete');
        language.registerLanguageHandler('plugins/c9.ide.language.javascript.immediate/immediate_complete_static');
        
        language.once("initWorker", function(e) {
            var worker = e.worker;
            worker.on("js_immediate_complete", function(e) {
                onImmediateComplete(e.data.immediateWindow, e.data.expr, function(results) {
                    worker.emit("js_immediate_complete_results", { data: { results: results, id: e.data.id }});
                });
            });
        });
    
        function onImmediateComplete(immediateWindow, expr, callback) {
            var tab = tabs.findTab(immediateWindow);
            if (!tab || !tab.editor || !tab.editor.ace || !tab.editor.ace.getSession())
                return callback();
            
            var ace = tab.editor.ace;
            var evaluator = ace.getSession().repl.evaluator;
            var isNodeJS = tab.editor.getActiveEvaluator() === "debugger";
            
            var propMatch = expr.match(/(.*)\.([A-Za-z0-9*$_]*)$/);
            var context;
            var id;
            if (propMatch) {
                context = propMatch[1];
                id = propMatch[2];
            }
            else {
                context = isNodeJS ? -1 : "window";
                id = expr.match(/[A-Za-z0-9*$_]*$/)[0] || "";
            }
            
            evaluator.getAllProperties(context, function(err, results) {
                if (err || !results || !results.length) // error
                    return callback();
                
                results = results.slice(); // make into real array
                results = completeUtil.findCompletions(id, results);
                callback(results.map(function(m) {
                    return {
                      name: m,
                      replaceText: m,
                      icon: "property",
                      meta: "",
                      priority: m.match(/^_/) ? 1 : 2
                    };
                }));
            });
        }
        
        register(null, {});
    }
});