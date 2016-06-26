"use strict";

main.consumes = [];
main.provides = ["http"];

module.exports = main;
    
function main(options, imports, register) {
    var request = require("frontdoor/lib/http_node");
    
    /**
     * Simple API for performing HTTP requests.
     * 
     * Example:
     * 
     *     http.request("http://www.c9.io", function(err, data){
     *         if (err) throw err;
     *         console.log(data);
     *     });
     * 
     * @singleton
     */
    var plugin = {
        /**
         * Performs an HTTP request
         * 
         * @param {String}   url                         Target URL for the HTTP request
         * @param {Object}   [options]                   Request options
         * @param {String}   [options.method]            HTTP method (default=GET)
         * @param {Object}   [options.query]             URL query parameters as an object
         * @param {String}   [options.body]              HTTP body for PUT and POST
         * @param {Object}   [options.headers]           Request headers
         * @param {Object}   [options.username]          Basic auth username
         * @param {Object}   [options.password]          Basic auth password
         * @param {Number}   [options.timeout]           Timeout in ms (default=10000)
         * @param {String}   [options.contentType='application/x-www-form-urlencoded; charset=UTF-8']    Content type of sent data 
         * @param {String}   [options.overrideMimeType]  Overrides the MIME type returned by the server
         * @param {Function} [options.progress]          Progress event handler
         * @param {Function} [options.progress.loaded]   The amount of bytes downloaded/uploaded.
         * @param {Function} [options.progress.total]    The total amount of bytes to download/upload.
         * @param {Function} callback                    Called when the request returns.
         * @param {Error}    callback.err                Error object if an error occured.
         * @param {String}   callback.data               The data received.
         * @param {Object}   callback.res           
         * @param {String}   callback.res.body           The body of the response message.
         * @param {Number}   callback.res.status         The status of the response message.
         * @param {Object}   callback.res.headers        The headers of the response message.
         */
        request: request
    };
    
    register(null, {
        http: plugin
    });
}