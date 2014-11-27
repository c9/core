define(function(require, exports, module) {
    "use strict";
    
    main.consumes = ["Plugin", "auth"];
    main.provides = ["api"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var auth = imports.auth;

        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var apiUrl = options.apiUrl || "";
        var pid = options.projectId;

        /***** Methods *****/

        var REST_METHODS = ["get", "post", "put", "delete"];

        function wrapMethod(urlPrefix, method) {
            return function(url, options, callback) {
                url = apiUrl + urlPrefix + url;
                if (!callback) {
                    callback = options;
                    options = {};
                }
                var headers = options.headers = options.headers || {};
                headers.Accept = headers.Accept || "application/json";
                options.method = method;
                if (!options.timeout)
                    options.timeout = 60000;
                auth.request(url, options, function(err, data, res) {
                    if (err) {
                        err = (data && data.error) || err;
                        err.message = err.message || String(err);
                        return callback(err, data, res);
                    }
                    callback(err, data, res);
                });
            };
        }

        function apiWrapper(urlPrefix) {
            var wrappers = REST_METHODS.map(wrapMethod.bind(null, urlPrefix));
            var wrappedApi = {};
            for (var i = 0; i < wrappers.length; i++)
                wrappedApi[REST_METHODS[i]] = wrappers[i];
            return wrappedApi;
        }

        var collab = apiWrapper("/collab/" + pid + "/");
        var user = apiWrapper("/user/");
        var preview = apiWrapper("/preview/");
        var project = apiWrapper("/projects/" + pid + "/");
        var users = apiWrapper("/users/");
        var stats = apiWrapper("/stats/");
        var settings = apiWrapper("/settings/");
        var vfs = apiWrapper("/vfs/");
        
        /***** Register and define API *****/
        
        /**
         * Provides C9 API access
         * @singleton
         **/
        plugin.freezePublicAPI({
            get apiUrl() { return apiUrl; },

            collab: collab,
            user: user,
            preview: preview,
            project: project,
            users: users,
            stats: stats,
            settings: settings,
            vfs: vfs
        });

        register(null, {
            api: plugin
        });
    }
});