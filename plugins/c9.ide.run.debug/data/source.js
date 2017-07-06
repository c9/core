/**
 * Source class for the Cloud9 Debugger.
 * @class debugger.Source
 * @extends debugger.Data
 */
/**
 * @property {"source"} tagName  The tag name used for xml serialization of this object.
 * @readonly
 */
/**
 * @property {String} id  The unique identifier of this source file.
 */
/**
 * @property {String} name  The name of this source file.
 */
/**
 * @property {String} path  The path (if any) of this source file.
 */
/**
 * @property {String} text  The textual contents of this source file.
 */
/**
 * @property {String} lineOffset  The line offset of the source file.
 */
/**
 * @property {String} debug  Whether this source file only exists in the memory of the runtime.
 */
define(function(require, exports, module) {
    
    var Data = require("./data");
    
    function Source(options) {
        this.data = options || {};
        this.tagName = "source";
    }
    
    Source.prototype = new Data([
        "id", "name", "path", "text", "lineOffset", "debug", "customSyntax"
    ]);
        
    Source.prototype.equals = function(source) {
        if (!source) return false;
        return this.data.ref == source.ref;
    };
    
    module.exports = Source;
    
});