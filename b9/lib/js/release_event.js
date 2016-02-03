"use strict";

var request = require('request');

var DATADOG_API_KEY = '64e56d39dfdd7f2bbf06f09100d51a18';
var DATADOG_API_URL = 'https://app.datadoghq.com/api/v1/events';

module.exports = releaseEvent;

if (!module.parent) {
    var argv = process.argv;
    releaseEvent(argv[2], argv[3], argv[4], argv[5]);
}

function datadogEvent(msg, callback) {
    request.post({
        url: DATADOG_API_URL,
        qs: { api_key: DATADOG_API_KEY },
        json: msg
    }, callback);
}

function releaseEvent(application, mode, version, pattern) {
    datadogEvent({
        title: 'Release: ' + application + ' version ' + version + ' to "' + pattern + '"',
        tags: [
            'release',
            'application:' + application,
            'mode:' + mode,
            'version:' + version,
            'pattern:' + pattern
            ]
    }, function(err) {
        if (err) console.error("Error posting release event to datadog" + err.message);
    });
}