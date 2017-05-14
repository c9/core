"use strict";

module.exports = function(options, imports, register) {
    register(null, {
        "connect.cors": {
            cors: cors
        }
    });
};

function cors(origin, options) {
    return function(req, res, next) {
        options = options || {};
        var whitelist = options.whitelist || [];
        var writeHead = res.writeHead;

        res.writeHead = function(status, headers) {
            headers = headers || {};
    
            for (var key in headers)
                if (key.toLowerCase().indexOf("access-control") === 0)
                    delete(headers[key]);

            if (req.headers.origin) {
                var hasHostName = whitelist.some(function(hostname) {
                    return req.headers.origin.match(new RegExp(hostname.replace(".", "\\.") + "$"));
                });
                
                if (whitelist.length && !hasHostName)
                    return writeHead.call(res, status, headers);
                    
                if (hasHostName)
                    origin = req.headers.origin;
            }
                
            headers["Access-Control-Allow-Origin"] = origin;
            headers["Access-Control-Allow-Methods"] = options.methods || "GET, OPTIONS";
            if (options.headers)
                headers["Access-Control-Allow-Headers"] = options.headers.join(", ");
            if (options.exposeHeaders)
                headers["Access-Control-Expose-Headers"] = options.exposeHeaders.join(", ");
            headers["Access-Control-Max-Age"] = options.maxAge || 100 * 24 * 60 * 60;
            if (origin !== "*")
                headers["Access-Control-Allow-Credentials"] = "true";
            
            return writeHead.call(res, status, headers);
        };
        
        if (req.method == "OPTIONS") {
            res.writeHead(200);
            res.end();
            return;
        }
    
        next();
    };
}