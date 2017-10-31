/**
 * Scope class for the Cloud9 Debugger.
 * @class debugger.Scope
 * @extends debugger.Data
 */
/**
 * @property {"scope"} tagName  The tag name used for xml serialization of this object.
 * @readonly
 */
/**
 * @property {Number} index  The index of the scope in the set of scopes (of a frame).
 */
/**
 * @property {Number} frameIndex  The index of the frame this scope belongs to.
 */
/**
 * @property {String} type  The type of scope (e.g. "global", "local").
 */
/**
 * @property {debugger.Variable[]} variables  The local variables in this scope.
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
    
    function Scope(options) {
        this.data = options || {};
        this.tagName = "scope";
    }

    Scope.prototype = new Data(
        ["index", "frameIndex", "type", "id"],
        ["variables"]
    );
    
    Scope.prototype.findVariable = function(ref, name, parents) {
        if (ref && typeof ref == "object")
            ref = ref.ref;
        
        var vars = this.data.variables || [];
        for (var i = 0, l = vars.length; i < l; i++) {
            if (vars[i].ref == ref || vars[i].name == name) {
                parents && parents.push(this.tagName == "frame" 
                    ? new Scope({ index: 0, frameIndex: this.index }) : this);
                return vars[i];
            }
            else if (vars[i].properties) {
                var result = vars[i].findVariable(ref, name, parents);
                if (result) {
                    parents && parents.push(vars[i]);
                    return result;
                }
            }
        }
        
        return false;
    };
        
    Scope.prototype.equals = function(scope) {
        if (!scope) return false;
        return this.data.index == scope.index 
          && this.data.frameIndex == scope.frameIndex;
    };
    
    module.exports = Scope;
    
});