if (typeof define === "undefined") {		
    var define = function(fn) {		
        fn(require, exports, module);		
    };		
}

define(function(require, exports, module) {
    "use strict";

    var internalTestNames = ["c9test", "c9 test"];
    var regex = new RegExp("^(" + internalTestNames.join("|") + ")+");

    function hasInternalTestName(name) {
        if (!name) return false;
        
        return regex.test(name);
    }

    module.exports = hasInternalTestName;
});