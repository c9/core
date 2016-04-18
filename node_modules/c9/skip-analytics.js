if (typeof define === "undefined") {
    var define = function(fn) {
        fn(require, exports, module);
    };
}

define(function(require, exports, module) {
    "use strict";

    var hasInternalDomain = require("c9/has-internal-domain");
    var hasInternalTestName = require("c9/has-internal-test-name");

    function skipAnalytics(userId, name, email, blocked, allowUnauthorized) {
        if (!userId) return true; // users without an id should never reach the Segment library

        if (typeof userId == "object") {
            var user = userId;
            return skipAnalytics(user.id, user.name || user.username, user.email, user.blocked, name); // make it backwards compatible for the client
        }
        if (!allowUnauthorized && userId === -1) return true;
        
        if (blocked) return true;
        if (hasInternalTestName(name)) return true;
        if (hasInternalDomain(email)) return true;
        return false;
    }

    module.exports = skipAnalytics;
});