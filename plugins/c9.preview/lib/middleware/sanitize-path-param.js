"use strict";

var Path = require("path");

module.exports = function sanitzePreviewPath(req, res, next) {
    var normalized = Path.normalize(decodeURIComponent(req.params.path));

    // N.B. Path.normalize does not strip away when the path starts with "../"
    if (normalized)
        normalized = normalized.replace(/[.]{2}\//g, "") || "/";

    req.params.path = normalized;

    next();
};
