define(function(require, module, exports) {
    "use strict";

    plugin.consumes = ["auth"];
    plugin.provides = [
        "api.client"
    ];
    
    return plugin;

    function plugin(options, imports, register) {
        var assert = require("assert");
        var createClient = require("frontdoor/lib/api-client");
        
        assert(options.baseUrl, "Option 'baseUrl' is required");
        
        var auth = imports.auth;
        
        var baseUrl = options.baseUrl.replace(/\/$/, "");
        var descriptionUrl = options.descriptionUrl || baseUrl + "/api.json";
        
        createClient(descriptionUrl, {
            request: auth.request
        }, function(err, client) {
            register(err, {
                "api.client": client
            });
        });
    }
});