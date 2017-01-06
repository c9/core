/**
 * Frame class for the Cloud9 Debugger.
 * @class debugger.Frame
 * @extends debugger.Data
 */
/**
 * @property {"frame"} tagName  The tag name used for xml serialization of this object.
 * @readonly
 */
/**
 * @property {String} id  The unique id that identifies this frame.
 */
/**
 * @property {Number} index  The index of this frame (in a stack trace).
 */
/**
 * @property {Boolean} istop  Specifies whether this frame is the frame where the debugger is stopped at.
 */
/**
 * @property {String} name  The name of this frame.
 */
/**
 * @property {Number} column  The column where this frame begins.
 */
/**
 * @property {String} ref  The unique reference that identifies this frame.
 * @ignore
 */
/**
 * @property {Number} line  The line where this frame begins.
 */
/**
 * @property {String} path  The path of the file where this frame begins.
 */
/**
 * @property {String} sourceId  The id of the source file related to this frame.
 */
/**
 * @property {Object} sourcemap       Specifies the location of the frame in a source map.
 * @property {Number} sourcemap.line  The line where this frame is set in the source file.
 * @property {String} sourcemap.path  The path of the source file where this frame is set.
 */
/**
 * @property {String} thread  The ID representing the thread that contains this frame.
 */
/**
 * @property {debugger.Variable[]} variables  The local variables in this frame.
 */
/**
 * @property {debugger.Scope[]} scopes  The scopes of this frame.
 */
/**
 * Finds a {@link debugger.Scope} object related to this frame.
 * @method findScope
 * @param {Number} index  The index of the scope to find.
 * @return {debugger.Scope}
 */
/**
 * Finds a {@link debugger.Variable} object related to this frame.
 * @method findVariable
 * @param {String} ref      The {@link debugger.Variable#ref} property of 
 *   the variable to find.
 * @param {String} name     The name of the variable to find.
 * @param {Array}  parents  Pass an empty array to receive all the parent 
 *   scopes/variables that lead to the variable that is found.
 * @return {debugger.Variable}
 */
define(function(require, exports, module) {
    
    var Data = require("./data");
    var Scope = require("./scope");
    
    function Frame(options) {
        this.data = options || {};
        this.tagName = "frame";
    }
    
    Frame.prototype = new Data(
        [
            "id", "index", "name", "column", "ref", "line", 
            "path", "sourceId", "sourcemap", "thread", "istop"
        ], 
        ["variables", "scopes"]
    );
    
    Frame.prototype.findScope = function(index) {
        if (typeof index == "object")
            index = index.getAttribute("index");
        
        var scopes = this.data.scopes || [];
        for (var i = 0, l = scopes.length; i < l; i++) {
            if (scopes[i].index == index)
                return scopes[i];
        }
        
        return false;
    };
        
    Frame.prototype.findVariable = function(ref, name, parents) {
        var result = Scope.prototype.findVariable.apply(this, arguments);
        if (result)
            return result;
            
        var scopes = this.scopes;
        for (var i = 0, l = scopes.length; i < l; i++) {
            if (scopes[i].variables) {
                result = scopes[i].findVariable(ref, name, parents);
                if (result) {
                    parents && parents.push(scopes[i]);
                    return result;
                }
            }
        }
        return false;
    };
    
    // @todo maybe check ref?
    Frame.prototype.equals = function(frame) {
        if (!frame) return false;
        return this.data.id == frame.id;// && this.data.path && frame.path;
    };
    
    module.exports = Frame;
    
});