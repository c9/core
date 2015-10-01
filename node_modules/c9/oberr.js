define(function(require, exports, module) {
    
    /** 
     * Turns a JS Error into a proper object that can be stringified 
     * https://github.com/timjrobinson/oberr for more information
    **/
    return function oberr(err) {
        var ob = {};
        Object.getOwnPropertyNames(err).forEach(function(key) {
            ob[key] = err[key];
        });
        return ob;
    };
        
});