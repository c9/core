/**
 * Breakpoint class for the Cloud9 Debugger.
 * @class debugger.Breakpoint
 * @extends debugger.Data
 */
/**
 * @property {"breakpoint"} tagName  The tag name used for xml serialization of this object.
 * @readonly
 */
/**
 * @property {String} id  The unique identifier for the breakpoint.
 */
/**
 * @property {String} path  The path of the file where this breakpoint is set.
 */
/**
 * @property {String} text  The caption of this breakpoint in the breakpoint UI.
 */
/**
 * @property {Number} line  The line where this breakpoint is set.
 */
/**
 * @property {Number} column  The column where this breakpoint is set.
 */
/**
 * @property {Boolean} serverOnly  Retrieves or sets whether this breakpoint is only known to the server.
 */
/**
 * @property {Object} actual  Contains information on the actual position of the breakpoint, rather than the position that the user has set the breakpoint on.
 */
/**
 * @property {String} content  The contents of the line of the file where this breakpoint is set.
 */
/**
 * @property {String} enabled  Retrieves or sets whether this breakpoint is enabled.
 */
/**
 * @property {Object} sourcemap       Specifies the location of the breakpoint in a source map.
 * @property {Number} sourcemap.line  The line where this breakpoint is set in the source file.
 * @property {String} sourcemap.path  The path of the source file where this breakpoint is set.
 */
/**
 * @property {String} condition  Retrieves or sets the conditional expression that determines when this breakpoint will break.
 */
define(function(require, exports, module) {
    
    var Data = require("./data");
    
    //var location = bp.script_name + "|" + bp.line + ":" + (bp.column || 0);
    function Breakpoint(options) {
        this.data = options || {};
        this.tagName = "breakpoint";
    }
    
    Breakpoint.prototype = new Data([
        "id", "path", "text", "line", "column", "serverOnly", "actual",
        "content", "enabled", "sourcemap", "condition", "hidden", "invalid",
        "moved"
    ]);
        
    Breakpoint.prototype.equals = function(breakpoint, ignoreInvalid) {
        if (!breakpoint) return false;
        
        if (this.data.id && this.data.id === breakpoint.id) 
            return true;
        
        var matchLine = breakpoint.line !== undefined;
        
        var left = {};
        left[this.data.path + ":" + (matchLine 
            ? (!isNaN(this.data.moved) ? this.data.moved : this.data.line) : "")] = true;
        
        if (this.data.sourcemap)
            left[this.data.sourcemap.source + ":" + (matchLine 
                ? (!isNaN(this.data.moved) ? this.data.moved : this.data.sourcemap.line) : "")] = true;
            
        if (this.data.actual && (!this.data.invalid || !ignoreInvalid))
            left[this.data.path + ":" 
                + (matchLine ? (!isNaN(this.data.moved) ? this.data.moved : this.data.actual.line) : "")] = true;
        
        if (left[breakpoint.path + ":" + (matchLine 
          ? (!isNaN(breakpoint.moved) ? breakpoint.moved : breakpoint.line) : "")])
            return true;
            
        var sm = breakpoint.sourcemap;
        if (sm && left[sm.source + ":" + (matchLine 
          ? (!isNaN(breakpoint.moved) ? breakpoint.moved : sm.line) : "")])
            return true;
            
        var actual = breakpoint.actual;
        if (actual && left[actual.path + ":" + (matchLine ? 
          (!isNaN(breakpoint.moved) ? breakpoint.moved : actual.line) : "")])
            return true;
        
        return false;
    };
    
    module.exports = Breakpoint;
    
});