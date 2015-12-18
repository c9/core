/**
 * Dummy implementation of analytics.
 */
define(function(require, exports, module) {
    "use strict";

    main.consumes = ["Plugin"];
    main.provides = ["c9.analytics"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var plugin = new Plugin("Ajax.org", main.consumes);

        plugin.freezePublicAPI({
            log: function() {},
            updateTraits: function() {},
            alias: function() {},
            identify: function() {},
            track: function() {},
            page: function() {}
        });

        register(null, {
            "c9.analytics": plugin
        });
    }
});
