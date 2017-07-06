/**
 * Architect module resolver for Cloud9 source code,
 * using runtime information from the running Cloud9.
 * It's not perfect but it's simple, avoids scanning all modules,
 * and doesn't need any configuration. A full resolver
 * requires significant server-side analysis and infrastructure
 * work.
 * @ignore
 */
define(function(require, exports, module) {
    "use strict";

    main.consumes = [
        "Plugin", "language"
    ];
    main.provides = ["language.tern.architect_resolver"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var language = imports.language;
        var assert = require("c9/assert");
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            assert(window.plugins && window.plugins.length > 10, "Architect plugins must be in window.plugins");
            
            var knownPlugins = {};
            window.plugins.forEach(function(plugin) {
                if (!plugin || !plugin.provides)
                    return;
                plugin.provides.forEach(function(provide) {
                    knownPlugins["_" + provide] = plugin.packagePath;
                });
            });
            
            language.getWorker(function(err, worker) {
                if (err) return console.error(err);
                
                worker.on("architectPlugins", function() {
                    worker.emit("architectPluginsResult", { data: knownPlugins });
                });
            });

            language.registerLanguageHandler("plugins/c9.ide.language.javascript.tern/worker/architect_resolver_worker");
        }
        
        plugin.on("load", function() {
            load();
        });

        plugin.freezePublicAPI({});
        
        register(null, { "language.tern.architect_resolver": plugin });
    }
});