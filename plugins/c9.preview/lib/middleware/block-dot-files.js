"use strict";

var HttpError = require("http-error");

function isDotFile(path){
    return /^[.]/.test(path)    ;
}

module.exports = function blockDotFiles(req, res, next){
    if (!req.params.path) return next();
    
    var pathParts = req.params.path.split("/");
    
    if (pathParts.some(isDotFile))
        return next(new HttpError.NotFound("File does not exist"));
        
    next();
};
