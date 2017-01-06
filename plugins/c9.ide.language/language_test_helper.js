define(function(require, exports, module) {
    
    var baseLanguageHandler = require("plugins/c9.ide.language/base_handler");
    var handler = module.exports = Object.create(baseLanguageHandler);
    
    handler.handlesLanguage = function(language) {
        // Note that we don't really support jsx here,
        // but rather tolerate it using error recovery...
        return language === "javascript";
    };
    
    handler.complete = function(doc, ast, pos, options, callback) {
        var emitter = handler.getEmitter();
        console.log("Completion called for ", options.line);
        if (/\.$/.test(options.line)) {
            // Looks like a complete prediction for "currentIdentifier.", ignore!
            emitter.emit("complete_predict_called", { data: pos });
            return callback();
        }
        emitter.emit("complete_called", { data: pos });
        callback();
    };
});