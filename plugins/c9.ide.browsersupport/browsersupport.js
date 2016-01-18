define(function(require, exports, module) {
    "use strict";
    
    main.consumes = ["Plugin"];
    main.provides = ["browsersupport"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        
        require("ace/lib/es5-shim");
        require("ace/lib/es6-shim");
        var useragent = require("ace/lib/useragent");
        var dom = require("ace/lib/dom");
        
        if (useragent.isGecko)
            dom.addCssClass(document.body, "ua_gecko");
        else if (useragent.isWebkit)
            dom.addCssClass(document.body, "ua_webkit");
        else if (useragent.isIE)
            dom.addCssClass(document.body, "ua_ie");

        function getIEVersion() {
            return useragent.isIE;
        }

        var plugin = new Plugin("Ajax.org", main.consumes);
        
        /**
         * Browser compatibility support.
         */
        plugin.freezePublicAPI({
            /**
             * Gets Internet Explorer's major version, e.g. 10,
             * or returns null if a different browser is used.
             * 
             * @return {Number}
             */
            getIEVersion: getIEVersion
        });
        register(null, { browsersupport: plugin });
    }
});

// Support __defineGetter__ et al. on IE9
// (always triggers when packed)
try {
   if (!Object.prototype.__defineGetter__ &&
        Object.defineProperty({},"x",{get: function(){return true}}).x) {
        
        // Setter    
        Object.defineProperty(
            Object.prototype, 
            "__defineSetter__",
            {
                enumerable: false, 
                configurable: true,
                value: function(name,func) {
                    Object.defineProperty(this,name,{set:func,enumerable: true,configurable: true});
                    
                    // Adding the property to the list (for __lookupSetter__)
                    if (!this.setters) this.setters = {};
                    this.setters[name] = func;
                }
            }
        );
        
        // Lookupsetter
        Object.defineProperty(
            Object.prototype, 
            "__lookupSetter__",
            {
                enumerable: false, 
                configurable: true,
                value: function(name) {
                    if (!this.setters) return false;
                    return this.setters[name];
                }
            }
        );
        
        // Getter    
        Object.defineProperty(
            Object.prototype, 
            "__defineGetter__",
            {
                enumerable: false, 
                configurable: true,
                value: function(name,func) {
                    Object.defineProperty(this,name,{get:func,enumerable: true,configurable: true});
                    
                    // Adding the property to the list (for __lookupSetter__)
                    if (!this.getters) this.getters = {};
                    this.getters[name] = func;
                }
            }
        );
        
        // Lookupgetter
        Object.defineProperty(
            Object.prototype, 
            "__lookupGetter__",
            {
                enumerable: false, 
                configurable: true,
                value: function(name) {
                    if (!this.getters) return false;
                    return this.getters[name];
                }
            }
        );
        
   }
} catch (defPropException) {
   // Forget about it
}


