"use strict";

var errors = require("http-error");

plugin.consumes = [
    "connect",
    "connect.static", 
    "connect.render",
    "connect.render.ejs"
];
plugin.provides = [
    "connect.error"
];

module.exports = plugin;

var errorPages = { 404: 1, 401: 1, 500: 1, 503: 1};
 
var statusCodes = {
    400: "Bad Request",
    401: "Unauthorized",
    402: "Payment Required",
    403: "Forbidden",
    404: "Not Found",
    405: "Method Not Allowed",
    406: "Not Acceptable",
    407: "Proxy Authentication Required",
    408: "Request Timeout",
    409: "Conflict",
    410: "Gone",
    411: "Length Required",
    412: "Precondition Failed",
    413: "Request Entity Too Large",
    414: "Request-URI Too Long",
    415: "Unsupported Media Type",
    416: "Requested Range Not Satisfiable",
    417: "Expectation Failed",
    418: "I'm a Teapot", // (RFC 2324) http://tools.ietf.org/html/rfc2324
    420: "Enhance Your Calm", // Returned by the Twitter Search and Trends API when the client is being rate limited
    422: "Unprocessable Entity", // (WebDAV) (RFC 4918)
    423: "Locked", // (WebDAV) (RFC 4918)
    424: "Failed Dependency", // (WebDAV) (RFC 4918)
    425: "Unordered Collection", // (RFC 3648)
    426: "Upgrade Required", // (RFC 2817)
    428: "Precondition Required",
    429: "Too Many Requests", // Used for rate limiting
    431: "Request Header Fields Too Large",
    444: "No Response", // An nginx HTTP server extension. The server returns no information to the client and closes the connection (useful as a deterrent for malware).
    449: "Retry With", // A Microsoft extension. The request should be retried after performing the appropriate action.
    450: "Blocked By Windows Parental Controls",
    499: "Client Closed Request",
    500: "Internal Server Error",
    501: "Not Implemented",
    502: "Bad Gateway",
    503: "Service Unavailable",
    504: "Gateway Timeout",
    505: "HTTP Version Not Supported",
    506: "Variant Also Negotiates",
    507: "Insufficient Storage",
    508: "Loop Detected",
    509: "Bandwidth Limit Exceeded",
    510: "Not Extended",
    511: "Network Authentication Required"
};
 
function plugin(options, imports, register) {
    var connect = imports.connect;
    var showStackTrace = false;

    var frontdoor = require("frontdoor");
    var statics = imports["connect.static"];
    
    // serve index.html
    statics.addStatics([{
        path: __dirname + "/www",
        mount: "/error_handler"
    }]);

    // make sure res.json is available
    connect.useStart(frontdoor.middleware.jsonWriter());
    
    connect.useError(function(err, req, res, next) {
        if (typeof err == "string")
            err = new errors.InternalServerError(err);
            
        var statusCode = parseInt(err.code || err.status || res.statusCode, 10) || 500;

        if (statusCode < 400)
            statusCode = 500;

        if (statusCode < 100)
            statusCode = 500;

        var stack = err.stack || err.message || err.toString();
        console.error(stack);
        var accept = req.headers.accept || '';
        // html
        if (~accept.indexOf('html')) {
            stack = stack.split('\n').slice(1);
            
            var path = errorPages[statusCode]
                ? __dirname + "/views/error-" + statusCode + ".html.ejs"
                : __dirname + "/views/error.html.ejs";

            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.render(path, {
                title: statusCodes[statusCode] || "Unspecified Error",
                scope: options.scope || "",
                showStackTrace: showStackTrace,
                stack: stack,
                statusCode: statusCode,
                error: err.toString()
            }, next);
        // json
        } else if (~accept.indexOf('json')) {
            var error = {
                message: err.message,
                hostname: options.hostname,
                scope: options.scope
            };

            for (var prop in err) error[prop] = err[prop];
            try {
                JSON.stringify(error);
            } catch (e) {
                console.error("Cannot send error as JSON: ", error);
                error = "Unspecified error";
            }
            res.json({ error: error }, null, statusCode);
        // plain text
        } else {
            res.writeHead(statusCode, { 'Content-Type': 'text/plain' });
            res.end(stack);
        }
    });

    register(null, {
        "connect.error": {}
    });
}
