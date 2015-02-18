"use strict";

var domain = require("domain");
var url = require("url");
var _ = require("lodash");

plugin.consumes = ["raygun", "connect", "http", "connect.remote-address"];
plugin.provides = ["raygun.connect"];

module.exports = plugin;

function plugin(options, imports, register) {
    var raygun = imports.raygun;
    var errorClient = raygun.errorClient;
    var warningClient = raygun.warningClient;
    var connect = imports.connect;
    var server = imports.http.getServer();

    errorClient.user = warningClient.user = function(req) {
        return (req && req.user) ? req.user.name : "";
    };

    connect.useStart(function(req, res, next) {
        var d = domain.create();
        d.on("error", function(err) {
            sendRequestError(errorClient, err, req);
            
            // from http://nodejs.org/api/domain.html
            try {
                // make sure we close down within 10 seconds
                console.error("Uncaught exception. Logging error and shutting down in 10 sec");
                var killtimer = setTimeout(function() {
                    console.error("Exiting after uncaught exception");
                    console.error(err.stack || err);
                    process.exit(1);
                }, 10000);
                // But don't keep the process open just for that!
                killtimer.unref();

                // stop taking new requests.
                server.close();
                next(err);
            } catch (er2) {
                console.error("Error sending 500!", er2.stack);
            }
        });
        d.add(req);
        d.add(res);
        d.run(next);
    });

    server.on("timeout", function(socket) {
        socket.destroy();

        var domain = socket._httpMessage && socket._httpMessage.domain;
        var req = domain && domain.members[0];
        if (req && req.url)
            sendRequestError(warningClient, new Error("Request timed out: " + req.url), req);
        
    });
    
    function sendRequestError(raygunClient, err, req) {
        var parsedUrl = url.parse(req.url, false);
        var ip = req.remoteAddress;

        var customData = _.clone(raygun.customData || {});
        if (req.user) {
            customData.user = {
                id: req.user.id,
                name: req.user.name,
                email: req.user.email
            };
        }
        else if (req.session) {
            customData.user = {
                id: req.session.uid
            };
        }

        raygunClient.send(err, customData, function() {}, {
            host: parsedUrl.hostname,
            path: parsedUrl.pathname,
            method: req.method,
            ip: ip,
            query: parsedUrl.query,
            headers: req.headers,
            body: req.body,
            user: req.user
        });
    }

    register(null, {"raygun.connect": {
        sendRequestError: sendRequestError
    }});
}