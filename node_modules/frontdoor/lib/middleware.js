"use strict";
 
var error = require("http-error");
 
exports.jsonWriter = function() {
    return function(req, res, next) {
        if (res.json) return next();
        
        res.json = function(json, headers, code) {
            var data;
            try {
                data = JSON.stringify(json);
            } catch(e) {
                console.error(e);
                return next(new error.InternalServerError("Could not stringify JSON"));
            }
             
            if (req.parsedUrl && req.parsedUrl.query.jsonp)
                data = req.parsedUrl.query.jsonp + "(" + data + ")";
             
            headers = headers || {};
            headers["Content-Type"] = "application/json";
            res.writeHead(code || 200, headers);
            res.end(data);
        };
         
        next();
    };
};
 
exports.describeApi = function(root) {
    return function(req, res, next) {
        res.json(root.describe());
    };
};