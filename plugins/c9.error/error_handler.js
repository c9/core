"use strict";

var errors = require("http-error");
var EventEmitter = require("events").EventEmitter;

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

var errorPages = {
    404: 1,
    401: 1,
    500: 1,
    503: 1
};

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

var NICE_USER_ERROR_MSG = "Something went wrong. Please retry in a few minutes and contact support if it continues to occur";

function plugin(options, imports, register) {
    var connect = imports.connect;
    
    var showStackTrace = false;

    var frontdoor = require("frontdoor");
    var statics = imports["connect.static"];
    var emitter = new EventEmitter();

    function isDev(mode) {
        return /^(onlinedev|devel)$/.test(mode);
    }

    // serve index.html
    statics.addStatics([{
        path: __dirname + "/www",
        mount: "/error_handler"
    }]);

    // make sure res.json is available
    connect.useStart(frontdoor.middleware.jsonWriter());

    function sanitizeErrorCode(code) {
        code = parseInt(code, 10);

        if (isNaN(code)) return 500;
        if (code < 400) return 500;
        
        return code;
    }

    connect.useError(function(err, req, res, next) {
        if (typeof err == "string")
            err = new errors.InternalServerError(err);

        var statusCode = sanitizeErrorCode(err.code || err.status || res.statusCode);
        var stack;

        if (isDev(options.mode))
            stack = err.stack || err.message || err.toString();
            
        var accept = req.headers.accept || '';

        if (statusCode == 500) {
            console.error(err && err.stack);
            emitter.emit("internalServerError", {
                err: err,
                req: req
            });
        }

        if (/json/.test(accept)) {
            var error = {
                code: statusCode,
                hostname: options.hostname,
                scope: options.scope,
                stack: stack
            };
            
            var allowedErrorKeys = [
                "message", "projectState", "premium", "retryIn", "progress",
                "oldHost", "blocked", "className", "errors", "subtype",
                "fatal", "ignore"
            ];
            
            allowedErrorKeys.forEach(function(key) {
                if (err.hasOwnProperty(key))
                    error[key] = err[key];
            });

            try {
                JSON.stringify(error);
            }
            catch (e) {
                console.error("Cannot send error as JSON: ", error);
                error.message = NICE_USER_ERROR_MSG;
                error.scope = null;
            }

            return res.json({
                error: error
            }, null, statusCode);
        }

        var path = errorPages[statusCode] ? __dirname + "/views/error-" + statusCode + ".html.ejs" : __dirname + "/views/error.html.ejs";

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        
        res.render(path, {
            title: statusCodes[statusCode] || NICE_USER_ERROR_MSG,
            scope: options.scope || "",
            showStackTrace: showStackTrace,
            stack: stack,
            statusCode: statusCode,
            error: err.toString()
        }, next);
    });

    register(null, {
        "connect.error": {
            on: emitter.on.bind(emitter)
        }
    });
}
