"use strict";

var Path = require("path");
var error = require("http-error");

module.exports = function sanitzePreviewPath(req, res, next) {
    
    var normalized;
    try {
        normalized = Path.normalize(decodeURIComponent(req.params.path));
    } catch(e) {
        return next(new error.BadRequest("URI malformed"));
    }

    // N.B. Path.normalize does not strip away when the path starts with "../"
    if (normalized)
        normalized = normalized.replace(/[.]{2}\//g, "") || "/";

    req.params.path = normalized;

    next();
};
