define(function(require, exports, module) {
    "use strict";

    var assert = require("assert");
    var format = require("util").format;
    var join = require("path").join;
    
    module.exports = createClient;
    createClient.buildApi = buildApi;
    
    function createClient(endpoint, options, callback) {
        if (!callback)
            return createClient(endpoint, {}, options);
    
        var baseUrl = options.baseUrl || endpoint.split("/").slice(0, -1).join("/");
        var request = options.request || require("./http_node" + "" /* hide this module from the packager */);
        
        function rest(path, requestOptions, callback) {
            var url =  baseUrl + path;
            if (!requestOptions.query) requestOptions.query = {};
            if (options.accessToken)
                requestOptions.query.access_token = options.accessToken;
                
            if (options.username) {
                requestOptions.username = options.username;
                requestOptions.password = options.password;
            }
            
            request(url, requestOptions, callback);
        }
        
        request(endpoint, {}, function(err, description, data) {
            if (err) return callback(err);
            
            var client = buildApi(description, rest);
            callback(null, client);
        });
    }
    
    function buildApi(description, rest) {
        var api = createSection(description, rest, "/");
        return api;
    }
    
    function createSection(description, rest, path) {
        var section = {};
        if (description.sections) {
            description.sections.forEach(function(sectionDesc) {
                assert(sectionDesc.name, "API section has no name");
                assert(!section[sectionDesc.name], format("Section with name '%s' already exists", sectionDesc.name));
                console.log("section", sectionDesc.name)
                section[sectionDesc.name] = createSection(sectionDesc, rest, join(path, sectionDesc.name));
            });
        }
        
        if (description.routes) {
            description.routes.forEach(function(route) {
                var name = route.name || route.method;
                assert(!section[name], format("Route with name '%s' already exists", name));
                
                section[name] = createRoute(route, rest, path);
            });
        }
        
        return section;
    }
    
    function createRoute(route, rest, path) {
        return function request(options, requestOptions, callback) {
            if (arguments.length == 1) return request({}, {}, arguments[0]);
            if (arguments.length == 2) return request(arguments[0], {}, arguments[1]);
            
            // check for required arguments
            for (var key in route.params) {
                var param = route.params[key];
                if (!param.optional && !options.hasOwnProperty(key)) {
                    return callback(new TypeError(format("Missing required parameter '%s'", key)));
                }
            }
            
            // check for additional arguments
            for (var key in options) {
                if (!route.params[key]) {
                    return callback(new TypeError(format("Argument '%s' is not supported by the API", key)));
                }
            }
    
            // TODO verify types
            // TODO serialize arguments
    
            // fill in parameters
            path = join(path, route.route.replace(/\/:([\w\.\-\_]+)(\*?)/g, function(match, key, wildcard) {
                if (wildcard) return "";
                return options[key].toString();
            }));
    
            // populate query string
            var query = {};
            for (var key in route.params) {
                if (route.params[key].source !== "query") continue;
                if (!options.hasOwnProperty(key)) continue;
                
                query[key] = options[key];
            }
            // options passed in have higher prio
            for (var key in requestOptions.query || {}) {
                query[key] = requestOptions.query[key];
            }
    
            // populate body
            var body = {};
            for (var key in route.params) {
                if (route.params[key].source !== "body") continue;
                if (!options.hasOwnProperty(key)) continue;
                
                body[key] = options[key];
            }
            
            requestOptions.contentType = "application/json";
            requestOptions.query = query;
            if (Object.keys(body).length)
                requestOptions.body = body;
            
            // do request
            rest(path, requestOptions, callback);
        };
    }
});