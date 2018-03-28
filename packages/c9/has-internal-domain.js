if (typeof define === "undefined") {		
    var define = function(fn) {		
        fn(require, exports, module);		
    };		
}

define(function(require, exports, module) {
    "use strict";

    var internalDomain = ['c9.io', 'cloud9beta.com'];

    function hasInternalDomain(email) {
        if (!email) return false;
        var emailDomain = email.split("@").pop();
        return internalDomain.indexOf(emailDomain) != -1;
    }

    module.exports = hasInternalDomain;
});