/**
 * Data base class for the Cloud9 Debugger.
 * @class debugger.Data
 */
/**
 * Retrieves an XML representation of this object.
 * @property {String} xml
 */
/**
 * Retrieves a json representation of thie object.
 * @property {String} json
 */
/**
 * Returns a string representation of this object (similar to {@link #xml})
 * @method toString
 * @return {String}
 */
/**
 * Determines whether the passed object is logically an exact copy.
 * @method equals
 * @param {Object} object
 */
define(function(require, exports, module) {
    
    function Data(props, sets, singletons) {
        this.$props = props || [];
        this.$sets = sets || [];
        this.$single = singletons || [];
        
        var _self = this;
        this.$props.concat(this.$sets).concat(this.$single).forEach(function(prop) {
            _self.__defineGetter__(prop, function() { 
                return this.data[prop];
            });
            _self.__defineSetter__(prop, function(v) { 
                this.data[prop] = v;
            });
        });
    }
    Data.prototype = {
        get json() {
            return this.data;
        },
        set json(v) {
            this.data = v;
        },
        toString: function() {
            return this.json;
        }
    };

    module.exports = Data;
    
});