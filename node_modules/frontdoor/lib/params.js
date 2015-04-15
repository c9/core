define(function(require, exports, module) {
    "use strict";
    
    /**
     * Handles parameter definitions. A full parameter definition is a name => value
     * object, where each value is an object with a type, source, optional and name parameter.
     */
    
    var Types = require("./types").Types;
    var RegExpType = require("./types").RegExp;
    var BuiltinTypes = new Types();
    
    var Params = {
        
        /**
         * Batch normalize params, and creates Type Objects for each param.
         */
        normalize: function(params, types, source) {
            if ( ! params ) return {};
    
            types = types || BuiltinTypes;
    
            for (var name in params) {
                var param = Params.param(params[name], name, source);
    
                param.type = types.get(param.type);
                params[name] = param;
            }
    
            return params;
        },
    
        /**
         * Create/normalize a parameter definition from one of the following
         * api's:
         * 
         * 1. A URL parameter defined as part of a path definition:
         *  - This is a single string, defaulting to a required, *string* type url param
         * 
         * 2. A url parameter following the { key: value } convention
         *  - The key is the name of the path/body/query part, value is a type
         *  - Values that are strings must be one of the builtin types
         *  - Values may be a RegExp, that will be converted to RegExpType
         * 
         * 3. Fully defined param spec with valid values for type and source.
         * 
         * @param String|Object def     A param object or type string, or name.
         * @param String        name    (Optional) param name. 
         *                              When omitted, the first argument will be the name
         * @param String        source  (Optional) param source. Must be url, body or query
         * 
         * @return Object param         Full param object
         */
    
        param: function(def, name, source) {
            var param = def;

            // Singe edge case for implicit param generation from the url pathparts,
            // where the pathpart is not defined in params definition.
            if (typeof def === 'string' && !name) {
                return {
                    source: 'url',
                    optional: false,
                    type: BuiltinTypes.get('string'),
                };
            }
            
            if (typeof def === 'string' || def instanceof RegExp) {
                param = {
                    name: name,
                    type: def
                };
            }
    
            param.optional = !!param.optional;
            param.source = param.source || source || "body";
            param.type = param.type || "string";
    
            // allow regular expressions as types
            if (param.type instanceof RegExp)
                param.type = new RegExpType(param.type);
    

            if ( !/^body|url|query$/.test(param.source)) {
                throw new Error("parameter source muste be 'url', 'query' or 'body'");
            }
    
            return param;
        }
    };
    
    module.exports = Params;
});