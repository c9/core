define(function(require, exports, module) {
    "use strict";
    
    main.consumes = ["Plugin"];
    main.provides = ["linked-services"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var plugin = new Plugin("Ajax.org", main.consumes);
        
        function getServices(callback) {
            setTimeout(function() {
                callback(null, options.services || {
                    "github": {
                        "visible": true,
                        "hasRepositories": true,
                        "service": "github",
                        "title": "GitHub",
                        "accounts": [],
                        "maxAccounts": 1,
                        "maxProjects": 100
                    }
                });
            }, 0);
        }
        
        function getAccessToken(serviceId, callback) {
            callback(new Error("Not Implemented"));
        }

        /**
         * Provides client-side Salesforce API access
         * @singleton
         **/
        plugin.freezePublicAPI({
            getServices: getServices,
            getAccessToken: getAccessToken
        });

        register(null, {
            "linked-services": plugin
        });
    }
});
