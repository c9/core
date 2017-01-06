/**
 * Variable class for the Cloud9 Debugger.
 * @class debugger.Variable
 * @extends debugger.Data
 */
/**
 * @property {"variable"} tagName  The tag name used for xml serialization of this object.
 * @readonly
 */
/**
 * @property {String} name  The name of this variable.
 */
/**
 * @property {String} value  The value of this variable.
 */
/**
 * @property {String} type  The data type of this variable (e.g. "number", "int32", "string")
 */
/**
 * @property {String} ref  The unique reference that identifies this variable.
 */
/**
 * @property {debugger.Scope} scope  The scope this variable belongs to.
 */
/**
 * @property {Boolean} children  Sets or retrieves whether this variable has sub properties.
 */
/**
 * @property {Boolean} error  Whether this variable represents an error state. 
 *   This can happen when an expression is evaluated, which results in an error.
 */
/**
 * @property {debugger.Variable[]} properties  The properties of this object (if any).
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
    
    function Variable(options) {
        this.data = options || {};
        this.tagName = options.tagName || "variable";
    }
    
    Variable.prototype = new Data(
        ["name", "value", "type", "ref", "scope", "children", "error"],
        ["properties"],
        ["prototype", "proto", "constructorFunction"]
    );
    
    Variable.prototype.findVariable = function(ref, name, parents) {
        if (ref && typeof ref == "object")
            ref = ref.getAttribute("ref");
        
        var vars = this.data.properties || [];
        for (var i = 0, l = vars.length; i < l; i++) {
            if (vars[i].ref == ref || vars[i].name == name) {
                parents && parents.push(this);
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
        
    Variable.prototype.equals = function(variable) {
        if (!variable) return false;
        return this.data.id == variable.id;
    };
    
    module.exports = Variable;
    
});