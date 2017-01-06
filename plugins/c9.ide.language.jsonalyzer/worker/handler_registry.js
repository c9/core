define(function(require, exports, module) {

var assert = require("c9/assert");

module.exports.HandlerRegistry = function() {
    var handlers = [];
    var supportedLanguages = "";
    var supportedExtensions = "";
    
    return {
        registerHandler: function(handler, options) {
            options = options || {};
            var existing = handlers.filter(function(h) { return h.$source && handler.$source === h.$source; });
            if (existing.length || handlers.indexOf(handler) > -1)
                return;
            
            handler.sender = options.sender;
            if (handler.init)
                handler.init(options, function(err) {
                    if (err)
                        console.error("Error initializing " + handler.$source, err.stack || err);
                });
        
            var languages = handler.languages;
            var extensions = handler.extensions;
            handler.guidName = languages.join("");
            assert(languages && extensions, "Handlers must have a languages and extensions property");
            
            handler.supportedLanguages = "$.";
            handler.supportedExtensions = "$.";
            handlers.push(handler);
            languages.forEach(function(e) {
                supportedLanguages += (supportedLanguages ? "|^" : "^") + e;
                handler.supportedLanguages += "|^" + e + "$";
            });
            extensions.forEach(function(e) {
                supportedExtensions += (supportedExtensions ? "|^" : "^") + e + "$";
                handler.supportedExtensions += "|^" + e + "$";
            });
        },
        
        unregisterHandler: function(source) {
            handlers = handlers.filter(function(h) { return !(h.$source && source === h.$source); });
        },
        
        getHandlerFor: function(path, language) {
            var match = path && path.match(/\.([^/.]*)$/);
            var extension = match && match[1] || "";
            if (!extension.match(supportedExtensions) && !(language || "").match(supportedLanguages))
                return null;
            
            var results = handlers.filter(function(p) {
                if (p.disabled) return false;
                if (language && language.match(p.supportedLanguages)) return true;
                if (p.supportedExtensions && extension.match(p.supportedExtensions)) return true;
                if (p.supportedPaths && path && path.match(p.supportedPaths)) return true;
                return false;
            });
            
            // Defer ctags handler
            if (results.length > 1)
                results = results.filter(function(r) { return !r.isGeneric; });
            
            return results[0];
        },
        
        getAllHandlers: function() {
            return handlers;
        }
    
    };
};

});