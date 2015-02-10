"use strict";

var http = require("http");

module.exports = function(options, imports, register) {
    
    imports.connect.addResponseMethod("redirect", function(location) {
        this.writeHead(302, {Location: location});
        this.end("");
    });
    imports.connect.addResponseMethod("returnTo", function(req, defaultReturn) {
        var url = defaultReturn || "/";        
        if (req.session && req.session.returnTo) {
            url = req.session.returnTo;
            delete req.session.returnTo;
        }
        
        this.redirect(url);
    });
    imports.connect.addResponseMethod("moved", function(location) {
        this.writeHead(301, {Location: location});
        this.end("");
    });
    
    register(null, {
        "connect.redirect": {}
    });
};
