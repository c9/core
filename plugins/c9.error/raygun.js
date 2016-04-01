"use strict";

var raygun = require("raygun");
var assert = require("assert");

plugin.consumes = ["graceful-shutdown"];
plugin.provides = ["raygun"];

module.exports = plugin;

function plugin(options, imports, register) {
    assert(options.keys, "Option 'keys' is required");
    assert(options.keys.error, "Option 'keys.error' is required");
    assert(options.keys.warning, "Option 'keys.warning' is required");
    assert(options.version, "Option 'version' is required");
    assert(options.revision, "Option 'revision' is required");
    assert(options.app, "Option 'app' is required");

    var graceful = imports["graceful-shutdown"];

    var customData = {
        app: options.app,
        server: true,
        revision: options.revision
    };
    
    var clients = {
        error: new raygun.Client().init({ apiKey: options.keys.error, useHumanStringForObject: false }),
        warning: new raygun.Client().init({ apiKey: options.keys.warning, useHumanStringForObject: false })
    };
    
    var customClients = options.customClients || {};
    for (var client in customClients) {
        clients[client] = new raygun.Client().init({ apiKey: customClients[client] });
    }
    
    for (var client in clients) {
        client = clients[client];
        client._send = client.send;
        client.send = function(exception, customData, callback, request) {
            if (!exception.stack)
                exception = new Error(exception.message || exception);
                
            return this._send.apply(this, arguments);
        };
        client.setVersion(options.version + ".0");
    }
    
    graceful.on("destroy", function(err) {
        if (!err) return graceful.emit("destroyComplete");
        console.error(err);
        clients.error.send(err, customData, function(response) {
            console.error("Raygun server response:", response.statusCode);
            graceful.emit("destroyComplete");
        });
    });

    register(null, {
        raygun: {
            Client: clients.error,
            errorClient: clients.error,
            warningClient: clients.warning,
            customClient: function(name) {
                return clients[name];
            },
            customData: customData
        }
    });
}
