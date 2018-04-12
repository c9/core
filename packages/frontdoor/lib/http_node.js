"use strict";

var http = require("http");
var https = require("https");
var qs = require("querystring");
var error = require("http-error");
var URL = require("url");
var debug = require("debug")("http:client");

module.exports = request;

function request(url, options, callback) {
    if (!callback)
        return request(url, {}, options);
        
    if (typeof options == "string")
        return request(url, {method: options}, callback);
    
    var method = options.method || "GET";
    var headers = options.headers || {};
    var body = options.body || "";
    var contentType = options.contentType 
        || "application/x-www-form-urlencoded; charset=UTF-8";
    var timeout = options.hasOwnProperty("timeout") ? options.timeout : 10000;
    var parsedUrl = parseUrl(url, options.query);
    
    if (typeof body == "object") {
        if (contentType.indexOf("application/json") === 0) {
            try {
                body = JSON.stringify(body);
            } catch(e) {
                return done(new Error("Could not serialize body as json"));
            }
        }
        if (contentType.indexOf("application/x-www-form-urlencoded") === 0) {
            body = qs.stringify(body);
        }
        else {
            body = body.toString();
        }
    }
    
    var isHttps = parsedUrl.protocol == "https:";
    var proto = isHttps ? https : http;
    var reqOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.path,
        method: method,
        headers: {
            "Content-Type": contentType,
            "Content-Length": body.length
        }
    };
    
    if (Object.keys(parsedUrl.query).length)
        reqOptions.path += "?" + qs.stringify(parsedUrl.query);
    
    if (options.username)
        reqOptions.auth = options.username + ":" + options.password;

    for (var header in headers)
        reqOptions.headers[header] = headers[header];
        
    // TODO
    if (options.progress) {}
    
    var req = proto.request(reqOptions, function(res) {
        var responseText = "";
        
        res.on("data", function(chunk) {
            responseText += chunk.toString();
        });

        res.on("end", function(chunk) {
            if (chunk) 
                responseText += chunk.toString();
            var status = res.statusCode;
            
            var fields = {
                body: responseText,
                status: status,
                headers: res.headers
            };
            
            var data;
            switch (options.overrideMimeType || res.headers["content-type"]) {
                case "application/json":
                    try {
                        data = JSON.parse(responseText);
                    } catch (e) {
                        return done(e); 
                    }
                    break;
                default:
                    data = responseText;
            }

            var err;
            if (status > 299)
                err = new error.HttpError(responseText, status);

            if (debug.enabled) {
                var req = "REQ: " + JSON.stringify(body || {});
                if (err) {
                    debug(
                        "ERROR", 
                        res.statusCode, reqOptions.method, 
                        URL.format(parsedUrl), 
                        req, "RES", data, err
                    );
                } 
                else {
                    debug(
                        res.statusCode, reqOptions.method, 
                        URL.format(parsedUrl), 
                        req, "RES", data
                    );
                }
            }

            done(err, data, fields);
        });
    });
    
    var timedout = false;
    if (timeout) {
        req.setTimeout(timeout, function() {
            timedout = true;
            var err = new Error("Timeout");
            err.code = "ETIMEOUT";
            done(err);
        });
    }
    
    req.end(body);
    
    req.on("error", function(e) {
        if (debug.enabled) {
            debug(
                "ERROR", 
                reqOptions.method, 
                URL.format(parsedUrl), 
                e
            );
        }

        done(e);
    }); 

    var called = false;
    function done(err, data, res) {
        if (called) return;
        called = true;
        callback(err, data, res);
    }
    
    return req;
}

function parseUrl(url, query) {
    query = query || {};
    var parsedUrl = URL.parse(url, true);
    for (var key in query)
        parsedUrl.query[key] = query[key];

    delete parsedUrl.search;
    return parsedUrl;
}