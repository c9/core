"use strict";

var https = require("https");

var DATADOG_API_KEY = '64e56d39dfdd7f2bbf06f09100d51a18';
var DATADOG_API_URL = 'https://app.datadoghq.com';

module.exports = releaseEvent;

if (!module.parent) {
    var argv = process.argv;
    releaseEvent(argv[2], argv[3], argv[4], argv[5], function(err) {
        if (err) {
            console.error("Error posting release event to datadog" + err.message);
            process.exit(1);
        }
        process.exit(0);
    });
}

function datadogEvent(msg, callback) {
    
    var payload = JSON.stringify(msg);
    
    var req = https.request({
        hostname: "app.datadoghq.com",
        port: 443,
        path: "/api/v1/events?api_key=" + encodeURIComponent(DATADOG_API_KEY),
        method: "POST",
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Content-Length": payload.length
        }
    }, function(res) {
        if (res.statusCode >= 400)
            return callback(new Error("request failed with status code " + res.statusCode));

        callback();
    });
    
    req.on("error", function(e) {
        callback(e);
    });

    req.write(payload);
    req.end();
}

function releaseEvent(application, mode, version, pattern, callback) {
    datadogEvent({
        title: 'Release: ' + application + ' version ' + version + ' to "' + pattern + '"',
        tags: [
            'release',
            'application:' + application,
            'mode:' + mode,
            'version:' + version,
            'pattern:' + pattern
            ]
    }, callback);
}