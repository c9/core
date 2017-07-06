/**
 * Code completion for the Cloud9
 *
 * @copyright 2013, Ajax.org B.V.
 */
define(function(require, exports, module) {
    main.consumes = ["language"];
    main.provides = [];
    return main;

    function main(options, imports, register) {
        var language = imports.language;
        var snippets = require("./snippet_loader");

        language.registerLanguageHandler('plugins/c9.ide.language.generic/local_completer');
        language.registerLanguageHandler('plugins/c9.ide.language.generic/snippet_completer');
        if (options.mode_completer)
            language.registerLanguageHandler("plugins/c9.ide.language.generic/mode_completer");
        language.registerLanguageHandler('plugins/c9.ide.language.generic/open_files_local_completer');
        language.registerLanguageHandler('plugins/c9.ide.language.generic/simple/shell');
        language.registerLanguageHandler('plugins/c9.ide.language.generic/simple/make');

        language.once("initWorker", function(e) {
            snippets.init(e.worker);
        });
        
        register(null, {});
    }
});