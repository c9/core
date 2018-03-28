"use strict";

var url = require("url");
var assert = require("assert");

module.exports = function(options, imports, register) {
    assert(options.trustedDomainsRe, "Options 'trustedDomainsRe' must be set");
    
    var trustedDomainsRe = options.trustedDomainsRe;
    
    imports.connect.addResponseMethod("redirect", function(location) {
        this.setHeader("Location", location);
        this.writeHead(302);
        this.end("");
    });
    imports.connect.addResponseMethod("secureRedirect", function(location) {
        var parsedLocation = url.parse(location, false, true);

        if (!trustedDomainsRe.test(parsedLocation.host)) {
            console.log("Avoiding untrusted redirect to", parsedLocation.host)
            location = parsedLocation.path || "/";
        }
           
        this.redirect(location); 
    });
    imports.connect.addResponseMethod("returnTo", function(req, defaultReturn) {
        var url = defaultReturn || "/";
        if (req.parsedUrl && req.parsedUrl.query.redirect) {
            url = req.parsedUrl.query.redirect;
        }
        else if (req.session && req.session.returnTo) {
            url = req.session.returnTo;
            delete req.session.returnTo;
        }
        this.secureRedirect(url);
    });
    imports.connect.addResponseMethod("moved", function(location) {
        this.writeHead(301, {Location: location});
        this.end("");
    });
    
    register(null, {
        "connect.redirect": {}
    });
};
