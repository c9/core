define(function(require, exports, module) {
    "use strict";
    
    main.consumes = ["Plugin", "auth", "ext"];
    main.provides = ["api"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var auth = imports.auth;

        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var apiUrl = options.apiUrl || "";
        var pid = options.projectId;
        
        var BASICAUTH;
        
        // Set api to ext
        imports.ext.api = plugin;

        /***** Methods *****/

        var REST_METHODS = ["get", "post", "put", "delete", "patch"];

        function wrapMethod(urlPrefix, method) {
            return function(url, options, callback) {
                url = apiUrl + urlPrefix + url;
                if (!callback) {
                    callback = options;
                    options = {};
                }
                var headers = options.headers = options.headers || {};
                headers.Accept = headers.Accept || "application/json";
                options.method = method.toUpperCase();
                if (!options.timeout)
                    options.timeout = 60000;
                
                if (BASICAUTH) {
                    options.username = BASICAUTH[0];
                    options.password = BASICAUTH[1];
                }
                    
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
        var packages = apiWrapper("/packages/");
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
            
            get basicAuth() { throw new Error("Permission Denied"); },
            set basicAuth(v) { BASICAUTH = v.split(":"); },

            apiWrapper: apiWrapper,

            collab: collab,
            user: user,
            preview: preview,
            project: project,
            users: users,
            packages: packages,
            stats: stats,
            settings: settings,
            vfs: vfs
        });

        register(null, {
            api: plugin
        });
    }
});