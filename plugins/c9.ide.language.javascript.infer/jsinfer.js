/**
 * Inference-based code completion for the Cloud9
 *
 * @copyright 2013, Ajax.org B.V.
 */
define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "language", "language.complete"
    ];
    main.provides = [];
    return main;

    function main(options, imports, register) {
        var language = imports.language;
        
        language.registerLanguageHandler('plugins/c9.ide.language.javascript.infer/infer_jumptodef');
        language.registerLanguageHandler('plugins/c9.ide.language.javascript.infer/infer_completer');
        register(null, {});
    }

});
