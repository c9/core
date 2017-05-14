var util = require("util");

exports.HttpError = function(message, code) {
    Error.call(this, message);
    //Error.captureStackTrace(this, arguments.callee);
    this.message = message;
    this.code = parseInt(code, 10);
    this.augment = null;
};
util.inherits(exports.HttpError, Error);

(function() {

    this.toString = function() {
        return this.message;
    };

    this.toJSON = function() {
        var json = {
            code: this.code,
            status: this.defaultMessage,
            message: this.message
        };
        var reserved = Object.keys(json);
        
        if (this.augment) {
            for (var name in this.augment) {
                if (reserved.indexOf(name) > -1)
                    continue;
                json[name] = this.augment[name];
            }
        }
        
        reserved.push("augment");
        for (var name in this) {
            if (this.hasOwnProperty(name)) {
                if (reserved.indexOf(name) > -1)
                    continue;
                json[name] = this[name];
            }
        }
        return json;
    };

}).call(exports.HttpError.prototype);


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

for (var status in statusCodes) {
    var defaultMsg = statusCodes[status];

    var error = (function(defaultMsg, status) {
        return function(msg) {
            if(!(this instanceof Error)) 
                throw new Error("Must be called as constructor");

            this.defaultMessage = defaultMsg;
            exports.HttpError.call(this, msg || status + ": " + defaultMsg, status);

            if (status >= 500)
                Error.captureStackTrace(this, arguments.callee);
        };
    })(defaultMsg, status);

    util.inherits(error, exports.HttpError);

    var className = toCamelCase(defaultMsg);
    exports[className] = error;
    exports[status] = error;
}

function toCamelCase(str) {
    return str.toLowerCase().replace(/'/g, '').replace(/\-/g, ' ').replace(/(?:(^.)|(\s+.))/g, function(match) {
        return match.charAt(match.length-1).toUpperCase();
    });
}
