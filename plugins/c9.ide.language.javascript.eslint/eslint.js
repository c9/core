/**
 * Cloud9 Language Foundation
 *
 * @copyright 2013, Ajax.org B.V.
 */
define(function(require, exports, module) {
    main.consumes = ["language"];
    main.provides = [];
    return main;

    function main(options, imports, register) {
        var language = imports.language;

        language.registerLanguageHandler("plugins/c9.ide.language.javascript.eslint/worker/eslint_worker");
        
        register(null, {});
    }
});
