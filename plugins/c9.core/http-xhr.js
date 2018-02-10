define(function(require, module, exports) {
    "use strict";
    
    var XHR = XMLHttpRequest; // Grab constructor early so it can't be spoofed
    
    main.consumes = ["Plugin"];
    main.provides = ["http"];
    return main;

    function main(options, imports, register) {
        var URL = require("url");
        var qs = require("querystring");
        
        var plugin = new imports.Plugin("Ajax.org", main.consumes);
        var debug = options.debug !== false;
        
        function request(url, options, callback) {
            if (!callback)
                return request(url, {}, options);
                
            if (typeof options == "string")
                return request(url, { method: options }, callback);
            
            var method = options.method || "GET";
            var headers = options.headers || {};
            var body = options.body || "";
            var contentType = options.contentType 
                || "application/x-www-form-urlencoded; charset=UTF-8";
            var timeout = options.hasOwnProperty("timeout") ? options.timeout : 10000;
            var async = options.sync !== true;
            var parsedUrl = parseUrl(url, options.query);
            if (contentType === "application/json")
                headers.Accept = headers.Accept || "application/json";
            
            if (options.username) {
                headers.Authorization = "Basic " + btoa(options.username + ":" + options.password);
            }
            
            var xhr = new XHR();
            
            if (options.overrideMimeType)
                xhr.overrideMimeType = options.overrideMimeType;
            
            // From MDN: Note: You need to add the event listeners before 
            // calling open() on the request.  Otherwise the progress events 
            // will not fire.
            if (options.progress) {
                var obj = method == "PUT" ? xhr.upload : xhr;
                obj.onprogress = function(e) {
                    if (e.lengthComputable)
                        options.progress(e.loaded, e.total);
                };
            }
            
            xhr.open(method, URL.format(parsedUrl), async);
            headers["Content-Type"] = contentType;
            for (var header in headers)
                xhr.setRequestHeader(header, headers[header]);
            
            // encode body
            if (typeof body == "object") {
                if (contentType.indexOf("application/json") === 0) {
                    try {
                        body = JSON.stringify(body);
                    } catch (e) {
                        return done(new Error("Could not serialize body as json"));
                    }
                }
                else if (contentType.indexOf("application/x-www-form-urlencoded") === 0) {
                    body = qs.stringify(body);
                }
                else if (["[object File]", "[object Blob]"].indexOf(Object.prototype.toString.call(body)) > -1) {
                    // pass as is
                    xhr.overrideMimeType = body.type;
                }
                else {
                    body = body.toString();
                }
            }
            
            if (options.withCredentials) {
                xhr.withCredentials = true;
            }
            
            var timer;
            if (timeout) {
                timer = setTimeout(function() {
                    xhr.abort();
                    var err = new Error("Timeout");
                    err.code = "ETIMEOUT";
                    err.data = { url: url, query: options.query, timeout: timeout };
                    done(err);
                }, timeout);
            }
            
            xhr.send(body || "");
            
            var abort = xhr.abort;
            xhr.abort = function() {
                clearTimeout(timer);
                abort.call(xhr);
            };
            
            xhr.onload = function(e) {
                var res = {
                    body: xhr.responseText,
                    status: xhr.status,
                    headers: parseHeaders(xhr.getAllResponseHeaders()),
                    $reqHeaders: headers // TODO remove when bug in readFileWithMetadata is fixed 
                };
                
                var data = xhr.responseText;
                var contentType = options.overrideMimeType || res.headers["content-type"] || "";
                if (contentType.indexOf("application/json") === 0) {
                    try {
                        data = JSON.parse(data);
                    } catch (e) {
                        return done(new Error("JSON parsing error"));
                    }
                }
                
                if (xhr.status > 299 || res.headers["content-type"] == "text/x-error") {
                    var err = new Error(xhr.responseText);
                    err.code = xhr.status;
                    if (debug && xhr.status > 299)
                        console.error("HTTP error " + xhr.status + ": " + xhr.responseText);
                    return done(err, data, res);
                }
                
                done(null, data, res);
            };
            
            xhr.onerror = function(e) {
                // No useful information in this object. Possibly CORS error if code was 0.
                var code = e.target.status;
                var err = new Error("Failed to retrieve resource from " + parsedUrl.href + " with code " + code);
                err.cause = e;
                err.code = code;
                return done(err);
            };

            var called = false;
            function done(err, data, res) {
                timer && clearTimeout(timer);
                if (called) return;
                called = true;
                callback(err, data, res);
            }
            
            return xhr;
        }
        
        var callbackId = 1;
        function jsonP(url, options, callback) {
            if (!callback) return jsonP(url, {}, options);
            
            var cbName = "__josnpcallback" + callbackId++;
            var callbackParam = options.callbackParam || "callback";

            var parsedUrl = parseUrl(url, options.query);
            parsedUrl.query[callbackParam] = cbName;

            window[cbName] = function(json) {
                delete window.cbName;
                callback(json);  
            };
            
            var head = document.getElementsByTagName("head")[0] || document.documentElement;
            var s = document.createElement('script');
        
            s.src = URL.format(parsedUrl);
            head.appendChild(s);
            
            s.onload = s.onreadystatechange = function(_, isAbort) {
                if (isAbort || !s.readyState || s.readyState == "loaded" || s.readyState == "complete") {
                    head.removeChild(s);
                    s = s.onload = s.onreadystatechange = null;
                }
            };
        }
        
        function parseUrl(url, query) {
            query = query || {};
            var parsedUrl = URL.parse(url, true);
            for (var key in query)
                parsedUrl.query[key] = query[key];
                
            delete parsedUrl.search;
            
            return parsedUrl;
        }
        
        function parseHeaders(headerString) {
            return headerString
                .trim() // on ie11 header string can start with single \n
                .split("\r\n")
                .reduce(function(headers, headerPair) {
                    var index = headerPair.indexOf(": ");
                    if (index > 0) {
                        var key = headerPair.substring(0, index).toLowerCase();
                        var val = headerPair.substring(index + 2);
                        headers[key] = val;
                    }
                    return headers;
                }, {});
        }
        
        /**
         * Simple API for performing HTTP requests.
         * 
         * Example:
         * 
         *     http.request("http://www.c9.io", function(err, data) {
         *         if (err) throw err;
         *         console.log(data);
         *     });
         * 
         * @singleton
         */
        plugin.freezePublicAPI({
            /**
             * Performs an HTTP request
             * 
             * @param {String}   url                         Target URL for the HTTP request
             * @param {Object}   [options]                   Request options
             * @param {String}   [options.method]            HTTP method (default=GET)
             * @param {Object}   [options.query]             URL query parameters as an object
             * @param {String|Object} [options.body]         HTTP body for PUT and POST
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
            request: request,
            
            /**
             * Performs a JSONP request 
             * 
             * @param {String} url                                 Target URL for the JSONP request
             * @param {Object} [options]                           Request options
             * @param {String} [options.callbackParam="callback"]  name of the callback query parameter
             * @param {Object} [options.query]                     URL query parameters as an object
             * @param {Function} callback                    Called when the request returns.
             * @param {Error}    callback.err                Error object if an error occured.
             * @param {String}   callback.data               The data received.
             * @param {Object}   callback.res           
             * @param {String}   callback.res.body           The body of the response message.
             * @param {Number}   callback.res.status         The status of the response message.
             */
            jsonP: jsonP
        });
        
        register(null, {
            http: plugin
        });
    }
});